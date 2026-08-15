// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { paymentsDb } from "../../resources";
import { TOKEN_TRANSFER_TOPIC } from "./chains/transfer";
import type { ChainTransactionEvidence } from "./chains/types";
import { CustodyProviderUnavailable, type CustodyEvidence } from "./custody";
import { verifyAndSettlePaymentAttempt } from "./verification";

const TOKEN = `0x${"11".repeat(20)}`;
const RECEIVER = `0x${"22".repeat(20)}`;
const SENDER = `0x${"33".repeat(20)}`;

function topic(address: string): string {
  return `0x${"0".repeat(24)}${address.replace(/^0x/, "")}`;
}

function evidence(hash: string, receiver = RECEIVER): ChainTransactionEvidence {
  return {
    network: "bsc",
    transactionHash: hash,
    visible: true,
    execution: "success",
    blockNumber: 100n,
    latestBlockNumber: 102n,
    sender: SENDER,
    logs: [{
      address: TOKEN,
      topics: [`0x${TOKEN_TRANSFER_TOPIC}`, topic(SENDER), topic(receiver)],
      data: `0x${25_000_000n.toString(16).padStart(64, "0")}`,
    }],
  };
}

function custodyEvidence(hash: string, amount = "25"): CustodyEvidence {
  return {
    provider: "remitano",
    providerReference: `deposit-${hash}`,
    transactionHash: hash,
    receiverAddress: RECEIVER,
    currency: "USDT",
    amount,
    outcome: "confirmed",
    observedAt: new Date().toISOString(),
  };
}

async function seedSubmittedPayment(custodyReconciliationRequired = false) {
  const walletId = crypto.randomUUID();
  const obligationId = crypto.randomUUID();
  const intentId = crypto.randomUUID();
  const attemptId = crypto.randomUUID();
  const hash = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
  const profileId = crypto.randomUUID();
  const reference = `KSP-VERIFY-${crypto.randomUUID()}`;
  await paymentsDb.rawExec(`INSERT INTO payment_wallets
    (id,provider,network,currency,address_reference,token_contract,decimals,minimum_confirmations,status,retired_at,intent_ttl_seconds,custody_reconciliation_required)
    VALUES ($1,$4,'bsc','USDT',$2,$3,6,3,'retired',now(),1800,$5)`, walletId, RECEIVER, TOKEN,
  custodyReconciliationRequired ? "remitano" : "kasihub", custodyReconciliationRequired);
  await paymentsDb.rawExec(`INSERT INTO payment_obligations
    (id,subject_type,subject_reference,payer_profile_id,beneficiary_profile_id,settlement_currency,settlement_amount,status)
    VALUES ($1,'presale_order',$2,$3,$3,'USDT',25,'open')`, obligationId, reference, profileId);
  await paymentsDb.rawExec(`INSERT INTO payment_intents
    (id,order_id,payer_profile_id,beneficiary_profile_id,wallet_id,rail,currency,network,expected_amount,idempotency_key_hash,request_hash,status,expires_at)
    VALUES ($1,$2,$3,$3,$4,'usdt','USDT','bsc',25,$5,$6,'submitted',now()+interval '30 minutes')`,
  intentId, obligationId, profileId, walletId, crypto.randomUUID(), crypto.randomUUID());
  await paymentsDb.rawExec(`INSERT INTO payment_attempts
    (id,payment_intent_id,transaction_hash,verification_status) VALUES ($1,$2,$3,'submitted')`, attemptId, intentId, hash);
  return { attemptId, obligationId, intentId, hash, reference };
}

describe("product-neutral payment verification and settlement", () => {
  it("settles canonical chain evidence exactly once and emits one durable event", async () => {
    const seeded = await seedSubmittedPayment();
    const reader = async () => evidence(seeded.hash);
    const first = await verifyAndSettlePaymentAttempt(seeded.attemptId, reader);
    const retry = await verifyAndSettlePaymentAttempt(seeded.attemptId, reader);
    expect(first).toMatchObject({ status: "settled", subjectType: "presale_order", subjectReference: seeded.reference });
    expect(retry).toMatchObject({ status: "settled", reason: "already_settled" });
    const state = await paymentsDb.rawQueryRow<{ intent_status: string; obligation_status: string; settled_events: number }>(
      `SELECT i.status AS intent_status,o.status AS obligation_status,
        (SELECT count(*)::int FROM payment_events e WHERE e.payment_intent_id=i.id AND e.event_type='payment.settled') AS settled_events
       FROM payment_intents i JOIN payment_obligations o ON o.id=i.order_id WHERE i.id=$1`, seeded.intentId);
    expect(state).toEqual({ intent_status: "settled", obligation_status: "settled", settled_events: 1 });
  });

  it("rejects wrong-destination evidence without settling the obligation", async () => {
    const seeded = await seedSubmittedPayment();
    const result = await verifyAndSettlePaymentAttempt(seeded.attemptId, async () => evidence(seeded.hash, `0x${"44".repeat(20)}`));
    const retry = await verifyAndSettlePaymentAttempt(seeded.attemptId, async () => evidence(seeded.hash, `0x${"44".repeat(20)}`));
    expect(result.status).toBe("rejected");
    expect(retry).toMatchObject({ status: "rejected", reason: "already_rejected" });
    const state = await paymentsDb.rawQueryRow<{ intent_status: string; obligation_status: string }>(
      `SELECT i.status AS intent_status,o.status AS obligation_status
       FROM payment_intents i JOIN payment_obligations o ON o.id=i.order_id WHERE i.id=$1`, seeded.intentId);
    expect(state).toEqual({ intent_status: "rejected", obligation_status: "open" });
  });

  it("requires matching custody evidence only for an explicitly gated route", async () => {
    const seeded = await seedSubmittedPayment(true);
    const result = await verifyAndSettlePaymentAttempt(
      seeded.attemptId,
      async () => evidence(seeded.hash),
      async () => custodyEvidence(seeded.hash),
    );
    expect(result).toMatchObject({ status: "settled", reason: "custody_evidence_satisfied" });
    const custody = await paymentsDb.rawQueryRow<{ count: number }>(
      "SELECT count(*)::int AS count FROM payment_custody_evidence WHERE payment_attempt_id = $1",
      seeded.attemptId,
    );
    expect(custody?.count).toBe(1);
  });

  it("fails closed without a custody adapter and leaves the obligation open", async () => {
    const seeded = await seedSubmittedPayment(true);
    const result = await verifyAndSettlePaymentAttempt(
      seeded.attemptId,
      async () => evidence(seeded.hash),
      async () => { throw new CustodyProviderUnavailable("remitano", "custody_temporarily_unavailable"); },
    );
    expect(result).toMatchObject({ status: "retryable", reason: "custody_temporarily_unavailable" });
    const state = await paymentsDb.rawQueryRow<{ intent_status: string; obligation_status: string }>(
      `SELECT i.status AS intent_status,o.status AS obligation_status
       FROM payment_intents i JOIN payment_obligations o ON o.id=i.order_id WHERE i.id=$1`, seeded.intentId);
    expect(state).toEqual({ intent_status: "submitted", obligation_status: "open" });
  });

  it("sends custody mismatches to manual review without duplicating evidence", async () => {
    const seeded = await seedSubmittedPayment(true);
    const reader = async () => custodyEvidence(seeded.hash, "24");
    const result = await verifyAndSettlePaymentAttempt(seeded.attemptId, async () => evidence(seeded.hash), reader);
    expect(result).toMatchObject({ status: "manual_review", reason: "custody_amount_mismatch" });
    const evidenceRows = await paymentsDb.rawQueryRow<{ count: number }>(
      "SELECT count(*)::int AS count FROM payment_custody_evidence WHERE payment_attempt_id = $1",
      seeded.attemptId,
    );
    expect(evidenceRows?.count).toBe(1);
  });
});
