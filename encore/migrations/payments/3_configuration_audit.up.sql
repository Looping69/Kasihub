-- Author: Klaasvaakie ( |╲ )
-- Critical payment configuration changes need an audit record in the same
-- database transaction as the configuration mutation. The global audit DB is a
-- secondary mirror because cross-database commits cannot be atomic.

CREATE TABLE payment_configuration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  configuration_id UUID NOT NULL REFERENCES payment_wallets(id),
  actor_user_id UUID NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payment_configuration_events_config
  ON payment_configuration_events(configuration_id, created_at DESC);
