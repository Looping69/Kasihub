// Author: Klaasvaakie ( |╲ )
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const PRESALE_TERMS_VERSION = "2026-09-02-v1.2";
export const INVESTOR_APPLICATION_VERSION = "2026-08-15";

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function hashSecret(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function fixedUsdt(value: number): string {
  if (!Number.isFinite(value) || value <= 0) throw new Error("invalid_usdt_amount");
  return value.toFixed(6);
}

export type PaymentEvent = {
  eventId: string;
  provider: string;
  orderReference?: string;
  txHash: string;
  network: string;
  tokenContract?: string;
  receiverAddress: string;
  senderAddress?: string;
  amountUsdt: number;
  confirmations: number;
  blockNumber?: string;
};

export function paymentEventMessage(event: PaymentEvent): string {
  return [
    event.eventId,
    event.provider,
    event.orderReference ?? "",
    event.txHash.trim().toLowerCase(),
    event.network.trim().toLowerCase(),
    event.tokenContract?.trim().toLowerCase() ?? "",
    event.receiverAddress.trim().toLowerCase(),
    event.senderAddress?.trim().toLowerCase() ?? "",
    fixedUsdt(event.amountUsdt),
    String(event.confirmations),
    event.blockNumber ?? "",
  ].join("|");
}

export function signPaymentEvent(event: PaymentEvent, secret: string): string {
  return createHmac("sha256", secret).update(paymentEventMessage(event)).digest("hex");
}

export function verifyPaymentEvent(event: PaymentEvent, secret: string, signature: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = Buffer.from(signPaymentEvent(event, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
