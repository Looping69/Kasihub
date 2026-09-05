// Author: Klaasvaakie ( |╲ )
import { describe, expect, it, vi } from "vitest";
import { paymentsDb } from "../../resources";
import { TOKEN_TRANSFER_TOPIC } from "./chains/transfer";
import type { ChainTransactionEvidence } from "./chains/types";
import { CustodyProviderUnavailable, readRemitanoCustodyEvidence, type CustodyEvidence } from "./custody";
import { verifyAndSettlePaymentAttempt } from "./verification";

import { submitPaymentAttempt } from "./attempts";
// Authentication is covered by the HTTP harness; keep this regression focused on
// the real submission transaction and verifier against Encore PostgreSQL.
vi.mock("../auth/access", () => ({ requireProfileAccess: vi.fn(async () => ({})) }));

const TOKEN = `0x${"11".repeat(20)}`;
const RECEIVER = `0x${"22".repeat(20)}`;
const SENDER = `0x${"33".repeat(20)}`;

function topic(address: string): string {
  return `0x${"0".repeat(24)}${address.replace(/^0x/, "")}`;
}

function evidence(hash: string, receiver = RECEIVER, latestBlockNumber = 102n, amount = 25_000_000n): ChainTransactionEvidence {
  return {
    network: "bsc",
    transactionHash: hash,
    visible: true,
    execution: "success",
    blockNumber: 100n,
    latestBlockNumber,
    sender: SENDER,
    logs: [{
      address: TOKEN,
      topics: [`0x${TOKEN_TRANSFER_TOPIC}`, topic(SENDER), topic(receiver)],
      data: `0x${amount.toString(16).padStart(64, "0")}`,
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
  return { attemptId, obligationId, intentId, hash, reference, profileId };
}

describe("product-neutral payment verification and settlement", () => {
  it("recovers a Remitano endpoint outage through verified deposit details and settles replay only once", async () => {
    const seeded = await seedSubmittedPayment(true);
    const chain = async () => evidence(seeded.hash);
    const failed = await verifyAndSettlePaymentAttempt(seeded.attemptId, chain, async () => {
      throw new CustodyProviderUnavailable("remitano", "custody_provider_http_400_invalid_endpoint");
    });
    expect(failed.status).toBe("retryable");
    const before = await paymentsDb.rawQueryRow<{ credits: number }>(
      "SELECT count(*)::int AS credits FROM payment_credits WHERE obligation_id=$1", seeded.obligationId);
    expect(before?.credits).toBe(0);
    const get = async (target: string): Promise<unknown> => {
      if (target.includes("by_currency_and_tx_hash")) throw new CustodyProviderUnavailable("remitano", "custody_provider_http_400_invalid_endpoint");
      if (target.includes("latest_coin_deposits")) return [{ type: "deposit", id: 123, coin_address: RECEIVER, coin_currency: "usdt" }];
      if (target === "/api/v1/coin_deposits/123") return { id: 123, tx_hash: `0x${seeded.hash}`, coin_address: RECEIVER,
        coin_currency: "usdt", coin_amount: 25, status: "verified", verified_at_timestamp: 1788375440 };
      throw new Error("Unexpected provider request");
    };
    const recover = () => verifyAndSettlePaymentAttempt(seeded.attemptId, chain,
      (expectation) => readRemitanoCustodyEvidence(expectation, get));
    expect((await recover()).status).toBe("settled");
    expect((await recover()).reason).toBe("already_settled");
    const counts = await paymentsDb.rawQueryRow<{ credits: number; settlements: number }>(
      `SELECT (SELECT count(*)::int FROM payment_credits WHERE obligation_id=$1) AS credits,
       (SELECT count(*)::int FROM payment_settlements WHERE obligation_id=$1) AS settlements`, seeded.obligationId);
    expect(counts).toEqual({ credits: 1, settlements: 1 });
  });

  it("accumulates verified partial credits, deduplicates concurrent replay, and settles once", async () => {
    const seeded = await seedSubmittedPayment(true);
    const partialReader = async () => evidence(seeded.hash, RECEIVER, 102n, 20_000_000n);
    const partialCustody = async () => custodyEvidence(seeded.hash, "20");
    const first = await verifyAndSettlePaymentAttempt(seeded.attemptId, partialReader, partialCustody);
    expect(first.status).toBe("underpaid");
    const replays = await Promise.all([
      verifyAndSettlePaymentAttempt(seeded.attemptId, partialReader, partialCustody),
      verifyAndSettlePaymentAttempt(seeded.attemptId, partialReader, partialCustody),
    ]);
    expect(replays.every((result) => result.status === "underpaid")).toBe(true);
    const balance = await paymentsDb.rawQueryRow<{ status: string; credited: string }>(
      "SELECT status,(SELECT SUM(amount)::text FROM payment_credits WHERE obligation_id=$1) AS credited FROM payment_obligations WHERE id=$1", seeded.obligationId);
    expect(balance).toEqual({ status: "partially_paid", credited: "20.000000" });
    const hash = "0x" + crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
    const submitted = await submitPaymentAttempt({intentId:seeded.intentId,profileId:seeded.profileId,transactionHash:hash});
    const topup = submitted.id;
    expect((await submitPaymentAttempt({intentId:seeded.intentId,profileId:seeded.profileId,transactionHash:hash})).id).toBe(topup);
    const settle = () => verifyAndSettlePaymentAttempt(topup, async () => evidence(hash, RECEIVER, 102n, 5_000_000n), async () => custodyEvidence(hash, "5"));
    const results = await Promise.all([settle(), settle()]);
    expect(results.every((result) => result.status === "settled")).toBe(true);
    const counts = await paymentsDb.rawQueryRow<{ credits: number; settlements: number; events: number }>(
      `SELECT (SELECT count(*)::int FROM payment_credits WHERE obligation_id=$1) AS credits,
       (SELECT count(*)::int FROM payment_settlements WHERE obligation_id=$1) AS settlements,
       (SELECT count(*)::int FROM payment_events WHERE payment_intent_id=$2 AND event_type='payment.settled') AS events`,
      seeded.obligationId, seeded.intentId);
    expect(counts).toEqual({ credits: 2, settlements: 1, events: 1 });
  });

  it("does not credit a partial transfer before confirmations and custody recover", async () => {
    const seeded = await seedSubmittedPayment(true);
    const pending = await verifyAndSettlePaymentAttempt(seeded.attemptId, async () => evidence(seeded.hash, RECEIVER, 100n, 10_000_000n));
    expect(pending.status).toBe("pending_confirmations");
    const outage = await verifyAndSettlePaymentAttempt(seeded.attemptId,
      async () => evidence(seeded.hash, RECEIVER, 102n, 10_000_000n),
      async () => { throw new CustodyProviderUnavailable("remitano", "custody_provider_network_unavailable"); });
    expect(outage.status).toBe("retryable");
    const before = await paymentsDb.rawQueryRow<{ count: number }>("SELECT count(*)::int AS count FROM payment_credits WHERE obligation_id=$1", seeded.obligationId);
    expect(before?.count).toBe(0);
    const recovered = await verifyAndSettlePaymentAttempt(seeded.attemptId,
      async () => evidence(seeded.hash, RECEIVER, 102n, 10_000_000n), async () => custodyEvidence(seeded.hash, "10"));
    expect(recovered.status).toBe("underpaid");
  });

  it("preserves an overpayment for review without emitting settlement", async () => {
    const seeded = await seedSubmittedPayment();
    const result = await verifyAndSettlePaymentAttempt(seeded.attemptId, async () => evidence(seeded.hash, RECEIVER, 102n, 26_000_000n));
    expect(result.status).toBe("manual_review");
    const state = await paymentsDb.rawQueryRow<{ status: string; count: number }>(
      "SELECT status,(SELECT count(*)::int FROM payment_settlements WHERE obligation_id=$1) AS count FROM payment_obligations WHERE id=$1", seeded.obligationId);
    expect(state).toEqual({ status: "review_required", count: 0 });
  });
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
    expect(state).toEqual({ intent_status: "settled", obligation_status: "paid", settled_events: 1 });
  });

  it("keeps polling a valid transfer until confirmation depth is met, then settles exactly once", async () => {
    const seeded = await seedSubmittedPayment();
    const pending = await verifyAndSettlePaymentAttempt(
      seeded.attemptId,
      async () => evidence(seeded.hash, RECEIVER, 100n),
    );
    expect(pending).toMatchObject({ status: "pending_confirmations", confirmations: 1 });

    const settled = await verifyAndSettlePaymentAttempt(
      seeded.attemptId,
      async () => evidence(seeded.hash),
    );
    const retry = await verifyAndSettlePaymentAttempt(seeded.attemptId, async () => evidence(seeded.hash));
    expect(settled).toMatchObject({ status: "settled", confirmations: 3 });
    expect(retry).toMatchObject({ status: "settled", reason: "already_settled" });

    const state = await paymentsDb.rawQueryRow<{
      intent_status: string; obligation_status: string; confirmations: number; settled_events: number;
    }>(
      `SELECT i.status AS intent_status,o.status AS obligation_status,a.confirmations,
        (SELECT count(*)::int FROM payment_events e WHERE e.payment_intent_id=i.id AND e.event_type='payment.settled') AS settled_events
       FROM payment_intents i
       JOIN payment_obligations o ON o.id=i.order_id
       JOIN payment_attempts a ON a.payment_intent_id=i.id
       WHERE i.id=$1`,
      seeded.intentId,
    );
    expect(state).toEqual({ intent_status: "settled", obligation_status: "paid", confirmations: 3, settled_events: 1 });
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
    const state = await paymentsDb.rawQueryRow<{
      intent_status: string; obligation_status: string; verification_error_code: string | null;
      verified_at: string | null; confirmations: number | null;
    }>(
      `SELECT i.status AS intent_status,o.status AS obligation_status,
              a.verification_error_code,a.verified_at,a.confirmations
       FROM payment_intents i
       JOIN payment_obligations o ON o.id=i.order_id
       JOIN payment_attempts a ON a.payment_intent_id=i.id
       WHERE i.id=$1`, seeded.intentId);
    expect(state).toMatchObject({
      intent_status: "submitted",
      obligation_status: "open",
      verification_error_code: "custody_temporarily_unavailable",
      confirmations: 3,
    });
    expect(state?.verified_at).toBeTruthy();
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
