-- Author: Klaasvaakie ( |╲ )
-- Durable transactional-email state belongs to the isolated presale domain.
CREATE TABLE presale_email_deliveries (
  id UUID PRIMARY KEY,
  external_profile_id TEXT NOT NULL,
  application_id UUID REFERENCES presale_applications(id),
  email_type TEXT NOT NULL CHECK (email_type IN ('account_created')),
  recipient_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  provider_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error_code TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (external_profile_id, email_type)
);

CREATE INDEX idx_presale_email_delivery_retry
  ON presale_email_deliveries (status, updated_at)
  WHERE status IN ('pending', 'failed');

-- The original private invitation remains recoverable only inside the
-- authenticated applicant portal. It is never placed in the welcome email.
ALTER TABLE presale_applications
  ADD COLUMN resume_token_ciphertext BYTEA,
  ADD COLUMN resume_token_nonce BYTEA,
  ADD COLUMN resume_token_auth_tag BYTEA,
  ADD COLUMN resume_token_key_version TEXT;
