-- Author: Klaasvaakie ( |╲ )
-- BOGO is display-only for draft mocks. Activation remains blocked until
-- paid-share and issued-share accounting is implemented end to end.
ALTER TABLE presale_campaigns
  ADD COLUMN bonus_buy_one_get_one BOOLEAN NOT NULL DEFAULT FALSE;
