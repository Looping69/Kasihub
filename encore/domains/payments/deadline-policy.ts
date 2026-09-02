// Author: Klaasvaakie ( |╲ )
export type TransactionDeadlineDecision = "on_time" | "late" | "manual_review";

export function classifyTransactionDeadline(blockTimestamp: string | null, expiresAt: string): TransactionDeadlineDecision {
  const deadline = Date.parse(expiresAt);
  if (!Number.isFinite(deadline)) throw new Error("payment_deadline_invalid");
  if (!blockTimestamp) return "manual_review";
  const minedAt = Date.parse(blockTimestamp);
  if (!Number.isFinite(minedAt)) return "manual_review";
  return minedAt <= deadline ? "on_time" : "late";
}
