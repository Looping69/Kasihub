// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { planPoolDistribution } from "./pool-policy";

describe("pool distribution policy", () => {
  it("accumulates when the pool has no eligible members", () => {
    const plan = planPoolDistribution(25_000n, []);
    expect(plan.shouldDistribute).toBe(false);
    expect(plan.distributedMinor).toBe(0n);
    expect(plan.retainedRemainderMinor).toBe(25_000n);
  });

  it("waits until every eligible member can receive at least R50", () => {
    const plan = planPoolDistribution(14_999n, ["b", "a", "c"]);
    expect(plan.shouldDistribute).toBe(false);
    expect(plan.perMemberMinor).toBe(4_999n);
    expect(plan.retainedRemainderMinor).toBe(14_999n);
  });

  it("distributes exactly at the R50 per-member threshold", () => {
    const plan = planPoolDistribution(15_000n, ["b", "a", "c"]);
    expect(plan.shouldDistribute).toBe(true);
    expect(plan.perMemberMinor).toBe(5_000n);
    expect(plan.distributedMinor).toBe(15_000n);
    expect(plan.retainedRemainderMinor).toBe(0n);
    expect(plan.allocations).toEqual([
      { recipientRef: "a", amountMinor: 5_000n },
      { recipientRef: "b", amountMinor: 5_000n },
      { recipientRef: "c", amountMinor: 5_000n },
    ]);
  });

  it("keeps indivisible remainder in the pool instead of favoring a member", () => {
    const plan = planPoolDistribution(15_002n, ["a", "b", "c"]);
    expect(plan.shouldDistribute).toBe(true);
    expect(plan.allocations.map((item) => item.amountMinor)).toEqual([5_000n, 5_000n, 5_000n]);
    expect(plan.distributedMinor).toBe(15_000n);
    expect(plan.retainedRemainderMinor).toBe(2n);
    expect(plan.distributedMinor + plan.retainedRemainderMinor).toBe(plan.balanceMinor);
  });

  it("rejects duplicate or blank eligibility rows rather than double-paying", () => {
    expect(() => planPoolDistribution(20_000n, ["a", "a"])).toThrow("invalid_pool_eligible_recipients");
    expect(() => planPoolDistribution(20_000n, ["a", " "])).toThrow("invalid_pool_eligible_recipients");
  });
});
