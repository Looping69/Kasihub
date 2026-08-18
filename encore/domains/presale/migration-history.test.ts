// Author: Klaasvaakie ( |╲ )
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const migrationDirectory = fileURLToPath(new URL("../../migrations/presale/", import.meta.url));

describe("presale application migration history", () => {
  test("keeps encrypted review and approval metadata together with its ciphertext", () => {
    const migrations = readdirSync(migrationDirectory)
      .filter((name) => name.endsWith(".up.sql"))
      .sort();
    const versions = migrations.map((name) => name.split("_", 1)[0]);
    const encryptionMigration = readFileSync(
      `${migrationDirectory}8_application_review_encryption_metadata.up.sql`,
      "utf8",
    );

    expect(new Set(versions).size).toBe(versions.length);
    expect(migrations).toContain("8_application_review_encryption_metadata.up.sql");
    for (const column of ["ciphertext", "nonce", "auth_tag", "key_version"]) {
      expect(encryptionMigration).toContain(`protected_notes_${column}`);
      expect(encryptionMigration).toContain(`protected_comment_${column}`);
    }
  });
});
