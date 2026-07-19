-- Author: Klaasvaakie ( |╲ )
ALTER TABLE share_phases
  ADD CONSTRAINT share_phases_quantity_nonnegative CHECK (quantity_available >= 0);

ALTER TABLE share_purchases ADD COLUMN operation_id UUID;
ALTER TABLE share_purchases ADD COLUMN certificate_id UUID;

CREATE UNIQUE INDEX idx_share_purchases_operation
  ON share_purchases(operation_id) WHERE operation_id IS NOT NULL;
CREATE UNIQUE INDEX idx_share_purchases_certificate
  ON share_purchases(certificate_id) WHERE certificate_id IS NOT NULL;
