// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { paymentsDb } from "../../resources";
import { requireProfileAccess } from "../auth/access";
import { normalizeSubmittedTransactionHash } from "./chains/hash";
import { assertPaymentTransition, type PaymentStatus } from "./state-machine";

export interface SubmitPaymentAttemptRequest {
  intentId: string;
  profileId: string;
  transactionHash: string;
  submittedSenderWallet?: string;
}

const submitAttemptRequest = z.object({
  profileId: z.string().uuid(),
  transactionHash: z.string().min(1).max(100),
  submittedSenderWallet: z.string().max(200).optional(),
});

type AttemptRow = {
  id: string;
  payment_intent_id: string;
  transaction_hash: string;
  verification_status: string;
  created_at: string;
};

export type PaymentAttemptResponse = {
  id: string;
  paymentIntentId: string;
  transactionHash: string;
  status: string;
  createdAt: string;
};

function mapAttempt(row: AttemptRow): PaymentAttemptResponse {
  return {
    id: row.id,
    paymentIntentId: row.payment_intent_id,
    transactionHash: row.transaction_hash,
    status: row.verification_status,
    createdAt: row.created_at,
  };
}

async function findAttemptByHash(transactionHash: string) {
  return paymentsDb.rawQueryRow<AttemptRow>(
    `SELECT id, payment_intent_id, transaction_hash, verification_status, created_at
       FROM payment_attempts WHERE lower(transaction_hash) = lower($1)`,
    transactionHash,
  );
}

/**
 * Records a member-supplied transaction hash and queues it for verification.
 * Submission is not evidence of payment. Only a verifier may move the intent
 * beyond `submitted` after reading canonical blockchain data.
 */
export const submitPaymentAttempt = api<
  SubmitPaymentAttemptRequest,
  PaymentAttemptResponse
>(
  { method: "POST", path: "/payments/intents/:intentId/attempts", expose: true },
  async (req) => {
    const payload = submitAttemptRequest.parse(req);
    const intent = await paymentsDb.rawQueryRow<{
      id: string; payer_profile_id: string; status: PaymentStatus; expires_at: string; network: "tron" | "bsc";
    }>(
      "SELECT id, payer_profile_id, status, expires_at, network FROM payment_intents WHERE id = $1",
      req.intentId,
    );
    if (!intent) throw APIError.notFound("Payment intent not found");
    await requireProfileAccess(intent.payer_profile_id);
    if (intent.payer_profile_id !== payload.profileId) {
      throw APIError.permissionDenied("Payment intent does not belong to this profile");
    }

    let transactionHash: string;
    try {
      transactionHash = normalizeSubmittedTransactionHash(intent.network, payload.transactionHash);
    } catch {
      throw APIError.invalidArgument(intent.network === "bsc"
        ? "BSC transaction hash must be 0x followed by exactly 64 hexadecimal characters"
        : "TRON transaction hash must contain exactly 64 hexadecimal characters");
    }

    const existing = await findAttemptByHash(transactionHash);
    if (existing) {
      if (existing.payment_intent_id !== req.intentId) {
        throw APIError.alreadyExists("Transaction hash has already been submitted for another payment intent");
      }
      return mapAttempt(existing);
    }

    const tx = await paymentsDb.begin();
    let attemptId: string | null = null;
    let expired = false;
    try {
      const locked = await tx.rawQueryRow<{
        payer_profile_id: string; status: PaymentStatus; expires_at: string;
      }>(
        "SELECT payer_profile_id, status, expires_at FROM payment_intents WHERE id = $1 FOR UPDATE",
        req.intentId,
      );
      if (!locked || locked.payer_profile_id !== payload.profileId) {
        throw APIError.permissionDenied("Payment intent is no longer available to this profile");
      }

      if (new Date(locked.expires_at).getTime() <= Date.now() && (locked.status === "awaiting_transfer" || locked.status === "underpaid")) {
        assertPaymentTransition(locked.status, "expired");
        await tx.rawExec(
          "UPDATE payment_intents SET status = 'expired', updated_at = now() WHERE id = $1",
          req.intentId,
        );
        await tx.rawExec(
          `INSERT INTO payment_state_history
            (payment_intent_id, prior_status, new_status, actor_type, actor_reference, evidence)
           VALUES ($1, $2, 'expired', 'system', 'attempt.submit', $3::jsonb)`,
          req.intentId,
          locked.status,
          JSON.stringify({ reason: "intent_ttl_elapsed" }),
        );
        await tx.commit();
        expired = true;
      } else {
        if (locked.status !== "awaiting_transfer" && locked.status !== "underpaid") {
          throw APIError.failedPrecondition(`Payment intent cannot accept a transaction hash while ${locked.status}`);
        }
        assertPaymentTransition(locked.status, "submitted");
        attemptId = crypto.randomUUID();
        await tx.rawExec(
          `INSERT INTO payment_attempts
            (id, payment_intent_id, transaction_hash, submitted_sender_wallet, verification_status)
           VALUES ($1, $2, $3, $4, 'submitted')`,
          attemptId,
          req.intentId,
          transactionHash,
          payload.submittedSenderWallet?.trim() || null,
        );
        await tx.rawExec(
          "UPDATE payment_intents SET status = 'submitted', updated_at = now() WHERE id = $1",
          req.intentId,
        );
        await tx.rawExec(
          `INSERT INTO payment_state_history
            (payment_intent_id, prior_status, new_status, actor_type, actor_reference, evidence)
           VALUES ($1, $2, 'submitted', 'profile', $3, $4::jsonb)`,
          req.intentId,
          locked.status,
          payload.profileId,
          JSON.stringify({ attemptId, transactionHash }),
        );
        await tx.rawExec(
          `INSERT INTO payment_events
            (payment_intent_id, event_key, event_type, payload)
           VALUES ($1, $2, 'payment.attempt.submitted', $3::jsonb)`,
          req.intentId,
          `payment-attempt:${attemptId}:submitted`,
          JSON.stringify({ attemptId, paymentIntentId: req.intentId }),
        );
        await tx.commit();
      }
    } catch (error) {
      try { await tx.rollback(); } catch { /* transaction may already be closed */ }
      const raced = await findAttemptByHash(transactionHash);
      if (raced) {
        if (raced.payment_intent_id !== req.intentId) {
          throw APIError.alreadyExists("Transaction hash has already been submitted for another payment intent");
        }
        return mapAttempt(raced);
      }
      throw error;
    }

    if (expired) throw APIError.failedPrecondition("Payment intent has expired; create a replacement intent if the obligation is still open");
    if (!attemptId) throw new Error("payment_attempt_not_created");
    const created = await findAttemptByHash(transactionHash);
    if (!created) throw new Error("payment_attempt_not_created");
    return mapAttempt(created);
  },
);
