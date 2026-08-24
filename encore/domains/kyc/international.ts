// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { auditDb, identityDb, kycDb } from "../../resources";
import { requireProfileAccess } from "../auth/access";
import { reconcilePendingDiditDecision } from "./didit";
import { INTERNATIONAL_KYC_PROVIDER, getInternationalKycVerification } from "./policy";

type InternationalKycCaseResponse = {
  id: string;
  status: string;
  provider: typeof INTERNATIONAL_KYC_PROVIDER;
};

/**
 * Creates or resumes the Kasihub-owned KYC case for an international profile.
 * Provider selection is server-owned and the persisted citizenship type is the
 * authority for eligibility.
 */
export const createInternationalKycCase = api<
  { profileId: string },
  InternationalKycCaseResponse
>(
  { method: "POST", path: "/kyc/international/cases", expose: true },
  async (req) => {
    const session = await requireProfileAccess(req.profileId);
    const profile = await identityDb.rawQueryRow<{ onboarding_authority: string }>(
      "SELECT onboarding_authority FROM profiles WHERE id = $1",
      req.profileId,
    );
    if (!profile) throw APIError.notFound("Profile not found");
    if (profile.onboarding_authority !== "kasihub") {
      throw APIError.failedPrecondition("KaSiHub KYC is only available when KaSiHub is the selected onboarding authority");
    }

    const existing = await kycDb.rawQueryRow<{ id: string; status: string; provider: string }>(
      `SELECT id, status, provider
       FROM kyc_cases
       WHERE profile_id = $1 AND provider = $2 AND status IN ('pending', 'approved')
       ORDER BY submitted_at DESC NULLS LAST
       LIMIT 1`,
      req.profileId,
      INTERNATIONAL_KYC_PROVIDER,
    );
    if (existing) {
      return { id: existing.id, status: existing.status, provider: INTERNATIONAL_KYC_PROVIDER };
    }

    const id = crypto.randomUUID();
    await kycDb.rawExec(
      `INSERT INTO kyc_cases (id, profile_id, provider, status, submitted_at)
       VALUES ($1, $2, $3, 'pending', now())`,
      id,
      req.profileId,
      INTERNATIONAL_KYC_PROVIDER,
    );
    await auditDb.rawExec(
      `INSERT INTO audit_logs (action, entity_type, entity_id, actor_user_id, after)
       VALUES ('kyc.international.create', 'kyc_case', $1, $2, $3::jsonb)`,
      id,
      session.user.id,
      JSON.stringify({ profileId: req.profileId, provider: INTERNATIONAL_KYC_PROVIDER, status: "pending" }),
    );

    return { id, status: "pending", provider: INTERNATIONAL_KYC_PROVIDER };
  },
);

export const internationalKycStatus = api<
  { profileId: string },
  { required: boolean; verified: boolean; status: string; caseId: string | null }
>(
  { method: "GET", path: "/kyc/international/status/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    try {
      await reconcilePendingDiditDecision(req.profileId);
    } catch {
      // Provider backfill is recovery, not availability authority. Preserve the
      // stored KYC state when Didit is temporarily unavailable.
      console.warn("didit_decision_reconciliation_unavailable");
    }
    return getInternationalKycVerification(req.profileId);
  },
);
