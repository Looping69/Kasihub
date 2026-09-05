import { describe, expect, test } from "vitest";
import { resolveWebPayUnitPrice, verifyWebPayChecksum, verifyWebPayProcessChecksum, webPayBuyerReferenceFields, webPayChecksum, webPayMerchantFields, webPayOrderNumber, webPayProcessChecksum, webPayTotalZar } from "./webpay";

describe("WebPay presale contract", () => {
  test("adds the buyer name as a separate provider reference without payment identity fields", () => {
    expect(webPayBuyerReferenceFields("  Anna-Marie   van der Merwe  "))
      .toEqual({ m_site_reference: "Anna-Marie van der Merwe" });
    expect(webPayBuyerReferenceFields("Zoë O’Connor")).toEqual({ m_site_reference: "Zoë O’Connor" });
  });

  test("bounds long references without splitting Unicode characters", () => {
    const fields = webPayBuyerReferenceFields("A".repeat(35) + "\u{10400} Surname");
    expect(fields).toEqual({ m_site_reference: "A".repeat(35) });
    expect(webPayBuyerReferenceFields("A".repeat(100)).m_site_reference).toHaveLength(36);
  });

  test("normalizes control characters and omits empty optional references", () => {
    expect(webPayBuyerReferenceFields("Anna\n\tSmith\u0000")).toEqual({ m_site_reference: "Anna Smith" });
    expect(webPayBuyerReferenceFields("\n \u0000\u200b")).toEqual({});
  });

  test("same-name buyers and retries retain unique order and transaction identifiers", () => {
    const firstOrder = webPayOrderNumber("KSH", "KSP-ORDER-1");
    const secondOrder = webPayOrderNumber("KSH", "KSP-ORDER-2");
    const display = webPayBuyerReferenceFields("Anna Smith");
    expect({ m_tx_order_nr: firstOrder, m_tx_id: "attempt-1", ...display })
      .toEqual({ m_tx_order_nr: firstOrder, m_tx_id: "attempt-1", m_site_reference: "Anna Smith" });
    expect({ m_tx_order_nr: firstOrder, m_tx_id: "attempt-2", ...display }.m_tx_order_nr).toBe(firstOrder);
    expect(secondOrder).not.toBe(firstOrder);
  });

  test("posts the merchant site identifier required by hosted checkout", () => {
    expect(webPayMerchantFields({
      merchantUuid: "merchant-uuid",
      accountUuid: "account-uuid",
      siteId: "site-id",
      siteName: "KASIHUB ECO",
    })).toEqual({
      m_uuid: "merchant-uuid",
      m_account_uuid: "account-uuid",
      m_site_id: "site-id",
      m_site_name: "KASIHUB ECO",
    });
  });

  test("charges exactly R450 per paid share", () => {
    expect(webPayTotalZar(1)).toBe("450.00");
    expect(webPayTotalZar(5)).toBe("2250.00");
  });

  test("supports a transaction-scoped unit price", () => {
    expect(webPayTotalZar(1, "20.00")).toBe("20.00");
    expect(webPayTotalZar(5, "20.00")).toBe("100.00");
  });

  test("applies a bounded campaign test price only to card reservations", () => {
    expect(resolveWebPayUnitPrice({ paymentRail: "webpay_card", invitationOverride: null, campaignTestPrice: "10.00", campaignTestOrdersRemaining: 5 }))
      .toEqual({ unitPriceZar: "10.00", campaignTestPriceApplied: true });
    expect(resolveWebPayUnitPrice({ paymentRail: "webpay_card", invitationOverride: null, campaignTestPrice: "10.00", campaignTestOrdersRemaining: 0 }))
      .toEqual({ unitPriceZar: "450.00", campaignTestPriceApplied: false });
    expect(resolveWebPayUnitPrice({ paymentRail: "remitano_usdt", invitationOverride: null, campaignTestPrice: "10.00", campaignTestOrdersRemaining: 5 }))
      .toEqual({ unitPriceZar: "450.00", campaignTestPriceApplied: false });
  });

  test("keeps invitation-specific card pricing ahead of campaign test pricing", () => {
    expect(resolveWebPayUnitPrice({ paymentRail: "webpay_card", invitationOverride: "20.00", campaignTestPrice: "10.00", campaignTestOrdersRemaining: 5 }))
      .toEqual({ unitPriceZar: "20.00", campaignTestPriceApplied: false });
  });

  test("uses the documented merchant, account, transaction, cents, currency and key checksum order", () => {
    const input = {
      merchantUuid: "merchant",
      accountUuid: "account",
      transactionId: "transaction",
      amountZar: "450.00",
      securityKey: "secret",
    };
    expect(webPayChecksum(input)).toBe("6b4f5905ad54ae85bc840aa3e15795f5");
    expect(verifyWebPayChecksum(input, webPayChecksum(input))).toBe(true);
    expect(verifyWebPayChecksum(input, "00000000000000000000000000000000")).toBe(false);
  });

  test("uses the documented account, process, stage and key process checksum order", () => {
    const input = {
      accountUuid: "8aa93ae6-c516-4c50-8ce8-b0f531cbe92c",
      processUuid: "3233f9a2-b7e7-4ff1-a6ac-4af2ee987e01",
      processStage: "return_card_payment",
      securityKey: "test-security-key",
    };
    const checksum = webPayProcessChecksum(input);
    expect(checksum).toMatch(/^[0-9a-f]{32}$/);
    expect(verifyWebPayProcessChecksum(input, checksum)).toBe(true);
    expect(verifyWebPayProcessChecksum(input, "00000000000000000000000000000000")).toBe(false);
  });

  test("creates a stable 20-character provider order number", () => {
    const value = webPayOrderNumber("KSH", "KSP-ORDER-1");
    expect(value).toHaveLength(20);
    expect(value.startsWith("KSH")).toBe(true);
    expect(webPayOrderNumber("KSH", "KSP-ORDER-1")).toBe(value);
  });
});
