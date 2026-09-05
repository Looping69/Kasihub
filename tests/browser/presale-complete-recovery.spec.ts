// Author: Klaasvaakie ( |╲ )
import { expect, test } from "@playwright/test";

const ORDER_REF = "KSP-RECOVERY-SPEC-01";

test("complimentary holdings survive reload and are not labelled paid shares", async ({ page }) => {
  const original = mockPortalResponse({ journeyState: "issued", kycVerified: true });
  const grant = { ...original,
    order: { ...original.order, paymentRail: "complimentary_coupon", totalUsdt: "0", totalZar: undefined },
    currentReservation: { ...original.currentReservation, paymentMethod: "complimentary_coupon", paidShares: 0, bonusShares: 0, complimentaryShares: 4, totalUsd: "0", totalUsdt: "0" },
    shareholder: { totalIssuedShares: 4, holdings: original.shareholder!.holdings.map(holding => ({ ...holding, paidShares: 0, bonusShares: 0, complimentaryShares: 4 })) },
  };
  await page.route("**/api/presale/portal", route => route.fulfill({ json: grant }));
  await page.goto("/shares/account");
  await expect(page.getByText("Complimentary shares", { exact: true })).toBeVisible();
  await expect(page.getByText("Paid shares", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Complimentary shares", { exact: true })).toBeVisible();
});

test("coupon checkout previews the server quantity and invalidates edited codes", async ({ page }) => {
  const original = mockPortalResponse({ journeyState: "eligible_to_reserve", kycVerified: true, phaseCompleted: 4 });
  const portal = { ...original, applicant: { ...original.applicant, phone: "+27820000000" },
    application: { ...original.application, nextStep: 5, applicantType: "individual", draft: {} },
    journey: { ...original.journey, allowedActions: ["create_reservation"], applicationEditable: true },
  };
  await page.route("**/api/presale/portal", route => route.fulfill({ json: portal }));
  await page.route("**/api/presale/offer?*", route => route.fulfill({ json: { offer: { slug: "test", name: "Coupon campaign", issuerName: "Test issuer", shareClass: "Class B", priceUsd: "25", priceUsdt: "25", usdtPerUsd: "1", sharesRemaining: 100, invitationSharesRemaining: 100, termsVersion: "test", network: "bsc", couponsEnabled: true, paymentMethods: [] } } }));
  await page.route("**/api/presale/coupons/preview", route => route.fulfill({ json: { quantity: 7, amountDue: "0" } }));
  await page.goto(`/presale?invite=${"a".repeat(64)}`);
  await page.getByText("Redeem free shares coupon", { exact: true }).click();
  await page.getByLabel("Coupon code", { exact: true }).fill("KSG-TEST");
  await page.getByRole("button", { name: "Check coupon", exact: true }).click();
  await expect(page.getByText("7 complimentary shares · Amount due: 0. No bonus shares are added.")).toBeVisible();
  await page.getByLabel("Coupon code", { exact: true }).fill("KSG-CHANGED");
  await expect(page.getByText("7 complimentary shares · Amount due: 0. No bonus shares are added.")).toHaveCount(0);
});

function mockPortalResponse(options: {
  journeyState: "application_in_progress" | "kyc_pending" | "eligible_to_reserve" | "awaiting_payment" | "confirmed" | "issued";
  phaseCompleted?: number;
  kycVerified?: boolean;
}) {
  const isAwaitingOrLater = ["awaiting_payment", "confirmed", "issued"].includes(options.journeyState);
  const isIssued = options.journeyState === "issued";
  const isConfirmed = options.journeyState === "confirmed";

  return {
    applicant: { profileNumber: "KSI-REC-9911", email: "recovery@example.test", legalName: "Recovery Tester" },
    application: {
      applicationNumber: "KSA-REC-1122",
      campaignName: "KaSiShares Private Allocation",
      status: isAwaitingOrLater ? "completed" : "draft",
      phaseCompleted: options.phaseCompleted ?? (isAwaitingOrLater ? 4 : 2),
      completionPercent: isAwaitingOrLater ? 100 : 50,
      nextStep: isAwaitingOrLater ? 5 : 3,
      resumeUrl: null,
    },
    kyc: {
      status: options.kycVerified ? "approved" : (options.journeyState === "kyc_pending" ? "pending" : "not_started"),
      verified: Boolean(options.kycVerified),
    },
    order: isAwaitingOrLater ? {
      orderReference: ORDER_REF,
      status: isIssued ? "incorporated" : (isConfirmed ? "confirmed" : "awaiting_payment"),
      incorporationStatus: isIssued ? "incorporated" : "pending",
      paymentRail: "webpay_card",
      quantity: 2,
      totalUsdt: "50.000000",
      totalZar: "900.00",
      unitPriceZar: "450.00",
      paymentDeadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      cancellation: { eligible: false, reason: "card_checkout_started" },
    } : null,
    currentReservation: isAwaitingOrLater ? {
      orderReference: ORDER_REF,
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
      paymentDeadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      termsVersion: "presale-reservation-v1",
      status: isIssued ? "incorporated" : (isConfirmed ? "confirmed" : "awaiting_payment"),
      incorporationStatus: isIssued ? "incorporated" : "pending",
      cancellation: { eligible: false, reason: "card_checkout_started" },
    } : null,
    journey: {
      state: options.journeyState,
      reason: "test_reason",
      allowedActions: isIssued
        ? ["view_reservation", "download_certificate", "verify_certificate"]
        : (isConfirmed ? ["view_reservation"] : ["start_card_checkout", "view_reservation"]),
      applicationEditable: false,
      reservationEditable: false,
      polling: "none",
      terminal: isIssued,
    },
    authority: {
      schemaVersion: "presale-applicant-authority.v2",
      requestGeneration: 1,
      available: true,
      reason: "authoritative",
      currentReservation: isAwaitingOrLater ? {
        orderReference: ORDER_REF,
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
        paymentDeadline: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        termsVersion: "presale-reservation-v1",
        status: isIssued ? "incorporated" : (isConfirmed ? "confirmed" : "awaiting_payment"),
        incorporationStatus: isIssued ? "incorporated" : "pending",
        cancellation: { eligible: false, reason: "card_checkout_started" },
      } : null,
      journey: {
        state: options.journeyState,
        reason: "authoritative_journey",
        allowedActions: isIssued
          ? ["view_reservation", "download_certificate", "verify_certificate"]
          : (isConfirmed ? ["view_reservation"] : ["start_card_checkout", "view_reservation"]),
        applicationEditable: false,
        reservationEditable: false,
        polling: "none",
        terminal: isIssued,
      },
      allowedActions: isIssued
        ? ["view_reservation", "download_certificate", "verify_certificate"]
        : (isConfirmed ? ["view_reservation"] : ["start_card_checkout", "view_reservation"]),
    },
    shareholder: isIssued ? {
      totalIssuedShares: 4,
      holdings: [{
        orderReference: ORDER_REF,
        campaignName: "KaSiShares Private Allocation",
        shareClass: "Class B",
        paidShares: 2,
        bonusShares: 2,
        allocatedShares: 4,
        status: "issued",
        certificate: {
          certificateNumber: "KSC-2026-B-8877",
          verificationId: "ksc-verify-8877",
          totalShares: 4,
          issuedAt: "2026-09-03T12:00:00.000Z",
        },
      }],
    } : null,
  };
}

test.describe("Phase 4: Browser Refresh & Recovery Matrix", () => {
  test("Browser Refresh at awaiting_payment preserves reservation and checkout CTA", async ({ page }) => {
    await page.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api/presale/portal", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPortalResponse({ journeyState: "awaiting_payment", kycVerified: true })),
      });
    });

    await page.goto("/shares/account");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to secure WebPay checkout" })).toBeVisible();

    // Reload page (F5 refresh)
    await page.reload();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue to secure WebPay checkout" })).toBeVisible();
  });

  test("Browser Refresh at confirmed preserves confirmed state without regress", async ({ page }) => {
    await page.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api/presale/portal", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPortalResponse({ journeyState: "confirmed", kycVerified: true })),
      });
    });

    await page.goto("/shares/account");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText("Payment confirmed")).toBeVisible();

    // Reload
    await page.reload();
    await expect(page.getByText("Payment confirmed")).toBeVisible();
  });

  test("Browser Refresh at issued displays shareholder holdings and certificate actions", async ({ page }) => {
    await page.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page.route("**/api/presale/portal", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPortalResponse({ journeyState: "issued", kycVerified: true })),
      });
    });

    await page.goto("/shares/account");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page.getByText("Shareholder account")).toBeVisible();
    await expect(page.getByText("KSC-2026-B-8877")).toBeVisible();

    // Reload
    await page.reload();
    await expect(page.getByText("Shareholder account")).toBeVisible();
    await expect(page.getByText("KSC-2026-B-8877")).toBeVisible();
  });

  test("Cross-Device Simulation: Clean session B loads authoritative state without localStorage", async ({ browser }) => {
    // Session A in Context 1
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    await page1.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page1.route("**/api/presale/portal", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPortalResponse({ journeyState: "awaiting_payment", kycVerified: true })),
      });
    });
    await page1.goto("/shares/account");
    await expect(page1.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    // Session B in a completely clean Context 2 (zero storage shared)
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await page2.route("**/api/theme", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
    await page2.route("**/api/presale/portal", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockPortalResponse({ journeyState: "awaiting_payment", kycVerified: true })),
      });
    });
    await page2.goto("/shares/account");
    await expect(page2.getByRole("heading", { name: "Welcome back" })).toBeVisible();
    await expect(page2.getByRole("button", { name: "Continue to secure WebPay checkout" })).toBeVisible();

    await context1.close();
    await context2.close();
  });
});


test('expired reservation blocks checkout after reload', async ({page}) => {
 const data=mockPortalResponse({journeyState:'awaiting_payment',kycVerified:true});
 data.currentReservation!.paymentDeadline=new Date(Date.now()-60000).toISOString();
 await page.route('**/api/presale/portal',route=>route.fulfill({json:data}));
 await page.goto('/shares/account');
 await expect(page.getByRole('button',{name:'Continue to secure WebPay checkout'})).toBeDisabled();
 await expect(page.getByText('Do not send more funds',{exact:false})).toBeVisible();
});

test('login network failure remains retryable without unhandled rejection',async ({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/presale/portal',route=>route.fulfill({status:401,json:{}}));
 await page.route('**/api/presale/auth/login',route=>route.abort('failed'));
 await page.goto('/shares/account');
 await page.locator('[name=email]').fill('network@example.test');await page.locator('[name=password]').fill('TestPassword!2026');
 const button=page.getByRole('button',{name:'Sign in to KaSiShares'});await button.click();
 await expect(page.getByText('Connection interrupted. Please try signing in again.')).toBeVisible();
 await expect(button).toBeEnabled();expect(errors).toEqual([]);
});
