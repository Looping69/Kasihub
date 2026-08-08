-- Author: Klaasvaakie ( |╲ )
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE payment_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  network TEXT NOT NULL,
  currency TEXT NOT NULL,
  address_reference TEXT NOT NULL,
  token_contract TEXT NOT NULL,
  decimals INTEGER NOT NULL CHECK (decimals >= 0),
  minimum_confirmations INTEGER NOT NULL CHECK (minimum_confirmations >= 0),
  active_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  retired_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('active', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((status = 'active' AND retired_at IS NULL) OR status = 'retired')
);

CREATE UNIQUE INDEX uq_payment_wallet_active_network_currency
  ON payment_wallets(network, currency)
  WHERE status = 'active';

CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  payer_profile_id UUID NOT NULL,
  beneficiary_profile_id UUID NOT NULL,
  wallet_id UUID NOT NULL REFERENCES payment_wallets(id),
  rail TEXT NOT NULL CHECK (rail IN ('usdt')),
  currency TEXT NOT NULL,
  network TEXT NOT NULL,
  expected_amount NUMERIC(20, 6) NOT NULL CHECK (expected_amount > 0),
  idempotency_key_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'created',
    'awaiting_transfer',
    'submitted',
    'verifying',
    'pending_confirmations',
    'underpaid',
    'manual_review',
    'confirmed',
    'settling',
    'settled',
    'expired',
    'failed',
    'rejected',
    'cancelled'
  )),
  expires_at TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (expires_at > created_at),
  CHECK (confirmed_at IS NULL OR status IN ('confirmed', 'settling', 'settled')),
  CHECK (settled_at IS NULL OR status = 'settled')
);

-- A failed/expired/rejected/cancelled attempt may be replaced for the same order.
-- Once an intent is live, confirmed, settling or settled, no competing intent may exist.
CREATE UNIQUE INDEX uq_payment_intent_live_order
  ON payment_intents(order_id)
  WHERE status NOT IN ('expired', 'failed', 'rejected', 'cancelled');

CREATE UNIQUE INDEX uq_payment_intent_idempotency
  ON payment_intents(payer_profile_id, idempotency_key_hash);

CREATE INDEX idx_payment_intents_payer ON payment_intents(payer_profile_id, created_at DESC);
CREATE INDEX idx_payment_intents_status ON payment_intents(status, updated_at);

CREATE TABLE payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  transaction_hash TEXT NOT NULL,
  submitted_sender_wallet TEXT,
  chain_sender_wallet TEXT,
  chain_receiver_wallet TEXT,
  chain_amount NUMERIC(20, 6) CHECK (chain_amount IS NULL OR chain_amount >= 0),
  block_number BIGINT CHECK (block_number IS NULL OR block_number >= 0),
  confirmations INTEGER CHECK (confirmations IS NULL OR confirmations >= 0),
  verification_status TEXT NOT NULL DEFAULT 'submitted' CHECK (verification_status IN (
    'submitted',
    'verifying',
    'pending_confirmations',
    'underpaid',
    'manual_review',
    'confirmed',
    'failed',
    'rejected'
  )),
  verification_error_code TEXT,
  verification_error_detail TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_payment_attempt_transaction_hash
  ON payment_attempts(lower(transaction_hash));
CREATE INDEX idx_payment_attempt_intent ON payment_attempts(payment_intent_id, created_at DESC);

CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_error TEXT
);

CREATE INDEX idx_payment_events_unprocessed
  ON payment_events(available_at, created_at)
  WHERE processed_at IS NULL;

CREATE TABLE payment_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  prior_status TEXT,
  new_status TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_reference TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_state_history_intent
  ON payment_state_history(payment_intent_id, created_at);
