-- Author: Klaasvaakie ( |â•² )
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE share_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_number INT NOT NULL UNIQUE,
  quantity_available INT NOT NULL,
  price_per_share NUMERIC(14, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ
);

CREATE TABLE share_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  phase_id UUID NOT NULL,
  quantity INT NOT NULL,
  bonus_quantity INT NOT NULL DEFAULT 0,
  total_amount NUMERIC(14, 2) NOT NULL,
  status TEXT NOT NULL,
  payment_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE share_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  total_shares INT NOT NULL,
  status TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  file_url TEXT
);

INSERT INTO share_phases (phase_number, quantity_available, price_per_share, currency, status, starts_at)
VALUES (1, 100000, 25.00, 'USD', 'active', now());

