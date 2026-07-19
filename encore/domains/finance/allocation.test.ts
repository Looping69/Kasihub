// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { allocateEvenCents, allocateWeightedCents } from "./allocation";

describe("exact financial allocation contracts", () => {
  test("equal allocation preserves every cent deterministically", () => {
    const result = allocateEvenCents(1000, ["profile-c", "profile-a", "profile-b"]);
    expect(result).toEqual([
      { profileId: "profile-a", cents: 334 },
      { profileId: "profile-b", cents: 333 },
      { profileId: "profile-c", cents: 333 },
    ]);
    expect(result.reduce((sum, item) => sum + item.cents, 0)).toBe(1000);
  });

  test("weighted allocation preserves every cent and resolves ties by profile", () => {
    const result = allocateWeightedCents(1001, [
      { profileId: "profile-b", weight: 1 },
      { profileId: "profile-a", weight: 1 },
      { profileId: "profile-c", weight: 2 },
    ]);
    expect(result.reduce((sum, item) => sum + item.cents, 0)).toBe(1001);
    expect(result).toEqual([
      { profileId: "profile-a", weight: 1, cents: 250 },
      { profileId: "profile-b", weight: 1, cents: 250 },
      { profileId: "profile-c", weight: 2, cents: 501 },
    ]);
  });

  test("invalid allocation inputs fail closed", () => {
    expect(() => allocateEvenCents(100, [])).toThrow("invalid_allocation_input");
    expect(() => allocateWeightedCents(100, [{ profileId: "x", weight: 0 }])).toThrow("invalid_allocation_weight");
  });
});
