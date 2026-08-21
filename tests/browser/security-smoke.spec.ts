// Author: Klaasvaakie ( |╲ )
import { expect, test } from "@playwright/test";

test("landing page boots from server session truth", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/KaSiHUB/i);
  await expect(page.getByRole("heading", { name: "Make your money go further." })).toBeVisible();
  const session = await page.request.get("/api/auth/session");
  await expect(session).toBeOK();
  expect(await session.json()).toMatchObject({ authenticated: false, member: null });
});

test("KaSiHub navigation opens the fully branded KaSiPay pages", async ({ page }) => {
  // Author: Klaasvaakie ( |╲ )
  await page.route("**/api/auth/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: false, member: null }),
  }));

  await page.goto("/");
  await page.locator('header nav.hidden a[href="/kasipay"]').click();
  await expect(page).toHaveURL(/\/kasipay$/);
  await expect(page.getByRole("heading", { name: "Shop at Participating Retailers & Earn Instant Cashback" })).toBeVisible();
  const primaryNavigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(primaryNavigation.getByRole("link", { name: "Home", exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole("link", { name: "KaSiPaY-OnE", exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole("link", { name: "KaSiPayBiz", exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole("link", { name: "Pricing", exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole("link", { name: "FAQ", exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole("link", { name: "About", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/InstaPay/i);

  for (const route of ["gini", "merchant", "pricing", "faq", "about", "contact"]) {
    await page.goto(`/kasipay/${route}`);
    await expect(page.locator("body")).toContainText("KaSiPay");
    await expect(page.locator("body")).not.toContainText(/InstaPay/i);
  }
});

test("Become a member uses KaSiPay throughout the South African registration flow", async ({ page }) => {
  // Author: Klaasvaakie ( |╲ )
  await page.route("**/api/auth/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: false, member: null }),
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Join KaSiHUB", exact: true }).first().click();
  const registration = page.getByRole("dialog");
  await expect(registration).toContainText("Become a member of the Eco-System");
  await expect(registration).not.toContainText(/InstaPay/i);

  await registration.getByText("SA Citizen in SA", { exact: true }).click();
  await registration.getByLabel("I confirm that I am joining via bulk registration").click();
  await registration.getByRole("button", { name: "Continue", exact: true }).click();

  await expect(registration.getByRole("heading", { name: "KaSiPay Gini setup" })).toBeVisible();
  await expect(registration).not.toContainText(/InstaPay/i);
  await expect(registration.locator('a[href*="instapay" i]')).toHaveCount(0);
  await expect(registration.getByRole("link", { name: /KaSiPay Gini/ })).toHaveAttribute("href", "/kasipay/gini");
  await expect(registration.getByRole("link", { name: /Contact KaSiPay/ })).toHaveAttribute("href", "/kasipay/contact");
});

test("KaSiPay status endpoints never return legacy-branded links or copy", async ({ request }) => {
  // Author: Klaasvaakie ( |╲ )
  for (const endpoint of ["/api/kasipay/status", "/api/instapay/status"]) {
    const response = await request.get(endpoint);
    await expect(response).toBeOK();
    expect(JSON.stringify(await response.json())).not.toMatch(/instapay/i);
  }
});

test("public KaSiHub assistant answers approved topics and protects private support", async ({ page }) => {
  // Author: Klaasvaakie ( |╲ )
  await page.route("**/api/auth/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: false, member: null }),
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Open Max" }).click();
  await expect(page.getByRole("heading", { name: "Max" })).toBeVisible();
  const conversation = page.getByRole("log", { name: "Max conversation" });
  await page.getByRole("button", { name: "How do I get started?" }).click();
  await expect(conversation).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("Source: KaSiHub public website — How it works")).toHaveCount(0);
  await expect(conversation).toHaveAttribute("aria-busy", "false");
  await expect(page.getByText(/Use “Join KaSiHub” on this website/)).toBeVisible();
  await expect(page.getByText("Source: KaSiHub public website — How it works")).toBeVisible();

  await page.getByLabel("Ask a public question about KaSiHub").fill("Can you check my account?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(conversation).toHaveAttribute("aria-busy", "true");
  await expect(conversation).toHaveAttribute("aria-busy", "false");
  await expect(page.getByText(/^I can only explain public KaSiHub information\. I cannot access accounts/)).toBeVisible();
  await expect(page.getByText(/Do not share passwords, ID numbers, banking details/)).toBeVisible();
});

test("cross-site state-changing requests are rejected", async ({ request }) => {
  const response = await request.post("/api/auth/login", {
    headers: { Origin: "https://attacker.invalid", "Sec-Fetch-Site": "cross-site" },
    data: { email: "victim@example.com", password: "not-a-real-password" },
  });
  expect(response.status()).toBe(403);
  expect(await response.json()).toMatchObject({ error: "Cross-site request rejected" });
});

const member = {
  id: "profile-member", profileNumber: "KSI-TEST", membershipType: "INDIVIDUAL_LOCAL",
  firstName: "Test", lastName: "Member", companyName: null, companyRegNo: null,
  idPassport: null, sarsNumber: null, email: "member@example.test", country: "ZA",
  mobile: "+27000000000", addressLine: null, city: null, postalCode: null,
  profilePicture: null, beneficiaryName: null, beneficiaryId: null, guardianName: null,
  kycStatus: "VERIFIED", kycVerifiedAt: null, subscriptionStatus: "ACTIVE",
  subscriptionAmount: 140, subscriptionCurrency: "ZAR", paymentMethod: "ADMIN_CONFIRMATION",
  taxThreshold: false, monthlyEarnings: 0, nfcTagId: null, visaCardLast4: null,
  rootsBankAccount: null, citizenshipType: "SA_CITIZEN", instapayStatus: "NONE",
  instapayVerifiedAt: null, instapayAccountRef: null, uplineProfileNumber: null,
  uplineConfirmed: false, isAdmin: false, createdAt: new Date().toISOString(),
};

test("restores an authenticated member and logs out without a page refresh", async ({ page }) => {
  let loggedOut = false;
  await page.route("**/api/auth/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(loggedOut ? { authenticated: false, member: null } : { authenticated: true, member }),
  }));
  await page.route("**/api/dashboard?**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      member, walletBalance: 0, walletCurrency: "ZAR", totalEarnings: 0, monthlyEarnings: 0, earningsToday: 0, earningsThisWeek: 0,
      earningsThisMonth: 0, ecosystemEarningsToday: 0,
      pools: { pioneer: { total: 0, today: 0, distributions: [], eligible: false }, marketplace: { total: 0, today: 0, distributions: [] }, shareholders: { total: 0, today: 0, distributions: [], eligible: false } },
      kasiShares: { count: 0, valuePerShare: 0, totalValue: 0 }, aureusShares: { count: 0, valuePerShare: 0, totalValue: 0 },
      rootsBankShares: { count: 0, totalValue: 0 }, ecosystemDownline: 0, ecosystemLevels: 0,
      pioneerPoolEligible: false, auditorNotified: false, transactions: [], poolDistributions: [],
      totalEarningsTrend: [], earningsBreakdown: [],
    }),
  }));
  await page.route("**/api/auth/logout", async (route) => {
    loggedOut = true;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Test Member" })).toBeVisible();
  await page.getByTitle("Sign out").first().click();
  await expect(page.getByRole("heading", { name: "Make your money go further." })).toBeVisible();
});

test("restores administrator authority from the server, not browser storage", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("kasihub-store", JSON.stringify({
    state: { isAuthenticated: true, adminMode: true, currentMemberId: "forged", currentMember: { id: "forged", isAdmin: true } }, version: 0,
  })));
  await page.route("**/api/auth/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ authenticated: true, member: { ...member, id: "admin-profile", firstName: "Admin", isAdmin: true } }),
  }));
  await page.route("**/api/admin/stats", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      totals: {
        members: 0, activeMembers: 0, pendingKyc: 0, totalShares: 0, shareRevenueUSD: 0,
        pioneerCount: 0, pioneerTarget: 200, totalRevenue: 0, subscriptionRevenue: 0,
        mallRevenue: 0, marketplaceRevenue: 0, poolPaidOut: 0, poolBalance: 0,
        poolIncoming: 0, mallTransactions: 0, marketplaceOrders: 0, taxEligibleMembers: 0,
        totalVouchers: 0, activeVouchers: 0, expiringVouchers: 0, totalVoucherValue: 0,
        totalReferrals: 0, registeredReferrals: 0, referralConversionRate: 0, totalReferralRewards: 0,
        totalNotifications: 0, sent5Days: 0, sent3Days: 0, sent1Day: 0,
        instapayVerifiedCount: 0, instapayPendingCount: 0,
      },
      memberGrowth: [], cumulativeGrowth: [], revenueBySource: [],
      typeBreakdown: { INDIVIDUAL_ADULT: 0, INDIVIDUAL_KIDS: 0, COMPANY: 0 },
      kycBreakdown: { VERIFIED: 0, PENDING: 0, REJECTED: 0 },
      silos: [], phases: [], dividends: [], recentActivity: [],
    }),
  }));
  await page.goto("/");
  await expect(page.getByText("Admin Portal").first()).toBeVisible();
  await expect(page.getByText("Exco Administrator").first()).toBeVisible();
});

test("administrator reviews private identity evidence before KYC verification", async ({ page }) => {
  const pendingMember = { ...member, id: "pending-profile", firstName: "Pending", lastName: "Applicant", isAdmin: false,
    citizenshipType: "INTERNATIONAL", kycStatus: "PENDING", shareCount: 0, transactionCount: 0, orderCount: 0 };
  const documents = [
    { id: "id-document", documentType: "identity_document", filename: "passport.png", contentType: "image/png", sizeBytes: 1024, status: "uploaded", uploadedAt: new Date().toISOString(), rejectionReason: null },
    { id: "selfie-document", documentType: "identity_selfie", filename: "selfie.jpg", contentType: "image/jpeg", sizeBytes: 1024, status: "uploaded", uploadedAt: new Date().toISOString(), rejectionReason: null },
  ];
  await page.route("**/api/auth/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true, member: { ...member, id: "admin-profile", firstName: "Admin", isAdmin: true } }) }));
  await page.route("**/api/admin/stats", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ totals: { members: 1, activeMembers: 0, pendingKyc: 1, totalShares: 0, shareRevenueUSD: 0, pioneerCount: 0, pioneerTarget: 200, totalRevenue: 0, subscriptionRevenue: 0, mallRevenue: 0, marketplaceRevenue: 0, poolPaidOut: 0, poolBalance: 0, poolIncoming: 0, mallTransactions: 0, marketplaceOrders: 0, taxEligibleMembers: 0, totalVouchers: 0, activeVouchers: 0, expiringVouchers: 0, totalVoucherValue: 0, totalReferrals: 0, registeredReferrals: 0, referralConversionRate: 0, totalReferralRewards: 0, totalNotifications: 0, sent5Days: 0, sent3Days: 0, sent1Day: 0, instapayVerifiedCount: 0, instapayPendingCount: 0 }, memberGrowth: [], cumulativeGrowth: [], revenueBySource: [], typeBreakdown: { INDIVIDUAL_ADULT: 1, INDIVIDUAL_KIDS: 0, COMPANY: 0 }, kycBreakdown: { VERIFIED: 0, PENDING: 1, REJECTED: 0 }, silos: [], phases: [], dividends: [], recentActivity: [] }) }));
  await page.route("**/api/admin/members?**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ members: [pendingMember], total: 1 }) }));
  await page.route("**/api/admin/kyc/documents?memberId=*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ caseId: "case-1", caseStatus: "pending", documents }) }));
  await page.route("**/api/admin/kyc/documents/id-document", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }));
  await page.route("**/api/admin/kyc/documents", async (route) => {
    if (route.request().method() !== "PATCH") return route.fallback();
    const body = route.request().postDataJSON() as { documentId: string; action: string };
    const document = documents.find((item) => item.id === body.documentId)!;
    document.status = "approved";
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ documentId: document.id, status: "approved" }) });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Members & KYC/ }).first().click();
  await page.getByRole("button", { name: "Review evidence" }).click();
  await expect(page.getByText("ID document or passport", { exact: true })).toBeVisible();
  await expect(page.getByText("Identity selfie", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Verify member" })).toBeDisabled();
  await page.getByRole("button", { name: "View" }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "ID document or passport" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Approve" }).first().click();
  await page.getByRole("button", { name: "Approve" }).first().click();
  await expect(page.getByRole("button", { name: "Verify member" })).toBeEnabled();
});

test("design studio remains hidden while its persistence path is stabilised", async ({ page }) => {
  await page.route("**/api/auth/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ authenticated: true, member: { ...member, id: "admin-profile", firstName: "Admin", isAdmin: true } }),
  }));
  await page.route("**/api/admin/stats", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ totals: {
      members: 0, activeMembers: 0, pendingKyc: 0, totalShares: 0, shareRevenueUSD: 0,
      pioneerCount: 0, pioneerTarget: 200, totalRevenue: 0, subscriptionRevenue: 0,
      mallRevenue: 0, marketplaceRevenue: 0, poolPaidOut: 0, poolBalance: 0,
      poolIncoming: 0, mallTransactions: 0, marketplaceOrders: 0, taxEligibleMembers: 0,
      totalVouchers: 0, activeVouchers: 0, expiringVouchers: 0, totalVoucherValue: 0,
      totalReferrals: 0, registeredReferrals: 0, referralConversionRate: 0, totalReferralRewards: 0,
      totalNotifications: 0, sent5Days: 0, sent3Days: 0, sent1Day: 0,
      instapayVerifiedCount: 0, instapayPendingCount: 0,
    }, memberGrowth: [], cumulativeGrowth: [], revenueBySource: [], typeBreakdown: { INDIVIDUAL_ADULT: 0, INDIVIDUAL_KIDS: 0, COMPANY: 0 }, kycBreakdown: { VERIFIED: 0, PENDING: 0, REJECTED: 0 }, silos: [], phases: [], dividends: [], recentActivity: [] }),
  }));
  await page.goto("/");
  // Author: Klaasvaakie ( |╲ )
  await expect(page.locator("button").filter({ hasText: "Design Suite" })).toHaveCount(0);
});

test("private USDT shares page fails closed without an invitation", async ({ page }) => {
  // Author: Klaasvaakie ( |╲ )
  await page.goto("/presale");
  await expect(page).toHaveTitle(/Private KaSiShares Presale/i);
  await expect(page.getByRole("heading", { name: "Private invitation required" })).toBeVisible();
  await expect(page.getByText("This Class B share presale is not open to the general public.")).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer");
});

test("invited buyer can reserve shares without exposing the order access token in URLs", async ({ page }) => {
  // Author: Klaasvaakie ( |╲ )
  const invite = "private-invitation-token-000000000001";
  const accessToken = "private-order-access-token-00000000001";
  const orderReference = "KSP-ORDER-001";
  let refreshUrl = "";
  let refreshAccessToken = "";

  await page.route("**/api/presale/offer?invite=*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ offer: {
      name: "KaSiShares Private Allocation",
      issuerName: "Solidus Holdings (Pty) Ltd",
      shareClass: "Class B",
      priceUsdt: "25.000000",
      network: "TRON",
      tokenContract: "TRON-USDT-CONTRACT",
      receivingAddress: "TControlledReceiverAddress",
      sharesRemaining: 100,
      invitationSharesRemaining: 5,
      invitationEmail: "buyer@example.test",
      minConfirmations: 20,
      paymentWindowMinutes: 30,
      termsVersion: "presale-reservation-v1",
    } }),
  }));
  await page.route("**/api/presale/orders", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accessToken, order: {
        orderReference,
        campaign: "KaSiShares Private Allocation",
        issuerName: "Solidus Holdings (Pty) Ltd",
        shareClass: "Class B",
        buyerName: "Private Buyer",
        buyerEmail: "buyer@example.test",
        quantity: 2,
        unitPriceUsdt: "25.000000",
        totalUsdt: "50.000000",
        status: "awaiting_payment",
        network: "TRON",
        tokenContract: "TRON-USDT-CONTRACT",
        receivingAddress: "TControlledReceiverAddress",
        minConfirmations: 20,
        paymentDeadline: "2026-08-11T00:00:00.000Z",
        confirmations: 0,
        incorporationStatus: "pending",
      } }),
    });
  });
  await page.route("**/api/presale/kyc-session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ session: { id: crypto.randomUUID(), url: "https://verify.didit.me/test-session", status: "Not Started" } }),
  }));
  await page.route("**/api/presale/kyc-status", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ verification: { required: true, verified: true, status: "VERIFIED", caseId: crypto.randomUUID() } }),
  }));
  await page.route(`**/api/presale/orders/${orderReference}/payment-proof`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ orderReference, status: "payment_submitted", transactionHash: "abcdef0123456789" }),
  }));
  await page.route(`**/api/presale/orders/${orderReference}`, async (route) => {
    refreshUrl = route.request().url();
    refreshAccessToken = route.request().headers()["x-presale-access-token"] ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ order: {
        orderReference,
        campaign: "KaSiShares Private Allocation",
        issuerName: "Solidus Holdings (Pty) Ltd",
        shareClass: "Class B",
        buyerName: "Private Buyer",
        buyerEmail: "buyer@example.test",
        quantity: 2,
        unitPriceUsdt: "25.000000",
        totalUsdt: "50.000000",
        status: "payment_submitted",
        network: "TRON",
        tokenContract: "TRON-USDT-CONTRACT",
        receivingAddress: "TControlledReceiverAddress",
        minConfirmations: 20,
        paymentDeadline: "2026-08-11T00:00:00.000Z",
        transactionHash: "abcdef0123456789",
        confirmations: 0,
        incorporationStatus: "pending",
      } }),
    });
  });

  // Legacy admin-generated links must resolve to the canonical invite route. Author: Klaasvaakie ( |╲ )
  await page.goto(`/presale/${encodeURIComponent(invite)}`);
  await expect(page.getByRole("heading", { name: "KaSiShares Private Allocation" })).toBeVisible();
  // Exercise the staged investor journey before asserting the secure order boundary. Author: Klaasvaakie ( |╲ )
  await page.getByLabel("Full legal name").fill("Private Buyer");
  await page.getByLabel("Cellphone number *", { exact: true }).fill("+27820000000");
  await page.getByLabel("Confirm cellphone number *", { exact: true }).fill("+27820000000");
  await page.getByLabel("Application type *").selectOption("individual");
  await page.getByLabel("Nationality *").fill("South African");
  await page.getByLabel("Country of residence *").fill("South Africa");
  await page.getByLabel("Occupation *").fill("Engineer");
  await page.getByLabel("Employer *").fill("Example Employer");
  await page.getByLabel("Tax number *").fill("TEST-TAX-001");
  await page.getByLabel("Physical address *").fill("1 Example Street, Johannesburg");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Phase 1 shares at $25 each *").fill("2");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Primary source").selectOption("salary");
  await page.getByLabel("Whose funds?").selectOption("own");
  await page.getByLabel("Source-of-funds details").fill("Employment income");
  await page.getByLabel("Account holder").fill("Private Buyer");
  await page.getByLabel("Bank").fill("Test Bank");
  await page.getByLabel("Account number").fill("1234567890");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel(/I confirm that the investment funds/).check();
  await page.getByLabel(/I understand that the investment is long-term/).check();
  await page.getByLabel(/I confirm that the investor information supplied/).check();
  await page.getByRole("button", { name: "Start identity verification" }).click();

  await page.getByLabel("Investor terms").evaluate((node) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event("scroll", { bubbles: true })); });
  await page.getByLabel(/I accept the presale reservation acknowledgement/).check();
  await page.getByRole("button", { name: "Reserve and view payment" }).click();

  await expect(page.getByText("50.000000 USDT")).toBeVisible();
  await expect(page.getByText("TControlledReceiverAddress")).toBeVisible();
  await expect(page.getByText(/transaction hash is not accepted as settled/i)).toBeVisible();

  await page.getByLabel("Transaction hash").fill("abcdef0123456789");
  await page.getByRole("button", { name: "Submit transaction for confirmation" }).click();
  await expect(page.getByRole("heading", { name: "Transaction submitted" })).toBeVisible();
  expect(refreshUrl).not.toContain(accessToken);
  expect(refreshUrl).not.toContain("accessToken=");
  expect(refreshAccessToken).toBe(accessToken);
});
