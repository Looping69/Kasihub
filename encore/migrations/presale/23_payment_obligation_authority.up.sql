-- Author: Klaasvaakie ( |\ )
-- Card and future hosted providers have an obligation without a chain intent.
-- Provider session identifiers no longer belong in the order invariant.

ALTER TABLE presale_orders DROP CONSTRAINT presale_payment_handoff_complete;
ALTER TABLE presale_orders ADD CONSTRAINT presale_payment_handoff_complete CHECK (
  payment_intent_id IS NULL
  OR (
    payment_obligation_id IS NOT NULL
    AND payment_network IS NOT NULL
    AND payment_receiving_address IS NOT NULL
    AND payment_token_contract IS NOT NULL
    AND payment_min_confirmations IS NOT NULL
  )
);
