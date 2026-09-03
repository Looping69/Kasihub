// Author: Klaasvaakie ( |╲ )
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KaSiShares Phase 4: Integration Contract & Security Invariants", () => {
  test("enforces fail-closed applicant authority contracts in frontend BFF", () => {
    const portalContract = source("src/lib/applicant-portal-contract.ts");
    expect(portalContract).toContain("readApplicantAuthority");
    expect(portalContract).toContain("FAIL_CLOSED_JOURNEY");
    expect(portalContract).toContain('state: "manual_review"');
    expect(portalContract).toContain('reason: "applicant_contract_unavailable"');
  });

  test("wildcard authorization audit: verifies no endpoint treats empty/whitespace string as a wildcard", () => {
    const apiFiles = [
      "src/app/api/presale/portal/route.ts",
      "src/app/api/shares/route.ts",
      "src/app/api/member/shares/route.ts",
    ];

    for (const file of apiFiles) {
      const content = source(file);
      // Ensure no dangerous patterns like `|| profileId === ""` or `!profileId || profileId === ...`
      expect(content).not.toMatch(/profileId\s*===\s*["']\s*["']/);
      expect(content).not.toMatch(/owner\s*===\s*["']\s*["']/);
      expect(content).not.toMatch(/external_profile_id\s*=\s*['"]\s*['"]/);
    }
  });

  test("public certificate verification route strictly redacts sensitive holder PII", () => {
    const certRoute = source("src/app/api/shares/certificates/verify/[verificationId]/route.ts");
    // Public endpoint must return verification status, not private tax/ID details
    expect(certRoute).toContain("verified");
    expect(certRoute).not.toContain("taxNumber");
    expect(certRoute).not.toContain("streetAddress");
    expect(certRoute).not.toContain("bankAccountNumber");
  });

  test("admin manual-review resolution BFF proxy enforces session authority and forward headers", () => {
    const route = source("src/app/api/admin/presale/orders/[reference]/resolve-manual-review/route.ts");
    expect(route).toContain("POST");
    expect(route).toContain("/admin/presale/orders/");
    expect(route).toContain("/resolve-manual-review");
    expect(route).toContain("encoreRequest");
  });

  test("shares account client maintains WebPay recovery action alongside crypto recovery", () => {
    const client = source("src/app/shares/account/shares-account-client.tsx");
    expect(client).toContain("WebPayPaymentRecovery");
    expect(client).toContain("CryptoPaymentRecovery");
    expect(client).toContain("startWebPayCheckout");
    expect(client).toContain("authorityHydration");
  });
});
