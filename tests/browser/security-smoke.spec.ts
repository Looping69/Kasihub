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

test("shareholder application enforces required banking details while keeping SWIFT/BIC optional", async ({ page }) => {
  const invite = "private-form-review-token-0000000000000001";
  let registrationBody: Record<string, unknown> = {};
  await page.route("**/api/presale/portal", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: "KaSiShares login is required" }),
  }));
  await page.route("**/api/presale/offer?invite=*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ offer: {
      name: "KaSiShares Private Allocation", issuerName: "Solidus Holdings (Pty) Ltd", shareClass: "Class B",
      priceUsdt: "25.000000", priceUsd: "25.00", network: "BSC", sharesRemaining: 100,
      invitationSharesRemaining: 5, invitationEmail: "buyer@example.test", minConfirmations: 20,
      paymentWindowMinutes: 30, termsVersion: "presale-reservation-v1",
    } }),
  }));
  await page.route("**/api/presale/members", (route) => {
    registrationBody = route.request().postDataJSON() as Record<string, unknown>;
    return route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ profileId: "profile-1", profileNumber: "KSI-ONE", applicationId: "application-1", created: true, emailStatus: "sent" }),
    });
  });
  await page.route("**/api/presale/progress", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ phaseCompleted: 1, completionPercent: 20 }),
  }));

  await page.goto(`/presale?invite=${invite}`);
  await expect(page.getByRole("heading", { name: "KASIHUB SHAREHOLDER PROFILE" })).toBeVisible();
  await expect(page.getByText("Your secure Shareholder profile links to this application, identity verification, share purchase and certificate.")).toBeVisible();
  await expect(page.getByLabel("Cellphone country code", { exact: true })).toHaveValue("+27");
  await expect(page.getByLabel("Confirm cellphone country code")).toHaveValue("+27");
  await expect(page.getByLabel("Street address *")).toBeAttached();
  await expect(page.getByLabel("Suburb *")).toBeAttached();
  await expect(page.getByLabel("City *")).toBeAttached();
  await expect(page.getByLabel("Postal code *")).toBeAttached();

  const password = page.locator('input[name="accountPassword"]');
  await password.fill("twelveletters");
  await expect(page.getByLabel("Password meets all requirements")).not.toBeVisible();
  await password.fill("Secure-pass-2026");
  await expect(page.getByLabel("Password meets all requirements")).toBeVisible();
  await expect(page.getByLabel("Passwords meet all requirements and match")).not.toBeVisible();
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Show confirm password" })).toBeVisible();

  await page.getByLabel("Full legal name").fill("Test Shareholder");
  await page.getByLabel("Cellphone number", { exact: true }).fill("82 123 4567");
  await expect(page.getByLabel("Cellphone number is valid for the selected country code")).toBeVisible();
  await page.getByLabel("Confirm cellphone number", { exact: true }).fill("82 123 4568");
  await expect(page.getByLabel("Cellphone numbers are valid and match")).not.toBeVisible();
  await page.getByLabel("Confirm cellphone number", { exact: true }).fill("82 123 4567");
  await expect(page.getByLabel("Cellphone numbers are valid and match")).toBeVisible();
  await page.locator('input[name="confirmAccountPassword"]').fill("Secure-pass-2026");
  await expect(page.getByLabel("Passwords meet all requirements and match")).toBeVisible();
  await page.getByLabel("Nationality *").fill("South African");
  await page.getByLabel("Country of residence *").fill("South Africa");
  await page.getByLabel("Occupation *").fill("Engineer");
  await page.getByLabel("Employer *").fill("Example Company");
  await page.getByLabel("Tax number *").fill("TAX-123");
  await page.getByLabel("Street address *").fill("1 Main Road");
  await page.getByLabel("Suburb *").fill("Sunnyside");
  await page.getByLabel("City *").fill("Pretoria");
  await page.getByLabel("Postal code *").fill("0002");
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page.getByRole("dialog", { name: "Shareholder profile created" })).toBeVisible();
  await expect(page.getByText("An email has been sent to you with your shareholder login details if you need to continue the process.")).toBeVisible();
  expect(registrationBody).toMatchObject({
    phone: "+27821234567", streetAddress: "1 Main Road", suburb: "Sunnyside", city: "Pretoria", postalCode: "0002",
  });
  await page.getByRole("button", { name: "Continue application" }).click();
  await expect(page.getByRole("heading", { name: "Choose your investment" })).toBeVisible();
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page.getByRole("heading", { name: "Funding details" })).toBeVisible();

  for (const label of ["Account holder *", "Bank *", "Branch *", "Account number *", "Account type *"]) {
    await expect(page.getByLabel(label)).toHaveAttribute("required", "");
  }
  await expect(page.getByLabel("SWIFT/BIC (optional)")).not.toHaveAttribute("required", "");
  const sourceDetails = page.getByLabel("Source-of-funds details");
  await expect(sourceDetails).not.toHaveAttribute("required", "");
  await page.getByLabel("Primary source *").selectOption("other", { force: true });
  await expect(page.getByLabel("Source-of-funds details *")).toHaveAttribute("required", "");
  await page.getByLabel("Whose funds? *").selectOption("own");
  await page.getByLabel("Source-of-funds details *").fill("Employment and savings");
  await page.getByLabel("Account holder *").fill("Test Shareholder");
  await page.getByLabel("Bank *").fill("Test Bank");
  await page.getByLabel("Branch *").fill("123456");
  await page.getByLabel("Account number *").fill("1234567890");
  await page.getByLabel("Account type *").fill("Cheque");
  await page.getByLabel("SWIFT/BIC (optional)").fill("SHORT");
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page.getByRole("heading", { name: "Funding details" })).toBeVisible();
  await expect(page.getByLabel("SWIFT/BIC (optional)")).toBeFocused();
  await page.getByLabel("SWIFT/BIC (optional)").fill("");
  await page.getByRole("button", { name: /^Continue$/ }).click();
  await expect(page.getByRole("heading", { name: "Identity evidence" })).toBeVisible();
});

test("applicant portal continues signup at the first server-authoritative unfinished step", async ({ page }) => {
  const invite = "private-resume-token-000000000000000001";
  const writes: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/api/presale/") && request.method() !== "GET") writes.push(`${request.method()} ${request.url()}`);
  });
  await page.route("**/api/presale/portal", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      applicant: {
        profileNumber: "KSI-RESUME",
        email: "resume@example.test",
        legalName: "Resume Applicant",
        phone: "+27820000000",
        country: "South Africa",
        physicalAddress: "1 Test Street",
      },
      application: {
        applicationNumber: "KSA-RESUME",
        campaignName: "KaSiShares Private Allocation",
        status: "draft",
        applicantType: "individual",
        phaseCompleted: 4,
        completionPercent: 80,
        nextStep: 4,
        resumeUrl: `/presale?invite=${encodeURIComponent(invite)}`,
      },
      kyc: { status: "pending", verified: false },
      order: null,
      reservation: null,
      journey: {
        state: "application_in_progress",
        reason: "application_incomplete",
        allowedActions: ["resume_application"],
        applicationEditable: true,
        reservationEditable: false,
        polling: "none",
        terminal: false,
      },
      continuation: { nextStep: 4, reason: "resume", resumeUrl: `/presale?invite=${encodeURIComponent(invite)}` },
    }),
  }));
  await page.route("**/api/presale/offer?invite=*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ offer: {
      name: "KaSiShares Private Allocation",
      issuerName: "Solidus Holdings (Pty) Ltd",
      shareClass: "Class B",
      priceUsdt: "25.000000",
      network: "BSC",
      sharesRemaining: 100,
      invitationSharesRemaining: 5,
      invitationEmail: "resume@example.test",
      minConfirmations: 20,
      paymentWindowMinutes: 30,
      termsVersion: "presale-reservation-v1",
    } }),
  }));

  await page.goto("/shares/account");
  const continueSignup = page.getByRole("link", { name: "Continue signup" });
  await expect(continueSignup).toBeVisible();
  await expect(continueSignup).toHaveAttribute("href", `/presale?invite=${encodeURIComponent(invite)}`);
  await continueSignup.click();

  await expect(page).toHaveURL(new RegExp(`/presale\\?invite=${encodeURIComponent(invite)}$`));
  await expect(page.getByText("Identity evidence, current step")).toBeAttached();
  await expect(page.getByRole("heading", { name: "Identity verification" })).toBeVisible();
  await expect(page.getByLabel("Full legal name")).toHaveValue("Resume Applicant");
  expect(page.url()).not.toContain("step=");
  expect(writes).toEqual([]);
});

test("applicant portal does not open a second signup path for an active reservation", async ({ page }) => {
  await page.route("**/api/presale/portal", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      applicant: { profileNumber: "KSI-RESERVED", email: "reserved@example.test" },
      application: {
        applicationNumber: "KSA-RESERVED", campaignName: "KaSiShares Private Allocation", status: "draft",
        phaseCompleted: 5, completionPercent: 100, nextStep: 5, resumeUrl: null,
      },
      kyc: { status: "approved", verified: true },
      order: {
        orderReference: "KSP-RESERVED", status: "awaiting_payment", incorporationStatus: "pending",
        paymentRail: "remitano_usdt", quantity: 2, totalUsdt: "50.000000",
        cancellation: { eligible: true, reason: "unpaid_no_payment_activity" },
      },
      reservation: {
        orderReference: "KSP-RESERVED", phaseNumber: 1, phaseLabel: "Phase 1",
        campaignName: "KaSiShares Private Allocation", issuerName: "Solidus Holdings (Pty) Ltd", shareClass: "Class B",
        paidShares: 2, bonusShares: 2, totalAllocatedShares: 4, paymentMethod: "remitano_usdt",
        unitPriceUsd: "25.00", totalUsd: "50.00", unitPriceUsdt: "25.000000", totalUsdt: "50.000000",
        network: "TRON", receivingAddress: "TControlledReceiverAddress", requiredConfirmations: 20,
        paymentDeadline: "2026-08-31T12:00:00.000Z", termsVersion: "presale-reservation-v1",
        status: "awaiting_payment", incorporationStatus: "pending",
        cancellation: { eligible: true, reason: "unpaid_no_payment_activity" },
      },
      journey: {
        state: "awaiting_payment", reason: "reservation_awaiting_payment",
        allowedActions: ["view_reservation", "submit_payment_hash", "cancel_reservation"],
        applicationEditable: false, reservationEditable: false, polling: "none", terminal: false,
      },
      continuation: { nextStep: null, reason: "reservation_in_progress", resumeUrl: null },
    }),
  }));

  await page.goto("/shares/account");
  await expect(page.getByRole("heading", { name: "Signup steps complete" })).toBeVisible();
  await expect(page.getByText(/A reservation already exists/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue signup" })).toHaveCount(0);
});

test("applicant portal fails closed against the legacy portal contract", async ({ page }) => {
  await page.route("**/api/presale/portal", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      applicant: { profileNumber: "KSI-NONE", email: "none@example.test" },
      application: null,
      kyc: { status: "pending", verified: false },
      order: null,
      testInviteUrl: "/presale?invite=" + "a".repeat(72),
    }),
  }));

  await page.goto("/shares/account");
  await expect(page.getByRole("heading", { name: "No application to continue" })).toBeVisible();
  await expect(page.getByText(/private invitation is still required/)).toBeVisible();
  await expect(page.getByText("Applicant controls are safely locked")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open test invitation" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Continue signup" })).toHaveCount(0);
});

test("invited buyer can reserve shares without exposing the order access token in URLs", async ({ page }) => {
  // Author: Klaasvaakie ( |╲ )
  test.setTimeout(60_000);
  const invite = "private-invitation-token-000000000001";
  const accessToken = "private-order-access-token-00000000001";
  const orderReference = "KSP-ORDER-001";
  const transactionHash = "ab".repeat(32);
  let refreshUrl = "";
  let refreshAccessToken = "";
  let memberCreated = false;
  let kycVerified = false;
  let orderCreated = false;
  let paymentSubmitted = false;

  await page.route("**/api/presale/offer?invite=*", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ offer: {
      name: "KaSiShares Private Allocation",
      issuerName: "Solidus Holdings (Pty) Ltd",
      shareClass: "Class B",
      priceUsdt: "25.000000",
      priceUsd: "25.00",
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
  await page.route("**/api/presale/portal", (route) => {
    if (!memberCreated) return route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "KaSiShares login is required" }),
    });
    if (!orderCreated) return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        applicant: { profileNumber: "KSI-ONE", email: "buyer@example.test", legalName: "Private Buyer", phone: "+27820000000", country: "South Africa", physicalAddress: "1 Example Street" },
        application: { applicationNumber: "KSA-ONE", campaignName: "KaSiShares Private Allocation", status: "draft", applicantType: "individual", phaseCompleted: 4, completionPercent: 80, nextStep: kycVerified ? 5 : 4, resumeUrl: null },
        kyc: { status: kycVerified ? "approved" : "pending", verified: kycVerified },
        order: null,
        reservation: null,
        journey: kycVerified ? {
          state: "eligible_to_reserve", reason: "application_and_kyc_complete", allowedActions: ["resume_application", "create_reservation"],
          applicationEditable: true, reservationEditable: true, polling: "none", terminal: false,
        } : {
          state: "kyc_pending", reason: "kyc_not_approved", allowedActions: ["resume_kyc", "refresh_kyc"],
          applicationEditable: true, reservationEditable: false, polling: "kyc", terminal: false,
        },
        shareholder: { totalIssuedShares: 0, holdings: [] },
        continuation: { nextStep: kycVerified ? 5 : 4, reason: "resume", resumeUrl: null },
      }),
    });
    const status = paymentSubmitted ? "payment_submitted" : "awaiting_payment";
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        applicant: { profileNumber: "KSI-ONE", email: "buyer@example.test", legalName: "Private Buyer", phone: "+27820000000", country: "South Africa", physicalAddress: "1 Example Street" },
        application: { applicationNumber: "KSA-ONE", campaignName: "KaSiShares Private Allocation", status: "draft", applicantType: "individual", phaseCompleted: 4, completionPercent: 100, nextStep: 5, resumeUrl: null },
        kyc: { status: "approved", verified: true },
        order: {
          orderReference, status, incorporationStatus: "pending", paymentRail: "remitano_usdt", quantity: 2,
          totalUsdt: "50.000000", paymentNetwork: "TRON", paymentMinConfirmations: 20,
          transactionHash: paymentSubmitted ? transactionHash : undefined,
          cancellation: paymentSubmitted
            ? { eligible: false, reason: "crypto_hash_submitted" }
            : { eligible: true, reason: "unpaid_no_payment_activity" },
        },
        reservation: {
          orderReference, phaseNumber: 1, phaseLabel: "Phase 1", campaignName: "KaSiShares Private Allocation",
          issuerName: "Solidus Holdings (Pty) Ltd", shareClass: "Class B", paidShares: 2, bonusShares: 2,
          totalAllocatedShares: 4, paymentMethod: "remitano_usdt", unitPriceUsd: "25.00", totalUsd: "50.00",
          unitPriceUsdt: "25.000000", totalUsdt: "50.000000", network: "TRON",
          tokenContract: "TRON-USDT-CONTRACT", receivingAddress: "TControlledReceiverAddress", requiredConfirmations: 20,
          paymentDeadline: "2026-08-31T12:00:00.000Z", termsVersion: "presale-reservation-v1",
          status, incorporationStatus: "pending",
          cancellation: paymentSubmitted
            ? { eligible: false, reason: "crypto_hash_submitted" }
            : { eligible: true, reason: "unpaid_no_payment_activity" },
        },
        journey: paymentSubmitted ? {
          state: "payment_submitted", reason: "payment_hash_submitted", allowedActions: ["view_reservation", "recheck_payment"],
          applicationEditable: false, reservationEditable: false, polling: "payment", terminal: false,
        } : {
          state: "awaiting_payment", reason: "reservation_awaiting_payment", allowedActions: ["view_reservation", "submit_payment_hash", "cancel_reservation"],
          applicationEditable: false, reservationEditable: false, polling: "none", terminal: false,
        },
        shareholder: { totalIssuedShares: 0, holdings: [] },
        continuation: { nextStep: null, reason: "reservation_in_progress", resumeUrl: null },
      }),
    });
  });
  await page.route("**/api/presale/members", async (route) => {
    memberCreated = true;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        profileId: "profile-1",
        profileNumber: "KSI-ONE",
        applicationId: "application-1",
        created: true,
        emailStatus: "sent",
      }),
    });
  });
  await page.route("**/api/presale/progress", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ phaseCompleted: 3, completionPercent: 60 }),
  }));
  await page.route("**/api/presale/orders", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    orderCreated = true;
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
        paymentRail: "remitano_usdt",
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
  await page.route("**/api/presale/kyc-status", async (route) => {
    kycVerified = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ verification: { required: true, verified: true, status: "VERIFIED", caseId: crypto.randomUUID() } }),
    });
  });
  await page.route(`**/api/presale/orders/${orderReference}/payment-proof`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ orderReference, status: "payment_submitted", transactionHash }),
  }).then(() => { paymentSubmitted = true; }));
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
        paymentRail: "remitano_usdt",
        unitPriceUsdt: "25.000000",
        totalUsdt: "50.000000",
        status: "payment_submitted",
        network: "TRON",
        tokenContract: "TRON-USDT-CONTRACT",
        receivingAddress: "TControlledReceiverAddress",
        minConfirmations: 20,
        paymentDeadline: "2026-08-11T00:00:00.000Z",
        transactionHash,
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
  await page.getByLabel("Cellphone number", { exact: true }).fill("+27820000000");
  await page.getByLabel("Confirm cellphone number", { exact: true }).fill("+27820000000");
  await page.getByLabel("Account password *", { exact: true }).fill("correct-horse-battery-staple-1");
  await page.getByLabel("Confirm account password *", { exact: true }).fill("correct-horse-battery-staple-1");
  await page.getByLabel("Application type *").selectOption("individual");
  await page.getByLabel("Nationality *").fill("South African");
  await page.getByLabel("Country of residence *").fill("South Africa");
  await page.getByLabel("Occupation *").fill("Engineer");
  await page.getByLabel("Employer *").fill("Example Employer");
  await page.getByLabel("Tax number *").fill("TEST-TAX-001");
  await page.getByLabel("Street address *").fill("1 Example Street");
  await page.getByLabel("Suburb *").fill("Example Suburb");
  await page.getByLabel("City *").fill("Johannesburg");
  await page.getByLabel("Postal code *").fill("2000");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue application" }).click();

  await page.getByLabel("Paid Class B at $25 each *").fill("2");
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Primary source").selectOption("salary");
  await page.getByLabel("Whose funds?").selectOption("own");
  await page.getByLabel("Source-of-funds details").fill("Employment income");
  await page.getByLabel("Account holder").fill("Private Buyer");
  await page.getByLabel("Bank").fill("Test Bank");
  await page.getByLabel("Branch *").fill("123456");
  await page.getByLabel("Account number").fill("1234567890");
  await page.getByLabel("Account type").fill("Cheque");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Identity evidence" })).toBeVisible();
  await page.getByLabel(/I confirm that the investment funds/).check();
  await page.getByLabel(/I understand that the investment is long-term/).check();
  await page.getByLabel(/I confirm that the investor information supplied/).check();
  await page.getByRole("button", { name: "Verify ID" }).click();

  await expect(page.getByRole("heading", { name: "Terms and reservation" })).toBeVisible({ timeout: 15_000 });
  await page.getByLabel("Investor terms").evaluate((node) => { node.scrollTop = node.scrollHeight; node.dispatchEvent(new Event("scroll", { bubbles: true })); });
  await page.getByLabel(/I accept the presale reservation acknowledgement/).check();
  expect(await page.locator("form :invalid").evaluateAll((fields) => fields.map((field) => field.getAttribute("name")))).toEqual([]);
  await page.getByRole("button", { name: "Create reservation" }).click();

  await expect(page.getByText("50.000000 USDT", { exact: true })).toBeVisible();
  await expect(page.getByText("TControlledReceiverAddress")).toBeVisible();
  await expect(page.getByText(/transaction hash is not accepted as settled/i)).toBeVisible();

  await page.getByLabel("Transaction hash").fill(transactionHash);
  await page.getByRole("button", { name: "Submit hash" }).click();
  await expect(page.getByRole("heading", { name: "Payment submitted" })).toBeVisible();
  expect(refreshUrl).not.toContain(accessToken);
  expect(refreshUrl).not.toContain("accessToken=");
  expect(refreshAccessToken).toBe(accessToken);
});
