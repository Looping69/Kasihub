import { api, APIError } from "encore.dev/api";
import { z } from "zod";
import { presaleDb } from "../../resources";
import { requireAdminAccess, requirePresaleSession } from "../auth/access";
import { couponEligible, couponHash, generateShareCoupon, type ShareCoupon } from "./coupon-policy";
import { hashSecret } from "./model";

export const listShareCoupons = api<{ campaignId: string }, {
  enabled: boolean; shareLimit: number; grantedShares: number;
  coupons: Array<{ id: string; recipientEmail: string; quantity: number; status: string; expiresAt: string; reason: string }>;
}>({ method: "GET", path: "/admin/presale/coupons/:campaignId", expose: true }, async ({ campaignId }) => {
  await requireAdminAccess();
  const policy = await presaleDb.rawQueryRow<{ enabled: boolean; share_limit: number; granted_shares: number }>(
    "SELECT enabled,share_limit,granted_shares FROM presale_coupon_policies WHERE campaign_id=$1", campaignId);
  const rows = await presaleDb.rawQueryAll<ShareCoupon & { reason: string }>(
    "SELECT id,campaign_id,recipient_email,quantity,status,expires_at,reason,redeemed_order_id FROM presale_share_coupons WHERE campaign_id=$1 ORDER BY created_at DESC LIMIT 200", campaignId);
  return { enabled: policy?.enabled ?? false, shareLimit: policy?.share_limit ?? 0, grantedShares: policy?.granted_shares ?? 0,
    coupons: rows.map(c => ({ id: c.id, recipientEmail: c.recipient_email, quantity: c.quantity,
      status: c.status === "active" && Date.parse(c.expires_at) <= Date.now() ? "expired" : c.status, expiresAt: c.expires_at, reason: c.reason })) };
});

export const configureShareCoupons = api<{ campaignId: string; enabled: boolean; shareLimit: number }, { ok: boolean }>(
  { method: "POST", path: "/admin/presale/coupons/policy", expose: true }, async (request) => {
    const admin = await requireAdminAccess();
    const input = z.object({ campaignId: z.string().uuid(), enabled: z.boolean(), shareLimit: z.number().int().min(0).max(1_000_000) }).parse(request);
    const tx = await presaleDb.begin();
    try {
      const campaign = await tx.rawQueryRow<{ total_shares: number }>("SELECT total_shares FROM presale_campaigns WHERE id=$1 FOR UPDATE", input.campaignId);
      if (!campaign || input.shareLimit > campaign.total_shares) throw APIError.invalidArgument("Coupon limit exceeds the campaign allocation");
      const policy = await tx.rawQueryRow<{ campaign_id: string }>(`INSERT INTO presale_coupon_policies(campaign_id,enabled,share_limit,updated_by)
        VALUES ($1,$2,$3,$4) ON CONFLICT (campaign_id) DO UPDATE SET enabled=$2,share_limit=$3,updated_by=$4,updated_at=now()
        WHERE presale_coupon_policies.granted_shares <= $3 RETURNING campaign_id`, input.campaignId,input.enabled,input.shareLimit,admin.user.id);
      if (!policy) throw APIError.failedPrecondition("The limit cannot be lower than shares already granted");
      await tx.rawExec("INSERT INTO presale_coupon_audit(campaign_id,actor_id,action,details) VALUES ($1,$2,'policy_updated',$3::jsonb)", input.campaignId,admin.user.id,JSON.stringify(input));
      await tx.commit();
      return { ok: true };
    } catch (error) { await tx.rollback(); throw error; }
  });

export const generateShareCoupons = api<{
  campaignId: string; recipientEmails: string[]; quantity: number; expiresAt: string; reason: string;
}, { coupons: Array<{ id: string; recipientEmail: string; code: string }> }>(
  { method: "POST", path: "/admin/presale/coupons", expose: true }, async (request) => {
    const admin = await requireAdminAccess();
    const input = z.object({ campaignId: z.string().uuid(), recipientEmails: z.array(z.string().trim().email().max(254)).min(1).max(100),
      quantity: z.number().int().positive().max(1_000_000), expiresAt: z.string().datetime(), reason: z.string().trim().min(3).max(500) }).parse(request);
    if (Date.parse(input.expiresAt) <= Date.now()) throw APIError.invalidArgument("Expiry must be in the future");
    const tx = await presaleDb.begin();
    try {
      const policy = await tx.rawQueryRow<{ share_limit: number; granted_shares: number }>("SELECT share_limit,granted_shares FROM presale_coupon_policies WHERE campaign_id=$1 FOR UPDATE", input.campaignId);
      const outstanding = await tx.rawQueryRow<{ quantity: number }>("SELECT COALESCE(SUM(quantity),0)::int AS quantity FROM presale_share_coupons WHERE campaign_id=$1 AND status='active' AND expires_at>now()", input.campaignId);
      if (!policy || policy.granted_shares + (outstanding?.quantity ?? 0) + input.quantity * input.recipientEmails.length > policy.share_limit) {
        throw APIError.failedPrecondition("Set a sufficient coupon allocation before generating codes");
      }
      const coupons: Array<{ id: string; recipientEmail: string; code: string }> = [];
      for (const email of input.recipientEmails) {
        const code = generateShareCoupon(); const id = crypto.randomUUID(); const recipientEmail = email.toLowerCase();
        await tx.rawExec(`INSERT INTO presale_share_coupons(id,campaign_id,code_hash,recipient_email,quantity,reason,expires_at,created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`, id,input.campaignId,couponHash(code),recipientEmail,input.quantity,input.reason,input.expiresAt,admin.user.id);
        await tx.rawExec("INSERT INTO presale_coupon_audit(campaign_id,coupon_id,actor_id,action) VALUES ($1,$2,$3,'generated')",input.campaignId,id,admin.user.id);
        coupons.push({ id,recipientEmail,code });
      }
      await tx.commit(); return { coupons };
    } catch (error) { await tx.rollback(); throw error; }
  });

export const revokeShareCoupon = api<{ couponId: string }, { ok: boolean }>(
  { method: "POST", path: "/admin/presale/coupons/:couponId/revoke", expose: true }, async ({ couponId }) => {
    const admin = await requireAdminAccess();
    const tx = await presaleDb.begin();
    try {
      const coupon = await tx.rawQueryRow<{ campaign_id: string }>(`UPDATE presale_share_coupons SET status='revoked',revoked_by=$2,revoked_at=now()
        WHERE id=$1 AND status='active' RETURNING campaign_id`,couponId,admin.user.id);
      if (!coupon) throw APIError.failedPrecondition("Only unredeemed coupons can be revoked");
      await tx.rawExec("INSERT INTO presale_coupon_audit(campaign_id,coupon_id,actor_id,action) VALUES ($1,$2,$3,'revoked')",coupon.campaign_id,couponId,admin.user.id);
      await tx.commit(); return { ok: true };
    } catch (error) { await tx.rollback(); throw error; }
  });

export const previewShareCoupon = api<{ inviteToken: string; code: string }, { quantity: number; amountDue: string }>(
  { method: "POST", path: "/presale/coupons/preview", expose: true }, async (request) => {
    const session = await requirePresaleSession();
    const input = z.object({ inviteToken: z.string().min(32).max(256), code: z.string().trim().min(1).max(100) }).parse(request);
    const invitation = await presaleDb.rawQueryRow<{ campaign_id: string; email: string | null }>(
      "SELECT campaign_id,email FROM presale_invitations WHERE token_hash=$1 AND status='active' AND (expires_at IS NULL OR expires_at>now())",hashSecret(input.inviteToken));
    if (!invitation || (invitation.email && invitation.email.toLowerCase() !== session.user.email.toLowerCase())) throw APIError.permissionDenied("Invitation unavailable");
    const coupon = await presaleDb.rawQueryRow<ShareCoupon>(`SELECT c.id,c.campaign_id,c.recipient_email,c.quantity,c.status,c.expires_at,c.redeemed_order_id
      FROM presale_share_coupons c JOIN presale_coupon_policies p ON p.campaign_id=c.campaign_id
      WHERE c.code_hash=$1 AND p.enabled AND p.granted_shares+c.quantity<=p.share_limit`,couponHash(input.code));
    if (!couponEligible(coupon,invitation.campaign_id,session.user.email)) throw APIError.failedPrecondition("Coupon unavailable for this application");
    return { quantity: coupon!.quantity, amountDue: "0" };
  });
