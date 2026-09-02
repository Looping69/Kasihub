import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("presale payment obligation architecture", () => {
  test("separates disposable sessions, additive credits, settlement, and outbox", () => {
    const migration = source("encore/migrations/payments/7_sessions_credits_and_settlements.up.sql");
    expect(migration).toContain("CREATE TABLE payment_sessions");
    expect(migration).toContain("CREATE TABLE payment_credits");
    expect(migration).toContain("CREATE TABLE payment_settlements");
    expect(migration).toContain("CREATE TABLE payment_outbox");
    expect(migration).toContain("UNIQUE (provider, provider_reference, asset)");
  });

  test("retries durable settlement delivery before share issuance", () => {
    const api = source("encore/domains/presale/api.ts");
    expect(api).toContain("export const reconcileSettledPaymentObligations");
    expect(api).toContain("payment_obligation.settled");
    expect(api).toContain("presale-payment-settlement-reconciliation");
  });

  test("creates a fresh WebPay session for each checkout retry", () => {
    const api = source("encore/domains/presale/api.ts");
    expect(api).toContain("const transactionId = crypto.randomUUID()");
    expect(api).toContain("await registerPaymentSession({");
    expect(api).not.toContain("const transactionId = order.webpay_transaction_id ?? crypto.randomUUID()");
  });

  test("uses authenticated order ownership instead of a browser-held checkout secret", () => {
    const api = source("encore/domains/presale/api.ts");
    const start = api.indexOf("export const createPresaleWebPayCheckout");
    const end = api.indexOf("type PresalePaymentReconciliation", start);
    const checkout = api.slice(start, end);
    expect(checkout).toContain("o.external_profile_id::text = $2::text");
    expect(checkout).not.toContain("x-presale-access-token");
    expect(checkout).not.toContain("access_token_hash");
  });

  test("requires a confirmed credit before WebPay fulfilment", () => {
    const api = source("encore/domains/presale/api.ts");
    const credit = api.indexOf("const credit = await recordConfirmedPaymentCredit({");
    const fulfilment = api.indexOf("await fulfilWebPayPresalePayment(order.order_reference", credit);
    expect(credit).toBeGreaterThan(-1);
    expect(fulfilment).toBeGreaterThan(credit);
    expect(api.slice(credit, fulfilment)).toContain('credit.obligationStatus === "paid"');
  });

  test("keeps provider callbacks away from share issuance", () => {
    const api = source("encore/domains/presale/api.ts");
    const start = api.indexOf("export const receivePresaleWebPayNotification");
    const end = api.indexOf("export const receivePresaleWebPayProcessNotification", start);
    const webhook = api.slice(start, end);
    expect(webhook).not.toContain("issueShares(");
    expect(webhook).not.toContain("incorporateConfirmedPresaleOrder(");
  });

  test("leaves unverified preferred provider APIs disabled", () => {
    const providers = source("encore/domains/payments/provider-contract.ts");
    expect(providers).toContain('provider: "instapay_payment_request", enabled: false');
    expect(providers).toContain('provider: "remitano_gateway", enabled: false');
  });
});
