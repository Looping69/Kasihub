-- Author: Klaasvaakie ( |╲ )
-- Test settlement amounts may exist on paused/draft campaigns only.
ALTER TABLE presale_campaigns ADD CONSTRAINT presale_active_campaign_has_real_pricing CHECK (
  status <> 'active' OR (
    webpay_test_unit_price_zar IS NULL AND webpay_test_orders_remaining = 0
    AND crypto_test_unit_price_usdt IS NULL AND crypto_test_orders_remaining = 0
  )
);
