-- Author: Klaasvaakie ( |╲ )
-- A singleton record makes first-admin bootstrap auditable and irreversible.

CREATE TABLE admin_bootstrap_events (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

