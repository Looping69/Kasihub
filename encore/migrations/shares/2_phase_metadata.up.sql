-- Author: Klaasvaakie ( |╲ )
ALTER TABLE share_phases ADD COLUMN total_quantity INT;
ALTER TABLE share_phases ADD COLUMN bonus_buy_one_get BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE share_phases ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE share_phases ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE share_phases
SET total_quantity = quantity_available,
    bonus_buy_one_get = (phase_number = 1)
WHERE total_quantity IS NULL;

ALTER TABLE share_phases ALTER COLUMN total_quantity SET NOT NULL;
