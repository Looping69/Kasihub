// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import {
  allocateByFixedPolicy,
  allocateBySplitPolicy,
  validateFixedSplitPolicy,
  validateSplitPolicy,
} from "./split-policy";
import {
  KASIHUB_CUSTODIAN,
  adultMembershipProfitPolicyV1,
  ecosystemUplineR53PolicyV1,
  marketplaceProductPolicyV1,
  npoNgoCampaignPolicyV1,
  productCampaignGroupPolicyV1,
} from "./split-policies";

describe("split policy engine", () => {
  it("conserves every minor unit and sends percentage remainder to Custodian", () => {
    const allocations = allocateBySplitPolicy(14_689n, adultMembershipProfitPolicyV1);
    expect(allocations.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(14_689n);
    const custodian = allocations.find((item) => item.recipientType === KASIHUB_CUSTODIAN);
    expect(custodian?.remainderMinor).toBeGreaterThanOrEqual(0n);
  });

  it("matches the approved adult R59 profit policy exactly", () => {
    const allocations = allocateBySplitPolicy(5_900n, adultMembershipProfitPolicyV1);
    expect(Object.fromEntries(allocations.map((item) => [item.recipientType, item.amountMinor]))).toEqual({
      KASIHUB_CUSTODIAN: 3481n,
      KASIPIONEER_POOL: 59n,
      PRIVATE_POOL: 59n,
      NPO_POOL: 59n,
      KASI_SHAREHOLDERS_POOL: 2242n,
    });
  });

  it("records the exact remainder on the approved remainder rule", () => {
    const allocations = allocateBySplitPolicy(101n, adultMembershipProfitPolicyV1);
    const custodian = allocations.find((item) => item.ruleCode === adultMembershipProfitPolicyV1.remainderRuleCode);
    expect(allocations.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(101n);
    expect(custodian?.remainderMinor).toBe(4n);
    expect(custodian?.amountMinor).toBe(63n);
  });

  it("validates all currently defined percentage policy families", () => {
    for (const policy of [adultMembershipProfitPolicyV1, npoNgoCampaignPolicyV1, marketplaceProductPolicyV1, productCampaignGroupPolicyV1]) {
      expect(() => validateSplitPolicy(policy)).not.toThrow();
    }
  });

  it("rejects percentage policies that do not total 100 percent", () => {
    expect(() => validateSplitPolicy({
      key: "broken",
      version: 1,
      status: "draft",
      currency: "ZAR",
      minorUnitScale: 2,
      remainderRuleCode: "a",
      rules: [{ code: "a", recipientType: "A", basisPoints: 9999 }],
    })).toThrow("split_policy_must_total_100_percent");
  });

  it("rejects duplicate rule codes even when recipient types differ", () => {
    expect(() => validateSplitPolicy({
      key: "broken",
      version: 1,
      status: "draft",
      currency: "ZAR",
      minorUnitScale: 2,
      remainderRuleCode: "same",
      rules: [
        { code: "same", recipientType: "A", basisPoints: 5000 },
        { code: "same", recipientType: "B", basisPoints: 5000 },
      ],
    })).toThrow("invalid_split_policy_rule_code");
  });

  it("allocates the approved six-level R53 ecosystem amount exactly", () => {
    const allocations = allocateByFixedPolicy(5_300n, ecosystemUplineR53PolicyV1);
    expect(allocations.reduce((sum, item) => sum + item.amountMinor, 0n)).toBe(5_300n);
    expect(allocations.map((item) => item.amountMinor)).toEqual([1300n, 1100n, 1100n, 900n, 600n, 300n]);
  });

  it("rejects fixed policy execution against the wrong source amount", () => {
    expect(() => allocateByFixedPolicy(5_299n, ecosystemUplineR53PolicyV1)).toThrow("fixed_policy_total_mismatch");
  });

  it("rejects a fixed policy whose rules do not conserve its expected total", () => {
    expect(() => validateFixedSplitPolicy({
      ...ecosystemUplineR53PolicyV1,
      expectedTotalMinor: 5_301n,
    })).toThrow("fixed_policy_rules_must_equal_expected_total");
  });
});
