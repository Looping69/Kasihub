-- Author: Klaasvaakie ( |╲ )
CREATE TABLE financial_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_type TEXT NOT NULL,
  actor_user_id UUID,
  profile_id UUID,
  idempotency_key_hash TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'processing', 'completed', 'compensating', 'failed')),
  result JSONB,
  last_error TEXT,
  retry_count INT NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (operation_type, idempotency_key_hash)
);

CREATE TABLE financial_operation_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES financial_operations(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'pending'
    CHECK (state IN ('pending', 'processing', 'completed', 'compensating', 'failed')),
  attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (operation_id, step_name)
);

CREATE TABLE wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  currency TEXT NOT NULL,
  available_balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (available_balance >= 0),
  held_balance NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (held_balance >= 0),
  status TEXT NOT NULL DEFAULT 'active',
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, currency)
);

CREATE TABLE wallet_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES financial_operations(id),
  profile_id UUID NOT NULL,
  currency TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  state TEXT NOT NULL DEFAULT 'held' CHECK (state IN ('held', 'captured', 'released')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (operation_id)
);

CREATE TABLE reconciliation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'processing' CHECK (state IN ('processing', 'completed', 'failed')),
  checked_count INT NOT NULL DEFAULT 0,
  finding_count INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE TABLE reconciliation_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES reconciliation_runs(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  expected JSONB,
  actual JSONB,
  state TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'resolved', 'ignored')),
  resolution TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (run_id, finding_type, entity_type, entity_id)
);

CREATE TABLE distribution_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES financial_operations(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount >= 0),
  weight NUMERIC(18, 4) NOT NULL DEFAULT 1 CHECK (weight >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (operation_id, profile_id)
);

CREATE INDEX idx_financial_operations_state ON financial_operations(state, updated_at);
CREATE INDEX idx_financial_operations_profile ON financial_operations(profile_id, created_at DESC);
CREATE INDEX idx_operation_steps_state ON financial_operation_steps(state, updated_at);
CREATE INDEX idx_wallet_holds_profile ON wallet_holds(profile_id, state);
CREATE INDEX idx_reconciliation_findings_state ON reconciliation_findings(state, severity);

ALTER TABLE pool_distributions ADD COLUMN operation_id UUID;
CREATE UNIQUE INDEX idx_pool_distributions_operation_profile
  ON pool_distributions(operation_id, profile_id) WHERE operation_id IS NOT NULL;

ALTER TABLE dividend_declarations ADD COLUMN operation_id UUID;
CREATE UNIQUE INDEX idx_dividend_declarations_operation
  ON dividend_declarations(operation_id) WHERE operation_id IS NOT NULL;
