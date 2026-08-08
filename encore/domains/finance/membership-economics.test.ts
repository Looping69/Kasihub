// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { calculateAdultBaseMembershipEconomics } from "./membership-economics";

describe("adult base membership economics", () => {
  it("produces the current approved R59 profit when benefits consume the full R28 budget", () => {
    const result = calculateAdultBaseMembershipEconomics(2_800n);
    expect(result.allocatableProfitMinor).toBe(5_900n);
    expect(result.unusedBenefitBudgetMinor).toBe(0n);
  });

  it("adds unused benefit budget to allocatable profit", () => {
    const result = calculateAdultBaseMembershipEconomics(2_500n);
    expect(result.unusedBenefitBudgetMinor).toBe(300n);
    expect(result.allocatableProfitMinor).toBe(6_200n);
  });

  it("conserves the full R140 membership value", () => {
    const result = calculateAdultBaseMembershipEconomics(1_811n);
    expect(result.ecosystemSplitMinor + result.selectedBenefitCostMinor + result.allocatableProfitMinor)
      .toBe(result.membershipPriceMinor);
  });

  it("fails closed when base benefits exceed the approved R28 budget", () => {
    expect(() => calculateAdultBaseMembershipEconomics(2_801n)).toThrow("base_membership_benefit_budget_exceeded");
  });
});
