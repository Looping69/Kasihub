-- Author: Klaasvaakie ( |╲ )
-- International KYC document evidence remains private in Encore object storage.
-- The database stores metadata and object keys only; no public URLs are created.

ALTER TABLE kyc_documents
  ADD COLUMN IF NOT EXISTS storage_key TEXT,
  ADD COLUMN IF NOT EXISTS original_filename TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT,
  ADD COLUMN IF NOT EXISTS size_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS sha256 TEXT,
  ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewer_user_id UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_kyc_documents_case_uploaded
  ON kyc_documents(kyc_case_id, uploaded_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_kyc_documents_case_sha256
  ON kyc_documents(kyc_case_id, sha256)
  WHERE sha256 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_kyc_cases_profile_provider_status
  ON kyc_cases(profile_id, provider, status, submitted_at DESC);
