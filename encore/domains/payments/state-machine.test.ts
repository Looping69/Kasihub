// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { assertPaymentTransition, canTransitionPayment, type PaymentStatus } from "./state-machine";

const statuses: PaymentStatus[] = [
  "created", "awaiting_transfer", "submitted", "verifying", "pending_confirmations",
  "underpaid", "manual_review", "confirmed", "settling", "settled", "expired",
  "failed", "rejected", "cancelled",
];

describe("payment state machine", () => {
  it("allows the normal happy path", () => {
    expect(canTransitionPayment("created", "awaiting_transfer")).toBe(true);
    expect(canTransitionPayment("awaiting_transfer", "submitted")).toBe(true);
    expect(canTransitionPayment("submitted", "verifying")).toBe(true);
    expect(canTransitionPayment("verifying", "confirmed")).toBe(true);
    expect(canTransitionPayment("confirmed", "settling")).toBe(true);
    expect(canTransitionPayment("settling", "settled")).toBe(true);
  });

  it("keeps settlement retryable without re-confirming payment", () => {
    expect(canTransitionPayment("settling", "confirmed")).toBe(true);
  });

  it("allows an underpaid intent to be retried or expire", () => {
    expect(canTransitionPayment("underpaid", "submitted")).toBe(true);
    expect(canTransitionPayment("underpaid", "manual_review")).toBe(true);
    expect(canTransitionPayment("underpaid", "expired")).toBe(true);
    expect(canTransitionPayment("underpaid", "cancelled")).toBe(true);
  });

  it("rejects unsafe jumps", () => {
    expect(() => assertPaymentTransition("submitted", "settled")).toThrow("invalid_payment_transition");
    expect(() => assertPaymentTransition("awaiting_transfer", "confirmed")).toThrow("invalid_payment_transition");
    expect(() => assertPaymentTransition("settled", "confirmed")).toThrow("invalid_payment_transition");
  });

  it("makes every terminal payment state irreversible", () => {
    for (const terminal of ["settled", "expired", "failed", "rejected", "cancelled"] as const) {
      for (const target of statuses) expect(canTransitionPayment(terminal, target)).toBe(false);
    }
  });
});
