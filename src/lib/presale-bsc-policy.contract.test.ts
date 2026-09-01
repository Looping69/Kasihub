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

  test("the temporary Remitano bypass still requires canonical confirmations and records its authority", () => {
    const verification = source("encore/domains/payments/verification.ts");
    expect(verification).toContain("evaluatePaymentEvidence({");
    expect(verification).toContain("minimumConfirmations: row.minimum_confirmations");
    expect(verification).toContain("TEMPORARY_REMITANO_CUSTODY_BYPASS = true");
    expect(verification).toContain('"remitano_custody_temporarily_bypassed"');
    expect(verification).toContain("custodyTemporarilyBypassed");
  });

  test("presale administration does not offer TRON as a network", () => {
    const defaults = source("src/components/admin/admin-presale-defaults.tsx");
    const campaigns = source("src/components/admin/admin-presale-campaigns.tsx");
    expect(defaults).not.toContain('value="tron"');
    expect(campaigns).not.toContain('value="tron"');
    expect(defaults).toContain("BNB Smart Chain (BSC / BEP20)");
    expect(campaigns).toContain("BNB Smart Chain (BSC / BEP20)");
  });
});
