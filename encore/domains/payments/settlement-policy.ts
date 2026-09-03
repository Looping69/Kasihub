// Author: Klaasvaakie ( |╲ )
import { decimalToUnits } from "./chains/amount";

export type ObligationFundingStatus = "open" | "partially_paid" | "paid" | "review_required";

export function classifyObligationFunding(due: string, confirmedCredits: readonly string[]): {
  status: ObligationFundingStatus;
  dueUnits: bigint;
  creditedUnits: bigint;
} {
  const dueUnits = decimalToUnits(due, 6);
  const creditedUnits = confirmedCredits.reduce((sum, amount) => sum + decimalToUnits(amount, 6), 0n);
  if (creditedUnits === 0n) return { status: "open", dueUnits, creditedUnits };
  if (creditedUnits < dueUnits) return { status: "partially_paid", dueUnits, creditedUnits };
  if (creditedUnits === dueUnits) return { status: "paid", dueUnits, creditedUnits };
  return { status: "review_required", dueUnits, creditedUnits };
}
