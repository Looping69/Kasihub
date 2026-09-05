import { createHash, randomBytes } from "node:crypto";

export function couponHash(code: string): string {
  return createHash("sha256").update(code.trim().toUpperCase()).digest("hex");
}

export function generateShareCoupon(): string {
  return `KSG-${randomBytes(24).toString("hex").toUpperCase()}`;
}

export type ShareCoupon = {
  id: string; campaign_id: string; recipient_email: string; quantity: number;
  status: string; expires_at: string; redeemed_order_id: string | null;
};

export function couponEligible(coupon: ShareCoupon | null, campaignId: string, email: string, now = Date.now()): boolean {
  return Boolean(coupon && coupon.campaign_id === campaignId
    && coupon.recipient_email === email.trim().toLowerCase()
    && coupon.status === "active" && !coupon.redeemed_order_id
    && Number.isFinite(Date.parse(coupon.expires_at)) && Date.parse(coupon.expires_at) > now);
}
