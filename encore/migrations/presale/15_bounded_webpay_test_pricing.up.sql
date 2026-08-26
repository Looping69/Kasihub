-- Author: Klaasvaakie ( |╲ )
-- Production-safe, self-expiring card test pricing. Configuration is applied
-- explicitly per campaign after deployment; normal and crypto pricing remain unchanged.
ALTER TABLE presale_campaigns
  ADD COLUMN webpay_test_unit_price_zar numeric(12,2),
  ADD COLUMN webpay_test_orders_remaining integer NOT NULL DEFAULT 0;

ALTER TABLE presale_campaigns
  ADD CONSTRAINT presale_campaigns_webpay_test_price_check
  CHECK (
    (webpay_test_unit_price_zar IS NULL AND webpay_test_orders_remaining = 0)
    OR
    (webpay_test_unit_price_zar > 0 AND webpay_test_orders_remaining >= 0)
  );

ALTER TABLE presale_orders
  ADD COLUMN webpay_test_price_applied boolean NOT NULL DEFAULT false;
