// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { availablePaidShares, formatUsdt } from "./presale-display";

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
});
