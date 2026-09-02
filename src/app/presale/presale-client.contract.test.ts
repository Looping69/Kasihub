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

  test("uses authenticated session for applicant order actions instead of browser-held order access token", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).not.toContain("window.sessionStorage.setItem(`presale_token_");
    expect(source).not.toContain("window.sessionStorage.getItem(`presale_token_");
    expect(source).not.toContain("X-Presale-Access-Token");
  });

  test("provides cancel reservation and payment recheck actions", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain("Cancel unpaid reservation &amp; change payment method");
    expect(source).toContain('"Recheck payment"');
    expect(source).toContain('"Continue to secure WebPay checkout"');
  });

  test("reopens investor application form and payment selection when reservation is cancelled or released", async () => {
    const source = await readFile(path.join(process.cwd(), "src", "app", "presale", "presale-client.tsx"), "utf8");
    expect(source).toContain("!hasActiveReservation && !order");
    expect(source).toContain("hasActiveReservation && applicantAuthority");
    expect(source).toContain("!applicantAuthority.journey.applicationEditable");
  });
});
