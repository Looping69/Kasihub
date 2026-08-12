-- Author: Klaasvaakie ( |╲ )
-- Draft mocks are deliberately not payment configurations.
ALTER TABLE presale_campaigns
  ADD COLUMN is_mock BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE presale_campaigns
  ALTER COLUMN receiving_address DROP NOT NULL;
