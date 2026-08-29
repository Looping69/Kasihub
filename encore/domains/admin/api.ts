// Author: Klaasvaakie ( |╲ )
import { api } from "encore.dev/api";
import * as log from "encore.dev/log";
import { StructKeyspace, expireInMinutes } from "encore.dev/storage/cache";
import { z } from "zod";
import { applicationCache, auditDb, commerceDb, financeDb, identityDb, kycDb, membershipDb, networkDb, sharesDb } from "../../resources";
import { requireAdminAccess } from "../auth/access";
import { decodeStoredConfig } from "./theme-storage";
import { cacheDelete, cacheRead, cacheWrite } from "../shared/cache";

interface AppTheme {
  name: string;
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  border: string;
  sidebar: string;
  sidebarText: string;
  radius: number;
  fontScale: number;
  shadow: "none" | "soft" | "medium" | "strong";
  pageBackground: "solid" | "soft" | "grid";
}

const themeSchema: z.ZodType<AppTheme> = z.object({
  name: z.string().min(1).max(80),
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  surface: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  text: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  mutedText: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  border: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sidebar: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  sidebarText: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  radius: z.number().int().min(0).max(24),
  fontScale: z.number().min(0.85).max(1.2),
  shadow: z.enum(["none", "soft", "medium", "strong"]),
  pageBackground: z.enum(["solid", "soft", "grid"]),
});

const DEFAULT_THEME = {
  name: "KaSiHUB Classic", primary: "#0569BD", accent: "#F58220", background: "#FFFFFF",
  surface: "#FFFFFF", text: "#17233C", mutedText: "#64748B", border: "#DDE6EE",
  sidebar: "#0569BD", sidebarText: "#FFFFFF", radius: 12, fontScale: 1,
  shadow: "soft" as const, pageBackground: "soft" as const,
} satisfies AppTheme;

const publicThemeCache = new StructKeyspace<string, { theme: AppTheme; version: number }>(applicationCache, {
  keyPattern: "public-config/:key",
  defaultExpiry: expireInMinutes(5),
});

function storedTheme(value: unknown) {
  const config = decodeStoredConfig(value);
  if (!config) return null;
  const nestedTheme = config.theme;
  const parsed = themeSchema.safeParse(nestedTheme && typeof nestedTheme === "object" ? nestedTheme : config);
  return parsed.success ? parsed.data : null;
}

export const publicTheme = api<void, { theme: AppTheme; version: number }>(
  { method: "GET", path: "/theme", expose: true },
  async () => {
    const cached = await cacheRead(publicThemeCache, "theme-v1");
    if (cached) return cached;
    const row = await membershipDb.rawQueryRow<{ version: number; config: unknown }>(
      `SELECT version, config FROM business_config_versions
       WHERE config_key = 'app_theme' AND config->>'status' = 'published'
       ORDER BY version DESC LIMIT 1`,
    );
    const theme = row ? storedTheme(row.config) : null;
    const response = { theme: theme ?? DEFAULT_THEME, version: theme ? row?.version ?? 0 : 0 };
    await cacheWrite(publicThemeCache, "theme-v1", response);
    return response;
  },
);

export const adminTheme = api<void, { active: AppTheme; versions: { version: number; status: string; theme: AppTheme; createdAt: string }[] }>(
  { method: "GET", path: "/admin/theme", expose: true },
  async () => {
    await requireAdminAccess();
    const rows = await membershipDb.rawQueryAll<{ version: number; config: unknown; created_at: string }>(
      `SELECT version, config, created_at::text AS created_at FROM business_config_versions
       WHERE config_key = 'app_theme' ORDER BY version DESC LIMIT 20`,
    );
    const versions = rows.flatMap((row) => {
      const config = decodeStoredConfig(row.config);
      const theme = storedTheme(row.config);
      return theme ? [{
        version: row.version,
        status: String(config?.status ?? "draft"),
        theme,
        createdAt: row.created_at,
      }] : [];
    });
    return { active: versions.find((item) => item.status === "published")?.theme ?? DEFAULT_THEME, versions };
  },
);

export const saveTheme = api<{ action: "draft" | "publish"; theme: AppTheme }, { ok: true; version: number; status: string }>(
  { method: "POST", path: "/admin/theme", expose: true },
  async (req) => {
    const admin = await requireAdminAccess();
    const theme = themeSchema.parse(req.theme);
    const status = req.action === "publish" ? "published" : "draft";
    const audit = await auditDb.rawQueryRow<{ id: string }>(`INSERT INTO audit_logs
      (actor_user_id, action, entity_type, entity_id, after) VALUES
      ($1, $2, 'app_theme', gen_random_uuid(), $3::jsonb) RETURNING id`,
      admin.user.id,
      `theme.${status}.requested`,
      JSON.stringify({ status: "processing", theme }),
    );
    if (!audit) throw new Error("theme_audit_not_created");
    const tx = await membershipDb.begin();
    let row: { version: number } | null;
    try {
      if (status === "published") {
        await tx.rawExec(`UPDATE business_config_versions SET config = jsonb_set(config, '{status}', '"archived"')
          WHERE config_key = 'app_theme' AND config->>'status' = 'published'`);
      }
      row = await tx.rawQueryRow<{ version: number }>(`INSERT INTO business_config_versions
        (config_key, version, config, created_by) VALUES
        ('app_theme', COALESCE((SELECT MAX(version) + 1 FROM business_config_versions WHERE config_key = 'app_theme'), 1), $1::jsonb, $2)
        RETURNING version`, JSON.stringify({ status, theme }), admin.user.id);
      if (!row) throw new Error("theme_version_not_created");
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      try {
        await auditDb.rawExec(`UPDATE audit_logs SET after = $1::jsonb WHERE id = $2`,
          JSON.stringify({ status: "failed", theme }), audit.id);
      } catch (auditError) {
        log.error(auditError, "theme failure audit update failed", { auditId: audit.id, actorUserId: admin.user.id });
      }
      throw error;
    }
    try {
      await auditDb.rawExec(`UPDATE audit_logs SET action = $1, after = $2::jsonb WHERE id = $3`,
        `theme.${status}`,
        JSON.stringify({ status: "completed", version: row.version, theme }),
        audit.id,
      );
    } catch (error) {
      log.error(error, "theme completion audit update failed", { auditId: audit.id, actorUserId: admin.user.id, version: row.version });
    }
    if (status === "published") await cacheDelete(publicThemeCache, "theme-v1");
    return { ok: true, version: row.version, status };
  },
);

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
  monthlyEarnings: number; taxThreshold: boolean; nfcTagId: string | null; instapayStatus: string;
  instapayVerifiedAt: string | null; instapayAccountRef: string | null; uplineProfileNumber: string | null;
  uplineConfirmed: boolean; createdAt: string; shareCount: number; transactionCount: number; orderCount: number;
  presaleApplicationStatus: string | null; presalePhaseCompleted: number | null;
  presaleCompletionPercent: number | null; presaleApplicationNumber: string | null;
  presaleReservationStatus: string | null; presaleOrderReference: string | null;
  presaleReservationQuantity: number | null; presaleIncorporationStatus: string | null;
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
    // Batch cross-database enrichment once per domain instead of five queries per member.
    // Author: Klaasvaakie ( |╲ )
    const profileIds = rows.map((row) => row.id);
    const [subscriptions, kycCases, shareTotals, transactionCounts, orderCounts, presaleApplications, presaleOrders] = profileIds.length === 0
      ? [[], [], [], [], [], [], []] as const
      : await Promise.all([
        membershipDb.rawQueryAll<{ profile_id: string; status: string; amount: string; currency: string }>(
          `SELECT DISTINCT ON (s.profile_id) s.profile_id, s.status, mp.amount::text AS amount, mp.currency
           FROM subscriptions s JOIN membership_plans mp ON mp.id = s.plan_id
           WHERE s.profile_id = ANY($1::uuid[]) ORDER BY s.profile_id, s.starts_at DESC`, profileIds,
        ),
        kycDb.rawQueryAll<{ profile_id: string; status: string; reviewed_at: string | null }>(
          `SELECT DISTINCT ON (profile_id) profile_id, status, reviewed_at FROM kyc_cases
           WHERE profile_id = ANY($1::uuid[]) ORDER BY profile_id, submitted_at DESC NULLS LAST`, profileIds,
        ),
        sharesDb.rawQueryAll<{ profile_id: string; total: string }>(
          `SELECT profile_id, COALESCE(SUM(total_shares), 0)::text AS total FROM share_certificates
           WHERE profile_id = ANY($1::uuid[]) AND status <> 'revoked' GROUP BY profile_id`, profileIds,
        ),
        financeDb.rawQueryAll<{ profile_id: string; count: string }>(
          `SELECT la.owner_id::text AS profile_id, COUNT(DISTINCT lt.id)::text AS count
           FROM ledger_accounts la JOIN ledger_entries le ON le.account_id = la.id
           JOIN ledger_transactions lt ON lt.id = le.transaction_id
           WHERE la.owner_type = 'profile' AND la.owner_id = ANY($1::uuid[]) GROUP BY la.owner_id`, profileIds,
        ),
        commerceDb.rawQueryAll<{ profile_id: string; count: string }>(
          `SELECT profile_id, COUNT(*)::text AS count FROM marketplace_orders
           WHERE profile_id = ANY($1::uuid[]) GROUP BY profile_id`, profileIds,
        ),
        presaleDb.rawQueryAll<{
          external_profile_id: string; application_number: string; status: string;
          phase_completed: number; completion_percent: number;
        }>(
          `SELECT DISTINCT ON (external_profile_id) external_profile_id, application_number, status,
                  phase_completed, completion_percent
           FROM presale_applications
           WHERE external_profile_id = ANY($1::text[])
           ORDER BY external_profile_id, updated_at DESC`, profileIds,
        ),
        presaleDb.rawQueryAll<{
          external_profile_id: string; order_reference: string; status: string; quantity: number;
          incorporation_status: string;
        }>(
          `SELECT DISTINCT ON (external_profile_id) external_profile_id::text AS external_profile_id,
                  order_reference, status, quantity, incorporation_status
           FROM presale_orders
           WHERE external_profile_id = ANY($1::uuid[])
           ORDER BY external_profile_id, created_at DESC`, profileIds,
        ),
      ]);
    const subscriptionByProfile = new Map(subscriptions.map((item) => [item.profile_id, item]));
    const kycByProfile = new Map(kycCases.map((item) => [item.profile_id, item]));
    const sharesByProfile = new Map(shareTotals.map((item) => [item.profile_id, item.total]));
    const transactionsByProfile = new Map(transactionCounts.map((item) => [item.profile_id, item.count]));
    const ordersByProfile = new Map(orderCounts.map((item) => [item.profile_id, item.count]));
    const presaleApplicationByProfile = new Map(presaleApplications.map((item) => [item.external_profile_id, item]));
    const presaleOrderByProfile = new Map(presaleOrders.map((item) => [item.external_profile_id, item]));
    const enriched: AdminMemberResponse[] = rows.map((row) => {
      const subscription = subscriptionByProfile.get(row.id);
      const kyc = kycByProfile.get(row.id);
      const kycStatusValue = kyc
        ? (kyc.status === "approved" ? "VERIFIED" : kyc.status.toUpperCase())
        : (row.status === "active" ? "VERIFIED" : row.status === "rejected" ? "REJECTED" : "PENDING");
      const subscriptionStatus = subscription?.status.toLowerCase();
      const presaleApplication = presaleApplicationByProfile.get(row.id);
      const presaleOrder = presaleOrderByProfile.get(row.id);
      return {
        id: row.id, profileNumber: row.profile_number, membershipType: row.membership_type ?? row.profile_type.toUpperCase(), citizenshipType: row.citizenship_type,
        firstName: row.first_name, lastName: row.surname, companyName: row.company_name, email: row.email,
        country: row.country ?? "ZA", mobile: row.phone ?? "", kycStatus: kycStatusValue, kycVerifiedAt: kyc?.reviewed_at ?? row.kyc_verified_at,
        subscriptionStatus: subscriptionStatus === "active" || subscriptionStatus === "paid" ? "ACTIVE" : subscriptionStatus?.toUpperCase() ?? "PENDING",
        subscriptionAmount: Number(subscription?.amount ?? 0), subscriptionCurrency: subscription?.currency ?? "ZAR",
        monthlyEarnings: Number(row.monthly_earnings), taxThreshold: row.tax_threshold,
        nfcTagId: row.nfc_tag_id, instapayStatus: row.instapay_status,
        instapayVerifiedAt: row.instapay_verified_at, instapayAccountRef: row.instapay_account_ref,
        uplineProfileNumber: row.upline_profile_number, uplineConfirmed: row.upline_confirmed, createdAt: row.created_at,
        shareCount: Number(sharesByProfile.get(row.id) ?? 0), transactionCount: Number(transactionsByProfile.get(row.id) ?? 0), orderCount: Number(ordersByProfile.get(row.id) ?? 0),
        presaleApplicationStatus: presaleApplication?.status ?? null,
        presalePhaseCompleted: presaleApplication?.phase_completed ?? null,
        presaleCompletionPercent: presaleApplication?.completion_percent ?? null,
        presaleApplicationNumber: presaleApplication?.application_number ?? null,
        presaleReservationStatus: presaleOrder?.status ?? null,
        presaleOrderReference: presaleOrder?.order_reference ?? null,
        presaleReservationQuantity: presaleOrder?.quantity ?? null,
        presaleIncorporationStatus: presaleOrder?.incorporation_status ?? null,
      };
    });
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
