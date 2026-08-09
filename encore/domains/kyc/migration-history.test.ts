// Author: Klaasvaakie ( |╲ )
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const migrationDirectory = fileURLToPath(new URL("../../migrations/kyc/", import.meta.url));

describe("KYC migration history", () => {
  test("preserves deployed versions and assigns each new migration a unique version", () => {
    const migrations = readdirSync(migrationDirectory)
      .filter((name) => name.endsWith(".up.sql"))
      .sort();
    const versions = migrations.map((name) => name.split("_", 1)[0]);

    expect(new Set(versions).size).toBe(versions.length);
    expect(migrations).toContain("3_reporting_indexes.up.sql");
    expect(migrations).toContain("4_international_documents.up.sql");
    expect(migrations).toContain("5_international_approval_guard.up.sql");
  });
});
