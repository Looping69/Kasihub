// Author: Klaasvaakie ( |╲ )

export type SplitRule = {
  recipientType: string;
  basisPoints: number;
};

export type SplitPolicy = {
  key: string;
  version: number;
  status: "draft" | "active" | "suspended" | "retired";
  remainderRecipientType: string;
  rules: readonly SplitRule[];
};

export type SplitAllocation = {
  recipientType: string;
  basisPoints: number;
  cents: number;
  remainderCents: number;
};

export type FixedAllocationRule = {
  recipientType: string;
  cents: number;
};

const BASIS_POINT_DENOMINATOR = 10_000n;

export function validateSplitPolicy(policy: SplitPolicy): void {
  if (!policy.key.trim() || !Number.isSafeInteger(policy.version) || policy.version <= 0) {
    throw new Error("invalid_split_policy_identity");
  }
  if (policy.rules.length === 0) throw new Error("split_policy_rules_required");
  if (!policy.rules.some((rule) => rule.recipientType === policy.remainderRecipientType)) {
    throw new Error("split_policy_remainder_recipient_missing");
  }

  const seen = new Set<string>();
  let totalBasisPoints = 0;
  for (const rule of policy.rules) {
    if (!rule.recipientType.trim() || seen.has(rule.recipientType)) throw new Error("invalid_split_policy_recipient");
    if (!Number.isSafeInteger(rule.basisPoints) || rule.basisPoints < 0) throw new Error("invalid_split_policy_basis_points");
    seen.add(rule.recipientType);
    totalBasisPoints += rule.basisPoints;
  }
  if (totalBasisPoints !== Number(BASIS_POINT_DENOMINATOR)) throw new Error("split_policy_must_total_100_percent");
}

export function allocateBySplitPolicy(totalCents: number, policy: SplitPolicy): SplitAllocation[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) throw new Error("invalid_split_total_cents");
  validateSplitPolicy(policy);

  const total = BigInt(totalCents);
  const allocations = policy.rules.map((rule) => ({
    recipientType: rule.recipientType,
    basisPoints: rule.basisPoints,
    cents: Number((total * BigInt(rule.basisPoints)) / BASIS_POINT_DENOMINATOR),
    remainderCents: 0,
  }));

  const allocated = allocations.reduce((sum, item) => sum + item.cents, 0);
  const remainder = totalCents - allocated;
  if (remainder < 0) throw new Error("split_allocation_overflow");

  if (remainder > 0) {
    const target = allocations.find((item) => item.recipientType === policy.remainderRecipientType);
    if (!target) throw new Error("split_policy_remainder_recipient_missing");
    target.cents += remainder;
    target.remainderCents = remainder;
  }

  const finalTotal = allocations.reduce((sum, item) => sum + item.cents, 0);
  if (finalTotal !== totalCents) throw new Error("split_allocation_not_conserved");
  return allocations;
}

export function allocateFixedCents(totalCents: number, rules: readonly FixedAllocationRule[], fallbackRecipientType: string): SplitAllocation[] {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0 || rules.length === 0) throw new Error("invalid_fixed_allocation_input");
  if (!fallbackRecipientType.trim()) throw new Error("fixed_allocation_fallback_required");

  const seen = new Set<string>();
  let requested = 0;
  for (const rule of rules) {
    if (!rule.recipientType.trim() || seen.has(rule.recipientType)) throw new Error("invalid_fixed_allocation_recipient");
    if (!Number.isSafeInteger(rule.cents) || rule.cents < 0) throw new Error("invalid_fixed_allocation_cents");
    seen.add(rule.recipientType);
    requested += rule.cents;
  }
  if (requested > totalCents) throw new Error("fixed_allocation_exceeds_total");

  const allocations: SplitAllocation[] = rules.map((rule) => ({
    recipientType: rule.recipientType,
    basisPoints: 0,
    cents: rule.cents,
    remainderCents: 0,
  }));

  const remainder = totalCents - requested;
  if (remainder > 0) {
    const existing = allocations.find((item) => item.recipientType === fallbackRecipientType);
    if (existing) {
      existing.cents += remainder;
      existing.remainderCents += remainder;
    } else {
      allocations.push({ recipientType: fallbackRecipientType, basisPoints: 0, cents: remainder, remainderCents: remainder });
    }
  }

  if (allocations.reduce((sum, item) => sum + item.cents, 0) !== totalCents) throw new Error("fixed_allocation_not_conserved");
  return allocations;
}
