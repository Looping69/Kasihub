import { describe, expect, test } from "vitest";
import { verifyWebPayChecksum, webPayChecksum, webPayMerchantFields, webPayOrderNumber, webPayTotalZar } from "./webpay";

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

  test("creates a stable 20-character provider order number", () => {
    const value = webPayOrderNumber("KSH", "KSP-ORDER-1");
    expect(value).toHaveLength(20);
    expect(value.startsWith("KSH")).toBe(true);
    expect(webPayOrderNumber("KSH", "KSP-ORDER-1")).toBe(value);
  });
});
