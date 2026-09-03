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
    currentReservation: {
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
  let portalReads = 0;
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.route("**/api/theme", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) });
  });
  await page.route("**/api/presale/portal", async (route) => {
    portalReads += 1;
    if (portalReads >= 2) settled = true;
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
  await expect(page.getByRole("list", { name: "Crypto payment verification progress" })).toBeVisible();
  await expect(page.getByText("A second purchase form is intentionally locked", { exact: false })).toBeVisible();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await expect(page.locator("[role=dialog]")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({ path: "test-results/crypto-payment-recovery-before.png", fullPage: true });

  await expect(page.getByRole("heading", { name: "Your KaSiShares" })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText("KSC-TEST-0001")).toBeVisible();
  await expect(page.getByText("Certificate issued")).toBeVisible();
  await page.screenshot({ path: "test-results/crypto-payment-recovery-after.png", fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test("manual recheck reports verified settlement without claiming the certificate is already ready", async ({ page }) => {
  await page.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }));
  await page.route("**/api/presale/portal", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(portalPayload(false)) }));
  await page.route(`**/api/presale/orders/${ORDER_REFERENCE}/payment-recheck`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ orderReference: ORDER_REFERENCE, status: "settled", transactionHash: TRANSACTION_HASH, confirmations: 12, reason: "canonical_transfer_confirmed" }),
  }));

  await page.goto("/shares/account");
  await page.getByRole("button", { name: "Recheck payment" }).click();
  await expect(page.getByText("Share issuance has started", { exact: false })).toBeVisible();
  await expect(page.getByText("certificate have been issued", { exact: false })).toHaveCount(0);
});

test("shows receiving instructions and allows submitting BSC transaction hash when awaiting payment", async ({ page }) => {
  let submittedPayload: { txHash?: string } | null = null;
  let orderSubmitted = false;

  const awaitingPayload = () => ({
    applicant: { profileNumber: "KSI-E4F6B6E0C8", email: "buyer@example.test" },
    application: { applicationNumber: "KSA-CF095B03", campaignName: "Test", status: "completed", phaseCompleted: 4, completionPercent: 100, nextStep: 5, resumeUrl: null },
    kyc: { status: "approved", verified: true },
    order: {
      orderReference: ORDER_REFERENCE,
      status: orderSubmitted ? "payment_submitted" : "awaiting_payment",
      incorporationStatus: "pending",
      paymentRail: "remitano_usdt",
      quantity: 1,
      totalUsdt: "1.000000",
      paymentNetwork: "bsc",
      paymentMinConfirmations: 12,
      transactionHash: orderSubmitted ? TRANSACTION_HASH : undefined,
      paymentVerificationStatus: orderSubmitted ? "submitted" : undefined,
      cancellation: { eligible: !orderSubmitted, reason: orderSubmitted ? "crypto_hash_submitted" : "unpaid_no_payment_activity" },
    },
    currentReservation: {
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
      requiredConfirmations: 12,
      tokenContract: "0x55d398326f99059fF775485246999027B3197955",
      paymentDeadline: "2026-08-31T12:00:00.000Z",
      termsVersion: "presale-reservation-v1",
      status: orderSubmitted ? "payment_submitted" : "awaiting_payment",
      incorporationStatus: "pending",
      cancellation: { eligible: !orderSubmitted, reason: orderSubmitted ? "crypto_hash_submitted" : "unpaid_no_payment_activity" },
    },
    journey: orderSubmitted ? {
      state: "payment_submitted",
      reason: "payment_hash_submitted",
      allowedActions: ["view_reservation", "recheck_payment"],
      applicationEditable: false,
      reservationEditable: false,
      polling: "payment",
      terminal: false,
    } : {
      state: "awaiting_payment",
      reason: "payment_required",
      allowedActions: ["view_reservation", "submit_payment_hash", "cancel_reservation"],
      applicationEditable: false,
      reservationEditable: false,
      polling: "payment",
      terminal: false,
    },
    shareholder: { totalIssuedShares: 0, holdings: [] },
    continuation: { nextStep: null, reason: "reservation_in_progress", resumeUrl: null },
  });

  await page.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) }));
  await page.route("**/api/presale/portal", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(awaitingPayload()) }));
  await page.route(`**/api/presale/orders/${ORDER_REFERENCE}/payment-proof`, async (route) => {
    submittedPayload = JSON.parse(route.request().postData() || "{}");
    orderSubmitted = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        orderReference: ORDER_REFERENCE,
        status: "submitted",
        transactionHash: TRANSACTION_HASH,
        confirmations: 0,
      }),
    });
  });

  await page.goto("/shares/account");
  await expect(page.getByRole("heading", { name: "Complete your USDT transfer" })).toBeVisible();
  await expect(page.getByText("USDT on BNB Smart Chain (BEP-20)")).toBeVisible();
  await expect(page.getByText("0x1111111111111111111111111111111111111111")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy address" })).toBeVisible();

  const hashInput = page.getByPlaceholder("0x... (66-character BSC transaction hash)");
  await expect(hashInput).toBeVisible();
  await hashInput.fill(TRANSACTION_HASH);
  await page.getByRole("button", { name: "Submit transaction hash" }).click();

  await expect(page.getByRole("heading", { name: "Your share choice is preserved" })).toBeVisible();
  expect(submittedPayload).toEqual({ txHash: TRANSACTION_HASH });
});

