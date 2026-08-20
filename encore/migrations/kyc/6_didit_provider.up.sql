-- Author: Klaasvaakie ( |╲ )
-- Didit session identifiers are correlation data, never KYC evidence themselves.
ALTER TABLE kyc_cases
  ADD COLUMN didit_session_id UUID,
  ADD COLUMN didit_workflow_id UUID;

CREATE UNIQUE INDEX uq_kyc_cases_didit_session
  ON kyc_cases(didit_session_id)
  WHERE didit_session_id IS NOT NULL;

CREATE TABLE didit_webhook_events (
  event_id UUID PRIMARY KEY,
  kyc_case_id UUID REFERENCES kyc_cases(id),
  session_id UUID NOT NULL,
  webhook_type TEXT NOT NULL,
  provider_status TEXT NOT NULL,
  payload_sha256 TEXT NOT NULL CHECK (payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_didit_webhook_case_received
  ON didit_webhook_events(kyc_case_id, received_at DESC);
