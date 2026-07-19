-- Author: Klaasvaakie ( |╲ )
ALTER TABLE marketplace_orders ADD COLUMN operation_id UUID;
ALTER TABLE marketplace_orders ADD COLUMN currency TEXT NOT NULL DEFAULT 'ZAR';
ALTER TABLE roots_bank_shares ADD COLUMN operation_id UUID;

CREATE UNIQUE INDEX idx_marketplace_orders_operation
  ON marketplace_orders(operation_id) WHERE operation_id IS NOT NULL;
CREATE UNIQUE INDEX idx_roots_bank_shares_operation
  ON roots_bank_shares(operation_id) WHERE operation_id IS NOT NULL;
