ALTER TABLE share_certificates
  ADD COLUMN verification_id UUID,
  ADD COLUMN snapshot_version TEXT,
  ADD COLUMN holder_name_snapshot TEXT,
  ADD COLUMN holder_address_snapshot TEXT,
  ADD COLUMN profile_number_snapshot TEXT,
  ADD COLUMN issue_price_per_share_snapshot NUMERIC(18,6),
  ADD COLUMN issue_price_currency_snapshot TEXT,
  ADD COLUMN certificate_payload TEXT,
  ADD COLUMN certificate_payload_sha256 TEXT;

ALTER TABLE share_certificates
  ADD CONSTRAINT share_certificates_integrity_snapshot_complete CHECK (
    (verification_id IS NULL AND snapshot_version IS NULL AND holder_name_snapshot IS NULL
      AND holder_address_snapshot IS NULL AND profile_number_snapshot IS NULL
      AND issue_price_per_share_snapshot IS NULL AND issue_price_currency_snapshot IS NULL
      AND certificate_payload IS NULL AND certificate_payload_sha256 IS NULL)
    OR
    (verification_id IS NOT NULL AND snapshot_version IS NOT NULL AND holder_name_snapshot IS NOT NULL
      AND holder_address_snapshot IS NOT NULL AND profile_number_snapshot IS NOT NULL
      AND issue_price_per_share_snapshot IS NOT NULL AND issue_price_currency_snapshot IS NOT NULL
      AND certificate_payload IS NOT NULL AND certificate_payload_sha256 ~ '^[0-9a-f]{64}$')
  ),
  ADD CONSTRAINT share_certificates_snapshot_version_check CHECK (
    snapshot_version IS NULL OR snapshot_version = 'solidus-presale-v1'
  ),
  ADD CONSTRAINT share_certificates_snapshot_currency_check CHECK (
    issue_price_currency_snapshot IS NULL OR issue_price_currency_snapshot = 'USD'
  );

CREATE UNIQUE INDEX share_certificates_verification_id_unique
  ON share_certificates (verification_id) WHERE verification_id IS NOT NULL;
