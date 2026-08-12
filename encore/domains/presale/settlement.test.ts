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
});
