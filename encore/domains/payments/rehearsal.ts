// Author: Klaasvaakie ( |╲ )
import { appMeta } from "encore.dev";
import { APIError } from "encore.dev/api";
import { paymentsDb } from "../../resources";
import { decimalToUnits } from "./chains/amount";
import { normalizeChainAddress } from "./chains/address";
import type { ChainTransactionEvidence } from "./chains/types";
import { TOKEN_TRANSFER_TOPIC } from "./chains/transfer";
import { isPaymentRehearsalAllowed } from "./rehearsal-policy";

const REHEARSAL_PROVIDER = "kasihub_rehearsal";
const REHEARSAL_RECEIVER = "0x000000000000000000000000000000000000dead";
const BSC_USDT_CONTRACT = "0x55d398326f99059fF775485246999027B3197955";

export function paymentRehearsalAllowed(isMock: boolean): boolean {
  const environment = appMeta().environment;
  const allowed = isPaymentRehearsalAllowed(isMock, environment.name);
  if (isMock) console.info("payment_rehearsal_policy", { environmentName: environment.name, environmentType: environment.type, allowed });
  return allowed;
}

export async function ensurePaymentRehearsalWallet(network: string, minimumConfirmations: number): Promise<void> {
  if (!paymentRehearsalAllowed(true)) {
    throw APIError.failedPrecondition("Payment rehearsals are disabled in production");
  }
  if (network !== "bsc") throw APIError.failedPrecondition("Payment rehearsals currently require the BSC staging rail");

  const active = await paymentsDb.rawQueryRow<{ provider: string }>(
    "SELECT provider FROM payment_wallets WHERE network = 'bsc' AND currency = 'USDT' AND status = 'active'",
  );
  if (active && active.provider !== REHEARSAL_PROVIDER) {
    throw APIError.failedPrecondition("Staging has a live receiving route; retire it before enabling a no-money rehearsal");
  }
  if (active) return;

  await paymentsDb.rawExec(
    `INSERT INTO payment_wallets
       (id,provider,network,currency,address_reference,token_contract,decimals,minimum_confirmations,
        status,intent_ttl_seconds,custody_reconciliation_required)
     VALUES ($1,$2,'bsc','USDT',$3,$4,18,$5,'active',1800,false)
     ON CONFLICT DO NOTHING`,
    crypto.randomUUID(), REHEARSAL_PROVIDER, REHEARSAL_RECEIVER, BSC_USDT_CONTRACT, minimumConfirmations,
  );
}

export async function readPaymentRehearsalEvidence(
  attemptId: string,
  network: "tron" | "bsc",
  transactionHash: string,
): Promise<ChainTransactionEvidence> {
  if (!paymentRehearsalAllowed(true)) {
    throw APIError.failedPrecondition("Payment rehearsals are disabled in production");
  }
  const row = await paymentsDb.rawQueryRow<{
    expected_amount: string;
    address_reference: string;
    token_contract: string;
    decimals: number;
    minimum_confirmations: number;
    provider: string;
  }>(
    `SELECT i.expected_amount::text AS expected_amount, w.address_reference, w.token_contract,
            w.decimals, w.minimum_confirmations, w.provider
       FROM payment_attempts a
       JOIN payment_intents i ON i.id = a.payment_intent_id
       JOIN payment_wallets w ON w.id = i.wallet_id
      WHERE a.id = $1`,
    attemptId,
  );
  if (!row || row.provider !== REHEARSAL_PROVIDER || network !== "bsc") {
    throw APIError.failedPrecondition("This payment attempt is not attached to the staging rehearsal rail");
  }

  const sender = "11".repeat(20);
  const receiver = normalizeChainAddress("bsc", row.address_reference);
  const amount = decimalToUnits(row.expected_amount, row.decimals);
  const blockNumber = 1000n;
  return {
    network: "bsc",
    transactionHash,
    visible: true,
    execution: "success",
    blockNumber,
    latestBlockNumber: blockNumber + BigInt(row.minimum_confirmations) - 1n,
    sender,
    providerReference: `staging-rehearsal:${attemptId}`,
    logs: [{
      address: row.token_contract,
      topics: [TOKEN_TRANSFER_TOPIC, sender.padStart(64, "0"), receiver.padStart(64, "0")],
      data: amount.toString(16).padStart(64, "0"),
    }],
  };
}

export async function recordPaymentRehearsal(attemptId: string): Promise<void> {
  await paymentsDb.rawExec(
    `INSERT INTO payment_state_history
       (payment_intent_id,prior_status,new_status,actor_type,actor_reference,evidence)
     SELECT payment_intent_id,'settled','settled','system','staging.payment-rehearsal',$2::jsonb
       FROM payment_attempts WHERE id = $1`,
    attemptId,
    JSON.stringify({ mock: true, fundsMoved: false, evidenceSource: "deterministic-staging-fixture" }),
  );
}
