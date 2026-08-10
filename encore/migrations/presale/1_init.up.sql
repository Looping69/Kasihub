-- Author: Klaasvaakie ( |╲ )
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE presale_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  issuer_name TEXT NOT NULL,
  share_class TEXT NOT NULL DEFAULT 'Class B',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
  total_shares INT NOT NULL CHECK (total_shares > 0),
  reserved_shares INT NOT NULL DEFAULT 0 CHECK (reserved_shares >= 0),
  sold_shares INT NOT NULL DEFAULT 0 CHECK (sold_shares >= 0),
  price_usdt NUMERIC(20, 6) NOT NULL CHECK (price_usdt > 0),
  network TEXT NOT NULL,
  token_contract TEXT,
  receiving_address TEXT NOT NULL,
  min_confirmations INT NOT NULL DEFAULT 20 CHECK (min_confirmations > 0),
  payment_window_minutes INT NOT NULL DEFAULT 30 CHECK (payment_window_minutes BETWEEN 5 AND 1440),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (reserved_shares + sold_shares <= total_shares)
);

CREATE TABLE presale_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES presale_campaigns(id),
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT,
  max_shares INT NOT NULL CHECK (max_shares > 0),
  used_shares INT NOT NULL DEFAULT 0 CHECK (used_shares >= 0),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'exhausted')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (used_shares <= max_shares)
);

CREATE TABLE presale_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_reference TEXT NOT NULL UNIQUE,
  campaign_id UUID NOT NULL REFERENCES presale_campaigns(id),
  invitation_id UUID NOT NULL REFERENCES presale_invitations(id),
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  buyer_phone TEXT,
  external_profile_id UUID,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price_usdt NUMERIC(20, 6) NOT NULL,
  total_usdt NUMERIC(20, 6) NOT NULL,
  status TEXT NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment', 'payment_submitted', 'payment_detected', 'confirmed', 'expired', 'cancelled', 'incorporated')),
  idempotency_key_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  access_token_hash TEXT NOT NULL,
  terms_version TEXT NOT NULL,
  terms_accepted_at TIMESTAMPTZ NOT NULL,
  payment_deadline TIMESTAMPTZ NOT NULL,
  confirmed_at TIMESTAMPTZ,
  incorporation_status TEXT NOT NULL DEFAULT 'pending' CHECK (incorporation_status IN ('pending', 'batched', 'incorporated')),
  incorporation_batch_id UUID,
  target_purchase_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX presale_orders_invitation_idempotency_idx ON presale_orders(invitation_id, idempotency_key_hash);

CREATE TABLE presale_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES presale_orders(id),
  network TEXT NOT NULL,
  tx_hash TEXT NOT NULL UNIQUE,
  sender_address TEXT,
  receiver_address TEXT NOT NULL,
  token_contract TEXT,
  amount_usdt NUMERIC(20, 6),
  confirmations INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'detected', 'confirmed', 'rejected')),
  provider TEXT,
  block_number TEXT,
  detected_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE presale_payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  tx_hash TEXT NOT NULL,
  payload JSONB NOT NULL,
  outcome TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE presale_incorporation_batches (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES presale_campaigns(id),
  status TEXT NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'applied', 'cancelled')),
  order_count INT NOT NULL,
  total_shares INT NOT NULL,
  total_usdt NUMERIC(20, 6) NOT NULL,
  manifest_hash TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ
);

CREATE INDEX presale_orders_campaign_status_idx ON presale_orders(campaign_id, status, created_at);
CREATE INDEX presale_orders_expiry_idx ON presale_orders(payment_deadline) WHERE status = 'awaiting_payment';
CREATE INDEX presale_payments_order_idx ON presale_payments(order_id, created_at DESC);
CREATE INDEX presale_invitations_campaign_idx ON presale_invitations(campaign_id, status);
