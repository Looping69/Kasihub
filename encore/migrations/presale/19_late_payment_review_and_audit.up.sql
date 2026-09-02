-- Author: Klaasvaakie ( |╲ )
-- Late money is evidence, not authority to revive expired inventory.
ALTER TABLE presale_orders DROP CONSTRAINT presale_orders_status_check;
ALTER TABLE presale_orders ADD CONSTRAINT presale_orders_status_check CHECK (status IN (
  'awaiting_payment', 'payment_submitted', 'payment_detected', 'manual_review',
  'confirmed', 'expired', 'cancelled', 'incorporated'
));

CREATE TABLE presale_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES presale_orders(id),
  event_type TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_reference TEXT,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX presale_audit_events_order_idx
  ON presale_audit_events(order_id, created_at);
