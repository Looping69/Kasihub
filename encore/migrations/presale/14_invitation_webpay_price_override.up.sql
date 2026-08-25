ALTER TABLE presale_invitations
  ADD COLUMN webpay_unit_price_zar_override numeric(12,2);

ALTER TABLE presale_invitations
  ADD CONSTRAINT presale_invitations_webpay_price_override_check
  CHECK (webpay_unit_price_zar_override IS NULL OR webpay_unit_price_zar_override > 0);
