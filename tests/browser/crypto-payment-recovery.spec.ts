// Author: Klaasvaakie ( |╲ )
import { expect, test } from "@playwright/test";

const ORDER_REFERENCE = "KSP-D53C93DF-MTESETBN";
const TRANSACTION_HASH = `0x${"ab".repeat(32)}`;

function portalPayload(settled: boolean) {
  const status = settled ? "incorporated" : "payment_submitted";
  const incorporationStatus = settled ? "incorporated" : "pending";
  return {
    applicant: { profileNumber: "KSI-E4F6B6E0C8", email: "buyer@example.test" },
    application: { applicationNumber: "KSA-CF095B03", campaignName: "Test", status: "completed", phaseCompleted: 4, completionPercent: 100, nextStep: 5, resumeUrl: null },
    kyc: { status: "approved", verified: true },
    order: {
      orderReference: ORDER_REFERENCE,
      status,
      incorporationStatus,
      paymentRail: "remitano_usdt",
      quantity: 1,
      totalUsdt: "1.000000",
      paymentNetwork: "bsc",
      paymentMinConfirmations: 3,
      transactionHash: TRANSACTION_HASH,
      paymentVerificationStatus: settled ? "confirmed" : "submitted",
      paymentVerificationReason: settled ? undefined : "custody_temporarily_unavailable",
      paymentConfirmations: settled ? 12 : 0,
      cancellation: { eligible: false, reason: "crypto_hash_submitted" },
    },
    reservation: {
      orderReference: ORDER_REFERENCE,
      phaseNumber: 1,
      phaseLabel: "Phase 1",
      campaignName: "Test",
      issuerName: "Solidus Holdings (Pty) Ltd",
      shareClass: "Class B",
      paidShares: 1,
      bonusShares: 1,
      totalAllocatedShares: 2,
      paymentMethod: "remitano_usdt",
      unitPriceUsd: "1.00",
      totalUsd: "1.00",
      unitPriceUsdt: "1.000000",
      totalUsdt: "1.000000",
      network: "bsc",
      receivingAddress: "0x1111111111111111111111111111111111111111",
      requiredConfirmations: 3,
      paymentDeadline: "2026-08-31T12:00:00.000Z",
      termsVersion: "presale-reservation-v1",
      status,
      incorporationStatus,
      cancellation: { eligible: false, reason: "crypto_hash_submitted" },
    },
    journey: settled ? {
      state: "issued",
      reason: "certificate_issued",
      allowedActions: ["view_reservation", "download_certificate", "verify_certificate"],
      applicationEditable: false,
      reservationEditable: false,
      polling: "none",
      terminal: true,
    } : {
      state: "payment_submitted",
      reason: "payment_hash_submitted",
      allowedActions: ["view_reservation", "recheck_payment"],
      applicationEditable: false,
      reservationEditable: false,
      polling: "payment",
      terminal: false,
    },
    shareholder: settled ? {
      totalIssuedShares: 2,
      holdings: [{
        orderReference: ORDER_REFERENCE,
        campaignName: "Test",
        paidShares: 1,
        bonusShares: 1,
        allocatedShares: 2,
        status: "issued",
        incorporationStatus: "incorporated",
        certificate: { certificateNumber: "KSC-TEST-0001", totalShares: 2, status: "issued", issuedAt: "2026-08-30T12:00:00.000Z" },
      }],
    } : { totalIssuedShares: 0, holdings: [] },
    continuation: { nextStep: null, reason: settled ? "signup_complete" : "reservation_in_progress", resumeUrl: null },
  };
}

test("recovers a stored crypto payment and reveals the issued shares", async ({ page }) => {
  let settled = false;
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.route("**/api/theme", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
  await page.route("**/api/presale/portal", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(portalPayload(settled)) });
  });
  await page.route(`**/api/presale/orders/${ORDER_REFERENCE}/payment-recheck`, async (route) => {
    settled = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ orderReference: ORDER_REFERENCE, status: "settled", transactionHash: TRANSACTION_HASH, confirmations: 12, reason: "canonical_transfer_confirmed" }),
    });
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/shares/account");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your share choice is preserved" })).toBeVisible();
  await expect(page.getByText(TRANSACTION_HASH)).toBeVisible();
  await expect(page.getByText("A second purchase form is intentionally locked", { exact: false })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/crypto-payment-recovery-before.png", fullPage: true });

  await page.getByRole("button", { name: "Recheck payment" }).click();
  await expect(page.getByRole("heading", { name: "Your KaSiShares" })).toBeVisible();
  await expect(page.getByText("KSC-TEST-0001")).toBeVisible();
  await expect(page.getByText("Certificate issued")).toBeVisible();
  await page.screenshot({ path: "test-results/crypto-payment-recovery-after.png", fullPage: true });
  expect(consoleErrors).toEqual([]);
});
