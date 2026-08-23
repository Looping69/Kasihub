// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { isPaymentRehearsalAllowed } from "./rehearsal-policy";

describe("payment rehearsal environment boundary", () => {
  it("allows only mock campaigns outside production", () => {
    expect(isPaymentRehearsalAllowed(true, "development")).toBe(true);
    expect(isPaymentRehearsalAllowed(true, "preview")).toBe(true);
    expect(isPaymentRehearsalAllowed(false, "development")).toBe(false);
  });

  it("always rejects production", () => {
    expect(isPaymentRehearsalAllowed(true, "production")).toBe(false);
    expect(isPaymentRehearsalAllowed(false, "production")).toBe(false);
  });
});
