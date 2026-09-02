// Author: Klaasvaakie ( |╲ )
import { compareUnits, decimalToUnits, unitsToDecimal } from "./amount";
import { normalizeChainAddress } from "./address";
import { normalizeTransactionHash } from "./hash";
import { matchingTokenTransfers } from "./transfer";
import type {
  ChainTransactionEvidence,
  PaymentEvidenceEvaluation,
  PaymentVerificationExpectation,
} from "./types";

function confirmationsFor(evidence: ChainTransactionEvidence): number {
  if (evidence.blockNumber === null || evidence.latestBlockNumber === null) return 0;
  if (evidence.latestBlockNumber < evidence.blockNumber) return 0;
  const count = evidence.latestBlockNumber - evidence.blockNumber + 1n;
  return count > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(count);
}

export function evaluatePaymentEvidence(
  expectation: PaymentVerificationExpectation,
  evidence: ChainTransactionEvidence,
): PaymentEvidenceEvaluation {
  const base = {
    confirmations: confirmationsFor(evidence),
    sender: evidence.sender,
    receiver: null,
    receivedAmount: null,
    receivedAmountUnits: null,
    blockNumber: evidence.blockNumber,
    blockTimestamp: evidence.blockTimestamp,
  };

  if (evidence.network !== expectation.network) {
    return { ...base, decision: "rejected", reason: "network_mismatch" };
  }
  if (normalizeTransactionHash(evidence.transactionHash) !== normalizeTransactionHash(expectation.transactionHash)) {
    return { ...base, decision: "rejected", reason: "transaction_hash_mismatch" };
  }
  if (!evidence.visible) {
    return { ...base, decision: "retryable", reason: "transaction_not_visible" };
  }
  if (evidence.execution === "pending") {
    return { ...base, decision: "retryable", reason: "transaction_execution_pending" };
  }
  if (evidence.execution === "failed") {
    return { ...base, decision: "rejected", reason: "transaction_execution_failed" };
  }

  const token = normalizeChainAddress(expectation.network, expectation.tokenContract);
  const receiver = normalizeChainAddress(expectation.network, expectation.receivingAddress);
  const matching = matchingTokenTransfers(evidence.logs, token, receiver);
  if (matching.transfers.length === 0 || matching.totalUnits === 0n) {
    return {
      ...base,
      receiver,
      decision: "rejected",
      reason: "expected_token_transfer_not_found",
    };
  }

  const expectedUnits = decimalToUnits(expectation.expectedAmount, expectation.tokenDecimals);
  const receivedAmount = unitsToDecimal(matching.totalUnits, expectation.tokenDecimals);
  const senderSet = new Set(matching.transfers.map((transfer) => transfer.sender));
  const canonicalSender = senderSet.size === 1 ? (matching.transfers[0]?.sender ?? evidence.sender) : evidence.sender;
  const amountComparison = compareUnits(matching.totalUnits, expectedUnits);
  const matched = {
    confirmations: base.confirmations,
    sender: canonicalSender,
    receiver,
    receivedAmount,
    receivedAmountUnits: matching.totalUnits,
    blockNumber: evidence.blockNumber,
    blockTimestamp: evidence.blockTimestamp,
  };

  if (amountComparison === "underpaid") {
    return { ...matched, decision: "underpaid", reason: "received_less_than_expected" };
  }
  if (amountComparison === "overpaid") {
    return { ...matched, decision: "manual_review", reason: "received_more_than_expected" };
  }
  if (base.confirmations < expectation.minimumConfirmations) {
    return { ...matched, decision: "pending_confirmations", reason: "insufficient_confirmations" };
  }
  return { ...matched, decision: "confirmed", reason: "chain_evidence_satisfied" };
}
