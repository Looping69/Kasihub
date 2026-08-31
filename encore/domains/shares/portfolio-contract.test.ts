import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const source = readFileSync("domains/shares/api.ts", "utf8");

describe("shares portfolio backend contract", () => {
  test("returns authoritative certificate linkage and phase inventory metadata", () => {
    expect(source).toContain("COALESCE(certificate.phase_number, phase.phase_number) AS phase_number");
    expect(source).toContain("sp.total_amount::text AS purchase_total_amount");
    expect(source).toContain("purchaseTotalAmount");
    expect(source).toContain("total_quantity, bonus_buy_one_get, created_at, updated_at");
    expect(source).toContain("quantity_available, total_quantity, price_per_share");
    expect(source).toContain('cacheRead(sharePhaseCache, "all-v2")');
  });

  test("exposes a session-derived versioned portfolio with exact money strings", () => {
    expect(source).toContain('path: "/shares/portfolio/me"');
    expect(source).toContain('schemaVersion: "shareholder-portfolio.v2"');
    expect(source).toContain("await requireEcosystemProfileAccess(session.profile.id)");
    expect(source).toContain("acquisition_cost");
    expect(source).toContain("issue_price_per_paid_share");
  });
});
