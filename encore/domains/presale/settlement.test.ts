// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { issuedSharesForPresale, quotedUsdtAmount, resolveCryptoTestSettlement } from "./settlement";

describe("presale settlement rules", () => {
  test("quotes USD shares with a server-owned USDT rate", () => {
    expect(quotedUsdtAmount("25", "0.9975", 3)).toEqual({ unitUsdt: "24.937500", totalUsdt: "74.812500", totalUsd: "75.000000" });
  });
  test("applies a bounded crypto settlement override without changing the legal USD share value", () => {
    expect(quotedUsdtAmount("25", "1", 3, "1")).toEqual({
      unitUsdt: "1.000000",
      totalUsdt: "3.000000",
      totalUsd: "75.000000",
    });
  });
  test("applies bounded crypto pricing only to the crypto rail while slots remain", () => {
    expect(resolveCryptoTestSettlement({
      paymentRail: "remitano_usdt",
      campaignTestUnitPriceUsdt: "1.000000",
      campaignTestOrdersRemaining: 5,
    })).toEqual({ settlementUnitUsdtOverride: "1.000000", campaignTestPriceApplied: true });
    expect(resolveCryptoTestSettlement({
      paymentRail: "remitano_usdt",
      campaignTestUnitPriceUsdt: "1.000000",
      campaignTestOrdersRemaining: 0,
    })).toEqual({ settlementUnitUsdtOverride: null, campaignTestPriceApplied: false });
    expect(resolveCryptoTestSettlement({
      paymentRail: "webpay_card",
      campaignTestUnitPriceUsdt: "1.000000",
      campaignTestOrdersRemaining: 5,
    })).toEqual({ settlementUnitUsdtOverride: null, campaignTestPriceApplied: false });
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

  test.each(["0", "-1", "not-a-price"])("rejects an invalid crypto settlement override: %s", (override) => {
    expect(() => quotedUsdtAmount("25", "1", 1, override)).toThrow("invalid_presale_quote");
  });

  test("keeps monetary values fixed at six decimals across fractional rates", () => {
    expect(quotedUsdtAmount("0.1", "0.333333", 3)).toEqual({
      unitUsdt: "0.033333",
      totalUsdt: "0.100000",
      totalUsd: "0.300000",
    });
  });
});
