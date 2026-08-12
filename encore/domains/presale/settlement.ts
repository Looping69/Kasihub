// Author: Klaasvaakie ( |╲ )
export function issuedSharesForPresale(paidShares: number, bonusBuyOneGet: boolean): number {
  if (!Number.isInteger(paidShares) || paidShares < 1) throw new Error("invalid_paid_share_quantity");
  return bonusBuyOneGet ? paidShares * 2 : paidShares;
}

export function quotedUsdtAmount(priceUsd: string, usdtPerUsd: string, quantity: number): { unitUsdt: string; totalUsdt: string; totalUsd: string } {
  const usd = Number(priceUsd);
  const rate = Number(usdtPerUsd);
  if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(rate) || rate <= 0 || !Number.isInteger(quantity) || quantity < 1) throw new Error("invalid_presale_quote");
  return { unitUsdt: (usd * rate).toFixed(6), totalUsdt: (usd * rate * quantity).toFixed(6), totalUsd: (usd * quantity).toFixed(6) };
}
