-- Author: Klaasvaakie ( |╲ )
-- Test settlement amounts may exist on paused/draft campaigns only.
-- Normalize legacy active rows before enforcing the production invariant. Existing
-- orders retain their snapshotted settlement price; this only closes future test slots.
UPDATE presale_campaigns
SET webpay_test_unit_price_zar = NULL,
    webpay_test_orders_remaining = 0,
    crypto_test_unit_price_usdt = NULL,
    crypto_test_orders_remaining = 0
WHERE status = 'active'
  AND (
    webpay_test_unit_price_zar IS NOT NULL OR webpay_test_orders_remaining <> 0
    OR crypto_test_unit_price_usdt IS NOT NULL OR crypto_test_orders_remaining <> 0
  );

ALTER TABLE presale_campaigns ADD CONSTRAINT presale_active_campaign_has_real_pricing CHECK (
  status <> 'active' OR (
    webpay_test_unit_price_zar IS NULL AND webpay_test_orders_remaining = 0
    AND crypto_test_unit_price_usdt IS NULL AND crypto_test_orders_remaining = 0
  )
);
