// Author: Klaasvaakie ( |╲ )
import { createHash } from "node:crypto";
import { normalizeChainAddress } from "./chains/address";
import { decimalToUnits } from "./chains/amount";
import { normalizeTransactionHash } from "./chains/hash";
import type { SupportedPaymentNetwork } from "./chains/types";

export type CustodyEvidence = {
  provider: string;
  providerReference: string;
  transactionHash: string;
  receiverAddress: string;
  currency: string;
  amount: string;
  outcome: "confirmed" | "pending" | "mismatch" | "reversed";
  observedAt: string;
};

export type CustodyExpectation = {
  provider: string;
  network: SupportedPaymentNetwork;
  transactionHash: string;
  receiverAddress: string;
  currency: string;
  expectedAmount: string;
  tokenDecimals: number;
};

export type CustodyDecision = {
  decision: "confirmed" | "retryable" | "manual_review";
  reason: string;
  digest: string;
};

export function evaluateCustodyEvidence(
  expectation: CustodyExpectation,
  evidence: CustodyEvidence,
): CustodyDecision {
  const digest = createHash("sha256").update(JSON.stringify([
    evidence.provider.toLowerCase(),
    evidence.providerReference,
    evidence.transactionHash.toLowerCase().replace(/^0x/, ""),
    evidence.receiverAddress.toLowerCase(),
    evidence.currency.toUpperCase(),
    evidence.amount,
    evidence.outcome,
    evidence.observedAt,
  ])).digest("hex");
  if (evidence.provider.toLowerCase() !== expectation.provider.toLowerCase()) {
    return { decision: "manual_review", reason: "custody_provider_mismatch", digest };
  }
  if (normalizeTransactionHash(evidence.transactionHash) !== normalizeTransactionHash(expectation.transactionHash)) {
    return { decision: "manual_review", reason: "custody_transaction_mismatch", digest };
  }
  if (normalizeChainAddress(expectation.network, evidence.receiverAddress)
      !== normalizeChainAddress(expectation.network, expectation.receiverAddress)) {
    return { decision: "manual_review", reason: "custody_receiver_mismatch", digest };
  }
  if (evidence.currency.toUpperCase() !== expectation.currency.toUpperCase()) {
    return { decision: "manual_review", reason: "custody_currency_mismatch", digest };
  }
  if (decimalToUnits(evidence.amount, expectation.tokenDecimals)
      !== decimalToUnits(expectation.expectedAmount, expectation.tokenDecimals)) {
    return { decision: "manual_review", reason: "custody_amount_mismatch", digest };
  }
  if (evidence.outcome === "pending") return { decision: "retryable", reason: "custody_pending", digest };
  if (evidence.outcome !== "confirmed") {
    return { decision: "manual_review", reason: `custody_${evidence.outcome}`, digest };
  }
  return { decision: "confirmed", reason: "custody_evidence_satisfied", digest };
}
