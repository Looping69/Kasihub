// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { isPaymentRehearsalAllowed } from "./rehearsal-policy";

describe("payment rehearsal environment boundary", () => {
  it("allows only mock campaigns outside production", () => {
    expect(isPaymentRehearsalAllowed(true, "staging")).toBe(true);
    expect(isPaymentRehearsalAllowed(true, "local")).toBe(true);
    expect(isPaymentRehearsalAllowed(true, "test")).toBe(true);
    expect(isPaymentRehearsalAllowed(false, "staging")).toBe(false);
  });

  it("always rejects production", () => {
    expect(isPaymentRehearsalAllowed(true, "production")).toBe(false);
    expect(isPaymentRehearsalAllowed(false, "production")).toBe(false);
    expect(isPaymentRehearsalAllowed(true, "preview-pr-123")).toBe(false);
  });
});
