-- Author: Klaasvaakie ( |╲ )
-- Track reservation confirmations independently for every committed order.
ALTER TABLE presale_email_deliveries
  ADD COLUMN order_id UUID REFERENCES presale_orders(id);

ALTER TABLE presale_email_deliveries
  DROP CONSTRAINT presale_email_deliveries_email_type_check;

ALTER TABLE presale_email_deliveries
  ADD CONSTRAINT presale_email_deliveries_email_type_check
  CHECK (email_type IN ('account_created', 'reservation_created'));

CREATE UNIQUE INDEX uq_presale_reservation_email_delivery
  ON presale_email_deliveries (order_id, email_type)
  WHERE order_id IS NOT NULL;
