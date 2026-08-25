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
    expect(api).toContain('const emailStatus = await ensurePresaleReservationCreatedEmail(order, campaign, intent?.network ?? "webpay");');
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
    expect(presale).toContain("<form key={resumeApplicant?.profileNumber ?? \"new-applicant\"} className=\"space-y-5\" noValidate");
    expect(presale).toContain('<Button formNoValidate className="flex-1 bg-amber-400');
  });
});
