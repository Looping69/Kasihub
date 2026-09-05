-- Coupon authorization is a non-cash grant. Existing campaigns default off.
CREATE TABLE presale_coupon_policies (
  campaign_id UUID PRIMARY KEY REFERENCES presale_campaigns(id),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  share_limit INT NOT NULL CHECK (share_limit >= 0),
  granted_shares INT NOT NULL DEFAULT 0 CHECK (granted_shares >= 0 AND granted_shares <= share_limit),
  updated_by UUID NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE presale_share_coupons (
  id UUID PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES presale_campaigns(id),
  code_hash TEXT NOT NULL UNIQUE,
  recipient_email TEXT NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','redeemed')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_by UUID,
  revoked_at TIMESTAMPTZ,
  redeemed_by UUID,
  redeemed_at TIMESTAMPTZ,
  redeemed_order_id UUID UNIQUE REFERENCES presale_orders(id),
  CHECK ((status = 'redeemed') = (redeemed_order_id IS NOT NULL))
);
CREATE TABLE presale_coupon_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES presale_campaigns(id),
  coupon_id UUID REFERENCES presale_share_coupons(id),
  actor_id UUID NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE presale_orders ADD COLUMN coupon_id UUID UNIQUE REFERENCES presale_share_coupons(id);
ALTER TABLE presale_orders DROP CONSTRAINT presale_orders_payment_rail_check;
ALTER TABLE presale_orders ADD CONSTRAINT presale_orders_payment_rail_check
  CHECK (payment_rail IN ('remitano_usdt','webpay_card','complimentary_coupon'));
ALTER TABLE presale_orders DROP CONSTRAINT presale_webpay_amount_complete;
ALTER TABLE presale_orders ADD CONSTRAINT presale_webpay_amount_complete CHECK (
  (payment_rail IN ('remitano_usdt','complimentary_coupon') AND unit_price_zar IS NULL AND total_zar IS NULL)
  OR (payment_rail='webpay_card' AND unit_price_zar > 0 AND total_zar > 0)
);
ALTER TABLE presale_orders ADD CONSTRAINT presale_coupon_terms CHECK (
  (payment_rail <> 'complimentary_coupon' AND coupon_id IS NULL)
  OR (payment_rail='complimentary_coupon' AND coupon_id IS NOT NULL
    AND unit_price_usdt=0 AND total_usdt=0 AND unit_price_usd=0 AND total_usd=0
    AND bonus_buy_one_get_one_snapshot=FALSE AND payment_obligation_id IS NULL AND payment_intent_id IS NULL)
);
CREATE OR REPLACE FUNCTION freeze_presale_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT CASE WHEN NEW.payment_rail='complimentary_coupon' THEN FALSE ELSE c.bonus_buy_one_get_one END,
      c.share_phase_number,c.name,c.issuer_name,c.share_class
    INTO NEW.bonus_buy_one_get_one_snapshot,NEW.share_phase_number_snapshot,
      NEW.campaign_name_snapshot,NEW.issuer_name_snapshot,NEW.share_class_snapshot
    FROM presale_campaigns c WHERE c.id=NEW.campaign_id FOR SHARE;
  ELSIF ROW(NEW.campaign_id,NEW.quantity,NEW.bonus_buy_one_get_one_snapshot,
    NEW.share_phase_number_snapshot,NEW.campaign_name_snapshot,NEW.issuer_name_snapshot,NEW.share_class_snapshot,NEW.coupon_id)
    IS DISTINCT FROM ROW(OLD.campaign_id,OLD.quantity,OLD.bonus_buy_one_get_one_snapshot,
    OLD.share_phase_number_snapshot,OLD.campaign_name_snapshot,OLD.issuer_name_snapshot,OLD.share_class_snapshot,OLD.coupon_id) THEN
    RAISE EXCEPTION 'presale_allocation_snapshot_is_immutable';
  END IF;
  RETURN NEW;
END;
$$;
