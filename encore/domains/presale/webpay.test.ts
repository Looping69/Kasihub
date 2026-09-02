import { describe, expect, test } from "vitest";
import { resolveWebPayUnitPrice, WEBPAY_ROUTING_CODE, verifyWebPayChecksum, verifyWebPayProcessChecksum, webPayBuyerFields, webPayChecksum, webPayItemDescription, webPayMerchantFields, webPayOrderNumber, webPayProcessChecksum, webPayReconciliationFields, webPayTotalZar } from "./webpay";

describe("WebPay presale contract", () => {
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
    const value = webPayOrderNumber(WEBPAY_ROUTING_CODE, "KSP-ORDER-1");
    expect(value).toHaveLength(20);
    expect(value.startsWith("KSH")).toBe(true);
    expect(webPayOrderNumber("KSH", "KSP-ORDER-1")).toBe(value);
  });

  test("never sends optional buyer fields beyond WebPay's documented limits", () => {
    const fields = webPayBuyerFields({
      buyerName: `${"A".repeat(100)} ${"B".repeat(100)}`,
      buyerEmail: `${"e".repeat(75)}@example.com`,
      buyerPhone: "+123456789012345",
    });
    expect(fields.b_name).toHaveLength(80);
    expect(fields.b_surname).toHaveLength(80);
    expect(fields).not.toHaveProperty("b_email");
    expect(fields).not.toHaveProperty("b_mobile");
  });

  test("includes valid optional buyer fields without blank values", () => {
    expect(webPayBuyerFields({ buyerName: "Ada Lovelace", buyerEmail: "ada@example.com", buyerPhone: "+27821234567" }))
      .toEqual({ b_name: "Ada", b_surname: "Lovelace", b_email: "ada@example.com", b_mobile: "+27821234567" });
  });

  test("puts the exact KaSiHub order reference in the visible provider description", () => {
    const description = webPayItemDescription(2, "KSP-036504F4-MTIE10BX");
    expect(description).toBe("KaSiShares 2 paid | KSP-036504F4-MTIE10BX");
    expect(description.length).toBeLessThanOrEqual(60);
  });

  test("rejects unsafe or oversized references instead of truncating reconciliation data", () => {
    expect(() => webPayItemDescription(1, "ORDER-1")).toThrow("invalid_presale_order_reference");
    expect(() => webPayItemDescription(1, `KSP-${"A".repeat(50)}`)).toThrow("webpay_item_description_too_long");
  });

  test("maps exact order and application identifiers into documented InstaPay fields", () => {
    expect(webPayReconciliationFields({
      orderReference: "KSP-036504F4-MTIE10BX",
      applicationNumber: "KSA-3115C1FE-MTICOP3B",
    })).toEqual({
      m_site_reference: "KSP-036504F4-MTIE10BX",
      m_tx_invoice_nr: "KSA-3115C1FE-MTICOP3B",
      m_category_1: "KASISHARES PRESALE",
      m_category_2: "KSP-036504F4-MTIE10BX",
      m_category_3: "KSA-3115C1FE-MTICOP3B",
    });
  });

  test("fails closed when provider metadata cannot preserve the complete reference", () => {
    expect(() => webPayReconciliationFields({ orderReference: "KSP-1", applicationNumber: "APPLICATION-1" }))
      .toThrow("invalid_presale_application_number");
    expect(() => webPayReconciliationFields({ orderReference: `KSP-${"A".repeat(40)}`, applicationNumber: "KSA-1" }))
      .toThrow("invalid_presale_order_reference");
  });
});
