-- Author: Klaasvaakie ( |╲ )
-- One idempotent issuance authority and a durable completion event ledger.
CREATE TABLE share_issuance_operations (
  operation_id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_reference TEXT NOT NULL,
  request_payload_sha256 TEXT NOT NULL CHECK (request_payload_sha256 ~ '^[0-9a-f]{64}$'),
  purchase_id UUID NOT NULL REFERENCES share_purchases(id),
  certificate_id UUID NOT NULL REFERENCES share_certificates(id),
  completion_event_id UUID NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status = 'completed'),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, source_reference)
);

CREATE TABLE shares_outbox (
  id UUID PRIMARY KEY,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ
);

CREATE INDEX shares_outbox_unpublished_idx
  ON shares_outbox (created_at)
  WHERE published_at IS NULL;
