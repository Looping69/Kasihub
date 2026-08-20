// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import * as log from "encore.dev/log";
import { z } from "zod";
import { auditDb, paymentsDb } from "../../resources";
import { requireAdminAccess } from "../auth/access";
import {
  RECEIVING_PROVIDERS,
  type ReceivingProvider,
  validateReceivingProviderPolicy,
  validateReceivingRoute,
} from "./receiving-config";

export interface ReceivingConfigurationRequest {
  provider?: ReceivingProvider;
  network: "tron" | "bsc";
  currency: "USDT";
  addressReference: string;
  tokenContract: string;
  decimals: number;
  minimumConfirmations: number;
  intentTtlSeconds: number;
  custodyReconciliationRequired?: boolean;
}

const receivingConfigRequest = z.object({
  provider: z.enum(RECEIVING_PROVIDERS).default("kasihub"),
  network: z.enum(["tron", "bsc"]),
  currency: z.literal("USDT"),
  addressReference: z.string().min(8).max(200),
  tokenContract: z.string().min(8).max(200),
  decimals: z.number().int().min(0).max(36),
  minimumConfirmations: z.number().int().min(1).max(10_000),
  intentTtlSeconds: z.number().int().min(300).max(86_400),
  custodyReconciliationRequired: z.boolean().default(false),
}).superRefine((value, context) => {
  try {
    validateReceivingProviderPolicy(value.provider, value.custodyReconciliationRequired);
  } catch (error) {
    context.addIssue({
      code: "custom",
      path: ["custodyReconciliationRequired"],
      message: error instanceof Error ? error.message : "Invalid custody reconciliation policy",
    });
  }
});

type ReceivingConfigResponse = {
  id: string;
  provider: ReceivingProvider;
  network: string;
  currency: string;
  addressReference: string;
  tokenContract: string;
  decimals: number;
  minimumConfirmations: number;
  intentTtlSeconds: number;
  status: string;
  activeFrom: string;
  retiredAt: string | null;
  custodyReconciliationRequired: boolean;
};

type ReceivingConfigRow = {
  id: string;
  provider: ReceivingProvider;
  network: string;
  currency: string;
  address_reference: string;
  token_contract: string;
  decimals: number;
  minimum_confirmations: number;
  intent_ttl_seconds: number | null;
  status: string;
  active_from: string;
  retired_at: string | null;
  custody_reconciliation_required: boolean;
};

/** Server-authoritative lookup used by product domains before activation. ( |╲ ) — Klaasvaakie */
export async function resolveActiveReceivingConfiguration(
  network: "tron" | "bsc",
  currency: "USDT" = "USDT",
): Promise<ReceivingConfigResponse> {
  const row = await paymentsDb.rawQueryRow<ReceivingConfigRow>(
    `SELECT id, provider, network, currency, address_reference, token_contract, decimals,
            minimum_confirmations, intent_ttl_seconds, status, active_from, retired_at,
            custody_reconciliation_required
       FROM payment_wallets
      WHERE lower(network) = lower($1) AND currency = $2 AND status = 'active'
        AND active_from <= now() AND retired_at IS NULL
      LIMIT 1`,
    network,
    currency,
  );
  if (!row) throw APIError.failedPrecondition("No active receiving configuration exists for this network");
  return mapConfig(row);
}

function mapConfig(row: ReceivingConfigRow): ReceivingConfigResponse {
  if (!row.intent_ttl_seconds) throw APIError.internal("Receiving configuration is missing an intent TTL");
  return {
    id: row.id,
    provider: row.provider,
    network: row.network,
    currency: row.currency,
    addressReference: row.address_reference,
    tokenContract: row.token_contract,
    decimals: row.decimals,
    minimumConfirmations: row.minimum_confirmations,
    intentTtlSeconds: row.intent_ttl_seconds,
    status: row.status,
    activeFrom: row.active_from,
    retiredAt: row.retired_at,
    custodyReconciliationRequired: row.custody_reconciliation_required,
  };
}

/**
 * Rotates the active receiving configuration for one network/currency pair.
 * Wallet addresses and token contracts are configuration, not secrets, but
 * changing them is privileged because they define where money is expected.
 */
export const rotateReceivingConfiguration = api<
  ReceivingConfigurationRequest,
  ReceivingConfigResponse
>(
  { method: "POST", path: "/admin/payments/receiving-config", expose: true },
  async (req) => {
    const session = await requireAdminAccess();
    const payload = receivingConfigRequest.parse(req);
    try {
      validateReceivingRoute(payload.network, payload.addressReference, payload.tokenContract);
    } catch {
      throw APIError.invalidArgument("Receiving address or token contract is invalid for the selected network");
    }
    const tx = await paymentsDb.begin();
    const id = crypto.randomUUID();
    const auditPayload = {
      provider: payload.provider,
      network: payload.network,
      currency: payload.currency,
      addressReference: payload.addressReference.trim(),
      tokenContract: payload.tokenContract.trim(),
      decimals: payload.decimals,
      minimumConfirmations: payload.minimumConfirmations,
      intentTtlSeconds: payload.intentTtlSeconds,
      custodyReconciliationRequired: payload.custodyReconciliationRequired,
    };
    let row: ReceivingConfigRow | null = null;
    try {
      await tx.rawExec(
        "SELECT pg_advisory_xact_lock(hashtext($1))",
        `payment-config:${payload.network}:${payload.currency}`,
      );
      await tx.rawExec(
        `UPDATE payment_wallets
            SET status = 'retired', retired_at = now()
          WHERE lower(network) = lower($1) AND currency = $2 AND status = 'active'`,
        payload.network,
        payload.currency,
      );
      row = await tx.rawQueryRow<ReceivingConfigRow>(
        `INSERT INTO payment_wallets
          (id, provider, network, currency, address_reference, token_contract, decimals,
           minimum_confirmations, intent_ttl_seconds, custody_reconciliation_required, status, active_from)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', now())
         RETURNING id, provider, network, currency, address_reference, token_contract, decimals,
                   minimum_confirmations, intent_ttl_seconds, status, active_from, retired_at,
                   custody_reconciliation_required`,
        id,
        payload.provider,
        payload.network,
        payload.currency,
        auditPayload.addressReference,
        auditPayload.tokenContract,
        payload.decimals,
        payload.minimumConfirmations,
        payload.intentTtlSeconds,
        payload.custodyReconciliationRequired,
      );
      if (!row) throw new Error("payment_receiving_config_not_created");
      await tx.rawExec(
        `INSERT INTO payment_configuration_events
          (event_type, configuration_id, actor_user_id, payload)
         VALUES ('receiving_config.rotated', $1, $2, $3::jsonb)`,
        id,
        session.user.id,
        JSON.stringify(auditPayload),
      );
      await tx.commit();
    } catch (error) {
      try { await tx.rollback(); } catch { /* transaction may already be closed */ }
      throw error;
    }

    // Mirror to the global audit database after the authoritative payments
    // transaction commits. A mirror outage is logged but cannot invalidate a
    // receiving configuration that has already been durably committed.
    try {
      await auditDb.rawExec(
        `INSERT INTO audit_logs (action, entity_type, entity_id, actor_user_id, after)
         VALUES ('payments.receiving_config.rotate', 'payment_wallet', $1, $2, $3::jsonb)`,
        id,
        session.user.id,
        JSON.stringify(auditPayload),
      );
    } catch (error) {
      log.error(error, "global payment configuration audit mirror failed", {
        configurationId: id,
        network: payload.network,
        currency: payload.currency,
      });
    }

    return mapConfig(row);
  },
);

export interface ListReceivingConfigurationsResponse {
  configurations: ReceivingConfigResponse[];
}

export const listReceivingConfigurations = api<
  void,
  ListReceivingConfigurationsResponse
>(
  { method: "GET", path: "/admin/payments/receiving-config", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await paymentsDb.rawQueryAll<ReceivingConfigRow>(
      `SELECT id, provider, network, currency, address_reference, token_contract, decimals,
              minimum_confirmations, intent_ttl_seconds, status, active_from, retired_at,
              custody_reconciliation_required
         FROM payment_wallets
        ORDER BY active_from DESC`,
    );
    return { configurations: rows.filter((row) => row.intent_ttl_seconds !== null).map(mapConfig) };
  },
);
