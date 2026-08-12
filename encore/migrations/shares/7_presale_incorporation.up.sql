-- Author: Klaasvaakie ( |╲ )
-- Makes presale incorporation idempotent in the live certificate ledger.
ALTER TABLE share_certificates
  ADD COLUMN presale_order_reference TEXT UNIQUE,
  ADD COLUMN source TEXT NOT NULL DEFAULT 'wallet';

ALTER TABLE share_purchases
  ADD COLUMN presale_order_reference TEXT UNIQUE,
  ADD COLUMN source TEXT NOT NULL DEFAULT 'wallet';
