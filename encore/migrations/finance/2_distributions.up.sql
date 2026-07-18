-- Author: Klaasvaakie ( |╲ )
CREATE TABLE dividend_declarations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  total_shares INT NOT NULL CHECK (total_shares > 0),
  per_share_amount NUMERIC(18, 4) NOT NULL CHECK (per_share_amount > 0),
  status TEXT NOT NULL DEFAULT 'processing',
  declared_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE pool_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  source TEXT NOT NULL,
  pool_type TEXT NOT NULL DEFAULT 'SHAREHOLDERS',
  status TEXT NOT NULL DEFAULT 'pending',
  payout_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (batch_id, profile_id)
);

CREATE INDEX idx_pool_distributions_profile ON pool_distributions(profile_id, payout_date DESC);
