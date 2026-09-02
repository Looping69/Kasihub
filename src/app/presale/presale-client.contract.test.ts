import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, test } from "vitest";

describe("presale crypto and webpay flow", () => {
  test("uses compact mobile-safe verification actions", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain('"Start verification"');
    expect(source).toContain('"Saving hash…"');
    expect(source).toContain('>Open applicant account</Link>');
    expect(source).not.toContain('"Submit transaction for confirmation"');
  });

  test("unblocks approved KYC applicants without re-triggering KYC session", async () => {
    const rawSource = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    const source = rawSource.replace(/\r\n/g, "\n");
    expect(source).toContain("if (kycVerification?.verified) {\n          setApplicationPhase(5);\n          return;\n        }");
    expect(source).toContain("Identity verification approved");
  });

  test("persists and restores access tokens across page reloads", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain("window.sessionStorage.setItem(`presale_token_${payload.order.orderReference}`, payload.accessToken)");
    expect(source).toContain("window.sessionStorage.getItem(`presale_token_${portal.order.orderReference}`)");
  });

  test("provides cancel reservation and payment recheck actions", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain("Cancel unpaid reservation &amp; change payment method");
    expect(source).toContain('"Recheck payment"');
    expect(source).toContain('"Continue to secure WebPay checkout"');
  });
});
