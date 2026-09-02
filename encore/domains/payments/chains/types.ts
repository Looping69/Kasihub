// Author: Klaasvaakie ( |╲ )
import type { ChainLog } from "./transfer";

export type SupportedPaymentNetwork = "tron" | "bsc";

/**
 * Provider-neutral facts returned by a chain adapter.
 *
 * Adapters do not decide whether Kasihub should credit a payment. They only
 * translate chain/provider responses into canonical evidence for the shared
 * verifier policy.
 */
export interface ChainTransactionEvidence {
  network: SupportedPaymentNetwork;
  transactionHash: string;
  visible: boolean;
  execution: "success" | "failed" | "pending";
  blockNumber: bigint | null;
  blockTimestamp: string | null;
  latestBlockNumber: bigint | null;
  sender: string | null;
  logs: ChainLog[];
  providerReference?: string;
}

export interface PaymentVerificationExpectation {
  network: SupportedPaymentNetwork;
  transactionHash: string;
  tokenContract: string;
  receivingAddress: string;
  expectedAmount: string;
  tokenDecimals: number;
  minimumConfirmations: number;
}

export type PaymentEvidenceDecision =
  | "retryable"
  | "rejected"
  | "pending_confirmations"
  | "underpaid"
  | "manual_review"
  | "confirmed";

export interface PaymentEvidenceEvaluation {
  decision: PaymentEvidenceDecision;
  reason: string;
  confirmations: number;
  sender: string | null;
  receiver: string | null;
  receivedAmount: string | null;
  receivedAmountUnits: bigint | null;
  blockNumber: bigint | null;
  blockTimestamp: string | null;
}
