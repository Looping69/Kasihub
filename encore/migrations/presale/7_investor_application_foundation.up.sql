-- Author: Klaasvaakie ( |╲ )
-- Application review is deliberately separate from orders, settlement and incorporation.
CREATE TABLE presale_applications (
  id UUID PRIMARY KEY,
  application_number TEXT NOT NULL UNIQUE,
  external_profile_id TEXT NOT NULL,
  campaign_id UUID NOT NULL REFERENCES presale_campaigns(id),
  invitation_id UUID REFERENCES presale_invitations(id),
  applicant_type TEXT NOT NULL CHECK (applicant_type IN ('individual', 'company', 'trust')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft', 'submitted', 'compliance_review', 'information_required', 'resubmitted',
    'compliance_cleared', 'compliance_rejected', 'exco_review', 'exco_approved',
    'exco_rejected', 'accepted', 'withdrawn', 'expired', 'superseded'
  )),
  current_version INTEGER NOT NULL DEFAULT 0 CHECK (current_version >= 0),
  phase_completed SMALLINT NOT NULL DEFAULT 0 CHECK (phase_completed BETWEEN 0 AND 6),
  completion_percent SMALLINT NOT NULL DEFAULT 0 CHECK (completion_percent BETWEEN 0 AND 100),
  row_version BIGINT NOT NULL DEFAULT 1,
  submitted_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX presale_applications_active_owner_campaign_idx
  ON presale_applications (external_profile_id, campaign_id)
  WHERE status NOT IN ('withdrawn', 'expired', 'superseded', 'compliance_rejected', 'exco_rejected');

CREATE TABLE presale_application_versions (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES presale_applications(id),
  version INTEGER NOT NULL CHECK (version > 0),
  schema_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'submitted', 'locked', 'superseded')),
  public_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_ciphertext BYTEA NOT NULL,
  payload_nonce BYTEA NOT NULL,
  payload_auth_tag BYTEA NOT NULL,
  encryption_key_version TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  created_by_profile_id TEXT,
  created_by_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_at TIMESTAMPTZ,
  UNIQUE (application_id, version)
);

CREATE TABLE presale_application_declarations (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES presale_applications(id),
  application_version_id UUID NOT NULL REFERENCES presale_application_versions(id),
  declaration_code TEXT NOT NULL,
  wording_version TEXT NOT NULL,
  accepted BOOLEAN NOT NULL,
  accepted_at TIMESTAMPTZ,
  actor_profile_id TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (content_hash ~ '^[a-f0-9]{64}$'),
  safe_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (application_version_id, declaration_code)
);

CREATE TABLE presale_application_document_links (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES presale_applications(id),
  application_version_id UUID NOT NULL REFERENCES presale_application_versions(id),
  kyc_case_id TEXT NOT NULL,
  kyc_document_id TEXT,
  requirement_code TEXT NOT NULL,
  applicant_type TEXT NOT NULL CHECK (applicant_type IN ('individual', 'company', 'trust')),
  status TEXT NOT NULL CHECK (status IN ('required', 'uploaded', 'scanning', 'accepted', 'rejected', 'expired', 'waived')),
  reviewer_profile_id TEXT,
  reviewed_at TIMESTAMPTZ,
  reason_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE presale_application_reviews (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES presale_applications(id),
  application_version_id UUID NOT NULL REFERENCES presale_application_versions(id),
  review_type TEXT NOT NULL CHECK (review_type IN ('compliance', 'kyc', 'fica', 'suitability', 'tax', 'fraud', 'manual')),
  status TEXT NOT NULL,
  assigned_reviewer_profile_id TEXT,
  outcome_code TEXT,
  protected_notes_ciphertext BYTEA,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE presale_approval_decisions (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES presale_applications(id),
  application_version_id UUID NOT NULL REFERENCES presale_application_versions(id),
  capacity TEXT NOT NULL CHECK (capacity IN ('compliance', 'cfo', 'coo', 'ceo')),
  reviewer_user_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected', 'information_required', 'abstained')),
  reason_code TEXT NOT NULL,
  protected_comment_ciphertext BYTEA,
  policy_version TEXT NOT NULL,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX presale_approval_decisions_active_capacity_idx
  ON presale_approval_decisions (application_version_id, capacity)
  WHERE superseded_at IS NULL;

CREATE TABLE presale_information_requests (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES presale_applications(id),
  application_version_id UUID NOT NULL REFERENCES presale_application_versions(id),
  requester_profile_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'responded', 'closed', 'cancelled')),
  applicant_safe_message TEXT NOT NULL,
  requested_codes JSONB NOT NULL DEFAULT '[]'::jsonb,
  due_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  response_version_id UUID REFERENCES presale_application_versions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE presale_application_events (
  id UUID PRIMARY KEY,
  application_id UUID NOT NULL REFERENCES presale_applications(id),
  application_version_id UUID REFERENCES presale_application_versions(id),
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  correlation_id TEXT,
  safe_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE presale_orders
  ADD COLUMN application_id UUID REFERENCES presale_applications(id),
  ADD COLUMN application_version_id UUID REFERENCES presale_application_versions(id);

COMMENT ON COLUMN presale_application_versions.public_summary IS
  'Non-sensitive operational facts only. Names, identity, tax and bank values belong only in encrypted payloads.';
