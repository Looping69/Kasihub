// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { validateResolvedAllocationsAgainstPolicy } from "./allocation-validation";
import { allocateByFixedPolicy, allocateBySplitPolicy, resolveAllocations } from "./split-policy";
import { adultMembershipProfitPolicyV1, ecosystemUplineR53PolicyV1, KASIHUB_CUSTODIAN } from "./split-policies";

const adultPersistedPolicy = {
  policyKind: "percentage" as const,
  remainderRuleCode: "custodian",
  expectedTotalMinor: null,
  rules: adultMembershipProfitPolicyV1.rules.map((rule) => ({
    code: rule.code,
    recipientType: rule.recipientType,
    recipientMode: rule.recipientMode,
    basisPoints: rule.basisPoints,
    fixedAmountMinor: null,
    fallbackRecipientType: rule.fallbackRecipientType ?? null,
  })),
};

describe("persisted split policy validation", () => {
  it("accepts the resolved adult R59 allocation", () => {
    const allocations = resolveAllocations(allocateBySplitPolicy(5_900n, adultMembershipProfitPolicyV1), []);
    expect(() => validateResolvedAllocationsAgainstPolicy(5_900n, allocations, adultPersistedPolicy)).not.toThrow();
  });

  it("rejects a conserved but economically altered allocation", () => {
    const allocations = resolveAllocations(allocateBySplitPolicy(5_900n, adultMembershipProfitPolicyV1), []);
    const changed = allocations.map((allocation) => ({ ...allocation }));
    changed[0].amountMinor += 100n;
    changed[4].amountMinor -= 100n;
    expect(changed.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(5_900n);
    expect(() => validateResolvedAllocationsAgainstPolicy(5_900n, changed, adultPersistedPolicy))
      .toThrow("allocation_amount_mismatch:custodian");
  });

  it("rejects tampering with a stable system account reference", () => {
    const allocations = resolveAllocations(allocateBySplitPolicy(5_900n, adultMembershipProfitPolicyV1), []);
    const changed = allocations.map((allocation) => ({ ...allocation }));
    changed[0].recipientRef = "profile-attacker";
    expect(() => validateResolvedAllocationsAgainstPolicy(5_900n, changed, adultPersistedPolicy))
      .toThrow("allocation_system_recipient_ref_mismatch:custodian");
  });

  it("accepts only the approved Custodian fallback for a missing upline", () => {
    const raw = allocateByFixedPolicy(5_300n, ecosystemUplineR53PolicyV1);
    const resolved = resolveAllocations(raw, raw.map((allocation, index) => ({
      ruleCode: allocation.ruleCode,
      recipientType: index === 0 ? KASIHUB_CUSTODIAN : allocation.recipientType,
      recipientRef: index === 0 ? KASIHUB_CUSTODIAN : `profile-${index + 1}`,
      fallbackApplied: index === 0,
    })));
    const fixedPolicy = {
      policyKind: "fixed" as const,
      remainderRuleCode: null,
      expectedTotalMinor: 5_300n,
      rules: ecosystemUplineR53PolicyV1.rules.map((rule) => ({
        code: rule.code,
        recipientType: rule.recipientType,
        recipientMode: rule.recipientMode,
        basisPoints: null,
        fixedAmountMinor: rule.amountMinor,
        fallbackRecipientType: rule.fallbackRecipientType ?? null,
      })),
    };
    expect(() => validateResolvedAllocationsAgainstPolicy(5_300n, resolved, fixedPolicy)).not.toThrow();
  });
});
