import { beforeEach, describe, expect, it, vi } from "vitest";
import { identityDb, presaleDb, sharesDb } from "../../resources";

const auth = vi.hoisted(() => ({ profileId: "", userId: "", email: "", key: "", denied: false }));
vi.mock("../auth/access", async importOriginal => ({
  ...await importOriginal<typeof import("../auth/access")>(),
  requirePresaleSession: async () => {
    if (auth.denied) throw new Error("not authenticated");
    return { profile: { id: auth.profileId }, user: { id: auth.userId, email: auth.email } };
  },
  requireAdminAccess: async () => ({ user: { id: auth.userId } }),
  requestHeader: () => auth.key,
}));
vi.mock("../kyc/policy", () => ({ requireInternationalKycVerified: vi.fn(async () => {}) }));
vi.mock("encore.dev/config", () => ({ secret: (name: string) => () => name === "InvestorApplicationEncryptionKey" ? "isolated-coupon-test-encryption-key" : "" }));

import { createPresaleOrder, incorporateConfirmedPresaleOrder, reconcileConfirmedPresaleOrders } from "./api";
import { configureShareCoupons, generateShareCoupons, previewShareCoupon, revokeShareCoupon } from "./coupons";
import { hashSecret } from "./model";
import { requireInternationalKycVerified } from "../kyc/policy";
import { adminShareCertificates } from "../shares/api";

async function setup(limit = 10) {
  auth.profileId = crypto.randomUUID(); auth.userId = crypto.randomUUID();
  auth.email = `coupon-${auth.userId}@example.test`; auth.key = crypto.randomUUID(); auth.denied = false;
  await identityDb.rawExec("INSERT INTO users(id,email,status) VALUES ($1,$2,'active')",auth.userId,auth.email);
  await identityDb.rawExec("INSERT INTO profiles(id,user_id,profile_type,unique_profile_number,first_name,surname,status) VALUES ($1,$2,'individual',$3,'Coupon','Recipient','active')",auth.profileId,auth.userId,`C${auth.profileId}`);
  const campaignId = crypto.randomUUID(); const inviteToken = crypto.randomUUID()+crypto.randomUUID();
  await presaleDb.rawExec(`INSERT INTO presale_campaigns(id,slug,name,issuer_name,total_shares,price_usdt,price_usd,network,receiving_address,status,bonus_buy_one_get_one)
    VALUES ($1,$2,'Coupon test','Test issuer',100,25,25,'bsc','unconfigured','active',TRUE)`,campaignId,campaignId);
  await presaleDb.rawExec("INSERT INTO presale_invitations(campaign_id,token_hash,email,max_shares) VALUES ($1,$2,$3,100)",campaignId,hashSecret(inviteToken),auth.email);
  await configureShareCoupons({ campaignId,enabled: true,shareLimit: limit });
  const generated = await generateShareCoupons({ campaignId,recipientEmails: [auth.email],quantity: 5,expiresAt: new Date(Date.now()+3600000).toISOString(),reason: "Isolated test grant" });
  const code = generated.coupons[0].code;
  const payload = { inviteToken,couponCode: code,buyerName: "Coupon Recipient",buyerEmail: auth.email,buyerPhone: "+27820000000",quantity: 5,paymentRail: "complimentary_coupon" as const,termsAccepted: true,
    investorApplication: { applicantType: "individual" as const,nationality: "South African",occupation: "Engineer",employer: "Test",countryOfResidence: "South Africa",streetAddress: "1 Test Street",suburb: "Test",city: "Johannesburg",postalCode: "2001",confirmMobileNumber: "+27820000000",taxNumber: "TEST",sourceOfFunds: "salary" as const,fundsOwnership: "own" as const,bankAccountHolder: "Coupon Recipient",bankName: "Test Bank",bankBranch: "000000",bankAccountNumber: "00000000",bankAccountType: "Cheque",amlDeclarationAccepted: true,suitabilityDeclarationAccepted: true,informationDeclarationAccepted: true } };
  return { campaignId,code,couponId: generated.coupons[0].id,payload };
}

describe("coupon redemption database integration", () => {
  beforeEach(() => vi.mocked(requireInternationalKycVerified).mockResolvedValue(undefined));
  it("redeems concurrently once, issues a zero-cash certificate once, and preserves exact quantity despite BOGO", async () => {
    const seeded = await setup();
    expect(await previewShareCoupon({ inviteToken: seeded.payload.inviteToken,code: seeded.code })).toEqual({ quantity: 5,amountDue: "0" });
    const results = await Promise.all([createPresaleOrder(seeded.payload),createPresaleOrder(seeded.payload)]);
    expect(results[0].order.orderReference).toBe(results[1].order.orderReference);
    expect(results[0].order).toMatchObject({ totalUsd: "0.000000",status: "confirmed",paymentRail: "complimentary_coupon" });
    const reference = results[0].order.orderReference;
    auth.key = crypto.randomUUID();
    expect((await createPresaleOrder(seeded.payload)).order.orderReference).toBe(reference);
    const issued = await Promise.all([incorporateConfirmedPresaleOrder(reference),incorporateConfirmedPresaleOrder(reference)]);
    expect(issued[0].purchaseId).toBe(issued[1].purchaseId);
    const cert = await sharesDb.rawQueryRow("SELECT total_shares,paid_shares,bonus_shares,complimentary_shares FROM share_certificates WHERE presale_order_reference=$1",reference);
    expect(cert).toEqual({ total_shares: 5,paid_shares: 0,bonus_shares: 0,complimentary_shares: 5 });
    expect(await sharesDb.rawQueryRow("SELECT quantity,bonus_quantity,complimentary_quantity,total_amount::text,status FROM share_purchases WHERE presale_order_reference=$1",reference)).toEqual({ quantity: 0,bonus_quantity: 0,complimentary_quantity: 5,total_amount: "0.00",status: "granted" });
    expect(await presaleDb.rawQueryRow("SELECT reserved_shares,sold_shares FROM presale_campaigns WHERE id=$1",seeded.campaignId)).toEqual({ reserved_shares: 0,sold_shares: 5 });
    expect(await presaleDb.rawQueryRow("SELECT payment_obligation_id,payment_intent_id,payment_settled_at FROM presale_orders WHERE order_reference=$1",reference)).toEqual({ payment_obligation_id: null,payment_intent_id: null,payment_settled_at: null });
    const register = await adminShareCertificates({ limit: 500 });
    expect(register.shares.find(entry => entry.orderReference === reference)).toMatchObject({ purchasedQuantity: 0,bonusQuantity: 0,complimentaryQuantity: 5,totalAmount: 0,pricePerShare: 0 });
  });
  it("rejects disabled, revoked, expired, mismatched and ineligible claims without consuming a coupon", async () => {
    const seeded = await setup();
    await configureShareCoupons({ campaignId: seeded.campaignId,enabled: false,shareLimit: 10 });
    await expect(createPresaleOrder(seeded.payload)).rejects.toThrow();
    await configureShareCoupons({ campaignId: seeded.campaignId,enabled: true,shareLimit: 10 });
    auth.denied = true;
    await expect(createPresaleOrder(seeded.payload)).rejects.toThrow("not authenticated");
    auth.denied = false;
    await presaleDb.rawExec("UPDATE presale_share_coupons SET recipient_email='someone-else@example.test' WHERE id=$1",seeded.couponId);
    await expect(createPresaleOrder(seeded.payload)).rejects.toThrow();
    await presaleDb.rawExec("UPDATE presale_share_coupons SET recipient_email=$2 WHERE id=$1",seeded.couponId,auth.email);
    await configureShareCoupons({ campaignId: seeded.campaignId,enabled: true,shareLimit: 4 });
    await expect(createPresaleOrder(seeded.payload)).rejects.toThrow();
    await configureShareCoupons({ campaignId: seeded.campaignId,enabled: true,shareLimit: 10 });
    await expect(createPresaleOrder({ ...seeded.payload,quantity: 6 })).rejects.toThrow();
    vi.mocked(requireInternationalKycVerified).mockRejectedValueOnce(new Error("KYC required"));
    await expect(createPresaleOrder(seeded.payload)).rejects.toThrow("KYC required");
    await presaleDb.rawExec("UPDATE presale_share_coupons SET expires_at=now()-interval '1 second' WHERE id=$1",seeded.couponId);
    await expect(createPresaleOrder(seeded.payload)).rejects.toThrow();
    await presaleDb.rawExec("UPDATE presale_share_coupons SET expires_at=now()+interval '1 hour' WHERE id=$1",seeded.couponId);
    await revokeShareCoupon({ couponId: seeded.couponId });
    await expect(createPresaleOrder(seeded.payload)).rejects.toThrow();
    expect(await presaleDb.rawQueryRow("SELECT COUNT(*)::int AS count FROM presale_orders WHERE campaign_id=$1",seeded.campaignId)).toEqual({ count: 0 });
  });
  it("retries issuance through the outbox after inventory becomes available", async () => {
    const seeded = await setup(); const phase = 100000 + Math.floor(Math.random()*100000);
    await presaleDb.rawExec("UPDATE presale_campaigns SET share_phase_number=$2 WHERE id=$1",seeded.campaignId,phase);
    const { order } = await createPresaleOrder(seeded.payload);
    await expect(incorporateConfirmedPresaleOrder(order.orderReference)).rejects.toThrow();
    await sharesDb.rawExec("INSERT INTO share_phases(phase_number,quantity_available,total_quantity,price_per_share,currency,status) VALUES ($1,10,10,25,'USD','active')",phase);
    await reconcileConfirmedPresaleOrders();
    expect(await sharesDb.rawQueryRow("SELECT count(*)::int AS count FROM share_certificates WHERE presale_order_reference=$1",order.orderReference)).toEqual({ count: 1 });
  });
});
