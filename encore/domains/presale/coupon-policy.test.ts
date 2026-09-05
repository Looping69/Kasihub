import { describe, expect, it } from "vitest";
import { couponEligible, couponHash, generateShareCoupon, type ShareCoupon } from "./coupon-policy";
import { sealPresaleCertificate } from "../shares/certificate-integrity";
import { buildShareholderPortfolio } from "./shareholder-portfolio";

const coupon: ShareCoupon = { id: "coupon", campaign_id: "campaign", recipient_email: "recipient@example.test", quantity: 10, status: "active", expires_at: "2030-01-01T00:00:00Z", redeemed_order_id: null };
describe("complimentary coupon authority", () => {
  it("accepts only an active unexpired coupon for the correct campaign and recipient", () => {
    const now = Date.parse("2026-09-05T00:00:00Z");
    expect(couponEligible(coupon,"campaign","Recipient@example.test",now)).toBe(true);
    for (const patch of [{ status: "revoked" },{ status: "redeemed" },{ redeemed_order_id: "order" },{ expires_at: "2026-09-05T00:00:00Z" },{ expires_at: "invalid" }]) {
      expect(couponEligible({ ...coupon,...patch },"campaign","recipient@example.test",now)).toBe(false);
    }
    expect(couponEligible(coupon,"other","recipient@example.test",now)).toBe(false);
    expect(couponEligible(coupon,"campaign","other@example.test",now)).toBe(false);
    expect(couponEligible(null,"campaign","recipient@example.test",now)).toBe(false);
  });
  it("generates distinct secret codes with case-insensitive hashes", () => {
    const code = generateShareCoupon();
    expect(code).toMatch(/^KSG-[A-F0-9]{48}$/);
    expect(generateShareCoupon()).not.toBe(code);
    expect(couponHash(code.toLowerCase())).toBe(couponHash(` ${code} `));
    expect(couponHash(code)).not.toContain(code);
  });
  it("seals a zero-cash grant without paid or bonus shares and rejects bonus stacking", () => {
    const input = { verificationId: "v", certificateNumber: "c", holderName: "Recipient", holderAddress: "1 Test Road", profileNumber: "p", orderReference: "o",
      totalShares: 10, paidShares: 0, bonusShares: 0, complimentaryShares: 10, couponReference: "coupon", phaseNumber: 1, distinctiveFrom: 1, distinctiveTo: 10, issuePricePerShare: "0", issuedAt: "2026-09-05T00:00:00Z" };
    expect(sealPresaleCertificate(input).data).toMatchObject({ paidShares: 0, bonusShares: 0, complimentaryShares: 10, couponReference: "coupon" });
    expect(() => sealPresaleCertificate({ ...input, bonusShares: 1, complimentaryShares: 9 })).toThrow();
    expect(() => sealPresaleCertificate({ ...input, couponReference: undefined })).toThrow();
    expect(() => sealPresaleCertificate({ ...input, issuePricePerShare: "25" })).toThrow();
    expect(() => sealPresaleCertificate({ ...input, complimentaryShares: undefined })).toThrow();
  });
  it("reports grants separately from paid acquisitions before issuance", () => {
    const result = buildShareholderPortfolio([{ order_reference: "o", campaign_name: "test", quantity: 10, bonus_buy_one_get_one: false, status: "confirmed", incorporation_status: "pending", payment_rail: "complimentary_coupon", total_usd: "0" }],[]);
    expect(result.holdings[0]).toMatchObject({ paidShares: 0, bonusShares: 0, complimentaryShares: 10, allocatedShares: 10, issuePricePerShare: 0 });
  });
});
