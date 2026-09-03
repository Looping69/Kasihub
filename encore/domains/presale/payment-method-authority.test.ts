import { describe, expect, test } from "vitest";
import { authoritativePaymentMethods, paymentRailAvailability } from "./payment-method-authority";

const methods = (overrides: Partial<Parameters<typeof authoritativePaymentMethods>[0]> = {}) => authoritativePaymentMethods({
  network: "bsc",
  tokenContract: `0x${"1".repeat(40)}`,
  receivingAddress: `0x${"2".repeat(40)}`,
  campaignUnitPriceUsdt: "25.000000",
  cryptoUnitPriceUsdt: "25.000000",
  webPayUnitPriceZar: "450.00",
  webPayConfigured: true,
  invitationWebPayOverride: false,
  ...overrides,
});

describe("server payment-method authority", () => {
  test("allows each configured method and rejects unavailable methods", () => {
    expect(paymentRailAvailability(methods(), "remitano_usdt")).toEqual({ allowed: true });
    expect(paymentRailAvailability(methods(), "webpay_card")).toEqual({ allowed: true });
    expect(paymentRailAvailability(methods({ receivingAddress: null }), "remitano_usdt")).toEqual({
      allowed: false,
      reason: "The controlled USDT receiving route is unavailable",
    });
    expect(paymentRailAvailability(methods({ webPayConfigured: false }), "webpay_card")).toEqual({
      allowed: false,
      reason: "WebPay checkout is not configured",
    });
  });

  test("publishes server-derived pricing metadata without payment secrets", () => {
    expect(methods({ cryptoUnitPriceUsdt: "1.000000", invitationWebPayOverride: true })).toMatchObject([
      { id: "remitano_usdt", currency: "USDT", unitPrice: "1.000000", pricingMode: "bounded_test", enabled: true },
      { id: "webpay_card", currency: "ZAR", unitPrice: "450.00", pricingMode: "invitation_override", enabled: true },
    ]);
  });
});
