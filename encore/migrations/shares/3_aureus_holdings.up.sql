-- Author: Klaasvaakie ( |╲ )
CREATE TABLE aureus_share_holdings (
  id UUID PRIMARY KEY,
  profile_id UUID NOT NULL,
  phase_number INT NOT NULL,
  price_per_share NUMERIC(14, 2) NOT NULL,
  quantity INT NOT NULL,
  total_amount NUMERIC(14, 2) NOT NULL,
  certificate_number TEXT NOT NULL UNIQUE,
  previous_certificate_number TEXT,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);
