-- Author: Klaasvaakie ( |\ )
-- An obligation is durable financial authority. Provider sessions are disposable,
-- credits are additive evidence, and only an exact settlement emits fulfilment work.

ALTER TABLE payment_obligations DROP CONSTRAINT payment_obligations_status_check;
ALTER TABLE payment_obligations DROP CONSTRAINT payment_obligations_check;
UPDATE payment_obligations SET status = 'paid' WHERE status = 'settled';
ALTER TABLE payment_obligations ADD CONSTRAINT payment_obligations_status_check
  CHECK (status IN ('open', 'partially_paid', 'paid', 'review_required', 'cancelled'));
ALTER TABLE payment_obligations ADD CONSTRAINT payment_obligations_settled_at_check
  CHECK (settled_at IS NULL OR status = 'paid');

CREATE TABLE payment_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL REFERENCES payment_obligations(id),
  provider TEXT NOT NULL CHECK (provider IN (
    'instapay_webpay_form',
    'instapay_payment_request',
    'remitano_gateway',
    'remitano_direct_usdt'
  )),
  provider_session_id TEXT NOT NULL,
  provider_reference TEXT,
  provider_payment_url TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'created', 'open', 'completed', 'failed', 'expired', 'cancelled'
  )),
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_session_id)
);

CREATE INDEX idx_payment_sessions_obligation
  ON payment_sessions(obligation_id, created_at DESC);
CREATE INDEX idx_payment_sessions_provider_reference
  ON payment_sessions(provider, provider_reference)
  WHERE provider_reference IS NOT NULL;

CREATE TABLE payment_provider_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  payment_session_id UUID REFERENCES payment_sessions(id),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'verified', 'rejected', 'processed')),
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE payment_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL REFERENCES payment_obligations(id),
  payment_session_id UUID REFERENCES payment_sessions(id),
  provider TEXT NOT NULL,
  provider_reference TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('confirmed', 'reversed', 'disputed')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_reference, asset)
);

CREATE INDEX idx_payment_credits_obligation
  ON payment_credits(obligation_id, status, created_at);

CREATE TABLE payment_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligation_id UUID NOT NULL UNIQUE REFERENCES payment_obligations(id),
  currency TEXT NOT NULL,
  amount NUMERIC(20, 6) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('settled', 'reversed', 'disputed')),
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_until TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_outbox_pending
  ON payment_outbox(available_at, created_at)
  WHERE status IN ('pending', 'processing');
