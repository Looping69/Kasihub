// Author: Klaasvaakie ( |╲ )
import { createHash } from "node:crypto";

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, stableValue(item)]));
  }
  return value;
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function requestHash(payload: unknown): string {
  return sha256(JSON.stringify(stableValue(payload)));
}

export function idempotencyDecision(existingHash: string | null, incomingHash: string): "create" | "replay" | "conflict" {
  if (!existingHash) return "create";
  return existingHash === incomingHash ? "replay" : "conflict";
}

export function normalizeLegacyWalletBalance(value: string | number): { available: string; deficit: string } {
  const balance = Number(value);
  if (!Number.isFinite(balance)) throw new RangeError("Legacy wallet balance is invalid");
  return {
    available: Math.max(balance, 0).toFixed(2),
    deficit: Math.max(-balance, 0).toFixed(2),
  };
}
