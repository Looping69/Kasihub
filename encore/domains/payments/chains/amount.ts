// Author: Klaasvaakie ( |╲ )

export function decimalToUnits(value: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("invalid_token_decimals");
  }
  const normalized = value.trim();
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) throw new Error("invalid_decimal_amount");
  const [whole, fraction = ""] = normalized.split(".");
  if (fraction.length > decimals) {
    const excess = fraction.slice(decimals);
    if (/[1-9]/.test(excess)) throw new Error("amount_exceeds_token_precision");
  }
  const fractionPadded = fraction.slice(0, decimals).padEnd(decimals, "0");
  return BigInt(`${whole}${fractionPadded}` || "0");
}

export function unitsToDecimal(value: bigint, decimals: number): string {
  if (value < 0n) throw new Error("negative_token_amount");
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error("invalid_token_decimals");
  }
  if (decimals === 0) return value.toString();
  const raw = value.toString().padStart(decimals + 1, "0");
  const whole = raw.slice(0, -decimals);
  const fraction = raw.slice(-decimals).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

export type AmountComparison = "exact" | "underpaid" | "overpaid";

export function compareUnits(actual: bigint, expected: bigint): AmountComparison {
  if (actual === expected) return "exact";
  return actual < expected ? "underpaid" : "overpaid";
}
