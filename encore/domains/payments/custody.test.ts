// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { evaluateCustodyEvidence, type CustodyEvidence, type CustodyExpectation } from "./custody";

const HASH = "a".repeat(64);
const expectation: CustodyExpectation = {
  provider: "remitano",
  network: "bsc",
  transactionHash: HASH,
  receiverAddress: `0x${"22".repeat(20)}`,
  currency: "USDT",
  expectedAmount: "25",
  tokenDecimals: 6,
};

function evidence(overrides: Partial<CustodyEvidence> = {}): CustodyEvidence {
  return {
    provider: "remitano",
    providerReference: "deposit-1",
    transactionHash: HASH,
    receiverAddress: expectation.receiverAddress,
    currency: "USDT",
    amount: "25.000000",
    outcome: "confirmed",
    observedAt: "2026-08-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("custody reconciliation policy", () => {
  it("accepts an exact confirmed provider record", () => {
    expect(evaluateCustodyEvidence(expectation, evidence())).toMatchObject({
      decision: "confirmed",
      reason: "custody_evidence_satisfied",
    });
  });

  it.each([
    [{ provider: "other" }, "custody_provider_mismatch"],
    [{ receiverAddress: `0x${"33".repeat(20)}` }, "custody_receiver_mismatch"],
    [{ amount: "24.999999" }, "custody_amount_mismatch"],
    [{ currency: "USD" }, "custody_currency_mismatch"],
    [{ outcome: "reversed" as const }, "custody_reversed"],
  ])("routes contradictory evidence to manual review", (override, reason) => {
    expect(evaluateCustodyEvidence(expectation, evidence(override))).toMatchObject({
      decision: "manual_review",
      reason,
    });
  });

  it("keeps a pending custodian record retryable", () => {
    expect(evaluateCustodyEvidence(expectation, evidence({ outcome: "pending" }))).toMatchObject({
      decision: "retryable",
      reason: "custody_pending",
    });
  });
});
