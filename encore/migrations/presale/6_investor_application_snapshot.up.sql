-- Author: Klaasvaakie ( |╲ )
-- The presale order retains the exact investor application facts and
-- declarations used for the reservation. Provider KYC remains a separate
-- authority and may prefill these facts, but never replaces this snapshot.
ALTER TABLE presale_orders
  ADD COLUMN investor_application JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN investor_application_ciphertext BYTEA,
  ADD COLUMN investor_application_nonce BYTEA,
  ADD COLUMN investor_application_auth_tag BYTEA,
  ADD COLUMN investor_application_version TEXT NOT NULL DEFAULT 'legacy',
  ADD COLUMN investor_application_accepted_at TIMESTAMPTZ;

COMMENT ON COLUMN presale_orders.investor_application IS
  'Minimal non-sensitive shareholder application summary. Never contains bank, tax, identity or document data.';

COMMENT ON COLUMN presale_orders.investor_application_ciphertext IS
  'AES-256-GCM encrypted versioned shareholder application snapshot.';
