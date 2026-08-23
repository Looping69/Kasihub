// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { CronJob } from "encore.dev/cron";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { engagementDb, membershipDb } from "../../resources";
import { requireAdminAccess, requireEcosystemProfileAccess } from "../auth/access";

type ReferralResponse = {
  id: string; referrerId: string; referredId: string | null; referralCode: string; referredName: string;
  referredEmail: string; referredMobile: string; status: string; rewardAmount: number; createdAt: string; convertedAt: string | null;
};

export const referrals = api<{ profileId: string }, { referrals: ReferralResponse[] }>(
  { method: "GET", path: "/referrals/:profileId", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const rows = await engagementDb.rawQueryAll<{
      id: string; referrer_profile_id: string; referred_profile_id: string | null; referral_code: string;
      referred_name: string; referred_email: string; referred_mobile: string; status: string;
      reward_amount: string; created_at: string; converted_at: string | null;
    }>(
      `SELECT id, referrer_profile_id, referred_profile_id, referral_code, referred_name, referred_email,
              referred_mobile, status, reward_amount::text AS reward_amount, created_at, converted_at
       FROM referrals WHERE referrer_profile_id = $1 ORDER BY created_at DESC`,
      req.profileId,
    );
    return { referrals: rows.map(referralResponse) };
  },
);

export const createReferral = api<
  { profileId: string; referredName: string; referredEmail: string; referredMobile: string },
  { referral: ReferralResponse; message: string }
>(
  { method: "POST", path: "/referrals", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const id = crypto.randomUUID();
    const code = `REF-${crypto.randomUUID().toUpperCase()}`;
    const row = await engagementDb.rawQueryRow<{
      id: string; referrer_profile_id: string; referred_profile_id: string | null; referral_code: string;
      referred_name: string; referred_email: string; referred_mobile: string; status: string;
      reward_amount: string; created_at: string; converted_at: string | null;
    }>(
      `INSERT INTO referrals (id, referrer_profile_id, referral_code, referred_name, referred_email, referred_mobile)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, referrer_profile_id, referred_profile_id, referral_code, referred_name, referred_email,
                 referred_mobile, status, reward_amount::text AS reward_amount, created_at, converted_at`,
      id, req.profileId, code, req.referredName, req.referredEmail, req.referredMobile,
    );
    if (!row) throw new Error("referral_create_failed");
    await engagementDb.rawExec(
      `INSERT INTO notification_outbox (profile_id, channel, notification_type, payload)
       VALUES ($1, 'WHATSAPP', 'referral_invitation', $2::jsonb)`,
      req.profileId,
      JSON.stringify({ referralCode: code, name: req.referredName, mobile: req.referredMobile, email: req.referredEmail }),
    );
    return { referral: referralResponse(row), message: "Referral created and invitation queued for delivery." };
  },
);

export const adminReferrals = api<void, { referrals: ReferralResponse[] }>(
  { method: "GET", path: "/admin/referrals", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await engagementDb.rawQueryAll<{
      id: string; referrer_profile_id: string; referred_profile_id: string | null; referral_code: string;
      referred_name: string; referred_email: string; referred_mobile: string; status: string;
      reward_amount: string; created_at: string; converted_at: string | null;
    }>(
      `SELECT id, referrer_profile_id, referred_profile_id, referral_code, referred_name, referred_email,
              referred_mobile, status, reward_amount::text AS reward_amount, created_at, converted_at
       FROM referrals ORDER BY created_at DESC`,
    );
    return { referrals: rows.map(referralResponse) };
  },
);

function referralResponse(row: {
  id: string; referrer_profile_id: string; referred_profile_id: string | null; referral_code: string;
  referred_name: string; referred_email: string; referred_mobile: string; status: string;
  reward_amount: string; created_at: string; converted_at: string | null;
}): ReferralResponse {
  return { id: row.id, referrerId: row.referrer_profile_id, referredId: row.referred_profile_id, referralCode: row.referral_code, referredName: row.referred_name, referredEmail: row.referred_email, referredMobile: row.referred_mobile, status: row.status, rewardAmount: Number(row.reward_amount), createdAt: row.created_at, convertedAt: row.converted_at };
}

type VoucherResponse = {
  id: string; memberId: string; code: string; title: string; description: string; provider: string; value: number;
  category: string; status: string; issueDate: string; expiryDate: string; anniversaryDate: string | null;
  wablastSent: boolean; expiringSent: boolean; createdAt: string;
};

export const vouchers = api<{ profileId: string }, { vouchers: VoucherResponse[] }>(
  { method: "GET", path: "/vouchers/:profileId", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    return { vouchers: await voucherRows(req.profileId) };
  },
);

export const adminVouchers = api<void, { vouchers: VoucherResponse[] }>(
  { method: "GET", path: "/admin/vouchers", expose: true },
  async () => {
    await requireAdminAccess();
    return { vouchers: await voucherRows(null) };
  },
);

// WhatsApp voucher delivery — Author: Klaasvaakie ( |╲ )
type WhatsAppStatusResponse = {
  verified: boolean;
  phone: string | null;
  verifiedAt: string | null;
  pendingVerificationExpiresAt: string | null;
};

export const whatsappStatus = api<{ profileId: string }, WhatsAppStatusResponse>(
  { method: "GET", path: "/whatsapp/:profileId/status", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const contact = await engagementDb.rawQueryRow<{ phone_e164: string; verified_at: string }>(
      "SELECT phone_e164, verified_at FROM whatsapp_contacts WHERE profile_id = $1",
      req.profileId,
    );
    const pending = await engagementDb.rawQueryRow<{ phone_e164: string; expires_at: string }>(
      `SELECT phone_e164, expires_at FROM whatsapp_verification_codes
       WHERE profile_id = $1 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5
       ORDER BY created_at DESC LIMIT 1`,
      req.profileId,
    );
    return {
      verified: Boolean(contact),
      phone: contact?.phone_e164 ?? pending?.phone_e164 ?? null,
      verifiedAt: contact?.verified_at ?? null,
      pendingVerificationExpiresAt: pending?.expires_at ?? null,
    };
  },
);

export const requestWhatsAppVerification = api<
  { profileId: string; phone: string },
  { requested: true; expiresAt: string; message: string }
>(
  { method: "POST", path: "/whatsapp/:profileId/verification/request", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const phone = normalizeWhatsAppNumber(req.phone);
    const recent = await engagementDb.rawQueryRow<{ expires_at: string }>(
      `SELECT expires_at FROM whatsapp_verification_codes
       WHERE profile_id = $1 AND phone_e164 = $2 AND created_at > now() - interval '60 seconds'
       ORDER BY created_at DESC LIMIT 1`,
      req.profileId, phone,
    );
    if (recent) {
      return { requested: true, expiresAt: recent.expires_at, message: "A verification code was already queued. Please wait before requesting another." };
    }
    const id = crypto.randomUUID();
    const code = String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");
    const salt = randomBytes(16).toString("hex");
    const codeHash = verificationCodeHash(salt, code);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    await engagementDb.rawExec(
      `INSERT INTO whatsapp_verification_codes (id, profile_id, phone_e164, code_salt, code_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6::timestamptz)`,
      id, req.profileId, phone, salt, codeHash, expiresAt,
    );
    await engagementDb.rawExec(
      `INSERT INTO notification_outbox
         (profile_id, channel, notification_type, destination, dedupe_key, payload)
       VALUES ($1, 'WHATSAPP', 'whatsapp_verification', $2, $3, (($4::jsonb) #>> '{}')::jsonb)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
      req.profileId, phone, `whatsapp_verification:${id}`,
      JSON.stringify({ verificationId: id, code, expiresAt, message: `Your KaSiHub WhatsApp verification code is ${code}. It expires in 10 minutes.` }),
    );
    return { requested: true, expiresAt, message: "Verification code queued for your WhatsApp number." };
  },
);

export const confirmWhatsAppVerification = api<
  { profileId: string; code: string },
  { verified: true; phone: string; activeVouchersQueued: number; message: string }
>(
  { method: "POST", path: "/whatsapp/:profileId/verification/confirm", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    if (!/^\d{6}$/.test(req.code)) throw APIError.invalidArgument("Enter the six-digit verification code.");
    const verification = await engagementDb.rawQueryRow<{
      id: string; phone_e164: string; code_salt: string; code_hash: string; attempts: number;
    }>(
      `SELECT id, phone_e164, code_salt, code_hash, attempts FROM whatsapp_verification_codes
       WHERE profile_id = $1 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5
       ORDER BY created_at DESC LIMIT 1`,
      req.profileId,
    );
    if (!verification) throw APIError.failedPrecondition("No valid verification request exists. Request a new code.");
    const suppliedHash = verificationCodeHash(verification.code_salt, req.code);
    const valid = timingSafeEqual(Buffer.from(suppliedHash, "hex"), Buffer.from(verification.code_hash, "hex"));
    if (!valid) {
      await engagementDb.rawExec("UPDATE whatsapp_verification_codes SET attempts = attempts + 1 WHERE id = $1", verification.id);
      throw APIError.permissionDenied("The verification code is incorrect.");
    }
    const transaction = await engagementDb.begin();
    try {
      await transaction.rawExec(
        "UPDATE whatsapp_verification_codes SET consumed_at = now() WHERE id = $1",
        verification.id,
      );
      await transaction.rawExec(
        `INSERT INTO whatsapp_contacts (profile_id, phone_e164, verified_at)
         VALUES ($1, $2, now())
         ON CONFLICT (profile_id) DO UPDATE SET phone_e164 = EXCLUDED.phone_e164, verified_at = now(), updated_at = now();`,
        req.profileId, verification.phone_e164,
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    const queued = await queueVoucherNotifications(req.profileId, "active", verification.phone_e164);
    await engagementDb.rawExec(
      "UPDATE whatsapp_contacts SET active_vouchers_queued_at = now(), updated_at = now() WHERE profile_id = $1",
      req.profileId,
    );
    return {
      verified: true,
      phone: verification.phone_e164,
      activeVouchersQueued: queued.queued,
      message: queued.queued > 0
        ? `WhatsApp verified. ${queued.queued} active voucher(s) were queued automatically.`
        : "WhatsApp verified. There are no undelivered active vouchers right now.",
    };
  },
);

export const queueVoucherDelivery = api<
  { profileId: string; mode: "active" | "expiring" },
  { pushed: number; queued: number; vouchers: { code: string; title: string; value: number; expiryDate: string }[]; message: string }
>(
  { method: "POST", path: "/vouchers/:profileId/delivery", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    const contact = await engagementDb.rawQueryRow<{ phone_e164: string }>(
      "SELECT phone_e164 FROM whatsapp_contacts WHERE profile_id = $1",
      req.profileId,
    );
    if (!contact) throw APIError.failedPrecondition("Verify your WhatsApp number before sending vouchers.");
    return queueVoucherNotifications(req.profileId, req.mode, contact.phone_e164);
  },
);

async function queueVoucherNotifications(profileId: string, mode: "active" | "expiring", destination: string) {
  const rows = await engagementDb.rawQueryAll<{ id: string; code: string; title: string; value: string; expiry_date: string }>(
    mode === "expiring"
      ? `SELECT id, code, title, value::text AS value, expiry_date FROM vouchers
         WHERE profile_id = $1 AND status = 'ACTIVE' AND expiring_sent = false
           AND anniversary_date > now() AND anniversary_date <= now() + interval '5 days'`
      : `SELECT id, code, title, value::text AS value, expiry_date FROM vouchers
         WHERE profile_id = $1 AND status = 'ACTIVE' AND wablast_sent = false AND expiry_date > now()`,
    profileId,
  );
  if (rows.length === 0) return { pushed: 0, queued: 0, vouchers: [], message: "No vouchers require delivery." };
  const vouchers = rows.map((row) => ({ code: row.code, title: row.title, value: Number(row.value), expiryDate: row.expiry_date }));
  const voucherIds = rows.map((row) => row.id).sort();
  const dedupeKey = `${mode === "expiring" ? "voucher_expiry" : "voucher_active"}:${profileId}:${createHash("sha256").update(voucherIds.join(",")).digest("hex")}`;
  await engagementDb.rawExec(
    `INSERT INTO notification_outbox
       (profile_id, channel, notification_type, destination, dedupe_key, payload)
     VALUES ($1, 'WHATSAPP', $2, $3, $4, (($5::jsonb) #>> '{}')::jsonb)
     ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    profileId, mode === "expiring" ? "voucher_expiry" : "voucher_active", destination, dedupeKey,
    JSON.stringify({ vouchers, priority: mode === "expiring" ? "high" : "normal" }),
  );
  await engagementDb.rawExec(
    mode === "expiring"
      ? "UPDATE vouchers SET expiring_sent = true WHERE id = ANY($1::uuid[])"
      : "UPDATE vouchers SET wablast_sent = true WHERE id = ANY($1::uuid[])",
    voucherIds,
  );
  return { pushed: 0, queued: rows.length, vouchers, message: `${rows.length} voucher notification(s) queued for verified WhatsApp delivery.` };
}

export const queueAnniversaryVoucherReminders = api(
  {},
  processAnniversaryVoucherReminders,
);

export const runAnniversaryVoucherReminders = api<void, { profilesProcessed: number; vouchersQueued: number }>(
  { method: "POST", path: "/admin/vouchers/run-anniversary-reminders", expose: true },
  async () => {
    await requireAdminAccess();
    return processAnniversaryVoucherReminders();
  },
);

const anniversaryVoucherReminderJob = new CronJob("anniversary-voucher-reminders", {
  title: "Queue five-day WhatsApp voucher reminders",
  schedule: "0 7 * * *",
  endpoint: queueAnniversaryVoucherReminders,
});

void anniversaryVoucherReminderJob;

async function processAnniversaryVoucherReminders(): Promise<{ profilesProcessed: number; vouchersQueued: number }> {
  const contacts = await engagementDb.rawQueryAll<{ profile_id: string; phone_e164: string }>(
    `SELECT DISTINCT wc.profile_id, wc.phone_e164 FROM whatsapp_contacts wc
     JOIN vouchers v ON v.profile_id = wc.profile_id
     WHERE v.status = 'ACTIVE' AND v.expiring_sent = false
       AND v.anniversary_date > now() AND v.anniversary_date <= now() + interval '5 days'`,
  );
  let vouchersQueued = 0;
  for (const contact of contacts) {
    const result = await queueVoucherNotifications(contact.profile_id, "expiring", contact.phone_e164);
    vouchersQueued += result.queued;
  }
  return { profilesProcessed: contacts.length, vouchersQueued };
}

function normalizeWhatsAppNumber(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const normalized = compact.startsWith("0") ? `+27${compact.slice(1)}` : compact.startsWith("+") ? compact : `+${compact}`;
  if (!/^\+[1-9]\d{7,14}$/.test(normalized)) throw APIError.invalidArgument("Enter a valid WhatsApp number including its country code.");
  return normalized;
}

function verificationCodeHash(salt: string, code: string): string {
  return createHash("sha256").update(`${salt}:${code}`).digest("hex");
}

async function voucherRows(profileId: string | null): Promise<VoucherResponse[]> {
  const rows = await engagementDb.rawQueryAll<{
    id: string; profile_id: string; code: string; title: string; description: string; provider: string; value: string;
    category: string; status: string; issue_date: string; expiry_date: string; anniversary_date: string | null;
    wablast_sent: boolean; expiring_sent: boolean; created_at: string;
  }>(
    `SELECT id, profile_id, code, title, description, provider, value::text AS value, category, status,
            issue_date, expiry_date, anniversary_date, wablast_sent, expiring_sent, created_at
     FROM vouchers WHERE ($1::uuid IS NULL OR profile_id = $1::uuid) ORDER BY expiry_date`,
    profileId,
  );
  return rows.map((row) => ({ id: row.id, memberId: row.profile_id, code: row.code, title: row.title, description: row.description, provider: row.provider, value: Number(row.value), category: row.category, status: row.status, issueDate: row.issue_date, expiryDate: row.expiry_date, anniversaryDate: row.anniversary_date, wablastSent: row.wablast_sent, expiringSent: row.expiring_sent, createdAt: row.created_at }));
}

type SubscriptionNotificationResponse = {
  id: string; memberId: string; daysBefore: number; channel: string; status: string; message: string; sentAt: string;
};

export const subscriptionNotifications = api<{ profileId: string }, { notifications: SubscriptionNotificationResponse[] }>(
  { method: "GET", path: "/subscriptions/:profileId/notifications", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    return { notifications: await notificationRows(req.profileId) };
  },
);

export const queueSubscriptionNotification = api<
  { profileId: string; daysBefore: 1 | 3 | 5 },
  { queued: boolean; notification: SubscriptionNotificationResponse | null }
>(
  { method: "POST", path: "/subscriptions/:profileId/notifications", expose: true },
  async (req) => {
    await requireEcosystemProfileAccess(req.profileId);
    return queueRenewalNotification(req.profileId, req.daysBefore);
  },
);

export const adminSubscriptionNotifications = api<void, { notifications: SubscriptionNotificationResponse[]; activeMembers: number }>(
  { method: "GET", path: "/admin/subscription-notifications", expose: true },
  async () => {
    await requireAdminAccess();
    const active = await membershipDb.rawQueryRow<{ count: string }>("SELECT COUNT(DISTINCT profile_id)::text AS count FROM subscriptions WHERE status = 'active'");
    return { notifications: await notificationRows(null), activeMembers: Number(active?.count ?? 0) };
  },
);

export const adminQueueSubscriptionNotifications = api<
  { daysBefore: 1 | 3 | 5 },
  { sent: number; totalEligible: number; daysBefore: number; message: string }
>(
  { method: "POST", path: "/admin/subscription-notifications", expose: true },
  async (req) => {
    await requireAdminAccess();
    const profiles = await membershipDb.rawQueryAll<{ profile_id: string }>("SELECT DISTINCT profile_id FROM subscriptions WHERE status = 'active'");
    let queued = 0;
    for (const profile of profiles) {
      const result = await queueRenewalNotification(profile.profile_id, req.daysBefore);
      if (result.queued) queued++;
    }
    return { sent: 0, totalEligible: profiles.length, daysBefore: req.daysBefore, message: `${queued} renewal reminder(s) queued for delivery.` };
  },
);

async function queueRenewalNotification(profileId: string, daysBefore: 1 | 3 | 5): Promise<{ queued: boolean; notification: SubscriptionNotificationResponse | null }> {
  const subscription = await membershipDb.rawQueryRow<{ billing_period: string }>(
    `SELECT COALESCE(to_char(current_period_end, 'YYYY-MM'), to_char(starts_at, 'YYYY-MM')) AS billing_period
     FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1`, profileId,
  );
  if (!subscription) throw new Error("subscription_not_found");
  const message = daysBefore === 1
    ? "URGENT: Your KaSiHUB subscription renews tomorrow. Please fund your payment account."
    : `Your KaSiHUB subscription renews in ${daysBefore} days. Please ensure your payment account is funded.`;
  const id = crypto.randomUUID();
  const row = await engagementDb.rawQueryRow<{
    id: string; profile_id: string; days_before: number; channel: string; status: string; message: string; sent_at: string;
  }>(
    `INSERT INTO subscription_notifications (id, profile_id, days_before, billing_period, message)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (profile_id, days_before, billing_period) DO NOTHING
     RETURNING id, profile_id, days_before, channel, status, message, sent_at`,
    id, profileId, daysBefore, subscription.billing_period, message,
  );
  if (!row) return { queued: false, notification: null };
  await engagementDb.rawExec(
    `INSERT INTO notification_outbox (profile_id, channel, notification_type, payload)
     VALUES ($1, 'WHATSAPP', 'subscription_renewal', $2::jsonb)`,
    profileId, JSON.stringify({ daysBefore, message, notificationId: id }),
  );
  return { queued: true, notification: notificationResponse(row) };
}

async function notificationRows(profileId: string | null): Promise<SubscriptionNotificationResponse[]> {
  const rows = await engagementDb.rawQueryAll<{
    id: string; profile_id: string; days_before: number; channel: string; status: string; message: string; sent_at: string;
  }>(
    `SELECT id, profile_id, days_before, channel, status, message, sent_at
     FROM subscription_notifications WHERE ($1::uuid IS NULL OR profile_id = $1::uuid)
     ORDER BY sent_at DESC LIMIT 200`, profileId,
  );
  return rows.map(notificationResponse);
}

function notificationResponse(row: { id: string; profile_id: string; days_before: number; channel: string; status: string; message: string; sent_at: string }): SubscriptionNotificationResponse {
  return { id: row.id, memberId: row.profile_id, daysBefore: row.days_before, channel: row.channel, status: row.status, message: row.message, sentAt: row.sent_at };
}

