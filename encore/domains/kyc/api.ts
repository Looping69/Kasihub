// Author: Klaasvaakie ( |╲ )
import { api } from "encore.dev/api";
import { z } from "zod";
import { auditDb, identityDb, kycDb } from "../../resources";
import { requireAdminAccess, requireProfileAccess } from "../auth/access";

interface KycCaseCreateRequest {
  profileId: string;
  provider: string;
}

interface KycCaseResponse {
  id: string;
  profileId: string;
  provider: string;
  status: string;
}

const kycRequest = z.object({
  provider: z.string().min(1),
});

export const createKycCase = api<KycCaseCreateRequest, { id: string; status: string }>(
  { method: "POST", path: "/kyc/cases", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const payload = kycRequest.parse(req);
    const id = crypto.randomUUID();
    await kycDb.rawExec(`INSERT INTO kyc_cases (id, profile_id, provider, status, submitted_at)
       VALUES ($1, $2, $3, 'pending', now())`,
      id,
      req.profileId,
      payload.provider,
    );
    return { id, status: "pending" };
  },
);

export const getKycCase = api<{ id: string }, KycCaseResponse>(
  { method: "GET", path: "/kyc/cases/:id", expose: true },
  async (req) => {
    const row = await kycDb.rawQueryRow<{
      id: string;
      profile_id: string;
      provider: string;
      status: string;
    }>("SELECT id, profile_id, provider, status FROM kyc_cases WHERE id = $1", req.id);
    if (!row) {
      return { id: "", profileId: "", provider: "", status: "not_found" };
    }
    await requireProfileAccess(row.profile_id);
    return { id: row.id, profileId: row.profile_id, provider: row.provider, status: row.status };
  },
);

export const kycStatus = api<{ profileId: string }, { status: string; accountRef: string | null }>(
  { method: "GET", path: "/kyc/status/:profileId", expose: true },
  async (req) => {
    await requireProfileAccess(req.profileId);
    const row = await kycDb.rawQueryRow<{ status: string; result_payload: string }>(
      "SELECT status, result_payload::text AS result_payload FROM kyc_cases WHERE profile_id = $1 ORDER BY submitted_at DESC NULLS LAST LIMIT 1",
      req.profileId,
    );
    let accountRef: string | null = null;
    if (row?.result_payload) {
      try {
        const result = JSON.parse(row.result_payload) as { accountRef?: string };
        accountRef = result.accountRef ?? null;
      } catch {
        accountRef = null;
      }
    }
    return { status: row?.status.toUpperCase() ?? "NONE", accountRef };
  },
);

export const reviewProfileKyc = api<
  { profileId: string; action: "APPROVE" | "REJECT" },
  { profileId: string; kycStatus: string }
>(
  { method: "POST", path: "/admin/kyc/profiles/:profileId/review", expose: true },
  async (req) => {
    await requireAdminAccess();
    let kycCase = await kycDb.rawQueryRow<{ id: string }>(
      "SELECT id FROM kyc_cases WHERE profile_id = $1 ORDER BY submitted_at DESC NULLS LAST LIMIT 1",
      req.profileId,
    );
    if (!kycCase) {
      const id = crypto.randomUUID();
      await kycDb.rawExec(
        "INSERT INTO kyc_cases (id, profile_id, provider, status, submitted_at) VALUES ($1, $2, 'manual', 'pending', now())",
        id, req.profileId,
      );
      kycCase = { id };
    }
    const status = req.action === "APPROVE" ? "approved" : "rejected";
    await kycDb.rawExec(
      "UPDATE kyc_cases SET status = $2, reviewed_at = now() WHERE id = $1",
      kycCase.id, status,
    );
    await identityDb.rawExec("UPDATE profiles SET status = $2 WHERE id = $1", req.profileId, status === "approved" ? "active" : "rejected");
    await auditDb.rawExec(
      `INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, 'profile', $2, $3::jsonb)`,
      `kyc.${status}`, req.profileId, JSON.stringify({ kycCaseId: kycCase.id }),
    );
    return { profileId: req.profileId, kycStatus: status.toUpperCase().replace("APPROVED", "VERIFIED") };
  },
);

export const approveKycCase = api<
  { id: string },
  { ok: true }
>(
  { method: "POST", path: "/admin/kyc/cases/:id/approve", expose: true },
  async (req) => {
    await requireAdminAccess();
    await kycDb.rawExec(`UPDATE kyc_cases SET status = 'approved', reviewed_at = now() WHERE id = $1`,
      req.id,
    );
    await auditDb.rawExec(`INSERT INTO audit_logs (action, entity_type, entity_id, after)
       VALUES ($1, $2, $3, $4::jsonb)`,
      "kyc.approve",
      "kyc_cases",
      req.id,
      JSON.stringify({ status: "approved" }),
    );
    return { ok: true };
  },
);


