import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const backend = readFileSync("encore/domains/presale/api.ts", "utf8");
const processRoute = readFileSync("src/app/api/presale/webpay/process/route.ts", "utf8");

describe("WebPay process notification contract", () => {
  test("posts process updates to a dedicated callback", () => {
    expect(backend).toContain('m_process_url: "https://shares.kasihub.net/api/presale/webpay/process"');
    expect(processRoute).toContain('encoreRequest("/presale/webhooks/webpay-process"');
    expect(processRoute).toContain("application/x-www-form-urlencoded");
  });

  test("accepts documented failure states without confirming or cancelling the order", () => {
    expect(backend).toContain('"FAILED", "PENDING", "REJECTED", "REVERSED"');
    expect(backend).toContain("verifyWebPayProcessChecksum");
    expect(backend).toContain("webpay_process_status = $4");
    const start = backend.indexOf("export const receivePresaleWebPayProcessNotification");
    const end = backend.indexOf("export const upsertPresaleCampaign", start);
    const processHandler = backend.slice(start, end);
    expect(processHandler).not.toMatch(/SET status = '(confirmed|cancelled)'/);
  });
});
