-- Author: Klaasvaakie ( |╲ )
-- Preserve signed WebPay process updates separately from authoritative payment
-- completion. Failed attempts remain retryable and never allocate shares.

ALTER TABLE presale_orders
  ADD COLUMN webpay_process_uuid UUID,
  ADD COLUMN webpay_process_stage TEXT,
  ADD COLUMN webpay_process_status TEXT
    CHECK (webpay_process_status IN ('payment_in_progress', 'COMPLETED', 'EXPIRED', 'FAILED', 'PENDING', 'REJECTED', 'REVERSED')),
  ADD COLUMN webpay_process_updated_at TIMESTAMPTZ;

CREATE INDEX presale_orders_webpay_process_uuid_idx
  ON presale_orders(webpay_process_uuid)
  WHERE webpay_process_uuid IS NOT NULL;
