// Author: Klaasvaakie ( |╲ )
import { createHash, timingSafeEqual } from "node:crypto";

export const WEBPAY_UNIT_PRICE_ZAR = "450.00";
export const WEBPAY_ROUTING_CODE = "KSH";
export type PresalePaymentRail = "remitano_usdt" | "webpay_card";

export function resolveWebPayUnitPrice(input: {
  paymentRail: PresalePaymentRail;
  invitationOverride: string | null;
  campaignTestPrice: string | null;
  campaignTestOrdersRemaining: number;
}): { unitPriceZar: string; campaignTestPriceApplied: boolean } {
  const campaignTestPriceApplied = input.paymentRail === "webpay_card"
    && !input.invitationOverride
    && input.campaignTestOrdersRemaining > 0
    && Boolean(input.campaignTestPrice);
  return {
    unitPriceZar: input.invitationOverride
      ?? (campaignTestPriceApplied ? input.campaignTestPrice : null)
      ?? WEBPAY_UNIT_PRICE_ZAR,
    campaignTestPriceApplied,
  };
}

export function webPayMerchantFields(input: {
  merchantUuid: string;
  accountUuid: string;
  siteId: string;
  siteName: string;
}): Record<string, string> {
  return {
    m_uuid: input.merchantUuid,
    m_account_uuid: input.accountUuid,
    m_site_id: input.siteId,
    m_site_name: input.siteName,
  };
}

function decimalToCents(value: string): number {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) throw new Error("invalid_zar_amount");
  const [whole, fraction = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents <= 0) throw new Error("invalid_zar_amount");
  return cents;
}

export function webPayTotalZar(quantity: number, unitPriceZar = WEBPAY_UNIT_PRICE_ZAR): string {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("invalid_share_quantity");
  return ((decimalToCents(unitPriceZar) * quantity) / 100).toFixed(2);
}

export function webPayChecksum(input: {
  merchantUuid: string;
  accountUuid: string;
  transactionId: string;
  amountZar: string;
  securityKey: string;
}): string {
  const material = [
    input.merchantUuid,
    input.accountUuid,
    input.transactionId,
    decimalToCents(input.amountZar),
    "ZAR",
    input.securityKey,
  ].join("_");
  return createHash("md5").update(material, "utf8").digest("hex");
}

export function verifyWebPayChecksum(input: Parameters<typeof webPayChecksum>[0], received: string): boolean {
  const expected = Buffer.from(webPayChecksum(input), "hex");
  if (!/^[0-9a-f]{32}$/i.test(received)) return false;
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function webPayProcessChecksum(input: {
  accountUuid: string;
  processUuid: string;
  processStage: string;
  securityKey: string;
}): string {
  return createHash("md5")
    .update([input.accountUuid, input.processUuid, input.processStage, input.securityKey].join("_"), "utf8")
    .digest("hex");
}

export function verifyWebPayProcessChecksum(input: Parameters<typeof webPayProcessChecksum>[0], received: string): boolean {
  if (!/^[0-9a-f]{32}$/i.test(received)) return false;
  const expected = Buffer.from(webPayProcessChecksum(input), "hex");
  const actual = Buffer.from(received, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function webPayOrderNumber(routingCode: string, orderReference: string): string {
  if (!/^[A-Z0-9]{3}$/.test(routingCode)) throw new Error("invalid_webpay_routing_code");
  const suffix = createHash("sha256").update(orderReference).digest("hex").slice(0, 17).toUpperCase();
  return `${routingCode}${suffix}`;
}

/** Keep the authoritative order visible without replacing InstaPay's stable key. */
export function webPayItemDescription(quantity: number, orderReference: string): string {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error("invalid_share_quantity");
  const reference = orderReference.trim();
  if (!/^KSP-[A-Z0-9-]+$/.test(reference)) throw new Error("invalid_presale_order_reference");
  const description = `KaSiShares ${quantity} paid | ${reference}`;
  if (description.length > 60) throw new Error("webpay_item_description_too_long");
  return description;
}

export function webPayReconciliationFields(input: {
  orderReference: string;
  applicationNumber: string;
}): Record<string, string> {
  const orderReference = input.orderReference.trim();
  const applicationNumber = input.applicationNumber.trim();
  if (!/^KSP-[A-Z0-9-]+$/.test(orderReference) || orderReference.length > 36) {
    throw new Error("invalid_presale_order_reference");
  }
  if (!/^KSA-[A-Z0-9-]+$/.test(applicationNumber) || applicationNumber.length > 50) {
    throw new Error("invalid_presale_application_number");
  }
  return {
    m_site_reference: orderReference,
    m_tx_invoice_nr: applicationNumber,
    m_category_1: "KASISHARES PRESALE",
    m_category_2: orderReference,
    m_category_3: applicationNumber,
  };
}

export function webPayBuyerFields(input: {
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string | null;
}): Record<string, string> {
  const [firstName = "", ...surnameParts] = input.buyerName.trim().split(/\s+/);
  const fields: Record<string, string> = {};
  if (firstName) fields.b_name = firstName.slice(0, 80);
  const surname = surnameParts.join(" ");
  if (surname) fields.b_surname = surname.slice(0, 80);
  const email = input.buyerEmail.trim();
  if (email.length <= 80) fields.b_email = email;
  const phone = input.buyerPhone?.trim() ?? "";
  if (phone && phone.length <= 15) fields.b_mobile = phone;
  return fields;
}
