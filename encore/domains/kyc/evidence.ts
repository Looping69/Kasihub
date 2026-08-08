// Author: Klaasvaakie ( |╲ )
import { api, APIError } from "encore.dev/api";
import { createHash } from "node:crypto";
import { auditDb, documentsBucket, kycDb } from "../../resources";
import { requireAdminAccess, requireProfileAccess } from "../auth/access";
import { INTERNATIONAL_KYC_PROVIDER } from "./policy";

const MAX_KYC_DOCUMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

function header(req: { headers: Record<string, string | string[] | undefined> }, name: string): string {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function caseIdFromUrl(urlValue: string | undefined): string {
  const url = new URL(urlValue ?? "/", "http://localhost");
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.indexOf("cases");
  return index >= 0 ? (parts[index + 1] ?? "") : "";
}

function hasExpectedFileSignature(contentType: string, file: Buffer): boolean {
  if (contentType === "application/pdf") {
    return file.length >= 5 && file.subarray(0, 5).equals(Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]));
  }
  if (contentType === "image/jpeg") {
    return file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff;
  }
  if (contentType === "image/png") {
    return file.length >= 8 && file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return false;
}

async function requireInternationalCaseAccess(caseId: string) {
  const row = await kycDb.rawQueryRow<{
    id: string;
    profile_id: string;
    provider: string;
    status: string;
  }>(
    "SELECT id, profile_id, provider, status FROM kyc_cases WHERE id = $1",
    caseId,
  );
  if (!row) throw APIError.notFound("KYC case not found");
  if (row.provider !== INTERNATIONAL_KYC_PROVIDER) {
    throw APIError.failedPrecondition("KYC case is not an international Kasihub case");
  }
  const session = await requireProfileAccess(row.profile_id);
  return { ...row, session };
}

/**
 * Uploads raw KYC evidence into the private Encore object bucket.
 *
 * Required headers:
 * - Content-Type: application/pdf | image/jpeg | image/png
 * - X-Filename: original file name
 * - X-Document-Type: policy document label (e.g. passport)
 *
 * Document-type allowlists are deliberately not hard-coded until the approved
 * KYC evidence matrix is supplied. The value is metadata, not an approval rule.
 */
export const uploadInternationalKycEvidence = api.raw(
  {
    expose: true,
    path: "/kyc/international/cases/:caseId/documents",
    method: "POST",
    bodyLimit: MAX_KYC_DOCUMENT_SIZE,
  },
  async (req, res) => {
    try {
      const caseId = caseIdFromUrl(req.url);
      if (!caseId) throw APIError.invalidArgument("KYC case id is required");
      const kycCase = await requireInternationalCaseAccess(caseId);
      if (kycCase.status !== "pending") {
        throw APIError.failedPrecondition("Evidence can only be uploaded to a pending KYC case");
      }

      const contentType = header(req, "content-type").split(";")[0].trim().toLowerCase();
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        throw APIError.invalidArgument("Only PDF, JPEG, and PNG KYC evidence is accepted");
      }
      const originalFilename = header(req, "x-filename").trim().slice(0, 255);
      const documentType = header(req, "x-document-type").trim().slice(0, 100);
      if (!originalFilename || !documentType) {
        throw APIError.invalidArgument("X-Filename and X-Document-Type headers are required");
      }

      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_KYC_DOCUMENT_SIZE) {
          res.writeHead(413, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "kyc_document_too_large", maxBytes: MAX_KYC_DOCUMENT_SIZE }));
          return;
        }
        chunks.push(buffer);
      }
      if (size === 0) throw APIError.invalidArgument("KYC document is empty");

      const fileBuffer = Buffer.concat(chunks);
      if (!hasExpectedFileSignature(contentType, fileBuffer)) {
        throw APIError.invalidArgument("KYC document content does not match its declared file type");
      }

      const sha256 = createHash("sha256").update(fileBuffer).digest("hex");
      const existing = await kycDb.rawQueryRow<{ id: string }>(
        "SELECT id FROM kyc_documents WHERE kyc_case_id = $1 AND sha256 = $2",
        caseId,
        sha256,
      );
      if (existing) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ id: existing.id, status: "uploaded", duplicate: true }));
        return;
      }

      const documentId = crypto.randomUUID();
      const storageKey = `kyc/international/${kycCase.profile_id}/${caseId}/${documentId}`;
      await documentsBucket.upload(storageKey, fileBuffer, { contentType });
      await kycDb.rawExec(
        `INSERT INTO kyc_documents
          (id, kyc_case_id, document_type, storage_url, storage_key, original_filename,
           content_type, size_bytes, sha256, status, uploaded_at)
         VALUES ($1, $2, $3, $4, $4, $5, $6, $7, $8, 'uploaded', now())`,
        documentId,
        caseId,
        documentType,
        storageKey,
        originalFilename,
        contentType,
        size,
        sha256,
      );
      await auditDb.rawExec(
        `INSERT INTO audit_logs (action, entity_type, entity_id, actor_user_id, after)
         VALUES ('kyc.document.upload', 'kyc_document', $1, $2, $3::jsonb)`,
        documentId,
        kycCase.session.user.id,
        JSON.stringify({ caseId, documentType, contentType, sizeBytes: size, sha256 }),
      );

      res.writeHead(201, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ id: documentId, status: "uploaded", duplicate: false }));
    } catch (error) {
      if (error instanceof APIError) {
        res.writeHead(error.httpStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "kyc_document_upload_failed" }));
    }
  },
);

export const listInternationalKycEvidence = api<
  { caseId: string },
  { documents: Array<{ id: string; documentType: string; filename: string; contentType: string; sizeBytes: number; status: string; uploadedAt: string; rejectionReason: string | null }> }
>(
  { method: "GET", path: "/kyc/international/cases/:caseId/documents", expose: true },
  async (req) => {
    await requireInternationalCaseAccess(req.caseId);
    const rows = await kycDb.rawQueryAll<{
      id: string; document_type: string; original_filename: string | null; content_type: string | null;
      size_bytes: number | null; status: string; uploaded_at: string; rejection_reason: string | null;
    }>(
      `SELECT id, document_type, original_filename, content_type, size_bytes, status, uploaded_at, rejection_reason
         FROM kyc_documents WHERE kyc_case_id = $1 ORDER BY uploaded_at DESC`,
      req.caseId,
    );
    return {
      documents: rows.map((row) => ({
        id: row.id,
        documentType: row.document_type,
        filename: row.original_filename ?? "document",
        contentType: row.content_type ?? "application/octet-stream",
        sizeBytes: Number(row.size_bytes ?? 0),
        status: row.status,
        uploadedAt: row.uploaded_at,
        rejectionReason: row.rejection_reason,
      })),
    };
  },
);

export const reviewInternationalKycEvidence = api<
  { documentId: string; action: "APPROVE" | "REJECT"; reason?: string },
  { documentId: string; status: "approved" | "rejected" }
>(
  { method: "POST", path: "/admin/kyc/international/documents/:documentId/review", expose: true },
  async (req) => {
    const session = await requireAdminAccess();
    const document = await kycDb.rawQueryRow<{ id: string; kyc_case_id: string }>(
      "SELECT id, kyc_case_id FROM kyc_documents WHERE id = $1",
      req.documentId,
    );
    if (!document) throw APIError.notFound("KYC document not found");
    const kycCase = await kycDb.rawQueryRow<{ provider: string }>(
      "SELECT provider FROM kyc_cases WHERE id = $1",
      document.kyc_case_id,
    );
    if (!kycCase || kycCase.provider !== INTERNATIONAL_KYC_PROVIDER) {
      throw APIError.failedPrecondition("Document does not belong to an international KYC case");
    }
    if (req.action === "REJECT" && !req.reason?.trim()) {
      throw APIError.invalidArgument("A rejection reason is required");
    }

    const status = req.action === "APPROVE" ? "approved" : "rejected";
    await kycDb.rawExec(
      `UPDATE kyc_documents
          SET status = $2, reviewed_at = now(), reviewer_user_id = $3, rejection_reason = $4
        WHERE id = $1`,
      req.documentId,
      status,
      session.user.id,
      status === "rejected" ? req.reason!.trim().slice(0, 1000) : null,
    );
    await auditDb.rawExec(
      `INSERT INTO audit_logs (action, entity_type, entity_id, actor_user_id, after)
       VALUES ($1, 'kyc_document', $2, $3, $4::jsonb)`,
      `kyc.document.${status}`,
      req.documentId,
      session.user.id,
      JSON.stringify({ caseId: document.kyc_case_id, status, reason: status === "rejected" ? req.reason : null }),
    );
    return { documentId: req.documentId, status };
  },
);

export const downloadInternationalKycEvidence = api.raw(
  { expose: true, path: "/admin/kyc/international/documents/:documentId/file", method: "GET" },
  async (req, res) => {
    try {
      await requireAdminAccess();
      const url = new URL(req.url ?? "/", "http://localhost");
      const parts = url.pathname.split("/").filter(Boolean);
      const documentId = parts[parts.indexOf("documents") + 1] ?? "";
      const document = await kycDb.rawQueryRow<{
        storage_key: string | null; storage_url: string; original_filename: string | null; content_type: string | null; size_bytes: number | null;
      }>(
        `SELECT d.storage_key, d.storage_url, d.original_filename, d.content_type, d.size_bytes
           FROM kyc_documents d JOIN kyc_cases c ON c.id = d.kyc_case_id
          WHERE d.id = $1 AND c.provider = $2`,
        documentId,
        INTERNATIONAL_KYC_PROVIDER,
      );
      if (!document) throw APIError.notFound("KYC document not found");
      const storageKey = document.storage_key ?? document.storage_url;
      const file = await documentsBucket.download(storageKey);
      res.writeHead(200, {
        "Content-Type": document.content_type ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${(document.original_filename ?? "kyc-document").replaceAll('"', '')}"`,
        ...(document.size_bytes ? { "Content-Length": document.size_bytes } : {}),
      });
      res.end(file);
    } catch (error) {
      if (error instanceof APIError) {
        res.writeHead(error.httpStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
        return;
      }
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "kyc_document_download_failed" }));
    }
  },
);
