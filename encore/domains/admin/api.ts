// Author: Klaasvaakie ( |╲ )
import { api } from "encore.dev/api";
import { z } from "zod";
import { auditDb, commerceDb, financeDb, identityDb, kycDb, membershipDb, networkDb, sharesDb } from "../../resources";
import { requireAdminAccess } from "../auth/access";

interface ConfigVersionRequest {
  config: Record<string, unknown>;
}

const configVersion = z.object({
  config: z.record(z.string(), z.unknown()),
});

export const listConfig = api<
  void,
  {
    versions: {
      config_key: string;
      version: number;
      config: Record<string, unknown>;
      effective_from: string;
    }[];
  }
>(
  { method: "GET", path: "/admin/config", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await membershipDb.rawQueryAll<{
      config_key: string;
      version: number;
      config: Record<string, unknown>;
      effective_from: string;
    }>(
      "SELECT config_key, version, config, effective_from FROM business_config_versions ORDER BY config_key, version DESC",
    );

    return { versions: rows };
  },
);

export const addConfigVersion = api<{ key: string; config: Record<string, unknown> }, { ok: true }>(
  { method: "POST", path: "/admin/config/:key/version", expose: true },
  async (req) => {
    await requireAdminAccess();
    const { config } = configVersion.parse(req);
    await membershipDb.rawExec(`INSERT INTO business_config_versions (config_key, version, config)
       VALUES ($1, COALESCE((SELECT MAX(version) + 1 FROM business_config_versions WHERE config_key = $1), 1), $2::jsonb)`,
      req.key,
      JSON.stringify(config),
    );
    await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, $2, gen_random_uuid(), $3::jsonb)`,
      "config.version.create",
      "business_config_versions",
      JSON.stringify({ key: req.key, config }),
    );
    return { ok: true };
  },
);

export const listAuditLogs = api<
  void,
  {
    logs: {
      action: string;
      entity_type: string;
      entity_id: string | null;
      created_at: string;
    }[];
  }
>(
  { method: "GET", path: "/admin/audit-logs", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await auditDb.rawQueryAll<{
      action: string;
      entity_type: string;
      entity_id: string | null;
      created_at: string;
    }>("SELECT action, entity_type, entity_id, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 100",
    );

  return { logs: rows };
  },
);

type AdminMemberResponse = {
  id: string; profileNumber: string; membershipType: string; citizenshipType: string | null;
  firstName: string | null; lastName: string | null; companyName: string | null; email: string;
  country: string; mobile: string; kycStatus: string; kycVerifiedAt: string | null;
  subscriptionStatus: string; subscriptionAmount: number; subscriptionCurrency: string;
  monthlyEarnings: number; taxThreshold: boolean; nfcTagId: string; instapayStatus: string;
  instapayVerifiedAt: string | null; instapayAccountRef: string | null; uplineProfileNumber: string | null;
  uplineConfirmed: boolean; createdAt: string; shareCount: number; transactionCount: number; orderCount: number;
};

export const adminMemberProfiles = api<
  { search?: string; kyc?: string; subscription?: string; type?: string; limit?: number; offset?: number },
  { members: AdminMemberResponse[]; total: number; limit: number; offset: number }
>(
  { method: "GET", path: "/admin/member-profiles", expose: true },
  async (req) => {
    await requireAdminAccess();
    const rows = await identityDb.rawQueryAll<{
      id: string; profile_number: string; profile_type: string; first_name: string | null; surname: string | null;
      membership_type: string | null; citizenship_type: string | null; company_name: string | null; email: string;
      country: string | null; phone: string | null; status: string; kyc_verified_at: string | null;
      monthly_earnings: string; tax_threshold: boolean; nfc_tag_id: string | null; instapay_status: string;
      instapay_verified_at: string | null; instapay_account_ref: string | null; upline_profile_number: string | null;
      upline_confirmed: boolean; created_at: string;
    }>(
      `SELECT p.id, p.unique_profile_number AS profile_number, p.profile_type, p.first_name, p.surname,
              p.membership_type, p.citizenship_type, p.company_name, u.email, p.country, u.phone, p.status,
              p.kyc_verified_at, p.monthly_earnings::text AS monthly_earnings, p.tax_threshold, p.nfc_tag_id,
              p.instapay_status, p.instapay_verified_at, p.instapay_account_ref, p.upline_profile_number,
              p.upline_confirmed, p.created_at
       FROM profiles p JOIN users u ON u.id = p.user_id ORDER BY p.created_at DESC`,
    );
    const enriched: AdminMemberResponse[] = [];
    for (const row of rows) {
      const [subscription, kyc, shares, transactions, orders] = await Promise.all([
        membershipDb.rawQueryRow<{ status: string; amount: string; currency: string }>(
          `SELECT s.status, mp.amount::text AS amount, mp.currency FROM subscriptions s
           JOIN membership_plans mp ON mp.id = s.plan_id WHERE s.profile_id = $1 ORDER BY s.starts_at DESC LIMIT 1`, row.id,
        ),
        kycDb.rawQueryRow<{ status: string; reviewed_at: string | null }>(
          "SELECT status, reviewed_at FROM kyc_cases WHERE profile_id = $1 ORDER BY submitted_at DESC NULLS LAST LIMIT 1", row.id,
        ),
        sharesDb.rawQueryRow<{ total: string }>("SELECT COALESCE(SUM(total_shares), 0)::text AS total FROM share_certificates WHERE profile_id = $1 AND status <> 'revoked'", row.id),
        financeDb.rawQueryRow<{ count: string }>(
          `SELECT COUNT(DISTINCT lt.id)::text AS count FROM ledger_transactions lt
           JOIN ledger_entries le ON le.transaction_id = lt.id JOIN ledger_accounts la ON la.id = le.account_id
           WHERE la.owner_type = 'profile' AND la.owner_id = $1`, row.id,
        ),
        commerceDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM marketplace_orders WHERE profile_id = $1", row.id),
      ]);
      const kycStatusValue = kyc
        ? (kyc.status === "approved" ? "VERIFIED" : kyc.status.toUpperCase())
        : (row.status === "active" ? "VERIFIED" : row.status === "rejected" ? "REJECTED" : "PENDING");
      const subscriptionStatus = subscription?.status.toLowerCase();
      enriched.push({
        id: row.id, profileNumber: row.profile_number, membershipType: row.membership_type ?? row.profile_type.toUpperCase(), citizenshipType: row.citizenship_type,
        firstName: row.first_name, lastName: row.surname, companyName: row.company_name, email: row.email,
        country: row.country ?? "ZA", mobile: row.phone ?? "", kycStatus: kycStatusValue, kycVerifiedAt: kyc?.reviewed_at ?? row.kyc_verified_at,
        subscriptionStatus: subscriptionStatus === "active" || subscriptionStatus === "paid" ? "ACTIVE" : subscriptionStatus?.toUpperCase() ?? "PENDING",
        subscriptionAmount: Number(subscription?.amount ?? 0), subscriptionCurrency: subscription?.currency ?? "ZAR",
        monthlyEarnings: Number(row.monthly_earnings), taxThreshold: row.tax_threshold,
        nfcTagId: row.nfc_tag_id ?? `NFC-${row.id.slice(0, 12).toUpperCase()}`, instapayStatus: row.instapay_status,
        instapayVerifiedAt: row.instapay_verified_at, instapayAccountRef: row.instapay_account_ref,
        uplineProfileNumber: row.upline_profile_number, uplineConfirmed: row.upline_confirmed, createdAt: row.created_at,
        shareCount: Number(shares?.total ?? 0), transactionCount: Number(transactions?.count ?? 0), orderCount: Number(orders?.count ?? 0),
      });
    }
    const search = (req.search ?? "").toLowerCase();
    const filtered = enriched.filter((member) => {
      const searchable = [member.firstName, member.lastName, member.companyName, member.email, member.profileNumber, member.mobile].filter(Boolean).join(" ").toLowerCase();
      return (!search || searchable.includes(search))
        && (!req.kyc || req.kyc === "ALL" || member.kycStatus === req.kyc)
        && (!req.subscription || req.subscription === "ALL" || member.subscriptionStatus === req.subscription)
        && (!req.type || req.type === "ALL" || member.membershipType === req.type);
    });
    const limit = Math.min(Math.max(req.limit ?? 100, 1), 500);
    const offset = Math.max(req.offset ?? 0, 0);
    return { members: filtered.slice(offset, offset + limit), total: filtered.length, limit, offset };
  },
);

export const listMembers = api<
  void,
  { members: { profileId: string; email: string; profileNumber: string; status: string; membershipStatus: string | null; walletBalance: string | null }[] }
>(
  { method: "GET", path: "/admin/members", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await identityDb.rawQueryAll<{
      profile_id: string;
      email: string;
      unique_profile_number: string;
      profile_status: string;
    }>(
      `SELECT p.id AS profile_id, u.email, p.unique_profile_number, p.status AS profile_status
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC`,
    );
    const members: {
      profileId: string;
      email: string;
      profileNumber: string;
      status: string;
      membershipStatus: string | null;
      walletBalance: string | null;
    }[] = [];
    for (const row of rows) {
      const membership = await membershipDb.rawQueryRow<{ status: string | null }>(
        "SELECT status FROM subscriptions WHERE profile_id = $1 ORDER BY starts_at DESC LIMIT 1",
        row.profile_id,
      );
      const wallet = await networkDb.rawQueryRow<{ cached_balance: string | null }>(
        "SELECT cached_balance::text AS cached_balance FROM wallets WHERE profile_id = $1 ORDER BY created_at DESC LIMIT 1",
        row.profile_id,
      );
      members.push({
        profileId: row.profile_id,
        email: row.email,
        profileNumber: row.unique_profile_number,
        status: row.profile_status,
        membershipStatus: membership?.status ?? null,
        walletBalance: wallet?.cached_balance ?? null,
      });
    }
    return {
      members,
    };
  },
);

export const financialSummary = api<
  void,
  { totalLedgerTransactions: number; totalWalletBalance: string; totalSharePurchases: number }
>(
  { method: "GET", path: "/admin/reports/financial-summary", expose: true },
  async () => {
    await requireAdminAccess();
    const tx = await financeDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM ledger_transactions");
    const wallet = await networkDb.rawQueryRow<{ total: string }>("SELECT COALESCE(SUM(cached_balance), 0)::text AS total FROM wallets");
    const shares = await sharesDb.rawQueryRow<{ count: string }>("SELECT COUNT(*)::text AS count FROM share_purchases");
    return {
      totalLedgerTransactions: Number(tx?.count ?? "0"),
      totalWalletBalance: wallet?.total ?? "0",
      totalSharePurchases: Number(shares?.count ?? "0"),
    };
  },
);


