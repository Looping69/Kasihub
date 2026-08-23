// Author: Klaasvaakie ( |╲ )
import { describe, expect, test } from "vitest";
import { hasEcosystemRole, PRESALE_INVESTOR_ROLE } from "./role-policy";

describe("identity role boundaries", () => {
  test("keeps presale investors outside the ordinary ecosystem", () => {
    expect(hasEcosystemRole([PRESALE_INVESTOR_ROLE])).toBe(false);
  });

  test("allows explicit member and administrator roles", () => {
    expect(hasEcosystemRole(["member"])).toBe(true);
    expect(hasEcosystemRole(["admin"])).toBe(true);
    expect(hasEcosystemRole([PRESALE_INVESTOR_ROLE, "member"])).toBe(true);
  });
});
