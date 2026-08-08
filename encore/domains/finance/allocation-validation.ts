// Author: Klaasvaakie ( |╲ )
import type { RecipientMode, ResolvedAllocation } from "./split-policy";

export type PersistedSplitRuleDefinition = {
  code: string;
  recipientType: string;
  recipientMode: RecipientMode;
  basisPoints: number | null;
  fixedAmountMinor: bigint | null;
  fallbackRecipientType: string | null;
};

export type PersistedSplitPolicyDefinition = {
  policyKind: "percentage" | "fixed";
  remainderRuleCode: string | null;
  expectedTotalMinor: bigint | null;
  rules: readonly PersistedSplitRuleDefinition[];
};

const BASIS_POINTS = 10_000n;

export function validateResolvedAllocationsAgainstPolicy(
  sourceAmountMinor: bigint,
  allocations: readonly ResolvedAllocation[],
  policy: PersistedSplitPolicyDefinition,
): void {
  if (sourceAmountMinor < 0n) throw new Error("invalid_source_amount_minor");
  if (allocations.length !== policy.rules.length) throw new Error("allocation_policy_rule_count_mismatch");

  const allocationsByRule = new Map(allocations.map((allocation) => [allocation.ruleCode, allocation]));
  if (allocationsByRule.size !== allocations.length) throw new Error("duplicate_allocation_rule_code");

  let percentageFloorTotal = 0n;
  if (policy.policyKind === "percentage") {
    if (!policy.remainderRuleCode) throw new Error("persisted_percentage_policy_missing_remainder_rule");
    for (const rule of policy.rules) {
      if (rule.basisPoints === null || rule.fixedAmountMinor !== null) throw new Error("invalid_persisted_percentage_rule");
      percentageFloorTotal += (sourceAmountMinor * BigInt(rule.basisPoints)) / BASIS_POINTS;
    }
  } else {
    if (policy.expectedTotalMinor === null || sourceAmountMinor !== policy.expectedTotalMinor) {
      throw new Error("fixed_policy_total_mismatch");
    }
  }
  const percentageRemainder = policy.policyKind === "percentage" ? sourceAmountMinor - percentageFloorTotal : 0n;

  for (const rule of policy.rules) {
    const allocation = allocationsByRule.get(rule.code);
    if (!allocation) throw new Error(`allocation_policy_rule_missing:${rule.code}`);
    if (allocation.sourceRecipientType !== rule.recipientType) {
      throw new Error(`allocation_source_recipient_mismatch:${rule.code}`);
    }

    const expectedBasisPoints = rule.basisPoints ?? 0;
    if (allocation.basisPoints !== expectedBasisPoints) throw new Error(`allocation_basis_points_mismatch:${rule.code}`);

    let expectedAmountMinor: bigint;
    let expectedRemainderMinor = 0n;
    if (policy.policyKind === "percentage") {
      expectedAmountMinor = (sourceAmountMinor * BigInt(expectedBasisPoints)) / BASIS_POINTS;
      if (rule.code === policy.remainderRuleCode) {
        expectedAmountMinor += percentageRemainder;
        expectedRemainderMinor = percentageRemainder;
      }
    } else {
      if (rule.fixedAmountMinor === null || rule.basisPoints !== null) throw new Error("invalid_persisted_fixed_rule");
      expectedAmountMinor = rule.fixedAmountMinor;
    }

    if (allocation.amountMinor !== expectedAmountMinor) throw new Error(`allocation_amount_mismatch:${rule.code}`);
    if (allocation.remainderMinor !== expectedRemainderMinor) throw new Error(`allocation_remainder_mismatch:${rule.code}`);

    if (allocation.fallbackApplied) {
      if (!rule.fallbackRecipientType) throw new Error(`allocation_fallback_not_allowed:${rule.code}`);
      if (allocation.recipientType !== rule.fallbackRecipientType || allocation.recipientRef !== rule.fallbackRecipientType) {
        throw new Error(`allocation_fallback_recipient_mismatch:${rule.code}`);
      }
    } else {
      if (allocation.recipientType !== rule.recipientType) throw new Error(`allocation_recipient_type_mismatch:${rule.code}`);
      if (rule.recipientMode === "system" && allocation.recipientRef !== rule.recipientType) {
        throw new Error(`allocation_system_recipient_ref_mismatch:${rule.code}`);
      }
      if (rule.recipientMode === "dynamic" && !allocation.recipientRef.trim()) {
        throw new Error(`allocation_dynamic_recipient_required:${rule.code}`);
      }
    }
  }

  const total = allocations.reduce((sum, allocation) => sum + allocation.amountMinor, 0n);
  if (total !== sourceAmountMinor) throw new Error("allocation_policy_not_conserved");
}
