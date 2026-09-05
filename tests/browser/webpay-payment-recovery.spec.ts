// Author: Klaasvaakie ( |╲ )
import { expect, test } from "@playwright/test";

const ORDER_REFERENCE = "KSP-WEBPAY-TEST-01";

// The presale landing page must not turn a completed allocation back into a bill.
for (const width of [390, 1440]) {
  for (const rail of ["webpay_card", "remitano_usdt"] as const) {
    for (const state of ["issued", "confirmed", "closed", "open"] as const) {
      test(`presale reservation ${rail} ${state} at ${width}px`, async ({ page }) => {
        await page.clock.install();
        await page.setViewportSize({ width, height: 900 });
        const errors: string[] = [];
        page.on("pageerror", (error) => errors.push(error.message));
        const portal = webPayPortalPayload(state === "closed" || state === "open" ? "awaiting_payment" : state);
        Object.assign(portal.applicant, { phone: "+27820000000", country: "South Africa", physicalAddress: "Test address" });
        Object.assign(portal.currentReservation, {
          paymentMethod: rail, network: "bsc", receivingAddress: `0x${"22".repeat(20)}`,
          tokenContract: `0x${"11".repeat(20)}`, requiredConfirmations: 12,
          paymentDeadline: new Date(Date.now() + (state === "open" ? 3600000 : -86400000)).toISOString(),
        });
        if (state === "open" || state === "closed") portal.journey.allowedActions = ["view_reservation", rail === "webpay_card" ? "start_card_checkout" : "submit_payment_hash"];
        await page.route("**/api/theme", (route) => route.fulfill({ json: {} }));
        await page.route("**/api/presale/portal", (route) => route.fulfill({ json: portal }));
        await page.route("**/api/presale/offer?*", (route) => route.fulfill({ json: { offer: {
          name: "Allocation test", issuerName: "Solidus Holdings (Pty) Ltd", shareClass: "Class B",
          priceUsdt: "25", priceUsd: "25", usdtPerUsd: "1", network: "bsc", sharesRemaining: 100,
          invitationSharesRemaining: 10, minConfirmations: 12, paymentWindowMinutes: 30, termsVersion: "test",
        } } }));
        await page.goto("/presale?invite=local-display-fixture");
        await expect(page.getByText(ORDER_REFERENCE, { exact: true })).toBeVisible();
        if (state === "open") {
          await expect(page.getByText(/Pay before/)).toBeVisible();
          await expect(page.getByText(/SAST \(UTC\+2\)/)).toBeVisible();
          await page.clock.fastForward(3_601_000);
          await expect(page.getByText(/Payment window closed/)).toBeVisible();
          await expect(page.getByText(/Pay before/)).toHaveCount(0);
        } else {
          await expect(page.getByText(/Pay before/)).toHaveCount(0);
          await expect(page.getByText("Verified receiving address", { exact: true })).toHaveCount(0);
          await expect(page.getByText(/Never send assets/)).toHaveCount(0);
          await expect(page.getByRole("button", { name: "Continue to secure WebPay checkout" })).toHaveCount(0);
          await expect(page.getByText(state === "closed" ? /Payment window closed/ : "No further payment is due for this allocation.")).toBeVisible();
        }
        if (rail === "webpay_card") await expect(page.getByText(/Never send assets/)).toHaveCount(0);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        if (state === "issued") {
          const account = page.getByRole("link", { name: "View my shares and certificate" });
          await account.scrollIntoViewIfNeeded();
          expect(await account.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            for (let parent = element.parentElement; parent; parent = parent.parentElement) {
              const style = getComputedStyle(parent);
              const bounds = parent.getBoundingClientRect();
              if (/(hidden|clip|auto|scroll)/.test(style.overflowX) && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) return false;
              if (/(hidden|clip|auto|scroll)/.test(style.overflowY) && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) return false;
            }
            return true;
          })).toBe(true);
          if (process.env.PRESALE_QA_SCREENSHOTS) await page.screenshot({ path: `${process.env.PRESALE_QA_SCREENSHOTS}/issued-${rail}-${width}.png`, fullPage: true });
          await account.click();
          await expect(page).toHaveURL(/\/shares\/account$/);
          await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
        }
        expect(errors).toEqual([]);
      });
    }
  }
}

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
