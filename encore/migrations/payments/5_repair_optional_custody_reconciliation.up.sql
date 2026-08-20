-- Author: Klaasvaakie ( |╲ )
-- Repair environments where migration 4 was present in the deployment tree
-- but was not registered or applied. Every operation is idempotent so this is
-- also safe on environments where the original migration completed.

ALTER TABLE payment_wallets
  ADD COLUMN IF NOT EXISTS custody_reconciliation_required BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS payment_custody_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_attempt_id UUID NOT NULL REFERENCES payment_attempts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  transaction_hash TEXT NOT NULL,
  receiver_address TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('confirmed', 'pending', 'mismatch', 'reversed')),
  evidence_digest TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_reference, evidence_digest)
);

CREATE INDEX IF NOT EXISTS idx_payment_custody_evidence_attempt
  ON payment_custody_evidence(payment_attempt_id, created_at DESC);
