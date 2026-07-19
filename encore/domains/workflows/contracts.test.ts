// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { idempotencyDecision, normalizeLegacyWalletBalance, requestHash } from "./contracts";

describe("idempotency contracts", () => {
  test("equivalent objects produce the same request hash", () => {
    expect(requestHash({ quantity: 2, profileId: "a", nested: { z: 1, a: 2 } }))
      .toBe(requestHash({ nested: { a: 2, z: 1 }, profileId: "a", quantity: 2 }));
  });

  test("same key payload replays and changed payload conflicts", () => {
    const original = requestHash({ quantity: 2 });
    expect(idempotencyDecision(null, original)).toBe("create");
    expect(idempotencyDecision(original, requestHash({ quantity: 2 }))).toBe("replay");
    expect(idempotencyDecision(original, requestHash({ quantity: 3 }))).toBe("conflict");
  });
});

describe("legacy wallet opening contracts", () => {
  test("keeps positive funds spendable and records no deficit", () => {
    expect(normalizeLegacyWalletBalance("125.50")).toEqual({ available: "125.50", deficit: "0.00" });
  });

  test("prevents negative spendable balances while preserving the deficit", () => {
    expect(normalizeLegacyWalletBalance("-250.00")).toEqual({ available: "0.00", deficit: "250.00" });
  });

  test("rejects invalid legacy balances", () => {
    expect(() => normalizeLegacyWalletBalance("not-a-number")).toThrow(RangeError);
  });
});
