-- Author: Klaasvaakie ( |╲ )
-- Presale owns commercial reservation and fulfilment. The payment domain owns
-- receiving policy, chain evidence, confirmation and settlement.

ALTER TABLE presale_orders
  ADD COLUMN payment_obligation_id UUID,
  ADD COLUMN payment_intent_id UUID,
  ADD COLUMN payment_network TEXT,
  ADD COLUMN payment_receiving_address TEXT,
  ADD COLUMN payment_token_contract TEXT,
  ADD COLUMN payment_min_confirmations INT,
  ADD COLUMN payment_transaction_hash TEXT,
  ADD COLUMN payment_confirmations INT,
  ADD COLUMN payment_settled_at TIMESTAMPTZ;

CREATE UNIQUE INDEX presale_orders_payment_obligation_idx
  ON presale_orders(payment_obligation_id)
  WHERE payment_obligation_id IS NOT NULL;

CREATE UNIQUE INDEX presale_orders_payment_intent_idx
  ON presale_orders(payment_intent_id)
  WHERE payment_intent_id IS NOT NULL;

ALTER TABLE presale_orders
  ADD CONSTRAINT presale_payment_handoff_complete CHECK (
    (payment_intent_id IS NULL AND payment_obligation_id IS NULL)
    OR
    (payment_intent_id IS NOT NULL
      AND payment_obligation_id IS NOT NULL
      AND payment_network IS NOT NULL
      AND payment_receiving_address IS NOT NULL
      AND payment_token_contract IS NOT NULL
      AND payment_min_confirmations IS NOT NULL)
  );

COMMENT ON TABLE presale_payments IS
  'Legacy compatibility only. New payment evidence is authoritative in payments.payment_attempts.';
