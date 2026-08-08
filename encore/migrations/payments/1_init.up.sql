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
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_payment_wallet_active_network_currency
  ON payment_wallets(network, currency)
  WHERE status = 'active';

CREATE TABLE payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE,
  payer_profile_id UUID NOT NULL,
  beneficiary_profile_id UUID NOT NULL,
  wallet_id UUID NOT NULL REFERENCES payment_wallets(id),
  rail TEXT NOT NULL CHECK (rail IN ('usdt')),
  currency TEXT NOT NULL,
  network TEXT NOT NULL,
  expected_amount NUMERIC(20, 6) NOT NULL CHECK (expected_amount > 0),
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_intents_payer ON payment_intents(payer_profile_id, created_at DESC);
CREATE INDEX idx_payment_intents_status ON payment_intents(status, updated_at);

CREATE TABLE payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  transaction_hash TEXT NOT NULL,
  submitted_sender_wallet TEXT,
  chain_sender_wallet TEXT,
  chain_receiver_wallet TEXT,
  chain_amount NUMERIC(20, 6),
  block_number BIGINT,
  confirmations INTEGER,
  verification_status TEXT NOT NULL DEFAULT 'submitted',
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
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_payment_events_unprocessed
  ON payment_events(created_at)
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
