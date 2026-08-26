// Author: Klaasvaakie ( |╲ )
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("presale user-class boundary", () => {
  test("creates presale-only accounts without granting ordinary membership", () => {
    const presaleApi = source("encore/domains/presale/api.ts");
    expect(presaleApi).toContain("WHERE name = 'presale_investor'");
    expect(presaleApi).not.toMatch(/SELECT \$1, id FROM roles WHERE name = 'member'/);
    expect(presaleApi).toContain("`PRESALE_${payload.applicantType.toUpperCase()}`");
  });

  test("migrates existing presale profiles without downgrading completed ecosystem registrations", () => {
    const migration = source("encore/migrations/identity/9_presale_investor_role.up.sql");
    expect(migration).toContain("VALUES ('presale_investor')");
    expect(migration).toContain("DELETE FROM user_roles");
    expect(migration).toContain("registration_workflows");
    expect(migration).toContain("rw.state = 'completed'");
  });

  test("gates ecosystem services while retaining shared KYC and certificate ownership access", () => {
    const access = source("encore/domains/auth/access.ts");
    expect(access).toContain("export async function requireEcosystemProfileAccess");
    for (const path of [
      "encore/domains/commerce/api.ts",
      "encore/domains/engagement/dashboard.ts",
      "encore/domains/finance/member-summary.ts",
      "encore/domains/membership/api.ts",
      "encore/domains/network/api.ts",
      "encore/domains/wallets/api.ts",
    ]) {
      expect(source(path), path).toContain("requireEcosystemProfileAccess");
    }
    expect(source("encore/domains/kyc/international.ts")).toContain("requireProfileAccess");
    expect(source("encore/domains/shares/api.ts")).toContain("requireProfileAccess(req.profileId)");
  });

  test("carries the mock campaign boundary into the invitation offer", () => {
    const presaleApi = source("encore/domains/presale/api.ts");
    expect(presaleApi).toContain("isMock: campaign.is_mock");
  });

  test("keeps undeclared tax residence and beneficial owner fields optional at the transport boundary", () => {
    const presaleApi = source("encore/domains/presale/api.ts");
    expect(presaleApi).toContain("taxResidenceCountry?: string;");
    expect(presaleApi).toContain("beneficialOwnerName?: string;");
  });

  test("retains required registration identity fields through Encore request decoding", () => {
    const presaleApi = source("encore/domains/presale/api.ts");
    expect(presaleApi).toContain("countryOfResidence: string;");
    expect(presaleApi).toContain("streetAddress: string;");
    expect(presaleApi).toContain("suburb: string;");
    expect(presaleApi).toContain("city: string;");
    expect(presaleApi).toContain("postalCode: string;");
    expect(presaleApi).toContain("confirmMobileNumber: string;");
  });

  test("does not mask post-commit payment setup failures with a closed rollback", () => {
    const presaleApi = source("encore/domains/presale/api.ts");
    expect(presaleApi).toContain("try { await tx.rollback(); } catch { /* transaction may already be closed */ }");
  });
});
