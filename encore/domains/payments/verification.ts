// Author: Klaasvaakie ( |╲ )
import { APIError } from "encore.dev/api";
import { classifyObligationFunding } from "./settlement-policy";
import { decimalToUnits } from "./chains/amount";
import { paymentsDb } from "../../resources";
import { evaluatePaymentEvidence } from "./chains/evaluate";
import { ChainProviderUnavailable, readChainTransactionEvidence } from "./chains/providers";
import type { PaymentEvidenceEvaluation } from "./chains/types";
import type { ChainTransactionEvidence } from "./chains/types";
import {
  CustodyProviderUnavailable,
  evaluateCustodyEvidence,
  readCustodyEvidence,
  type CustodyDecision,
  type CustodyEvidence,
  type CustodyEvidenceReader,
} from "./custody";
import { assertPaymentTransition, type PaymentStatus } from "./state-machine";

export type SettledPaymentResult = {
  paymentIntentId: string;
  paymentAttemptId: string;
  obligationId: string;
  subjectType: string;
  subjectReference: string;
  transactionHash: string;
  status: PaymentStatus | "retryable";
  confirmations: number;
  reason: string;
};

type VerificationRow = {
  attempt_id: string;
  payment_intent_id: string;
  transaction_hash: string;
  verification_status: PaymentStatus;
  intent_status: PaymentStatus;
  obligation_id: string;
  subject_type: string;
  subject_reference: string;
  obligation_status: string;
  network: "tron" | "bsc";
  expected_amount: string;
  address_reference: string;
  token_contract: string;
  decimals: number;
  minimum_confirmations: number;
  provider: string;
  custody_reconciliation_required: boolean;
};

function targetStatus(evaluation: PaymentEvidenceEvaluation): PaymentStatus | "retryable" {
  switch (evaluation.decision) {
    case "confirmed": return "confirmed";
    case "pending_confirmations": return "pending_confirmations";
    case "underpaid": return "underpaid";
    case "manual_review": return "manual_review";
    case "rejected": return "rejected";
    case "retryable": return "retryable";
  }
}

function retryableResult(row: VerificationRow, reason: string): SettledPaymentResult {
  return {
    paymentIntentId: row.payment_intent_id,
    paymentAttemptId: row.attempt_id,
    obligationId: row.obligation_id,
    subjectType: row.subject_type,
    subjectReference: row.subject_reference,
    transactionHash: row.transaction_hash,
    status: "retryable",
    confirmations: 0,
    reason,
  };
}

async function persistRetryableResult(
  row: VerificationRow,
  reason: string,
  evaluation?: PaymentEvidenceEvaluation,
): Promise<SettledPaymentResult> {
  if (evaluation) {
    await paymentsDb.rawExec(
      `UPDATE payment_attempts
          SET chain_sender_wallet = $3,
              chain_receiver_wallet = $4,
              chain_amount = $5::numeric,
              block_number = $6,
              confirmations = $7,
              verification_error_code = $2,
              verification_error_detail = NULL,
              verified_at = now()
        WHERE id = $1
          AND verification_status IN ('submitted', 'verifying', 'pending_confirmations')`,
      row.attempt_id,
      reason,
      evaluation.sender,
      evaluation.receiver,
      evaluation.receivedAmount,
      evaluation.blockNumber ?? null,
      evaluation.confirmations,
    );
    return { ...retryableResult(row, reason), confirmations: evaluation.confirmations };
  }
  await paymentsDb.rawExec(
    `UPDATE payment_attempts SET verification_error_code = $2,
        verification_error_detail = NULL, verified_at = now()
      WHERE id = $1 AND verification_status IN ('submitted', 'verifying', 'pending_confirmations')`,
    row.attempt_id, reason,
  );
  return retryableResult(row, reason);
}

/**
 * Product-neutral payment authority. It alone reads chain evidence and moves a
 * payment from submitted to settled. Product domains may consume the settled
 * result, but cannot supply or override canonical receiver, token, amount,
 * confirmations, or settlement state. ( |╲ ) — Klaasvaakie
 */
export async function verifyAndSettlePaymentAttempt(
  attemptId: string,
  evidenceReader: (network: "tron" | "bsc", transactionHash: string) => Promise<ChainTransactionEvidence> = readChainTransactionEvidence,
  custodyReader: CustodyEvidenceReader = readCustodyEvidence,
): Promise<SettledPaymentResult> {
  const row = await paymentsDb.rawQueryRow<VerificationRow>(
    `SELECT a.id AS attempt_id, a.payment_intent_id, a.transaction_hash,
            a.verification_status, i.status AS intent_status,
            o.id AS obligation_id, o.subject_type, o.subject_reference, o.status AS obligation_status,
            i.network, i.expected_amount::text AS expected_amount,
            w.address_reference, w.token_contract, w.decimals, w.minimum_confirmations,
            w.provider, w.custody_reconciliation_required
       FROM payment_attempts a
       JOIN payment_intents i ON i.id = a.payment_intent_id
       JOIN payment_obligations o ON o.id = i.order_id
       JOIN payment_wallets w ON w.id = i.wallet_id
      WHERE a.id = $1`,
    attemptId,
  );
  if (!row) throw APIError.notFound("Payment attempt not found");
  if (row.intent_status === "settled" && row.obligation_status === "paid") {
    return { ...retryableResult(row, "already_settled"), status: "settled" };
  }
  if (row.intent_status === "rejected" && row.verification_status === "rejected") {
    return { ...retryableResult(row, "already_rejected"), status: "rejected" };
  }
  const credited = await paymentsDb.rawQueryRow<{ id: string }>(
    "SELECT id FROM payment_credits WHERE obligation_id=$1 AND provider=$2 AND provider_reference=$3 AND status='confirmed'",
    row.obligation_id, `chain:${row.network}`, row.transaction_hash.toLowerCase().replace(/^0x/, ""));
  if (credited) return { ...retryableResult(row, "credit_already_recorded"), status: row.intent_status };
  if (!["submitted", "verifying", "pending_confirmations"].includes(row.intent_status)) {
    throw APIError.failedPrecondition(`Payment intent cannot be verified while ${row.intent_status}`);
  }

  let evidence;
  try {
    evidence = await evidenceReader(row.network, row.transaction_hash);
  } catch (error) {
    if (error instanceof ChainProviderUnavailable) return persistRetryableResult(row, "chain_provider_unavailable");
    throw error;
  }
  const evaluation = evaluatePaymentEvidence({
    network: row.network,
    transactionHash: row.transaction_hash,
    tokenContract: row.token_contract,
    receivingAddress: row.address_reference,
    expectedAmount: row.expected_amount,
    tokenDecimals: row.decimals,
    minimumConfirmations: row.minimum_confirmations,
  }, evidence);
  // A partial transfer is credit only after canonical confirmation depth.
  if (["underpaid", "manual_review"].includes(evaluation.decision)
      && evaluation.receivedAmount && evaluation.confirmations < row.minimum_confirmations) {
    evaluation.decision = "pending_confirmations";
    evaluation.reason = "insufficient_confirmations";
  }
  let decision = targetStatus(evaluation);
  let creditEligible = decision === "confirmed" || decision === "underpaid"
    || (decision === "manual_review" && evaluation.reason === "received_more_than_expected");
  if (creditEligible) {
    try { decimalToUnits(evaluation.receivedAmount!, 6); }
    catch { creditEligible = false; decision = "manual_review"; evaluation.reason = "credit_precision_requires_review"; }
  }
  if (decision === "retryable") return persistRetryableResult(row, evaluation.reason, evaluation);
  let custodyEvidence: CustodyEvidence | null = null;
  let custodyDecision: CustodyDecision | null = null;
  if (creditEligible && row.custody_reconciliation_required) {
    try {
      custodyEvidence = await custodyReader({
        provider: row.provider,
        network: row.network,
        transactionHash: row.transaction_hash,
        receiverAddress: row.address_reference,
        currency: "USDT",
        expectedAmount: evaluation.receivedAmount!,
        tokenDecimals: row.decimals,
      });
    } catch (error) {
      if (error instanceof CustodyProviderUnavailable) return persistRetryableResult(row, error.message, evaluation);
      throw error;
    }
    custodyDecision = evaluateCustodyEvidence({
      provider: row.provider,
      network: row.network,
      transactionHash: row.transaction_hash,
      receiverAddress: row.address_reference,
      currency: "USDT",
      expectedAmount: evaluation.receivedAmount!,
      tokenDecimals: row.decimals,
    }, custodyEvidence);
    await recordCustodyEvidence(row.attempt_id, custodyEvidence, custodyDecision);
    if (custodyDecision.decision === "retryable") return persistRetryableResult(row, custodyDecision.reason, evaluation);
    if (custodyDecision.decision === "manual_review") { decision = "manual_review"; creditEligible = false; }
  }
  let decisionReason = custodyDecision?.reason ?? evaluation.reason;

  const tx = await paymentsDb.begin();
  try {
    await tx.rawExec("SELECT pg_advisory_xact_lock(hashtext($1))", `payment-settle:${row.obligation_id}`);
    const locked = await tx.rawQueryRow<{ status: PaymentStatus; obligation_status: string }>(
      `SELECT i.status, o.status AS obligation_status
         FROM payment_intents i JOIN payment_obligations o ON o.id = i.order_id
        WHERE i.id = $1 FOR UPDATE OF i, o`,
      row.payment_intent_id,
    );
    if (!locked) throw APIError.notFound("Payment intent not found");
    if (locked.status === "settled" && locked.obligation_status === "paid") {
      await tx.commit();
      return { ...retryableResult(row, "already_settled"), status: "settled", confirmations: evaluation.confirmations };
    }
    const replayCredit = await tx.rawQueryRow<{ id: string }>(
      "SELECT id FROM payment_credits WHERE obligation_id=$1 AND provider=$2 AND provider_reference=$3 AND status='confirmed'",
      row.obligation_id, `chain:${row.network}`, row.transaction_hash.toLowerCase().replace(/^0x/, ""));
    if (replayCredit) {
      await tx.commit();
      return { ...retryableResult(row, "credit_already_recorded"), status: locked.status };
    }
    if (!["open", "partially_paid"].includes(locked.obligation_status)) {
      throw APIError.failedPrecondition("The obligation is not open for automatic settlement");
    }
    if (!["submitted", "verifying", "pending_confirmations"].includes(locked.status)) {
      throw APIError.failedPrecondition(`Payment intent cannot be verified while ${locked.status}`);
    }

    if (locked.status !== "verifying") {
      assertPaymentTransition(locked.status, "verifying");
      await tx.rawExec("UPDATE payment_intents SET status = 'verifying', updated_at = now() WHERE id = $1", row.payment_intent_id);
      await tx.rawExec(`INSERT INTO payment_state_history
        (payment_intent_id, prior_status, new_status, actor_type, actor_reference, evidence)
        VALUES ($1,$2,'verifying','system','chain.verify',$3::jsonb)`, row.payment_intent_id, locked.status,
      JSON.stringify({ attemptId: row.attempt_id }));
    }

    if (creditEligible) {
      const reference = row.transaction_hash.toLowerCase().replace(/^0x/, "");
      const provider = `chain:${row.network}`;
      await tx.rawExec(`INSERT INTO payment_credits
        (obligation_id,provider,provider_reference,asset,amount,status,evidence,observed_at,finalized_at)
        VALUES ($1,$2,$3,'USDT',$4::numeric,'confirmed',$5::jsonb,now(),now())
        ON CONFLICT (provider,provider_reference,asset) DO NOTHING`,
      row.obligation_id, provider, reference, evaluation.receivedAmount,
      JSON.stringify({ attemptId: row.attempt_id, confirmations: evaluation.confirmations, custodyRequired: row.custody_reconciliation_required }));
      const credit = await tx.rawQueryRow<{ obligation_id: string; amount: string; status: string }>(
        "SELECT obligation_id,amount::text AS amount,status FROM payment_credits WHERE provider=$1 AND provider_reference=$2 AND asset='USDT'", provider, reference);
      if (!credit || credit.obligation_id !== row.obligation_id || credit.status !== "confirmed"
        || decimalToUnits(credit.amount,6) !== decimalToUnits(evaluation.receivedAmount!,6)) {
        throw APIError.alreadyExists("Credit was already claimed with different evidence");
      }
      const credits = await tx.rawQueryAll<{ amount: string }>(
        "SELECT amount::text AS amount FROM payment_credits WHERE obligation_id=$1 AND status='confirmed'", row.obligation_id);
      const funding = classifyObligationFunding(row.expected_amount, credits.map((credit) => credit.amount));
      decision = funding.status === "paid" ? "confirmed" : funding.status === "review_required" ? "manual_review" : "underpaid";
      if (decision !== "confirmed") decisionReason = decision === "underpaid" ? "cumulative_credit_below_obligation" : "cumulative_credit_exceeds_obligation";
      await tx.rawExec("UPDATE payment_obligations SET status=$2,updated_at=now() WHERE id=$1 AND status IN ('open','partially_paid')",
        row.obligation_id, decision === "manual_review" ? "review_required" : "partially_paid");
    }
    const finalIntentStatus: PaymentStatus = decision === "confirmed" ? "settled" : decision;
    await tx.rawExec(`UPDATE payment_attempts SET verification_status = $2,
      chain_sender_wallet = $3, chain_receiver_wallet = $4, chain_amount = $5::numeric,
      block_number = $6, confirmations = $7, verification_error_code = $8,
      verification_error_detail = NULL, verified_at = now() WHERE id = $1`,
    row.attempt_id, decision, evaluation.sender, evaluation.receiver, evaluation.receivedAmount,
    evaluation.blockNumber ?? null, evaluation.confirmations,
    decision === "confirmed" ? null : decisionReason);

    if (decision === "confirmed") {
      assertPaymentTransition("verifying", "confirmed");
      assertPaymentTransition("confirmed", "settling");
      assertPaymentTransition("settling", "settled");
      await tx.rawExec(`UPDATE payment_intents SET status = 'settled', confirmed_at = COALESCE(confirmed_at, now()),
        settled_at = COALESCE(settled_at, now()), updated_at = now() WHERE id = $1`, row.payment_intent_id);
      await tx.rawExec(`UPDATE payment_obligations SET status = 'paid', settled_at = COALESCE(settled_at, now()),
        updated_at = now() WHERE id = $1 AND status IN ('open','partially_paid')`, row.obligation_id);
      await tx.rawExec(`INSERT INTO payment_settlements (obligation_id,currency,amount,status)
        VALUES ($1,'USDT',$2::numeric,'settled') ON CONFLICT (obligation_id) DO NOTHING`, row.obligation_id, row.expected_amount);
      await tx.rawExec(`INSERT INTO payment_state_history
        (payment_intent_id, prior_status, new_status, actor_type, actor_reference, evidence) VALUES
        ($1,'verifying','confirmed','system','chain.verify',$2::jsonb),
        ($1,'confirmed','settling','system','payment.settle','{}'::jsonb),
        ($1,'settling','settled','system','payment.settle',$3::jsonb)`, row.payment_intent_id,
      JSON.stringify({ attemptId: row.attempt_id, confirmations: evaluation.confirmations }),
      JSON.stringify({ obligationId: row.obligation_id, subjectType: row.subject_type, subjectReference: row.subject_reference }));
      await tx.rawExec(`INSERT INTO payment_events (payment_intent_id,event_key,event_type,payload) VALUES
        ($1,$2,'payment.confirmed',$3::jsonb),($1,$4,'payment.settled',$5::jsonb)
        ON CONFLICT (event_key) DO NOTHING`, row.payment_intent_id,
      `payment-intent:${row.payment_intent_id}:confirmed`, JSON.stringify({ attemptId: row.attempt_id }),
      `payment-intent:${row.payment_intent_id}:settled`, JSON.stringify({ obligationId: row.obligation_id, subjectType: row.subject_type, subjectReference: row.subject_reference }));
    } else {
      assertPaymentTransition("verifying", decision);
      await tx.rawExec("UPDATE payment_intents SET status = $2, updated_at = now() WHERE id = $1", row.payment_intent_id, decision);
      await tx.rawExec(`INSERT INTO payment_state_history
        (payment_intent_id, prior_status, new_status, actor_type, actor_reference, evidence)
        VALUES ($1,'verifying',$2,'system','chain.verify',$3::jsonb)`, row.payment_intent_id, decision,
      JSON.stringify({ attemptId: row.attempt_id, reason: decisionReason, confirmations: evaluation.confirmations }));
    }
    await tx.commit();
    return {
      paymentIntentId: row.payment_intent_id,
      paymentAttemptId: row.attempt_id,
      obligationId: row.obligation_id,
      subjectType: row.subject_type,
      subjectReference: row.subject_reference,
      transactionHash: row.transaction_hash,
      status: finalIntentStatus,
      confirmations: evaluation.confirmations,
      reason: decisionReason,
    };
  } catch (error) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    throw error;
  }
}

function normalizeCustodyHash(transactionHash: string): string {
  return transactionHash.trim().toLowerCase().replace(/^0x/, "");
}

async function recordCustodyEvidence(
  attemptId: string,
  evidence: CustodyEvidence,
  decision: CustodyDecision,
): Promise<void> {
  await paymentsDb.rawExec(`INSERT INTO payment_custody_evidence
    (payment_attempt_id,provider,provider_reference,transaction_hash,receiver_address,
     currency,amount,outcome,evidence_digest,observed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7::numeric,$8,$9,$10::timestamptz)
    ON CONFLICT (provider,provider_reference,evidence_digest) DO NOTHING`,
  attemptId, evidence.provider, evidence.providerReference,
  normalizeCustodyHash(evidence.transactionHash), evidence.receiverAddress,
  evidence.currency.toUpperCase(), evidence.amount, evidence.outcome,
  decision.digest, evidence.observedAt);
}
