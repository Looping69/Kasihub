-- Author: Klaasvaakie ( |╲ )
CREATE TABLE password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  provider_message_id TEXT,
  delivery_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (delivery_status IN ('pending', 'sent', 'failed')),
  last_error_code TEXT
);

CREATE INDEX password_reset_tokens_user_requested_idx
  ON password_reset_tokens (user_id, requested_at DESC);

CREATE INDEX password_reset_tokens_active_idx
  ON password_reset_tokens (token_hash, expires_at)
  WHERE used_at IS NULL;
