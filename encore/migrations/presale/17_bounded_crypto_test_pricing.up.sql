-- Author: Klaasvaakie ( |╲ )
-- Production-safe, self-expiring crypto test settlement pricing. The legal
-- campaign/share price remains unchanged; only the locked USDT payment amount
-- is discounted for a bounded number of reservations.
ALTER TABLE presale_campaigns
  ADD COLUMN crypto_test_unit_price_usdt numeric(20,6),
  ADD COLUMN crypto_test_orders_remaining integer NOT NULL DEFAULT 0;

ALTER TABLE presale_campaigns
  ADD CONSTRAINT presale_campaigns_crypto_test_price_check
  CHECK (
    (crypto_test_unit_price_usdt IS NULL AND crypto_test_orders_remaining = 0)
    OR
    (crypto_test_unit_price_usdt > 0 AND crypto_test_orders_remaining >= 0)
  );

ALTER TABLE presale_orders
  ADD COLUMN crypto_test_price_applied boolean NOT NULL DEFAULT false;
