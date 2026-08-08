// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { allocateBySplitPolicy, allocateFixedCents, validateSplitPolicy } from "./split-policy";
import {
  KASIHUB_CUSTODIAN,
  adultMembershipProfitPolicyV1,
  ecosystemUplineR53V1,
  marketplaceProductPolicyV1,
  npoNgoCampaignPolicyV1,
  productCampaignGroupPolicyV1,
} from "./split-policies";

describe("split policy engine", () => {
  it("conserves every cent and sends percentage remainder to Custodian", () => {
    const allocations = allocateBySplitPolicy(14_689, adultMembershipProfitPolicyV1);
    expect(allocations.reduce((sum, item) => sum + item.cents, 0)).toBe(14_689);
    const custodian = allocations.find((item) => item.recipientType === KASIHUB_CUSTODIAN);
    expect(custodian?.remainderCents).toBeGreaterThanOrEqual(0);
  });

  it("matches the approved adult R59 profit policy", () => {
    const allocations = allocateBySplitPolicy(5_900, adultMembershipProfitPolicyV1);
    expect(Object.fromEntries(allocations.map((item) => [item.recipientType, item.cents]))).toEqual({
      KASIHUB_CUSTODIAN: 3481,
      KASIPIONEER_POOL: 59,
      PRIVATE_POOL: 59,
      NPO_POOL: 59,
      KASI_SHAREHOLDERS_POOL: 2242,
    });
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
      remainderRecipientType: "A",
      rules: [{ recipientType: "A", basisPoints: 9999 }],
    })).toThrow("split_policy_must_total_100_percent");
  });

  it("allocates the approved six-level R53 ecosystem amount exactly", () => {
    const allocations = allocateFixedCents(5_300, ecosystemUplineR53V1, KASIHUB_CUSTODIAN);
    expect(allocations.reduce((sum, item) => sum + item.cents, 0)).toBe(5_300);
    expect(allocations.map((item) => item.cents)).toEqual([1300, 1100, 1100, 900, 600, 300]);
  });

  it("routes unused fixed-allocation value to Custodian", () => {
    const allocations = allocateFixedCents(5_300, ecosystemUplineR53V1.slice(0, 5), KASIHUB_CUSTODIAN);
    expect(allocations.reduce((sum, item) => sum + item.cents, 0)).toBe(5_300);
    expect(allocations.find((item) => item.recipientType === KASIHUB_CUSTODIAN)?.cents).toBe(300);
  });
});
