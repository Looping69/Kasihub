-- Freeze reservation terms at creation. Historical rows use the best available
-- campaign baseline; this cannot reconstruct campaign edits made before rollout.
ALTER TABLE presale_orders
  ADD COLUMN bonus_buy_one_get_one_snapshot BOOLEAN,
  ADD COLUMN share_phase_number_snapshot INT,
  ADD COLUMN campaign_name_snapshot TEXT,
  ADD COLUMN issuer_name_snapshot TEXT,
  ADD COLUMN share_class_snapshot TEXT;

UPDATE presale_orders o SET
  bonus_buy_one_get_one_snapshot=c.bonus_buy_one_get_one,
  share_phase_number_snapshot=c.share_phase_number,
  campaign_name_snapshot=c.name,
  issuer_name_snapshot=c.issuer_name,
  share_class_snapshot=c.share_class
FROM presale_campaigns c WHERE c.id=o.campaign_id;

ALTER TABLE presale_orders
  ALTER COLUMN bonus_buy_one_get_one_snapshot SET NOT NULL,
  ALTER COLUMN share_phase_number_snapshot SET NOT NULL,
  ALTER COLUMN campaign_name_snapshot SET NOT NULL,
  ALTER COLUMN issuer_name_snapshot SET NOT NULL,
  ALTER COLUMN share_class_snapshot SET NOT NULL;

CREATE FUNCTION freeze_presale_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT c.bonus_buy_one_get_one,c.share_phase_number,c.name,c.issuer_name,c.share_class
    INTO NEW.bonus_buy_one_get_one_snapshot,NEW.share_phase_number_snapshot,
         NEW.campaign_name_snapshot,NEW.issuer_name_snapshot,NEW.share_class_snapshot
    FROM presale_campaigns c WHERE c.id=NEW.campaign_id FOR SHARE;
  ELSIF ROW(NEW.campaign_id,NEW.quantity,NEW.bonus_buy_one_get_one_snapshot,
            NEW.share_phase_number_snapshot,NEW.campaign_name_snapshot,
            NEW.issuer_name_snapshot,NEW.share_class_snapshot)
    IS DISTINCT FROM ROW(OLD.campaign_id,OLD.quantity,OLD.bonus_buy_one_get_one_snapshot,
            OLD.share_phase_number_snapshot,OLD.campaign_name_snapshot,
            OLD.issuer_name_snapshot,OLD.share_class_snapshot) THEN
    RAISE EXCEPTION 'presale_allocation_snapshot_is_immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER presale_allocation_snapshot
BEFORE INSERT OR UPDATE ON presale_orders
FOR EACH ROW EXECUTE FUNCTION freeze_presale_allocation();
