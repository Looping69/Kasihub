// Author: Klaasvaakie ( |╲ )

export type PoolDistributionAllocation = {
  recipientRef: string;
  amountMinor: bigint;
};

export type PoolDistributionPlan = {
  eligibleCount: number;
  balanceMinor: bigint;
  minimumPerMemberMinor: bigint;
  shouldDistribute: boolean;
  perMemberMinor: bigint;
  distributedMinor: bigint;
  retainedRemainderMinor: bigint;
  allocations: readonly PoolDistributionAllocation[];
};

/**
 * Approved pool rule:
 * - pool balances accumulate while empty;
 * - distribution starts only when every eligible member can receive at least R50;
 * - every eligible member receives the same amount;
 * - indivisible remainder stays in the pool for the next distribution.
 */
export function planPoolDistribution(
  balanceMinor: bigint,
  eligibleRecipientRefs: readonly string[],
  minimumPerMemberMinor = 5_000n,
): PoolDistributionPlan {
  if (balanceMinor < 0n) throw new Error("invalid_pool_balance");
  if (minimumPerMemberMinor <= 0n) throw new Error("invalid_pool_minimum_distribution");

  const eligible = [...new Set(eligibleRecipientRefs.map((value) => value.trim()))]
    .filter(Boolean)
    .sort();
  if (eligible.length !== eligibleRecipientRefs.length) {
    throw new Error("invalid_pool_eligible_recipients");
  }

  if (eligible.length === 0) {
    return {
      eligibleCount: 0,
      balanceMinor,
      minimumPerMemberMinor,
      shouldDistribute: false,
      perMemberMinor: 0n,
      distributedMinor: 0n,
      retainedRemainderMinor: balanceMinor,
      allocations: [],
    };
  }

  const count = BigInt(eligible.length);
  const perMemberMinor = balanceMinor / count;
  if (perMemberMinor < minimumPerMemberMinor) {
    return {
      eligibleCount: eligible.length,
      balanceMinor,
      minimumPerMemberMinor,
      shouldDistribute: false,
      perMemberMinor,
      distributedMinor: 0n,
      retainedRemainderMinor: balanceMinor,
      allocations: [],
    };
  }

  const distributedMinor = perMemberMinor * count;
  const retainedRemainderMinor = balanceMinor - distributedMinor;
  const allocations = eligible.map((recipientRef) => ({ recipientRef, amountMinor: perMemberMinor }));

  if (distributedMinor + retainedRemainderMinor !== balanceMinor) throw new Error("pool_distribution_not_conserved");
  if (allocations.some((allocation) => allocation.amountMinor !== perMemberMinor)) {
    throw new Error("pool_distribution_not_even");
  }

  return {
    eligibleCount: eligible.length,
    balanceMinor,
    minimumPerMemberMinor,
    shouldDistribute: true,
    perMemberMinor,
    distributedMinor,
    retainedRemainderMinor,
    allocations,
  };
}
