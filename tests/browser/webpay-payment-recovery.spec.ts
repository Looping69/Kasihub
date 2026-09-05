// Author: Klaasvaakie ( |╲ )
import { expect, test } from "@playwright/test";

const ORDER_REFERENCE = "KSP-WEBPAY-TEST-01";

function webPayPortalPayload(state: "awaiting_payment" | "confirmed" | "issued", error?: string) {
  const isSettled = state === "confirmed" || state === "issued";
  return {
    applicant: { profileNumber: "KSI-WP-8877", email: "cardbuyer@example.test", legalName: "Card Buyer" },
    application: {
      applicationNumber: "KSA-WP-1122",
      campaignName: "KaSiShares Private Allocation",
      status: "completed",
      phaseCompleted: 4,
      completionPercent: 100,
      nextStep: 5,
      resumeUrl: null,
    },
    kyc: { status: "approved", verified: true },
    order: {
      orderReference: ORDER_REFERENCE,
      status: isSettled ? "confirmed" : "awaiting_payment",
      incorporationStatus: state === "issued" ? "incorporated" : "pending",
      paymentRail: "webpay_card",
      quantity: 2,
      totalUsdt: "50.000000",
      totalZar: "900.00",
      unitPriceZar: "450.00",
      paymentDeadline: new Date(Date.now()+3600000).toISOString(),
      cancellation: { eligible: false, reason: "card_checkout_started" },
    },
    currentReservation: {
      orderReference: ORDER_REFERENCE,
      phaseNumber: 1,
      phaseLabel: "Phase 1",
      campaignName: "KaSiShares Private Allocation",
      issuerName: "Solidus Holdings (Pty) Ltd",
      shareClass: "Class B",
      paidShares: 2,
      bonusShares: 2,
      totalAllocatedShares: 4,
      paymentMethod: "webpay_card",
      unitPriceUsd: "25.00",
      totalUsd: "50.00",
      unitPriceUsdt: "25.000000",
      totalUsdt: "50.000000",
      unitPriceZar: "450.00",
      totalZar: "900.00",
      paymentDeadline: new Date(Date.now()+3600000).toISOString(),
      termsVersion: "presale-reservation-v1",
      status: isSettled ? "confirmed" : "awaiting_payment",
      incorporationStatus: state === "issued" ? "incorporated" : "pending",
      cancellation: { eligible: false, reason: "card_checkout_started" },
    },
    journey: isSettled ? {
      state: state === "issued" ? "issued" : "confirmed",
      reason: state === "issued" ? "certificate_issued" : "payment_confirmed",
      allowedActions: state === "issued"
        ? ["view_reservation", "download_certificate", "verify_certificate"]
        : ["view_reservation"],
      applicationEditable: false,
      reservationEditable: false,
      polling: state === "issued" ? "none" : "incorporation",
      terminal: state === "issued",
    } : {
      state: "awaiting_payment",
      reason: "reservation_awaiting_payment",
      allowedActions: ["view_reservation", "start_card_checkout"],
      applicationEditable: false,
      reservationEditable: false,
      polling: "none",
      terminal: false,
    },
    shareholder: state === "issued" ? {
      totalIssuedShares: 4,
      holdings: [{
        orderReference: ORDER_REFERENCE,
        campaignName: "KaSiShares Private Allocation",
        paidShares: 2,
        bonusShares: 2,
        allocatedShares: 4,
        status: "issued",
        incorporationStatus: "incorporated",
        certificate: {
          certificateNumber: "KSC-WP-0001",
          totalShares: 4,
          status: "issued",
          issuedAt: "2026-09-03T12:00:00.000Z",
        },
      }],
    } : { totalIssuedShares: 0, holdings: [] },
    continuation: { nextStep: null, reason: isSettled ? "signup_complete" : "reservation_in_progress", resumeUrl: null },
    ...(error ? { error } : {}),
  };
}

test.describe("WebPay Payment Recovery Suite", () => {
  test("shows start checkout CTA when reservation is awaiting payment", async ({ page }) => {
    await page.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api/presale/portal", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(webPayPortalPayload("awaiting_payment")),
    }));

    await page.goto("/shares/account");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to secure WebPay checkout" })).toBeVisible();
  });

  test("retains reservation card and retry action if WebPay checkout endpoint returns error", async ({ page }) => {
    await page.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api/presale/portal", (route) => route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(webPayPortalPayload("awaiting_payment")),
    }));
    await page.route(`**/api/presale/orders/${ORDER_REFERENCE}/webpay-checkout`, (route) => route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: "WebPay gateway is temporarily unavailable. Please retry shortly." }),
    }));

    await page.goto("/shares/account");
    const checkoutButton = page.getByRole("button", { name: "Continue to secure WebPay checkout" });
    await expect(checkoutButton).toBeVisible();
    await checkoutButton.click();

    // Error message must be presented without destroying reservation state
    await expect(page.getByText("WebPay gateway is temporarily unavailable", { exact: false })).toBeVisible();
    // Retry button remains accessible
    await expect(page.getByRole("button", { name: "Continue to secure WebPay checkout" })).toBeVisible();
  });

  test("advances cleanly to confirmed state when webhook settles payment", async ({ page }) => {
    let settled = false;
    await page.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api/presale/portal", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(webPayPortalPayload(settled ? "confirmed" : "awaiting_payment")),
      });
    });

    await page.goto("/shares/account");
    await expect(page.getByRole("button", { name: "Continue to secure WebPay checkout" })).toBeVisible();

    // Simulate backend settlement after callback
    settled = true;
    await page.reload();

    await expect(page.getByText("Payment confirmed", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to secure WebPay checkout" })).toHaveCount(0);
  });
});
