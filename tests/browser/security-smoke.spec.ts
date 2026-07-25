// Author: Klaasvaakie ( |╲ )
import { expect, test } from "@playwright/test";

test("landing page boots from server session truth", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/KaSiHUB/i);
  await expect(page.getByRole("heading", { name: "The hybrid ecosystem for community wealth." })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "Your money. Your business. Simplified." })).toBeVisible();
  const primaryNavigation = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(primaryNavigation.getByRole("link", { name: "Gini", exact: true })).toBeVisible();
  await expect(primaryNavigation.getByRole("link", { name: "Merchant", exact: true })).toBeVisible();
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

test("public KaSiHub assistant answers approved topics and protects private support", async ({ page }) => {
  // Author: Klaasvaakie ( |╲ )
  await page.route("**/api/auth/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: false, member: null }),
  }));

  await page.goto("/");
  await page.getByRole("button", { name: "Ask KaSiHub" }).click();
  await expect(page.getByRole("heading", { name: "Ask KaSiHub" })).toBeVisible();
  const conversation = page.getByRole("log", { name: "KaSiHub conversation" });
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
      member, totalEarnings: 0, monthlyEarnings: 0, earningsToday: 0, earningsThisWeek: 0,
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
  await expect(page.getByRole("heading", { name: "The hybrid ecosystem for community wealth." })).toBeVisible();
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
