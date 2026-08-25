// Author: Klaasvaakie ( |╲ )
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string) {
  return readFileSync(new URL(`../../../../${path}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
}

describe("isolated KaSiShares applicant portal", () => {
  test("uses a separate browser cookie and scoped backend sessions", () => {
    const client = source("src/lib/encore-client.ts");
    const registration = source("src/app/api/presale/members/route.ts");
    const migration = source("encore/migrations/identity/10_scoped_sessions.up.sql");
    expect(client).toContain('PRESALE_SESSION_COOKIE = "kasishares_session"');
    expect(registration).toContain("PRESALE_SESSION_COOKIE");
    expect(registration).not.toContain("ENCORE_SESSION_COOKIE");
    expect(migration).toContain("session_scope");
    expect(migration).toContain("'presale'");
  });

  test("keeps resume credentials encrypted and out of welcome email links", () => {
    const api = source("encore/domains/presale/api.ts");
    const migration = source("encore/migrations/presale/9_applicant_portal_email.up.sql");
    expect(migration).toContain("resume_token_ciphertext");
    expect(migration).toContain("presale_email_deliveries");
    expect(api).toContain('const portalUrl = "https://shares.kasihub.net/shares/account"');
    expect(api).toContain("decryptPresaleSecret");
    expect(api).toContain("Idempotency-Key");
    expect(api).not.toMatch(/portalUrl\s*=.*invite=/);
  });

  test("sends one durable confirmation for each committed reservation", () => {
    const api = source("encore/domains/presale/api.ts");
    const migration = source("encore/migrations/presale/10_reservation_email.up.sql");
    expect(migration).toContain("order_id UUID REFERENCES presale_orders(id)");
    expect(migration).toContain("uq_presale_reservation_email_delivery");
    expect(api).toContain("presale-reservation-created/${input.orderId}");
    expect(api).toContain('await tx.commit();\n      const intent = order.payment_rail === "remitano_usdt" ? await ensurePresalePaymentIntent(order, campaign) : undefined;');
    expect(api).toContain('const emailStatus = await safelyEnsurePresaleReservationCreatedEmail(order, campaign, intent?.network ?? "webpay");');
    expect(api).toContain('return { order: orderResponse(order, campaign, null, 0, intent), accessToken, emailStatus };');
  });

  test("makes exchange fees explicit without weakening exact USDT settlement", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    const verifier = source("encore/domains/payments/chains/evaluate.ts");
    expect(presale).toContain("Exchange withdrawal fees and network fees are additional");
    expect(presale).toContain("Do not send BNB or another token");
    expect(presale).toContain("Do not send funds after this deadline");
    expect(presale).toContain("dateTime={order.paymentDeadline}");
    expect(verifier).toContain('decision: "underpaid"');
    expect(verifier).toContain('decision: "manual_review"');
    expect(verifier).toContain('decision: "confirmed"');
  });

  test("requires the presale role and rejects ecosystem-only account reuse", () => {
    const api = source("encore/domains/presale/api.ts");
    const access = source("encore/domains/auth/access.ts");
    expect(api).toContain("Use a different email address for the separate KaSiShares applicant account");
    expect(api).toContain("requirePresaleSession()");
    expect(access).toContain("session.scope !== \"presale\"");
    expect(access).toContain("r.name = 'presale_investor'");
  });

  test("derives continuation from backend state without accepting a browser-selected step", () => {
    const api = source("encore/domains/presale/api.ts");
    const continuation = source("encore/domains/presale/applicant-continuation.ts");
    const account = source("src/app/shares/account/shares-account-client.tsx");
    const presale = source("src/app/presale/presale-client.tsx");
    expect(api).toContain("deriveApplicantContinuation");
    expect(api).toContain("`/presale?invite=${encodeURIComponent(");
    expect(continuation).toContain("Browser query parameters never participate in this decision");
    expect(continuation).toContain('kycStatus?.toLowerCase() !== "approved"');
    expect(account).toContain("Continue signup");
    expect(account).toContain("continuation.resumeUrl");
    expect(presale).toContain("portal.continuation?.nextStep ?? portal.application.nextStep");
    expect(api).not.toMatch(/resumeUrl[^\n]+[?&]step=/);
  });

  test("does not let hidden completed phases block the final reservation submit", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    expect(presale).toContain('key={resumeApplicant?.profileNumber ?? "new-applicant"} className="space-y-5" noValidate');
    expect(presale).toContain('<Button formNoValidate className="flex-1 bg-amber-400');
    expect(presale).not.toContain("event.currentTarget.checkValidity()");
    expect(presale).toContain("setApplicationPhase(1)");
    expect(presale).toContain("setApplicationPhase(4)");
  });

  test("persists and restores the encrypted applicant form draft", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    const api = source("encore/domains/presale/api.ts");
    expect(presale).toContain("draft: applicationDraft(form)");
    expect(presale).toContain("setResumeDraft(portal.application.draft)");
    expect(presale).toContain('name !== "accountPassword" && name !== "confirmAccountPassword"');
    expect(api).toContain("decryptPresaleApplicationDraft");
    expect(api).toContain('for (const forbidden of ["accountPassword", "confirmAccountPassword"])');
    expect(api).toContain("payload_ciphertext,payload_nonce,payload_auth_tag");
  });

  test("restores authoritative KYC and legacy structured application data", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    const account = source("src/app/shares/account/shares-account-client.tsx");
    const api = source("encore/domains/presale/api.ts");
    expect(presale).toContain("verified: portal.kyc.verified");
    expect(presale).toContain("setVerificationStarted(portal.kyc.verified");
    expect(api).toContain("normalizePresaleApplicationDraft");
    expect(api).toContain('assign("buyerPhone", source.mobileNumber)');
    expect(api).toContain("restoredDraft.buyerEmail ??= session.user.email");
    expect(api).toContain("investor_application_ciphertext");
    expect(api).toContain("const restoredDraft = { ...orderDraft, ...applicationDraft }");
    expect(account).toContain("application.phaseCompleted >= 4 && portal.kyc.verified");
  });

  test("recovers a committed active reservation and keeps email delivery non-fatal", () => {
    const api = source("encore/domains/presale/api.ts");
    const migration = source("encore/migrations/presale/12_reservation_email_uniqueness.up.sql");
    expect(api).toContain("safelyEnsurePresaleReservationCreatedEmail");
    expect(api).toContain("An active reservation already exists with a different quantity or payment method");
    expect(api).toContain("status = 'awaiting_payment' AND payment_deadline > now()");
    expect(migration).toContain("DROP CONSTRAINT IF EXISTS presale_email_deliveries_external_profile_id_email_type_key");
    expect(migration).toContain("uq_presale_account_created_email_delivery");
  });

  test("lets the applicant cancel only an unpaid reservation before changing payment method", () => {
    const api = source("encore/domains/presale/api.ts");
    const account = source("src/app/shares/account/shares-account-client.tsx");
    const route = source("src/app/api/presale/orders/[reference]/cancel/route.ts");
    expect(api).toContain('path: "/presale/orders/:orderReference/cancel"');
    expect(api).toContain("acknowledgeNoPaymentSent !== true");
    expect(api).toContain('target.status !== "awaiting_payment"');
    expect(api).toContain("reserved_shares = reserved_shares - $2");
    expect(api).toContain("used_shares = used_shares - $2");
    expect(route).toContain("presaleSessionToken");
    expect(route).toContain("Your account status will be refreshed");
    expect(account).toContain("await loadPortal().catch(() => undefined)");
    expect(account).toContain("Cancel unpaid reservation &amp; change payment method");
    expect(account).toContain("no card payment or crypto transfer has been sent");
  });
});
