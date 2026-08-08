// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { assertPaymentTransition, canTransitionPayment } from "./state-machine";

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

  it("rejects unsafe jumps", () => {
    expect(() => assertPaymentTransition("submitted", "settled")).toThrow("invalid_payment_transition");
    expect(() => assertPaymentTransition("awaiting_transfer", "confirmed")).toThrow("invalid_payment_transition");
    expect(() => assertPaymentTransition("settled", "confirmed")).toThrow("invalid_payment_transition");
  });
});
