// Author: Klaasvaakie ( |╲ )
import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("KaSiShares BSC-only policy", () => {
  test("the backend rejects non-BSC campaign input and intent creation", () => {
    const api = source("encore/domains/presale/api.ts");
    expect(api).toContain('network: z.literal("bsc")');
    expect(api).toContain('campaign.network !== "bsc"');
    expect(api).toContain('network: "bsc"');
  });

  test("submitted hashes enter a durable backend verification queue", () => {
    const api = source("encore/domains/presale/api.ts");
    expect(api).toContain('new Topic<PresaleCryptoReconciliationTask>("presale-crypto-reconciliation"');
    expect(api).toContain('"verify-presale-crypto-payment"');
    expect(api).toContain('minBackoff: "10s"');
    expect(api).toContain('maxBackoff: "1m"');
    expect(api).toContain("maxRetries: 120");
    expect(api).toContain("shouldRetryPresaleCryptoReconciliation(result.status)");
  });

  test("Remitano settlement requires both canonical confirmations and custody reconciliation", () => {
    const verification = source("encore/domains/payments/verification.ts");
    expect(verification).toContain("evaluatePaymentEvidence({");
    expect(verification).toContain("minimumConfirmations: row.minimum_confirmations");
    expect(verification).toContain("row.custody_reconciliation_required");
    expect(verification).toContain("await custodyReader({");
    expect(verification).toContain("evaluateCustodyEvidence({");
    expect(verification).not.toContain("TEMPORARY_REMITANO_CUSTODY_BYPASS");
  });

  test("presale administration does not offer TRON as a network", () => {
    const defaults = source("src/components/admin/admin-presale-defaults.tsx");
    const campaigns = source("src/components/admin/admin-presale-campaigns.tsx");
    expect(defaults).not.toContain('value="tron"');
    expect(campaigns).not.toContain('value="tron"');
    expect(defaults).toContain("BNB Smart Chain (BSC / BEP20)");
    expect(campaigns).toContain("BNB Smart Chain (BSC / BEP20)");
  });

  test("order access requires both a presale session owner and the order credential", () => {
    const api = source("encore/domains/presale/api.ts");
    expect(api.match(/const session = await requirePresaleSession\(\);/g)?.length).toBeGreaterThanOrEqual(6);
    expect(api.match(/o\.external_profile_id::text = \$3::text/g)?.length).toBeGreaterThanOrEqual(3);
    expect(api).toContain("req.orderReference, hashSecret(accessToken), session.profile.id");
    expect(api).toContain("payload.orderReference, hashSecret(payload.accessToken), session.profile.id");
  });

  test("late or cancelled payments preserve evidence without creating issuance work", () => {
    const api = source("encore/domains/presale/api.ts");
    const migration = source("encore/migrations/presale/19_late_payment_review_and_audit.up.sql");
    expect(api).toContain('["cancelled", "expired", "manual_review"].includes(order.status)');
    expect(api).toContain("status='manual_review'");
    expect(api).toContain("'payment.late_detected'");
    expect(api).toContain('"transaction_mined_after_deadline"');
    expect(api).toContain('"on_time_transaction_after_reservation_release"');
    expect(migration).toContain("CREATE TABLE presale_audit_events");
    expect(migration).toContain("'manual_review'");
  });

  test("production activation fails closed and cannot enable discounted financial behavior", () => {
    const api = source("encore/domains/presale/api.ts");
    const migration = source("encore/migrations/presale/20_disable_active_test_pricing.up.sql");
    expect(api).toContain('if (payload.status === "active") requirePresaleProductionConfiguration()');
    expect(api).toContain("validateBscProviderConfiguration()");
    expect(api).toContain("validateRemitanoConfiguration()");
    expect(migration).toContain("status <> 'active'");
    expect(migration).toContain("crypto_test_orders_remaining = 0");
  });

  test("WebPay claims each settlement reference durably before fulfilment", () => {
    const api = source("encore/domains/presale/api.ts");
    const migration = source("encore/migrations/presale/22_webpay_settlement_claims.up.sql");
    expect(migration).toContain("provider_reference TEXT PRIMARY KEY");
    expect(migration).toContain("order_id UUID NOT NULL UNIQUE");
    expect(api).toContain("INSERT INTO presale_webpay_settlements");
    expect(api).toContain("WebPay settlement reference was already used for different payment evidence");
  });

  test("the admin allocation override cannot manufacture paid ownership", () => {
    const api = source("encore/domains/presale/api.ts");
    expect(api).toContain("Manual presale share allocation is disabled; settled payment authority is required");
  });
});
