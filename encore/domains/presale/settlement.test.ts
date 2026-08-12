// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { issuedSharesForPresale, quotedUsdtAmount } from "./settlement";

describe("presale settlement rules", () => {
  test("quotes USD shares with a server-owned USDT rate", () => {
    expect(quotedUsdtAmount("25", "0.9975", 3)).toEqual({ unitUsdt: "24.937500", totalUsdt: "74.812500", totalUsd: "75.000000" });
  });
  test("phase BOGO issues two shares per paid share", () => {
    expect(issuedSharesForPresale(7, true)).toBe(14);
    expect(issuedSharesForPresale(7, false)).toBe(7);
  });

  test.each([0, -1, 1.5, Number.NaN])("rejects an unsafe paid-share quantity: %s", (quantity) => {
    expect(() => issuedSharesForPresale(quantity, true)).toThrow("invalid_paid_share_quantity");
  });

  test.each([
    ["0", "1", 1],
    ["25", "0", 1],
    ["25", "1", 0],
    ["not-a-price", "1", 1],
    ["25", "not-a-rate", 1],
    ["25", "1", 1.5],
  ])("rejects an invalid server quote (%s, %s, %s)", (priceUsd, usdtPerUsd, quantity) => {
    expect(() => quotedUsdtAmount(priceUsd, usdtPerUsd, quantity)).toThrow("invalid_presale_quote");
  });

  test("keeps monetary values fixed at six decimals across fractional rates", () => {
    expect(quotedUsdtAmount("0.1", "0.333333", 3)).toEqual({
      unitUsdt: "0.033333",
      totalUsdt: "0.100000",
      totalUsd: "0.300000",
    });
  });
});
