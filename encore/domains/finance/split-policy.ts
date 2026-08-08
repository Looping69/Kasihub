// Author: Klaasvaakie ( |╲ )

export type SplitPolicyStatus = "draft" | "approved" | "active" | "suspended" | "retired";
export type RecipientMode = "system" | "dynamic";

export type SplitRule = {
  code: string;
  recipientType: string;
  recipientMode: RecipientMode;
  basisPoints: number;
  fallbackRecipientType?: string;
};

export type SplitPolicy = {
  key: string;
  version: number;
  status: SplitPolicyStatus;
  currency: string;
  minorUnitScale: number;
  remainderRuleCode: string;
  rules: readonly SplitRule[];
};

export type SplitAllocation = {
  ruleCode: string;
  recipientType: string;
  recipientMode: RecipientMode;
  fallbackRecipientType?: string;
  basisPoints: number;
  amountMinor: bigint;
  remainderMinor: bigint;
};

export type FixedAllocationRule = {
  code: string;
  recipientType: string;
  recipientMode: RecipientMode;
  amountMinor: bigint;
  fallbackRecipientType?: string;
};

export type FixedSplitPolicy = {
  key: string;
  version: number;
  status: SplitPolicyStatus;
  currency: string;
  minorUnitScale: number;
  expectedTotalMinor: bigint;
  rules: readonly FixedAllocationRule[];
};

export type RecipientResolution = {
  ruleCode: string;
  recipientType: string;
  recipientRef: string | null;
  fallbackApplied: boolean;
};

export type ResolvedAllocation = Omit<SplitAllocation, "recipientType"> & {
  sourceRecipientType: string;
  recipientType: string;
  recipientRef: string;
  fallbackApplied: boolean;
};

const BASIS_POINT_DENOMINATOR = 10_000n;

function validatePolicyIdentity(policy: {
  key: string;
  version: number;
  currency: string;
  minorUnitScale: number;
}): void {
  if (!policy.key.trim() || !Number.isSafeInteger(policy.version) || policy.version <= 0) {
    throw new Error("invalid_split_policy_identity");
  }
  if (!policy.currency.trim()) throw new Error("split_policy_currency_required");
  if (!Number.isSafeInteger(policy.minorUnitScale) || policy.minorUnitScale < 0 || policy.minorUnitScale > 18) {
    throw new Error("invalid_split_policy_minor_unit_scale");
  }
}

function validateRecipientMode(mode: RecipientMode): void {
  if (mode !== "system" && mode !== "dynamic") throw new Error("invalid_split_policy_recipient_mode");
}

export function validateSplitPolicy(policy: SplitPolicy): void {
  validatePolicyIdentity(policy);
  if (policy.rules.length === 0) throw new Error("split_policy_rules_required");
  if (!policy.rules.some((rule) => rule.code === policy.remainderRuleCode)) {
    throw new Error("split_policy_remainder_rule_missing");
  }

  const seenRuleCodes = new Set<string>();
  let totalBasisPoints = 0;
  for (const rule of policy.rules) {
    if (!rule.code.trim() || seenRuleCodes.has(rule.code)) throw new Error("invalid_split_policy_rule_code");
    if (!rule.recipientType.trim()) throw new Error("invalid_split_policy_recipient");
    validateRecipientMode(rule.recipientMode);
    if (!Number.isSafeInteger(rule.basisPoints) || rule.basisPoints < 0 || rule.basisPoints > 10_000) {
      throw new Error("invalid_split_policy_basis_points");
    }
    if (rule.fallbackRecipientType !== undefined && !rule.fallbackRecipientType.trim()) {
      throw new Error("invalid_split_policy_fallback_recipient");
    }
    seenRuleCodes.add(rule.code);
    totalBasisPoints += rule.basisPoints;
  }
  if (totalBasisPoints !== Number(BASIS_POINT_DENOMINATOR)) throw new Error("split_policy_must_total_100_percent");
}

export function validateFixedSplitPolicy(policy: FixedSplitPolicy): void {
  validatePolicyIdentity(policy);
  if (policy.expectedTotalMinor < 0n) throw new Error("invalid_fixed_policy_total");
  if (policy.rules.length === 0) throw new Error("fixed_policy_rules_required");

  const seenRuleCodes = new Set<string>();
  let total = 0n;
  for (const rule of policy.rules) {
    if (!rule.code.trim() || seenRuleCodes.has(rule.code)) throw new Error("invalid_fixed_policy_rule_code");
    if (!rule.recipientType.trim()) throw new Error("invalid_fixed_allocation_recipient");
    validateRecipientMode(rule.recipientMode);
    if (rule.amountMinor < 0n) throw new Error("invalid_fixed_allocation_amount");
    if (rule.fallbackRecipientType !== undefined && !rule.fallbackRecipientType.trim()) {
      throw new Error("invalid_fixed_policy_fallback_recipient");
    }
    seenRuleCodes.add(rule.code);
    total += rule.amountMinor;
  }
  if (total !== policy.expectedTotalMinor) throw new Error("fixed_policy_rules_must_equal_expected_total");
}

export function allocateBySplitPolicy(totalMinor: bigint, policy: SplitPolicy): SplitAllocation[] {
  if (totalMinor < 0n) throw new Error("invalid_split_total_minor");
  validateSplitPolicy(policy);

  const allocations = policy.rules.map((rule) => ({
    ruleCode: rule.code,
    recipientType: rule.recipientType,
    recipientMode: rule.recipientMode,
    fallbackRecipientType: rule.fallbackRecipientType,
    basisPoints: rule.basisPoints,
    amountMinor: (totalMinor * BigInt(rule.basisPoints)) / BASIS_POINT_DENOMINATOR,
    remainderMinor: 0n,
  }));

  const allocated = allocations.reduce((sum, item) => sum + item.amountMinor, 0n);
  const remainder = totalMinor - allocated;
  if (remainder < 0n) throw new Error("split_allocation_overflow");

  if (remainder > 0n) {
    const target = allocations.find((item) => item.ruleCode === policy.remainderRuleCode);
    if (!target) throw new Error("split_policy_remainder_rule_missing");
    target.amountMinor += remainder;
    target.remainderMinor = remainder;
  }

  const finalTotal = allocations.reduce((sum, item) => sum + item.amountMinor, 0n);
  if (finalTotal !== totalMinor) throw new Error("split_allocation_not_conserved");
  return allocations;
}

export function allocateByFixedPolicy(totalMinor: bigint, policy: FixedSplitPolicy): SplitAllocation[] {
  if (totalMinor < 0n) throw new Error("invalid_fixed_allocation_input");
  validateFixedSplitPolicy(policy);
  if (totalMinor !== policy.expectedTotalMinor) throw new Error("fixed_policy_total_mismatch");

  const allocations = policy.rules.map((rule) => ({
    ruleCode: rule.code,
    recipientType: rule.recipientType,
    recipientMode: rule.recipientMode,
    fallbackRecipientType: rule.fallbackRecipientType,
    basisPoints: 0,
    amountMinor: rule.amountMinor,
    remainderMinor: 0n,
  }));

  if (allocations.reduce((sum, item) => sum + item.amountMinor, 0n) !== totalMinor) {
    throw new Error("fixed_allocation_not_conserved");
  }
  return allocations;
}

export function resolveAllocations(
  allocations: readonly SplitAllocation[],
  resolutions: readonly RecipientResolution[],
): ResolvedAllocation[] {
  const byRule = new Map<string, RecipientResolution>();
  for (const resolution of resolutions) {
    if (!resolution.ruleCode.trim() || byRule.has(resolution.ruleCode)) throw new Error("invalid_recipient_resolution");
    if (!resolution.recipientType.trim()) throw new Error("invalid_recipient_resolution");
    byRule.set(resolution.ruleCode, resolution);
  }

  return allocations.map((allocation) => {
    if (allocation.recipientMode === "system") {
      return {
        ...allocation,
        sourceRecipientType: allocation.recipientType,
        recipientType: allocation.recipientType,
        recipientRef: allocation.recipientType,
        fallbackApplied: false,
      };
    }

    const resolution = byRule.get(allocation.ruleCode);
    if (!resolution) throw new Error(`recipient_resolution_required:${allocation.ruleCode}`);
    if (!resolution.recipientRef?.trim()) throw new Error(`recipient_resolution_required:${allocation.ruleCode}`);

    if (resolution.fallbackApplied) {
      if (!allocation.fallbackRecipientType) throw new Error(`recipient_fallback_not_allowed:${allocation.ruleCode}`);
      if (resolution.recipientType !== allocation.fallbackRecipientType) {
        throw new Error(`recipient_fallback_type_mismatch:${allocation.ruleCode}`);
      }
      return {
        ...allocation,
        sourceRecipientType: allocation.recipientType,
        recipientType: allocation.fallbackRecipientType,
        recipientRef: resolution.recipientRef,
        fallbackApplied: true,
      };
    }

    if (resolution.recipientType !== allocation.recipientType) {
      throw new Error(`recipient_resolution_type_mismatch:${allocation.ruleCode}`);
    }
    return {
      ...allocation,
      sourceRecipientType: allocation.recipientType,
      recipientType: allocation.recipientType,
      recipientRef: resolution.recipientRef,
      fallbackApplied: false,
    };
  });
}
