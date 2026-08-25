-- Author: Klaasvaakie ( |╲ )
-- Freeze the buyer-selected payment rail and its commercial amount on the
-- reservation. Legacy orders remain on the existing Remitano/USDT rail.

ALTER TABLE presale_orders
  ADD COLUMN payment_rail TEXT NOT NULL DEFAULT 'remitano_usdt'
    CHECK (payment_rail IN ('remitano_usdt', 'webpay_card')),
  ADD COLUMN unit_price_zar NUMERIC(20, 2),
  ADD COLUMN total_zar NUMERIC(20, 2),
  ADD COLUMN webpay_transaction_id UUID,
  ADD COLUMN webpay_order_number TEXT,
  ADD COLUMN webpay_request_token_id TEXT,
  ADD COLUMN webpay_system_reference TEXT,
  ADD COLUMN webpay_payment_method TEXT;

ALTER TABLE presale_orders
  ADD CONSTRAINT presale_webpay_amount_complete CHECK (
    (payment_rail = 'remitano_usdt' AND unit_price_zar IS NULL AND total_zar IS NULL)
    OR
    (payment_rail = 'webpay_card' AND unit_price_zar > 0 AND total_zar > 0)
  );

CREATE UNIQUE INDEX presale_orders_webpay_transaction_idx
  ON presale_orders(webpay_transaction_id)
  WHERE webpay_transaction_id IS NOT NULL;

CREATE UNIQUE INDEX presale_orders_webpay_order_number_idx
  ON presale_orders(webpay_order_number)
  WHERE webpay_order_number IS NOT NULL;
