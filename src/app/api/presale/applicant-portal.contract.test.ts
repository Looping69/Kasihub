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
    expect(api).toContain('await tx.commit();\n      const intent = await ensurePresalePaymentAuthority(order, campaign);');
    expect(api).toContain('const emailStatus = await safelyEnsurePresaleReservationCreatedEmail(order, campaign, intent?.network ?? "webpay");');
    expect(api).toContain('return { order: orderResponse(order, campaign, null, 0, intent), accessToken, emailStatus };');
  });

  test("makes exchange fees explicit without weakening exact USDT settlement", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    const verifier = source("encore/domains/payments/chains/evaluate.ts");
    expect(presale).toContain("Exchange withdrawal fees and network fees are additional");
    expect(presale).toContain("Do not send BNB or another token");
    expect(presale).toContain("Do not send funds after this deadline");
    expect(presale).toContain("dateTime={reservation.paymentDeadline}");
    expect(verifier).toContain('decision: "underpaid"');
    expect(verifier).toContain('decision: "manual_review"');
    expect(verifier).toContain('decision: "confirmed"');
  });

  test("uses the server journey and reservation contracts as the only browser action authority", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    const account = source("src/app/shares/account/shares-account-client.tsx");
    const boundary = source("src/lib/applicant-portal-contract.ts");
    for (const client of [presale, account]) {
      expect(client).toContain("allowsApplicantAction");
      expect(client).toContain("readApplicantAuthority");
      expect(client).not.toContain("window.confirm");
      expect(client).not.toMatch(/order\.status\s*===/);
    }
    expect(presale).not.toContain("webPayUnitPriceZar ?? 450");
    expect(presale).not.toContain("Phase 1 shares at $25 each");
    expect(boundary).toContain('reason: "applicant_contract_unavailable"');
    expect(boundary).toContain('allowedActions: ["contact_support"]');
  });

  test("requires scoped presale sessions while allowing authenticated member reuse", () => {
    const api = source("encore/domains/presale/api.ts");
    const access = source("encore/domains/auth/access.ts");
    expect(api).not.toContain("Use a different email address for the separate KaSiShares applicant account");
    expect(api).toContain("verifyPassword(payload.password, existing.password_hash)");
    expect(api).toContain("WHERE name = 'presale_investor'");
    expect(api).toContain("requirePresaleSession()");
    expect(access).toContain("session.scope !== \"presale\"");
    expect(access).toContain("r.name = 'presale_investor'");
  });

  test("offers password visibility on both login surfaces without changing autocomplete semantics", () => {
    const account = source("src/app/shares/account/shares-account-client.tsx");
    const landing = source("src/components/landing.tsx");
    for (const login of [account, landing]) {
      expect(login).toContain('type={showPassword ? "text" : "password"}');
      expect(login).toContain("Show password");
      expect(login).toContain('autoComplete="current-password"');
    }
  });

  test("promotes only verified issued shareholders and keeps matrix placement behind payment activation", () => {
    const api = source("encore/domains/presale/api.ts");
    const membership = source("encore/domains/membership/api.ts");
    const account = source("src/app/shares/account/shares-account-client.tsx");
    const route = source("src/app/api/presale/ecosystem-account/route.ts");
    expect(api).toContain('path: "/presale/shareholder/ecosystem-account"');
    expect(api).toContain("Verified shareholder identity is required");
    expect(api).toContain("An issued share allocation is required");
    expect(api).toContain("shareholder-conversion-${session.profile.id}");
    expect(api).toContain("'ecosystem',now(),now() + interval '7 days'");
    expect(membership).toContain("const node = await placeMatrixNode(payment.profile_id");
    expect(account).not.toContain("Open your normal KaSiHub account");
    expect(account).not.toContain("Open member account");
    expect(route).toContain("ENCORE_SESSION_COOKIE");
    expect(route).not.toContain("PRESALE_SESSION_COOKIE");
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

  test("does not rehydrate and remount the live form after creating its applicant profile", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    expect(presale).toContain("portalHydratedRef.current = true;\n    await loadApplicantPortal();");
    expect(presale).toContain("polling must not overwrite values the applicant is actively editing");
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

  test("does not reapply a stale draft or require passwords from a resumed applicant", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    expect(presale).toContain("}, [resumeDraft]);");
    expect(presale).not.toContain("[resumeDraft, applicationPhase]");
    expect(presale).toContain("{!memberProfileNumber ? <>");
    expect(presale).toContain('name="accountPassword"');
    expect(presale).toContain('name="confirmAccountPassword"');
  });

  test("persists declarations before handing off to identity verification", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    const phaseFour = presale.slice(presale.indexOf("if (applicationPhase === 4)"), presale.indexOf("if (applicationPhase === 2 || applicationPhase === 3)"));
    expect(phaseFour.indexOf("await saveProgress(form, 3);")).toBeGreaterThan(-1);
    expect(phaseFour.indexOf("await saveProgress(form, 3);")).toBeLessThan(phaseFour.indexOf("await startIdentityVerification();"));
  });

  test("restores authoritative KYC and legacy structured application data", () => {
    const presale = source("src/app/presale/presale-client.tsx");
    const account = source("src/app/shares/account/shares-account-client.tsx");
    const api = source("encore/domains/presale/api.ts");
    expect(presale).toContain("verified: portal.kyc.verified");
    expect(presale).toContain('if (portal.kyc.verified || portal.kyc.status.toLowerCase() !== "pending") setVerificationStarted(true)');
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

  test("shows presale application and reservation state in the admin member record", () => {
    const adminApi = source("encore/domains/admin/api.ts");
    const adminMembers = source("src/components/admin/admin-members.tsx");
    expect(adminApi).toContain("networkDb, presaleDb, sharesDb");
    expect(adminApi).toContain("presaleApplicationByProfile");
    expect(adminApi).toContain("presaleOrdersByProfile");
    expect(adminApi).toContain("FROM presale_applications");
    expect(adminApi).toContain("FROM presale_orders");
    expect(adminApi).toContain("presaleReservationStatus");
    expect(adminApi).not.toContain("row.nfc_tag_id ?? `NFC-");
    expect(adminMembers).toContain("KaSiShares application &amp; reservation");
    expect(adminMembers).toContain("selected.presaleOrderReference");
    expect(adminApi).toContain("presaleWebPayReference");
    expect(adminApi).toContain("member.presaleWebPayReference");
    expect(adminApi).toContain("presalePaymentReconciliations");
    expect(adminApi).toContain("...member.presalePaymentReconciliations.flatMap");
    expect(adminApi).toContain("webpay_system_reference");
    expect(adminMembers).toContain("InstaPay payment reconciliation");
    expect(adminMembers).toContain("selected.presalePaymentReconciliations.map");
    expect(adminMembers).toContain("InstaPay My reference");
    expect(adminMembers).toContain("selected.presalePhaseCompleted + 1");
    expect(adminMembers).toContain('member.citizenshipType === "PRESALE_INVESTOR"');
    expect(adminMembers).toContain('return "InstaPay"');
    expect(adminMembers).toContain("paymentMethodLabel(selected)");
  });

  test("lets the applicant cancel only an unpaid reservation before changing payment method", () => {
    const api = source("encore/domains/presale/api.ts");
    const account = source("src/app/shares/account/shares-account-client.tsx");
    const route = source("src/app/api/presale/orders/[reference]/cancel/route.ts");
    expect(api).toContain('path: "/presale/orders/:orderReference/cancel"');
    expect(api).toContain("acknowledgeNoPaymentSent !== true");
    expect(api).toContain("deriveReservationCancellationPolicy");
    expect(api).toContain("Only an unpaid reservation with no payment activity can be cancelled");
    expect(api).toContain("reserved_shares = reserved_shares - $2");
    expect(api).toContain("used_shares = used_shares - $2");
    expect(route).toContain("presaleSessionToken");
    expect(route).toContain("Your account status will be refreshed");
    expect(account).toContain("await loadPortal().catch(() => undefined)");
    expect(account).toContain("Cancel unpaid reservation &amp; change payment method");
    expect(account).toContain("no card payment or crypto transfer has been sent");
  });

  test("recovers a submitted crypto payment without reopening share selection", () => {
    const api = source("encore/domains/presale/api.ts");
    const account = source("src/app/shares/account/shares-account-client.tsx");
    const route = source("src/app/api/presale/orders/[reference]/payment-recheck/route.ts");
    expect(api).toContain('path: "/presale/orders/:orderReference/payment-recheck"');
    expect(api).toContain('every: "5m"');
    expect(api).toContain("retryPendingPresaleCryptoPayments");
    expect(api).toContain("attempt.transaction_hash.trim().toLowerCase() !== event.txHash.trim().toLowerCase()");
    expect(api).toContain("canonical_${verification.status}");
    expect(route).toContain("presaleSessionToken");
    expect(account).toContain("Your share choice is preserved");
    expect(account).toContain("Recheck payment");
    expect(account).toContain("A second purchase form is intentionally locked");
    expect(account).toContain("Blockchain verification passed. Remitano credit confirmation is still pending");
    expect(account).toContain("verificationReason={order.paymentVerificationReason}");
    expect(source("encore/domains/payments/remitano.ts")).toContain("transactionHashForRpc(lookup.network, lookup.transactionHash)");
  });

  test("treats an initial confirmation-email failure as delayed and retryable", () => {
    const api = source("encore/domains/presale/api.ts");
    const presale = source("src/app/presale/presale-client.tsx");
    expect(api).toContain('every: "15m"');
    expect(api).toContain("attempt_count < 5");
    expect(api).toContain("result?.message");
    expect(presale).toContain('setReservationEmailDelayed(payload.emailStatus === "failed")');
    expect(presale).toContain("Reservation confirmed — email delayed");
    expect(presale).not.toContain("confirmation email could not be sent");
  });

  test("keeps the public reservation decoder aligned with the split address form", () => {
    const api = source("encore/domains/presale/api.ts");
    const start = api.indexOf("interface CreatePresaleOrderRequest");
    const request = api.slice(start, start + 2500);
    expect(request).toContain("streetAddress: string");
    expect(request).toContain("suburb: string");
    expect(request).toContain("city: string");
    expect(request).toContain("postalCode: string");
    expect(request).not.toContain("physicalAddress: string");
  });

  test("uses the approved Solidus certificate with named signature attestations", () => {
    const certificate = source("src/lib/share-certificate-pdf.ts");
    expect(certificate).toContain("solidus-shareholder-certificate.pdf");
    expect(certificate).toContain("lelanie-retief-signature.png");
    expect(certificate).toContain("tertius-du-plessis-signature.png");
    expect(certificate).toContain("pdf.embedPng");
    expect(certificate).toContain("LELANIE RETIEF - DIRECTOR");
    expect(certificate).toContain("TERTIUS DU PLESSIS - CFO");
    expect(certificate).toContain('data.distinctiveFrom?.toLocaleString("en-ZA") ?? "N/A"');
    expect(certificate).toContain('data.distinctiveTo?.toLocaleString("en-ZA") ?? "N/A"');
    expect(certificate).toContain("data.issuePricePerShare.toLocaleString");
    expect(certificate).toContain("data.issuePriceCurrency!.trim().toUpperCase()");
  });

  test("offers issued shareholders a controlled additional-purchase route and completes their progress", () => {
    const account = source("src/app/shares/account/shares-account-client.tsx");
    expect(account).toContain("Buy more shares");
    expect(account).toContain("additional%20purchase%20invitation");
    expect(account).toContain('portal.authority.journey.state === "issued" ? 100');
  });

  test("sends exact KaSiHub reconciliation references alongside the immutable InstaPay key", () => {
    const backend = source("encore/domains/presale/api.ts");
    expect(backend).toContain("m_tx_item_description: webPayItemDescription(order.quantity, order.order_reference)");
    expect(backend).toContain("...webPayReconciliationFields({");
    expect(backend).toContain("orderReference: order.order_reference");
    expect(backend).toContain("applicationNumber: order.application_number");
    expect(backend).toContain("JOIN presale_applications a ON a.id = o.application_id");
    expect(backend).toContain("a.application_number");
  });
});
