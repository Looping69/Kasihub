-- Author: Klaasvaakie ( |╲ )
ALTER TABLE subscriptions ADD COLUMN registration_id UUID;
ALTER TABLE subscriptions ADD COLUMN operation_id UUID;
CREATE UNIQUE INDEX idx_subscriptions_registration
  ON subscriptions(registration_id) WHERE registration_id IS NOT NULL;
CREATE UNIQUE INDEX idx_subscriptions_operation
  ON subscriptions(operation_id) WHERE operation_id IS NOT NULL;
