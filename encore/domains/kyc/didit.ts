// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { auditDb, kycDb } from "../../resources";
import { requireProfileAccess } from "../auth/access";
import { evaluateDiditDecision, type DiditDecisionPayload } from "./didit-decision";
import { INTERNATIONAL_KYC_PROVIDER } from "./policy";

const DiditApiKey = secret("DiditApiKey");
const DiditWebhookSecret = secret("DiditWebhookSecret");
const DIDIT_WORKFLOW_ID = "67a9c6a9-e8dc-4515-afd5-749549f66ebe";
const DIDIT_SESSION_URL = "https://verification.didit.me/v3/session/";

type DiditSessionResponse = {
  session_id: string;
  url: string;
  status: string;
  workflow_id: string;
};

type DiditWebhook = {
  event_id?: unknown;
  webhook_type?: unknown;
  environment?: unknown;
  session_id?: unknown;
  workflow_id?: unknown;
  vendor_data?: unknown;
  status?: unknown;
  decision?: DiditDecisionPayload;
};

function uuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = sortKeys((value as Record<string, unknown>)[key]);
      return result;
    }, {});
  }
  return value;
}

function header(req: { headers: Record<string, string | string[] | undefined> }, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function secureHexEqual(expected: string, received: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  const a = Buffer.from(expected.toLowerCase(), "utf8");
  const b = Buffer.from(received.toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const createDiditVerificationSession = api<
  { caseId: string },
  { sessionId: string; url: string; status: string }
>(
  { method: "POST", path: "/kyc/international/cases/:caseId/didit-session", expose: true },
  async (req) => {
    const kycCase = await kycDb.rawQueryRow<{
      id: string; profile_id: string; provider: string; status: string; didit_session_id: string | null;
    }>("SELECT id, profile_id, provider, status, didit_session_id FROM kyc_cases WHERE id = $1", req.caseId);
    if (!kycCase) throw APIError.notFound("KYC case not found");
    await requireProfileAccess(kycCase.profile_id);
    if (kycCase.provider !== INTERNATIONAL_KYC_PROVIDER || kycCase.status !== "pending") {
      throw APIError.failedPrecondition("This KYC case cannot start identity verification");
    }

    const response = await fetch(DIDIT_SESSION_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": DiditApiKey() },
      body: JSON.stringify({
        workflow_id: DIDIT_WORKFLOW_ID,
        vendor_data: kycCase.id,
        metadata: { purpose: "kasishares_presale_kyc" },
      }),
    });
    if (!response.ok) {
      if (response.status === 403) throw APIError.unavailable("Identity verification provider credentials were rejected");
      throw APIError.unavailable("Identity verification provider is unavailable");
    }
    const session = await response.json() as DiditSessionResponse;
    if (!uuid(session.session_id) || session.workflow_id !== DIDIT_WORKFLOW_ID || !session.url.startsWith("https://verify.didit.me/")) {
      throw APIError.internal("Identity verification provider returned an invalid session");
    }
    await kycDb.rawExec(
      `UPDATE kyc_cases SET didit_session_id = $2, didit_workflow_id = $3,
         result_payload = result_payload || $4::jsonb
       WHERE id = $1`,
      kycCase.id, session.session_id, DIDIT_WORKFLOW_ID,
      JSON.stringify({ externalProvider: "didit", providerStatus: session.status }),
    );
    return { sessionId: session.session_id, url: session.url, status: session.status };
  },
);

/**
 * Webhooks remain primary. This bounded provider read repairs a pending case
 * when Didit's final status webhook is delayed or lost. The database claim
 * throttles browser polling and prevents concurrent reconciliation storms.
 */
export async function reconcilePendingDiditDecision(profileId: string): Promise<void> {
  const kycCase = await kycDb.rawQueryRow<{
    id: string; didit_session_id: string; didit_workflow_id: string;
  }>(
    `UPDATE kyc_cases
        SET didit_last_synced_at = now()
      WHERE id = (
        SELECT id FROM kyc_cases
         WHERE profile_id = $1 AND provider = $2 AND status = 'pending'
           AND didit_session_id IS NOT NULL
           AND (didit_last_synced_at IS NULL OR didit_last_synced_at < now() - interval '30 seconds')
         ORDER BY submitted_at DESC NULLS LAST
         LIMIT 1
      )
      RETURNING id, didit_session_id::text, didit_workflow_id::text`,
    profileId, INTERNATIONAL_KYC_PROVIDER,
  );
  if (!kycCase) return;

  const response = await fetch(
    `https://verification.didit.me/v3/session/${encodeURIComponent(kycCase.didit_session_id)}/decision/`,
    { headers: { "x-api-key": DiditApiKey() } },
  );
  if (!response.ok) {
    console.warn("didit_decision_reconciliation_failed", { caseId: kycCase.id, status: response.status });
    return;
  }

  const payload = await response.json() as DiditDecisionPayload;
  if (payload.session_id !== kycCase.didit_session_id
    || payload.workflow_id !== kycCase.didit_workflow_id
    || payload.vendor_data !== kycCase.id) {
    console.warn("didit_decision_reconciliation_mismatch", { caseId: kycCase.id });
    return;
  }

  const evaluation = evaluateDiditDecision(payload);
  const safeResult = {
    externalProvider: "didit",
    providerStatus: evaluation.providerStatus,
    policySatisfied: evaluation.policySatisfied,
    policyVersion: evaluation.policySatisfied ? "didit-free-kyc-v1" : undefined,
    checks: evaluation.checks,
    evidenceSource: "provider-decision-backfill",
  };
  const tx = await kycDb.begin();
  let updated: { id: string } | null = null;
  try {
    updated = await tx.rawQueryRow<{ id: string }>(
      `UPDATE kyc_cases
          SET result_payload = $2::jsonb
        WHERE id = $1 AND status = 'pending' AND didit_session_id = $3
        RETURNING id`,
      kycCase.id, JSON.stringify(safeResult), kycCase.didit_session_id,
    );
    if (updated) {
      // The database approval guard intentionally reads already-persisted policy
      // evidence. Keep evidence and status changes ordered in one transaction.
      await tx.rawExec(
        `UPDATE kyc_cases
            SET status = $2,
                reviewed_at = CASE WHEN $2 IN ('approved','rejected') THEN now() ELSE reviewed_at END
          WHERE id = $1 AND status = 'pending'`,
        kycCase.id, evaluation.nextStatus,
      );
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback();
    throw error;
  }
  if (!updated) return;

  await auditDb.rawExec(
    `INSERT INTO audit_logs (action, entity_type, entity_id, after)
     VALUES ('kyc.didit.reconcile', 'kyc_case', $1, $2::jsonb)`,
    kycCase.id,
    JSON.stringify({ providerStatus: evaluation.providerStatus, status: evaluation.nextStatus }),
  );
}

export const diditWebhook = api.raw(
  { expose: true, path: "/kyc/providers/didit/webhook", method: "POST", bodyLimit: 1048576 },
  async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const raw = Buffer.concat(chunks);
    try {
      const timestamp = header(req, "x-timestamp");
      const signature = header(req, "x-signature-v2");
      const timestampSeconds = Number(timestamp);
      if (!Number.isInteger(timestampSeconds) || Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > 300) {
        throw APIError.unauthenticated("Expired webhook");
      }
      const payload = JSON.parse(raw.toString("utf8")) as DiditWebhook;
      const canonical = JSON.stringify(sortKeys(payload));
      const expected = createHmac("sha256", DiditWebhookSecret()).update(canonical, "utf8").digest("hex");
      if (!secureHexEqual(expected, signature)) throw APIError.unauthenticated("Invalid webhook signature");
      if (payload.webhook_type !== "status.updated" || payload.environment !== "live") {
        res.writeHead(202).end();
        return;
      }
      if (!uuid(payload.event_id) || !uuid(payload.session_id) || !uuid(payload.vendor_data) || payload.workflow_id !== DIDIT_WORKFLOW_ID) {
        throw APIError.invalidArgument("Invalid Didit webhook correlation");
      }
      const providerStatus = typeof payload.status === "string" ? payload.status : "Unknown";
      const kycCase = await kycDb.rawQueryRow<{ id: string; profile_id: string; didit_session_id: string | null }>(
        "SELECT id, profile_id, didit_session_id FROM kyc_cases WHERE id = $1 AND provider = $2",
        payload.vendor_data, INTERNATIONAL_KYC_PROVIDER,
      );
      if (!kycCase || kycCase.didit_session_id !== payload.session_id) throw APIError.notFound("KYC session not found");

      const evaluation = evaluateDiditDecision({ ...payload.decision, status: providerStatus });
      const nextStatus = evaluation.nextStatus;
      const safeResult = {
        externalProvider: "didit",
        providerStatus,
        policySatisfied: evaluation.policySatisfied,
        policyVersion: evaluation.policySatisfied ? "didit-free-kyc-v1" : undefined,
        checks: evaluation.checks,
        evidenceSource: "signed-webhook",
      };
      const tx = await kycDb.begin();
      try {
        const inserted = await tx.rawQueryRow<{ event_id: string }>(
          `INSERT INTO didit_webhook_events
             (event_id, kyc_case_id, session_id, webhook_type, provider_status, payload_sha256)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING event_id`,
          payload.event_id, kycCase.id, payload.session_id, payload.webhook_type, providerStatus,
          createHash("sha256").update(raw).digest("hex"),
        );
        if (inserted) {
          await tx.rawExec(
            `UPDATE kyc_cases
                SET didit_last_synced_at = now(), result_payload = $2::jsonb
              WHERE id = $1`,
            kycCase.id, JSON.stringify(safeResult),
          );
          await tx.rawExec(
            `UPDATE kyc_cases
                SET status = $2,
                    reviewed_at = CASE WHEN $2 IN ('approved','rejected') THEN now() ELSE reviewed_at END
              WHERE id = $1`,
            kycCase.id, nextStatus,
          );
        }
        await tx.commit();
      } catch (error) {
        await tx.rollback();
        throw error;
      }
      await auditDb.rawExec(
        `INSERT INTO audit_logs (action, entity_type, entity_id, after)
         VALUES ('kyc.didit.status', 'kyc_case', $1, $2::jsonb)`,
        kycCase.id, JSON.stringify({ eventId: payload.event_id, providerStatus, status: nextStatus }),
      );
      res.writeHead(204).end();
    } catch (error) {
      const status = error instanceof APIError && String((error as APIError & { code?: unknown }).code) === "unauthenticated" ? 401
        : error instanceof APIError ? 400 : 500;
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: status === 500 ? "didit_webhook_failed" : (error as Error).message }));
    }
  },
);
