// Author: Klaasvaakie ( |╲ )

export type PaymentStatus =
  | "created"
  | "awaiting_transfer"
  | "submitted"
  | "verifying"
  | "pending_confirmations"
  | "underpaid"
  | "manual_review"
  | "confirmed"
  | "settling"
  | "settled"
  | "expired"
  | "failed"
  | "rejected"
  | "cancelled";

const transitions: Record<PaymentStatus, ReadonlySet<PaymentStatus>> = {
  created: new Set(["awaiting_transfer", "cancelled"]),
  awaiting_transfer: new Set(["submitted", "expired", "cancelled"]),
  submitted: new Set(["verifying"]),
  verifying: new Set(["pending_confirmations", "underpaid", "manual_review", "confirmed", "failed", "rejected"]),
  pending_confirmations: new Set(["verifying", "manual_review", "failed"]),
  underpaid: new Set(["submitted", "manual_review", "rejected", "expired", "cancelled"]),
  manual_review: new Set(["verifying", "confirmed", "rejected"]),
  confirmed: new Set(["settling"]),
  settling: new Set(["settled", "confirmed"]),
  settled: new Set(),
  expired: new Set(),
  failed: new Set(),
  rejected: new Set(),
  cancelled: new Set(),
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return transitions[from].has(to);
}

export function assertPaymentTransition(from: PaymentStatus, to: PaymentStatus): void {
  if (!canTransitionPayment(from, to)) {
    throw new Error(`invalid_payment_transition:${from}->${to}`);
  }
}
