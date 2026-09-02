// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { evaluatePaymentEvidence } from "./evaluate";
import { TOKEN_TRANSFER_TOPIC } from "./transfer";
import type { ChainTransactionEvidence, PaymentVerificationExpectation } from "./types";

const HASH = "a".repeat(64);
const TOKEN = "11".repeat(20);
const RECEIVER = "22".repeat(20);
const SENDER = "33".repeat(20);

function addressTopic(address: string): string {
  return `0x${"0".repeat(24)}${address}`;
}

function amountData(value: bigint): string {
  return `0x${value.toString(16).padStart(64, "0")}`;
}

const expectation: PaymentVerificationExpectation = {
  network: "bsc",
  transactionHash: HASH,
  tokenContract: `0x${TOKEN}`,
  receivingAddress: `0x${RECEIVER}`,
  expectedAmount: "25",
  tokenDecimals: 6,
  minimumConfirmations: 3,
};

function evidence(overrides: Partial<ChainTransactionEvidence> = {}): ChainTransactionEvidence {
  return {
    network: "bsc",
    transactionHash: `0x${HASH}`,
    visible: true,
    execution: "success",
    blockNumber: 100n,
    blockTimestamp: new Date().toISOString(),
    latestBlockNumber: 102n,
    sender: SENDER,
    logs: [{
      address: `0x${TOKEN}`,
      topics: [`0x${TOKEN_TRANSFER_TOPIC}`, addressTopic(SENDER), addressTopic(RECEIVER)],
      data: amountData(25_000_000n),
    }],
    ...overrides,
  };
}

describe("shared payment evidence evaluation", () => {
  it("confirms only exact amount with enough confirmations", () => {
    expect(evaluatePaymentEvidence(expectation, evidence())).toMatchObject({
      decision: "confirmed",
      reason: "chain_evidence_satisfied",
      confirmations: 3,
      receiver: RECEIVER,
      receivedAmount: "25",
    });
  });

  it("keeps invisible and pending transactions retryable", () => {
    expect(evaluatePaymentEvidence(expectation, evidence({ visible: false, logs: [] })).decision).toBe("retryable");
    expect(evaluatePaymentEvidence(expectation, evidence({ execution: "pending", logs: [] })).decision).toBe("retryable");
  });

  it("rejects failed execution and missing expected-token evidence", () => {
    expect(evaluatePaymentEvidence(expectation, evidence({ execution: "failed" })).decision).toBe("rejected");
    expect(evaluatePaymentEvidence(expectation, evidence({ logs: [] }))).toMatchObject({
      decision: "rejected",
      reason: "expected_token_transfer_not_found",
    });
  });

  it("classifies underpayment and overpayment without floating point", () => {
    expect(evaluatePaymentEvidence(expectation, evidence({
      logs: [{ address: TOKEN, topics: [TOKEN_TRANSFER_TOPIC, addressTopic(SENDER), addressTopic(RECEIVER)], data: amountData(24_999_999n) }],
    })).decision).toBe("underpaid");
    expect(evaluatePaymentEvidence(expectation, evidence({
      logs: [{ address: TOKEN, topics: [TOKEN_TRANSFER_TOPIC, addressTopic(SENDER), addressTopic(RECEIVER)], data: amountData(25_000_001n) }],
    })).decision).toBe("manual_review");
  });

  it("waits for the configured confirmation threshold", () => {
    expect(evaluatePaymentEvidence(expectation, evidence({ latestBlockNumber: 101n }))).toMatchObject({
      decision: "pending_confirmations",
      confirmations: 2,
    });
  });

  it("rejects network and transaction-hash mismatches", () => {
    expect(evaluatePaymentEvidence(expectation, evidence({ network: "tron" }))).toMatchObject({ decision: "rejected", reason: "network_mismatch" });
    expect(evaluatePaymentEvidence(expectation, evidence({ transactionHash: "b".repeat(64) }))).toMatchObject({ decision: "rejected", reason: "transaction_hash_mismatch" });
  });
});
