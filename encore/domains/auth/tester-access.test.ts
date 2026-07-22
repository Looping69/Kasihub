// Author: Klaasvaakie ( |╲ )
import { describe, expect, it } from "vitest";
import { hasTesterAdminAccess, TESTER_ADMIN_EMAIL } from "./tester-access";

describe("tester administrator access", () => {
  it("opens the tester account in long-lived development environments", () => {
    expect(hasTesterAdminAccess(TESTER_ADMIN_EMAIL, "development")).toBe(true);
    expect(hasTesterAdminAccess(TESTER_ADMIN_EMAIL.toUpperCase(), "ephemeral")).toBe(true);
    expect(hasTesterAdminAccess(TESTER_ADMIN_EMAIL, "test")).toBe(true);
  });

  it("stays closed in production and for every other account", () => {
    expect(hasTesterAdminAccess(TESTER_ADMIN_EMAIL, "production")).toBe(false);
    expect(hasTesterAdminAccess("member@kasihub.co.za", "development")).toBe(false);
  });
});
