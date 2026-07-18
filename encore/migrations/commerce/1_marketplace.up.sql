-- Author: Klaasvaakie ( |╲ )
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE marketplace_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
  free_price NUMERIC(14, 2) NOT NULL CHECK (free_price >= 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  commission_pct NUMERIC(7, 4) NOT NULL DEFAULT 0 CHECK (commission_pct >= 0 AND commission_pct <= 100),
  image_color TEXT NOT NULL DEFAULT 'emerald',
  rating NUMERIC(3, 2) NOT NULL DEFAULT 4.5 CHECK (rating >= 0 AND rating <= 5),
  popular BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE marketplace_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES marketplace_products(id),
  product_name TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  pricing_tier TEXT NOT NULL CHECK (pricing_tier IN ('FREE', 'PAID')),
  commission NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (commission >= 0),
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_products_category ON marketplace_products(category);
CREATE INDEX idx_marketplace_orders_profile ON marketplace_orders(profile_id, created_at DESC);

INSERT INTO marketplace_products (name, description, category, provider, price, free_price, commission_pct, image_color, rating, popular)
VALUES
  ('Mobile Airtime', 'Prepaid mobile airtime for South African networks.', 'AIRTIME', 'KaSi Connect', 100, 110, 5, 'emerald', 4.8, true),
  ('Grocery Voucher', 'Digital grocery voucher accepted by participating stores.', 'GROCERIES', 'KaSi Market', 500, 525, 4, 'amber', 4.7, true),
  ('Electricity Token', 'Prepaid electricity token delivered digitally.', 'UTILITIES', 'KaSi Utilities', 250, 260, 3, 'teal', 4.6, false)
ON CONFLICT DO NOTHING;
