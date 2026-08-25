-- Author: Klaasvaakie ( |╲ )
-- Account-created email uniqueness is profile-scoped; reservation confirmations are order-scoped.
ALTER TABLE presale_email_deliveries
  DROP CONSTRAINT IF EXISTS presale_email_deliveries_external_profile_id_email_type_key;

CREATE UNIQUE INDEX uq_presale_account_created_email_delivery
  ON presale_email_deliveries (external_profile_id, email_type)
  WHERE application_id IS NOT NULL AND order_id IS NULL;
