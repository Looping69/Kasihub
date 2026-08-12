-- Author: Klaasvaakie ( |╲ )
-- A presale order is bound to an authenticated eligible profile and retains
-- the exact server-issued USD -> USDT quote used for settlement.
ALTER TABLE presale_campaigns
  ADD COLUMN price_usd NUMERIC(20, 6),
  ADD COLUMN usdt_per_usd NUMERIC(20, 6) NOT NULL DEFAULT 1,
  ADD COLUMN share_phase_number INT NOT NULL DEFAULT 1;

UPDATE presale_campaigns SET price_usd = price_usdt WHERE price_usd IS NULL;
ALTER TABLE presale_campaigns ALTER COLUMN price_usd SET NOT NULL;

ALTER TABLE presale_orders
  ADD COLUMN unit_price_usd NUMERIC(20, 6),
  ADD COLUMN total_usd NUMERIC(20, 6),
  ADD COLUMN usdt_per_usd NUMERIC(20, 6),
  ADD COLUMN quote_reference TEXT;

UPDATE presale_orders SET
  unit_price_usd = unit_price_usdt,
  total_usd = total_usdt,
  usdt_per_usd = 1,
  quote_reference = 'legacy-usdt-parity';

ALTER TABLE presale_orders
  ALTER COLUMN unit_price_usd SET NOT NULL,
  ALTER COLUMN total_usd SET NOT NULL,
  ALTER COLUMN usdt_per_usd SET NOT NULL,
  ALTER COLUMN quote_reference SET NOT NULL;

CREATE INDEX presale_orders_external_profile_idx ON presale_orders(external_profile_id, created_at DESC);
