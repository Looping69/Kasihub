-- Author: Klaasvaakie ( |╲ )
-- Emergency administrative allocation authority. This does not rewrite or
-- manufacture payment-provider evidence; it records the explicit human
-- decision that allowed an otherwise submitted reservation to proceed.
CREATE TABLE presale_allocation_overrides (
  id UUID PRIMARY KEY,
  order_id UUID NOT NULL UNIQUE REFERENCES presale_orders(id),
  order_reference TEXT NOT NULL UNIQUE,
  actor_user_id UUID NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 20 AND 1000),
  evidence_reference TEXT NOT NULL CHECK (char_length(evidence_reference) BETWEEN 8 AND 240),
  previous_order_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX presale_allocation_overrides_actor_idx
  ON presale_allocation_overrides (actor_user_id, created_at DESC);
