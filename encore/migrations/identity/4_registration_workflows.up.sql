-- Author: Klaasvaakie ( |╲ )
CREATE TABLE registration_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  user_id UUID,
  profile_id UUID,
  membership_plan_code TEXT NOT NULL,
  create_kyc BOOLEAN NOT NULL DEFAULT false,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'identity_created', 'membership_pending', 'kyc_pending', 'completed', 'failed')),
  last_error TEXT,
  retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (email)
);

CREATE INDEX idx_registration_workflows_state ON registration_workflows(state, updated_at);
