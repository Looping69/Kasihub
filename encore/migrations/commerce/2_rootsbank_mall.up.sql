-- Author: Klaasvaakie ( |╲ )
CREATE TABLE roots_bank_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('KIDS_STUDENT', 'ADULT', 'PENSIONER')),
  share_price NUMERIC(14, 2) NOT NULL CHECK (share_price >= 0),
  membership_fee NUMERIC(14, 2) NOT NULL CHECK (membership_fee >= 0),
  total_amount NUMERIC(14, 2) NOT NULL CHECK (total_amount >= 0),
  payment_ref TEXT NOT NULL UNIQUE,
  pioneer_pool BOOLEAN NOT NULL DEFAULT true,
  status TEXT NOT NULL DEFAULT 'REGISTERED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE mall_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID,
  nfc_tag_id TEXT NOT NULL,
  store_name TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  cost_of_sale NUMERIC(14, 2) NOT NULL CHECK (cost_of_sale >= 0),
  vat NUMERIC(14, 2) NOT NULL CHECK (vat >= 0),
  share_pool NUMERIC(14, 2) NOT NULL CHECK (share_pool >= 0),
  kasi_pool NUMERIC(14, 2) NOT NULL CHECK (kasi_pool >= 0),
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE silo_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  percentage NUMERIC(7, 4) NOT NULL CHECK (percentage >= 0 AND percentage <= 100),
  description TEXT,
  color TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mall_transactions_profile ON mall_transactions(profile_id, created_at DESC);
CREATE INDEX idx_mall_transactions_nfc ON mall_transactions(nfc_tag_id, created_at DESC);

CREATE OR REPLACE FUNCTION enforce_roots_bank_pioneer_cap() RETURNS trigger AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(20250701);
  IF (SELECT COUNT(*) FROM roots_bank_shares) >= 200 THEN
    RAISE EXCEPTION 'pioneer_cap_reached';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER roots_bank_pioneer_cap
BEFORE INSERT ON roots_bank_shares
FOR EACH ROW EXECUTE FUNCTION enforce_roots_bank_pioneer_cap();

INSERT INTO silo_config (name, percentage, description, color, sort_order)
VALUES
  ('Cost of Sale (Suppliers)', 65, 'Paid to suppliers for goods sold at KasiMall stores', 'oklch(0.55 0.08 50)', 1),
  ('VAT', 15, 'Value Added Tax remitted to SARS', 'oklch(0.65 0.18 145)', 2),
  ('KasiShare Pool', 10, 'Distributed daily to KasiShare holders', 'oklch(0.75 0.15 80)', 3),
  ('KasiPool', 10, 'Shared equally among eligible Hub members', 'oklch(0.52 0.13 158)', 4)
ON CONFLICT (name) DO NOTHING;
