// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { compareUnits, decimalToUnits, unitsToDecimal } from "./amount";

describe("token amount arithmetic", () => {
  it("converts decimal strings without floating-point arithmetic", () => {
    expect(decimalToUnits("25", 6)).toBe(25_000_000n);
    expect(decimalToUnits("25.123456", 6)).toBe(25_123_456n);
    expect(decimalToUnits("0.000001", 6)).toBe(1n);
  });

  it("rejects precision that would change value", () => {
    expect(() => decimalToUnits("1.0000001", 6)).toThrow("amount_exceeds_token_precision");
    expect(decimalToUnits("1.0000000", 6)).toBe(1_000_000n);
  });

  it("formats canonical decimal amounts", () => {
    expect(unitsToDecimal(25_000_000n, 6)).toBe("25");
    expect(unitsToDecimal(25_123_400n, 6)).toBe("25.1234");
  });

  it("classifies exact, underpaid and overpaid values", () => {
    expect(compareUnits(10n, 10n)).toBe("exact");
    expect(compareUnits(9n, 10n)).toBe("underpaid");
    expect(compareUnits(11n, 10n)).toBe("overpaid");
  });
});
