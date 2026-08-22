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
