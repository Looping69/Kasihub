-- Author: Klaasvaakie ( |╲ )
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_profile_id UUID NOT NULL,
  referred_profile_id UUID,
  referral_code TEXT NOT NULL UNIQUE,
  referred_name TEXT NOT NULL,
  referred_email TEXT NOT NULL,
  referred_mobile TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reward_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ
);

CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  provider TEXT NOT NULL,
  value NUMERIC(14, 2) NOT NULL CHECK (value >= 0),
  category TEXT NOT NULL DEFAULT 'GENERAL',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  expiry_date TIMESTAMPTZ NOT NULL,
  anniversary_date TIMESTAMPTZ,
  wablast_sent BOOLEAN NOT NULL DEFAULT false,
  expiring_sent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notification_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  channel TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_profile_id, created_at DESC);
CREATE INDEX idx_vouchers_profile ON vouchers(profile_id, expiry_date);
CREATE INDEX idx_notification_outbox_status ON notification_outbox(status, created_at);
