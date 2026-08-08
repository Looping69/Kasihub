-- Author: Klaasvaakie ( |╲ )
-- Product domains create payment obligations. Public payment intent creation
-- references these rows and never accepts the amount as browser authority.

CREATE TABLE payment_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL,
  subject_reference TEXT NOT NULL,
  payer_profile_id UUID NOT NULL,
  beneficiary_profile_id UUID NOT NULL,
  settlement_currency TEXT NOT NULL,
  settlement_amount NUMERIC(20, 6) NOT NULL CHECK (settlement_amount > 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled', 'cancelled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  UNIQUE (subject_type, subject_reference),
  CHECK (settled_at IS NULL OR status = 'settled'),
  CHECK (cancelled_at IS NULL OR status = 'cancelled')
);

CREATE INDEX idx_payment_obligations_payer
  ON payment_obligations(payer_profile_id, status, created_at DESC);

-- Existing payment_intents.order_id is the canonical payment-obligation id.
-- The column name is retained for migration compatibility while the FK makes
-- the authority explicit.
ALTER TABLE payment_intents
  ADD CONSTRAINT fk_payment_intent_obligation
  FOREIGN KEY (order_id) REFERENCES payment_obligations(id);

-- Intent expiry is policy owned by the receiving configuration. Existing
-- active rows without a TTL are intentionally unusable until explicitly
-- configured; public creation fails closed if this value is NULL.
ALTER TABLE payment_wallets
  ADD COLUMN intent_ttl_seconds INTEGER CHECK (intent_ttl_seconds IS NULL OR intent_ttl_seconds BETWEEN 300 AND 86400);
