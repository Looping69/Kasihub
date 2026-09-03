// Author: Klaasvaakie ( |╲ )
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("KaSiShares Phase 3: Payment Engine Integrity & Recovery Contracts", () => {
  test("enforces database-level uniqueness across sessions, credits, settlements, and outbox", () => {
    const migration = source("encore/migrations/payments/7_sessions_credits_and_settlements.up.sql");
    expect(migration).toContain("CREATE TABLE payment_sessions");
    expect(migration).toContain("UNIQUE (provider, provider_session_id)");
    expect(migration).toContain("CREATE TABLE payment_credits");
    expect(migration).toContain("UNIQUE (provider, provider_reference, asset)");
    expect(migration).toContain("CREATE TABLE payment_settlements");
    expect(migration).toContain("obligation_id UUID NOT NULL UNIQUE REFERENCES payment_obligations(id)");
    expect(migration).toContain("CREATE TABLE payment_outbox");
    expect(migration).toContain("event_key TEXT NOT NULL UNIQUE");
  });

  test("enforces single settlement claim per WebPay provider reference", () => {
    const migration = source("encore/migrations/presale/22_webpay_settlement_claims.up.sql");
    expect(migration).toContain("CREATE TABLE presale_webpay_settlements");
    expect(migration).toContain("provider_reference TEXT PRIMARY KEY");
    expect(migration).toContain("order_id UUID NOT NULL UNIQUE REFERENCES presale_orders(id)");
  });

  test("creates disposable WebPay checkout attempts and records payment.attempt_started audit event", () => {
    const api = source("encore/domains/presale/api.ts");
    const checkoutStart = api.indexOf("export const createPresaleWebPayCheckout");
    const checkoutEnd = api.indexOf("type PresalePaymentReconciliation", checkoutStart);
    const checkoutCode = api.slice(checkoutStart, checkoutEnd);

    expect(checkoutCode).toContain("const transactionId = crypto.randomUUID()");
    expect(checkoutCode).toContain("UPDATE presale_orders SET webpay_transaction_id = $2, webpay_order_number = $3");
    expect(checkoutCode).toContain("payment.attempt_started");
  });

  test("evaluates late/cancelled WebPay payments before asserting confirmed", () => {
    const api = source("encore/domains/presale/api.ts");
    const fulfilStart = api.indexOf("export async function fulfilWebPayPresalePayment");
    const fulfilEnd = api.indexOf("type AllocationOverrideResponse", fulfilStart);
    const fulfilCode = api.slice(fulfilStart, fulfilEnd);

    const lateCheck = fulfilCode.indexOf('["cancelled", "expired", "manual_review"].includes(order.status)');
    const confirmedAssert = fulfilCode.indexOf('assertApplicantJourneyTransition(orderJourneyState(order.status), "confirmed")');

    expect(lateCheck).toBeGreaterThan(-1);
    expect(confirmedAssert).toBeGreaterThan(-1);
    // CRITICAL: late check MUST precede confirmed assertion!
    expect(lateCheck).toBeLessThan(confirmedAssert);
    expect(fulfilCode).toContain('assertApplicantJourneyTransition(orderJourneyState(order.status), "manual_review")');
    expect(fulfilCode).toContain("payment.late_detected");
  });

  test("provides privileged manual review operational resolution endpoint", () => {
    const api = source("encore/domains/presale/api.ts");
    expect(api).toContain("export const resolvePresaleManualReview = api<");
    expect(api).toContain("/admin/presale/orders/:orderReference/resolve-manual-review");
    expect(api).toContain("requireAdminAccess()");
    expect(api).toContain("approve_settlement");
    expect(api).toContain("reject_and_cancel");
    expect(api).toContain("payment.manual_review_resolved");
    expect(api).toContain("payment.manual_review_rejected");
  });

  test("derives awaiting_payment journey with retryable card checkout", () => {
    const journey = source("encore/domains/presale/applicant-journey.ts");
    const awaitingPayment = journey.slice(journey.indexOf('if (order?.status === "awaiting_payment")'), journey.indexOf("if (order) return decision"));
    expect(awaitingPayment).toContain('["start_card_checkout"]');
    expect(awaitingPayment).not.toContain("order.cardCheckoutStarted ? [] : ");
  });

  test("maintains canonical block timestamp deadline policy in payments domain", () => {
    const deadlinePolicy = source("encore/domains/payments/deadline-policy.ts");
    expect(deadlinePolicy).toContain('export type TransactionDeadlineDecision = "on_time" | "late" | "manual_review"');
    expect(deadlinePolicy).toContain('minedAt <= deadline ? "on_time" : "late"');
  });

  test("maintains cumulative credit funding policy for top-ups", () => {
    const settlementPolicy = source("encore/domains/payments/settlement-policy.ts");
    expect(settlementPolicy).toContain('if (creditedUnits === 0n) return { status: "open", dueUnits, creditedUnits }');
    expect(settlementPolicy).toContain('if (creditedUnits < dueUnits) return { status: "partially_paid", dueUnits, creditedUnits }');
    expect(settlementPolicy).toContain('if (creditedUnits === dueUnits) return { status: "paid", dueUnits, creditedUnits }');
    expect(settlementPolicy).toContain('return { status: "review_required", dueUnits, creditedUnits }');
  });
});
