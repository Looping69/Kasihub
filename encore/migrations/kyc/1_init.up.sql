-- Author: Klaasvaakie ( |╲ )
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE kyc_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_user_id UUID,
  result_payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE kyc_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kyc_case_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded'
);
