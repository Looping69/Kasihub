-- Author: Klaasvaakie ( |╲ )

CREATE TABLE split_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL,
  version INT NOT NULL CHECK (version > 0),
  policy_kind TEXT NOT NULL CHECK (policy_kind IN ('percentage', 'fixed')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'active', 'suspended', 'retired')),
  currency TEXT NOT NULL,
  minor_unit_scale SMALLINT NOT NULL CHECK (minor_unit_scale >= 0 AND minor_unit_scale <= 18),
  expected_total_minor BIGINT CHECK (expected_total_minor IS NULL OR expected_total_minor >= 0),
  remainder_rule_code TEXT,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  source_reference TEXT,
  source_revision TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (policy_key, version),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from),
  CHECK (
    (policy_kind = 'percentage' AND expected_total_minor IS NULL AND remainder_rule_code IS NOT NULL)
    OR
    (policy_kind = 'fixed' AND expected_total_minor IS NOT NULL AND remainder_rule_code IS NULL)
  )
);

CREATE TABLE split_policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES split_policies(id) ON DELETE RESTRICT,
  rule_order INT NOT NULL CHECK (rule_order >= 0),
  rule_code TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_mode TEXT NOT NULL CHECK (recipient_mode IN ('system', 'dynamic')),
  basis_points INT CHECK (basis_points IS NULL OR (basis_points >= 0 AND basis_points <= 10000)),
  fixed_amount_minor BIGINT CHECK (fixed_amount_minor IS NULL OR fixed_amount_minor >= 0),
  fallback_recipient_type TEXT,
  recipient_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (policy_id, rule_order),
  UNIQUE (policy_id, rule_code),
  CHECK ((basis_points IS NOT NULL)::int + (fixed_amount_minor IS NOT NULL)::int = 1)
);

CREATE TABLE settlement_allocation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_ref TEXT NOT NULL UNIQUE,
  policy_id UUID NOT NULL REFERENCES split_policies(id) ON DELETE RESTRICT,
  source_amount_minor BIGINT NOT NULL CHECK (source_amount_minor >= 0),
  currency TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'applied' CHECK (state IN ('applied', 'reversed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_at TIMESTAMPTZ
);

CREATE TABLE settlement_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  allocation_run_id UUID NOT NULL REFERENCES settlement_allocation_runs(id) ON DELETE RESTRICT,
  rule_code TEXT NOT NULL,
  recipient_type TEXT NOT NULL,
  recipient_ref TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  basis_points INT NOT NULL DEFAULT 0 CHECK (basis_points >= 0 AND basis_points <= 10000),
  remainder_minor BIGINT NOT NULL DEFAULT 0 CHECK (remainder_minor >= 0),
  fallback_applied BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (allocation_run_id, rule_code)
);

CREATE TABLE payable_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_ref TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'held', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_type, owner_ref, currency)
);

CREATE TABLE payable_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES payable_accounts(id) ON DELETE RESTRICT,
  allocation_id UUID REFERENCES settlement_allocations(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'reserve', 'release', 'debit', 'adjustment', 'reversal')),
  amount_minor BIGINT NOT NULL CHECK (amount_minor > 0),
  direction SMALLINT NOT NULL CHECK (direction IN (-1, 1)),
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_id, idempotency_key)
);

CREATE INDEX idx_split_policies_lookup
  ON split_policies(policy_key, status, effective_from DESC NULLS LAST);
CREATE UNIQUE INDEX idx_split_policies_one_active
  ON split_policies(policy_key) WHERE status = 'active';
CREATE INDEX idx_split_policy_rules_policy
  ON split_policy_rules(policy_id, rule_order);
CREATE INDEX idx_settlement_allocations_run
  ON settlement_allocations(allocation_run_id, created_at);
CREATE INDEX idx_settlement_allocations_recipient
  ON settlement_allocations(recipient_type, recipient_ref, created_at DESC);
CREATE INDEX idx_payable_entries_account
  ON payable_entries(account_id, created_at, id);
CREATE INDEX idx_payable_entries_allocation
  ON payable_entries(allocation_id) WHERE allocation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION reject_immutable_finance_row_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; create a compensating/reversal record instead', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_settlement_allocations_immutable
BEFORE UPDATE OR DELETE ON settlement_allocations
FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_row_mutation();

CREATE TRIGGER trg_payable_entries_immutable
BEFORE UPDATE OR DELETE ON payable_entries
FOR EACH ROW EXECUTE FUNCTION reject_immutable_finance_row_mutation();
