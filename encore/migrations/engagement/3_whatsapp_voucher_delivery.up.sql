-- Author: Klaasvaakie ( |╲ )
CREATE TABLE whatsapp_contacts (
  profile_id UUID PRIMARY KEY,
  phone_e164 TEXT NOT NULL UNIQUE,
  verified_at TIMESTAMPTZ NOT NULL,
  active_vouchers_queued_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (phone_e164 ~ '^\\+[1-9][0-9]{7,14}$')
);

CREATE TABLE whatsapp_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  phone_e164 TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_outbox
  ADD COLUMN destination TEXT,
  ADD COLUMN dedupe_key TEXT,
  ADD COLUMN available_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX idx_notification_outbox_dedupe
  ON notification_outbox(dedupe_key)
  WHERE dedupe_key IS NOT NULL;
CREATE INDEX idx_whatsapp_verification_profile
  ON whatsapp_verification_codes(profile_id, created_at DESC);
CREATE INDEX idx_voucher_anniversary_delivery
  ON vouchers(anniversary_date, profile_id)
  WHERE status = 'ACTIVE' AND expiring_sent = false;
