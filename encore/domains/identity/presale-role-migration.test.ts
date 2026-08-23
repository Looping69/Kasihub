// Author: Klaasvaakie ( |╲ )
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const migrationPath = fileURLToPath(new URL("../../migrations/identity/9_presale_investor_role.up.sql", import.meta.url));

describe("presale investor identity migration", () => {
  test("creates the isolated role and removes accidental membership without downgrading completed members", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toContain("VALUES ('presale_investor')");
    expect(sql).toContain("PRESALE_INVESTOR");
    expect(sql).toContain("PRESALE_TRUST");
    expect(sql).toContain("PRESALE_INDIVIDUAL");
    expect(sql).toContain("PRESALE_COMPANY");
    expect(sql).toContain("DELETE FROM user_roles");
    expect(sql).toContain("registration_workflows");
    expect(sql).toContain("rw.state = 'completed'");
  });
});
