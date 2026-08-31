// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { availablePaidShares, formatUsdt, multiplyDecimalByWhole } from "./presale-display";

describe("presale display contracts", () => {
  test.each([
    ["25.000000", "25"],
    ["25.500000", "25.5"],
    ["1234.123456", "1,234.123456"],
  ])("formats %s without meaningless zeroes", (value, expected) => {
    expect(formatUsdt(value)).toBe(expected);
  });

  test("uses the invitation and campaign inventory instead of a global 300-share cap", () => {
    expect(availablePaidShares(750, 2_000)).toBe(750);
    expect(availablePaidShares(1_500, 900)).toBe(900);
  });

  test.each([
    ["25.000000", "3", "75"],
    ["0.10", 3, "0.3"],
    ["450.25", 2, "900.5"],
  ])("multiplies %s by %s without floating-point drift", (value, quantity, expected) => {
    expect(multiplyDecimalByWhole(value, quantity)).toBe(expected);
  });

  test("rejects malformed decimals and quantities", () => {
    expect(multiplyDecimalByWhole("not-a-price", 2)).toBeNull();
    expect(multiplyDecimalByWhole("25.00", "1.5")).toBeNull();
  });
});
