// Presentation-only helpers for the private presale. Server values remain authoritative.
// Author: Klaasvaakie ( |╲ )
export function formatUsdt(value: string | number): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "0";

  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6,
  });
}

export function availablePaidShares(invitationRemaining: number, campaignRemaining: number): number {
  return Math.max(0, Math.min(invitationRemaining, campaignRemaining));
}

/** Multiplies a server decimal by a whole-share quantity without binary floating-point drift. */
export function multiplyDecimalByWhole(value: string, quantity: string | number): string | null {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const wholeQuantity = typeof quantity === "number" ? quantity : Number(quantity);
  if (!Number.isSafeInteger(wholeQuantity) || wholeQuantity < 0) return null;
  const [whole, fraction = ""] = value.split(".");
  const scale = BigInt(10) ** BigInt(fraction.length);
  const scaled = BigInt(whole) * scale + BigInt(fraction || "0");
  const total = scaled * BigInt(wholeQuantity);
  const totalWhole = total / scale;
  if (fraction.length === 0) return totalWhole.toString();
  const totalFraction = (total % scale).toString().padStart(fraction.length, "0").replace(/0+$/, "");
  return totalFraction ? `${totalWhole}.${totalFraction}` : totalWhole.toString();
}
