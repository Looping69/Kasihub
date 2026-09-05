// Author: Klaasvaakie ( |╲ )
export function issuedSharesForPresale(paidShares: number, bonusBuyOneGet: boolean): number {
  if (!Number.isInteger(paidShares) || paidShares < 1) throw new Error("invalid_paid_share_quantity");
  return bonusBuyOneGet ? paidShares * 2 : paidShares;
}

export function resolveCryptoTestSettlement(input: {
  paymentRail: "remitano_usdt" | "webpay_card" | "complimentary_coupon";
  campaignTestUnitPriceUsdt: string | null;
  campaignTestOrdersRemaining: number;
}): { settlementUnitUsdtOverride: string | null; campaignTestPriceApplied: boolean } {
  const campaignTestPriceApplied = input.paymentRail === "remitano_usdt"
    && input.campaignTestOrdersRemaining > 0
    && Boolean(input.campaignTestUnitPriceUsdt);
  return {
    settlementUnitUsdtOverride: campaignTestPriceApplied ? input.campaignTestUnitPriceUsdt : null,
    campaignTestPriceApplied,
  };
}

export function quotedUsdtAmount(
  priceUsd: string,
  usdtPerUsd: string,
  quantity: number,
  settlementUnitUsdtOverride?: string | null,
): { unitUsdt: string; totalUsdt: string; totalUsd: string } {
  const usd = Number(priceUsd);
  const rate = Number(usdtPerUsd);
  const settlementUnitUsdt = settlementUnitUsdtOverride == null ? usd * rate : Number(settlementUnitUsdtOverride);
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rate) || rate <= 0
    || !Number.isFinite(settlementUnitUsdt) || settlementUnitUsdt <= 0
    || !Number.isInteger(quantity) || quantity < 1) throw new Error("invalid_presale_quote");
  return {
    unitUsdt: settlementUnitUsdt.toFixed(6),
    totalUsdt: (settlementUnitUsdt * quantity).toFixed(6),
    totalUsd: (usd * quantity).toFixed(6),
  };
}
