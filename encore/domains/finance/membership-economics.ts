// Author: Klaasvaakie ( |╲ )

export type BaseMembershipEconomics = {
  membershipPriceMinor: bigint;
  ecosystemSplitMinor: bigint;
  benefitBudgetMinor: bigint;
  selectedBenefitCostMinor: bigint;
  unusedBenefitBudgetMinor: bigint;
  allocatableProfitMinor: bigint;
};

export const ADULT_BASE_MEMBERSHIP_PRICE_MINOR = 14_000n;
export const ADULT_ECOSYSTEM_SPLIT_MINOR = 5_300n;
export const ADULT_BASE_BENEFIT_BUDGET_MINOR = 2_800n;

/**
 * Approved adult/base membership economics.
 *
 * The base R140 membership reserves R53 for the ecosystem split and up to R28
 * for selected benefits. If selected benefits cost less than R28, the unused
 * benefit budget becomes additional allocatable profit. A cost above R28 is a
 * different/add-on product model and must not be smuggled into this base policy.
 */
export function calculateAdultBaseMembershipEconomics(
  selectedBenefitCostMinor: bigint,
): BaseMembershipEconomics {
  if (selectedBenefitCostMinor < 0n) throw new Error("invalid_selected_benefit_cost");
  if (selectedBenefitCostMinor > ADULT_BASE_BENEFIT_BUDGET_MINOR) {
    throw new Error("base_membership_benefit_budget_exceeded");
  }

  const unusedBenefitBudgetMinor = ADULT_BASE_BENEFIT_BUDGET_MINOR - selectedBenefitCostMinor;
  const allocatableProfitMinor = ADULT_BASE_MEMBERSHIP_PRICE_MINOR
    - ADULT_ECOSYSTEM_SPLIT_MINOR
    - selectedBenefitCostMinor;

  if (
    ADULT_ECOSYSTEM_SPLIT_MINOR + selectedBenefitCostMinor + allocatableProfitMinor
    !== ADULT_BASE_MEMBERSHIP_PRICE_MINOR
  ) {
    throw new Error("membership_economics_not_conserved");
  }

  return {
    membershipPriceMinor: ADULT_BASE_MEMBERSHIP_PRICE_MINOR,
    ecosystemSplitMinor: ADULT_ECOSYSTEM_SPLIT_MINOR,
    benefitBudgetMinor: ADULT_BASE_BENEFIT_BUDGET_MINOR,
    selectedBenefitCostMinor,
    unusedBenefitBudgetMinor,
    allocatableProfitMinor,
  };
}
