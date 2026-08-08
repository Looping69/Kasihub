// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { identityDb, paymentsDb } from "../../resources";
import { requireProfileAccess } from "../auth/access";
import { requireInternationalKycVerified } from "../kyc/policy";
import { resolveMemberRouting } from "../shared/member-routing";
import { requireIdempotencyKey } from "../workflows/core";
import { requestHash, sha256 } from "../workflows/contracts";

const createIntentRequest = z.object({
  profileId: z.string().uuid(),
  obligationId: z.string().uuid(),
  network: z.enum(["tron", "bsc"]),
});

type PaymentIntentRow = {
  id: string;
  order_id: string;
  payer_profile_id: string;
  beneficiary_profile_id: string;
  currency: string;
  network: string;
  expected_amount: string;
  request_hash: string;
  status: string;
  expires_at: string;
  confirmed_at: string | null;
  settled_at: string | null;
  address_reference: string;
  token_contract: string;
  decimals: number;
  minimum_confirmations: number;
};

export type PaymentIntentResponse = {
  id: string;
  obligationId: string;
  payerProfileId: string;
  beneficiaryProfileId: string;
  rail: "usdt";
  currency: string;
  network: string;
  expectedAmount: string;
  receivingAddress: string;
  tokenContract: string;
  decimals: number;
  minimumConfirmations: number;
  status: string;
  expiresAt: string;
  confirmedAt: string | null;
  settledAt: string | null;
};

function mapIntent(row: PaymentIntentRow): PaymentIntentResponse {
  return {
    id: row.id,
    obligationId: row.order_id,
    payerProfileId: row.payer_profile_id,
    beneficiaryProfileId: row.beneficiary_profile_id,
    rail: "usdt",
    currency: row.currency,
    network: row.network,
    expectedAmount: row.expected_amount,
    receivingAddress: row.address_reference,
    tokenContract: row.token_contract,
    decimals: row.decimals,
    minimumConfirmations: row.minimum_confirmations,
    status: row.status,
    expiresAt: row.expires_at,
    confirmedAt: row.confirmed_at,
    settledAt: row.settled_at,
  };
}

const INTENT_SELECT = `
  SELECT i.id, i.order_id, i.payer_profile_id, i.beneficiary_profile_id,
         i.currency, i.network, i.expected_amount::text AS expected_amount,
         i.request_hash, i.status, i.expires_at, i.confirmed_at, i.settled_at,
         w.address_reference, w.token_contract, w.decimals, w.minimum_confirmations
    FROM payment_intents i
    JOIN payment_wallets w ON w.id = i.wallet_id`;

async function assertInternationalUsdtProfile(profileId: string): Promise<void> {
  const profile = await identityDb.rawQueryRow<{ citizenship_type: string | null }>(
    "SELECT citizenship_type FROM profiles WHERE id = $1",
    profileId,
  );
  if (!profile) throw APIError.notFound("Profile not found");
  let routing;
  try {
    routing = resolveMemberRouting(profile.citizenship_type);
  } catch {
    throw APIError.failedPrecondition("Profile does not have a supported payment routing classification");
  }
  if (!routing.isInternational || routing.paymentRail !== "usdt") {
    throw APIError.failedPrecondition("USDT payment intents are only available to international profiles");
  }
  await requireInternationalKycVerified(profileId);
}

async function findIntentByIdempotency(profileId: string, idempotencyKeyHash: string) {
  return paymentsDb.rawQueryRow<PaymentIntentRow>(
    `${INTENT_SELECT} WHERE i.payer_profile_id = $1 AND i.idempotency_key_hash = $2`,
    profileId,
    idempotencyKeyHash,
  );
}

async function findLiveIntent(obligationId: string) {
  return paymentsDb.rawQueryRow<PaymentIntentRow>(
    `${INTENT_SELECT}
      WHERE i.order_id = $1
        AND i.status NOT IN ('expired', 'failed', 'rejected', 'cancelled')
      LIMIT 1`,
    obligationId,
  );
}

function assertCompatibleExistingIntent(intent: PaymentIntentRow, network: string): PaymentIntentResponse {
  if (intent.network.toLowerCase() !== network.toLowerCase()) {
    throw APIError.alreadyExists("A live payment intent already exists for this obligation on another network");
  }
  return mapIntent(intent);
}

/**
 * Creates or resumes an international USDT payment intent.
 *
 * Browser authority is deliberately narrow: profile, obligation id and desired
 * supported network. Amount, token, receiving address, confirmation threshold
 * and expiry come from server-owned obligation/wallet configuration.
 */
export const createPaymentIntent = api<
  z.input<typeof createIntentRequest>,
  PaymentIntentResponse
>(
  { method: "POST", path: "/payments/intents", expose: true },
  async (req) => {
    const payload = createIntentRequest.parse(req);
    await requireProfileAccess(payload.profileId);
    await assertInternationalUsdtProfile(payload.profileId);

    const obligation = await paymentsDb.rawQueryRow<{
      id: string; payer_profile_id: string; beneficiary_profile_id: string;
      settlement_currency: string; settlement_amount: string; status: string;
    }>(
      `SELECT id, payer_profile_id, beneficiary_profile_id,
              settlement_currency, settlement_amount::text AS settlement_amount, status
         FROM payment_obligations WHERE id = $1`,
      payload.obligationId,
    );
    if (!obligation) throw APIError.notFound("Payment obligation not found");
    if (obligation.payer_profile_id !== payload.profileId) {
      throw APIError.permissionDenied("Payment obligation does not belong to this profile");
    }
    if (obligation.status !== "open") {
      throw APIError.failedPrecondition(`Payment obligation is ${obligation.status}`);
    }
    if (obligation.settlement_currency !== "USDT") {
      throw APIError.failedPrecondition("Payment obligation is not denominated in USDT");
    }

    const wallet = await paymentsDb.rawQueryRow<{
      id: string; network: string; currency: string; address_reference: string;
      token_contract: string; decimals: number; minimum_confirmations: number; intent_ttl_seconds: number | null;
    }>(
      `SELECT id, network, currency, address_reference, token_contract, decimals,
              minimum_confirmations, intent_ttl_seconds
         FROM payment_wallets
        WHERE lower(network) = lower($1) AND currency = $2 AND status = 'active'
          AND active_from <= now() AND retired_at IS NULL
        LIMIT 1`,
      payload.network,
      obligation.settlement_currency,
    );
    if (!wallet) throw APIError.failedPrecondition("No active receiving configuration exists for this network");
    if (!wallet.intent_ttl_seconds) {
      throw APIError.failedPrecondition("Receiving configuration does not define a payment intent TTL");
    }

    const idempotencyKey = requireIdempotencyKey();
    const idempotencyKeyHash = sha256(idempotencyKey);
    const requestFingerprint = requestHash({
      profileId: payload.profileId,
      obligationId: payload.obligationId,
      network: payload.network,
    });

    const idempotent = await findIntentByIdempotency(payload.profileId, idempotencyKeyHash);
    if (idempotent) {
      if (idempotent.request_hash !== requestFingerprint) {
        throw APIError.alreadyExists("Idempotency-Key was already used with a different payment intent request");
      }
      return mapIntent(idempotent);
    }

    const live = await findLiveIntent(payload.obligationId);
    if (live) return assertCompatibleExistingIntent(live, payload.network);

    const tx = await paymentsDb.begin();
    let createdIntentId: string | null = null;
    let racedIntent: PaymentIntentRow | null = null;
    try {
      await tx.rawExec("SELECT pg_advisory_xact_lock(hashtext($1))", `payment-intent:${payload.obligationId}`);
      const locked = await tx.rawQueryRow<{
        payer_profile_id: string; beneficiary_profile_id: string; settlement_currency: string;
        settlement_amount: string; status: string;
      }>(
        `SELECT payer_profile_id, beneficiary_profile_id, settlement_currency,
                settlement_amount::text AS settlement_amount, status
           FROM payment_obligations WHERE id = $1 FOR UPDATE`,
        payload.obligationId,
      );
      if (!locked || locked.payer_profile_id !== payload.profileId || locked.status !== "open") {
        throw APIError.failedPrecondition("Payment obligation is no longer available for payment");
      }

      racedIntent = await tx.rawQueryRow<PaymentIntentRow>(
        `${INTENT_SELECT}
          WHERE i.order_id = $1
            AND i.status NOT IN ('expired', 'failed', 'rejected', 'cancelled')
          LIMIT 1`,
        payload.obligationId,
      );
      if (racedIntent) {
        if (racedIntent.network.toLowerCase() !== payload.network.toLowerCase()) {
          throw APIError.alreadyExists("A live payment intent already exists for this obligation on another network");
        }
        await tx.commit();
      } else {
        createdIntentId = crypto.randomUUID();
        await tx.rawExec(
          `INSERT INTO payment_intents
            (id, order_id, payer_profile_id, beneficiary_profile_id, wallet_id, rail, currency,
             network, expected_amount, idempotency_key_hash, request_hash, status, expires_at)
           VALUES ($1, $2, $3, $4, $5, 'usdt', $6, $7, $8::numeric, $9, $10,
                   'awaiting_transfer', now() + ($11::int * interval '1 second'))`,
          createdIntentId,
          payload.obligationId,
          payload.profileId,
          locked.beneficiary_profile_id,
          wallet.id,
          locked.settlement_currency,
          wallet.network,
          locked.settlement_amount,
          idempotencyKeyHash,
          requestFingerprint,
          wallet.intent_ttl_seconds,
        );
        await tx.rawExec(
          `INSERT INTO payment_state_history
            (payment_intent_id, prior_status, new_status, actor_type, actor_reference, evidence)
           VALUES
            ($1, NULL, 'created', 'system', 'intent.create', '{}'::jsonb),
            ($1, 'created', 'awaiting_transfer', 'system', 'intent.create', $2::jsonb)`,
          createdIntentId,
          JSON.stringify({ obligationId: payload.obligationId, network: wallet.network }),
        );
        await tx.commit();
      }
    } catch (error) {
      try { await tx.rollback(); } catch { /* transaction may already be closed */ }

      // Recover cleanly from idempotency/order uniqueness races across concurrent requests.
      const racedByKey = await findIntentByIdempotency(payload.profileId, idempotencyKeyHash);
      if (racedByKey) {
        if (racedByKey.request_hash !== requestFingerprint) {
          throw APIError.alreadyExists("Idempotency-Key was already used with a different payment intent request");
        }
        return mapIntent(racedByKey);
      }
      const racedLive = await findLiveIntent(payload.obligationId);
      if (racedLive) return assertCompatibleExistingIntent(racedLive, payload.network);
      throw error;
    }

    if (racedIntent) return mapIntent(racedIntent);
    if (!createdIntentId) throw new Error("payment_intent_not_created");
    const created = await paymentsDb.rawQueryRow<PaymentIntentRow>(
      `${INTENT_SELECT} WHERE i.id = $1`,
      createdIntentId,
    );
    if (!created) throw new Error("payment_intent_not_created");
    return mapIntent(created);
  },
);

export const getPaymentIntent = api<
  { id: string },
  PaymentIntentResponse
>(
  { method: "GET", path: "/payments/intents/:id", expose: true },
  async (req) => {
    const intent = await paymentsDb.rawQueryRow<PaymentIntentRow>(
      `${INTENT_SELECT} WHERE i.id = $1`,
      req.id,
    );
    if (!intent) throw APIError.notFound("Payment intent not found");
    await requireProfileAccess(intent.payer_profile_id);
    return mapIntent(intent);
  },
);
