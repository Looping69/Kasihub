-- Author: Klaasvaakie ( |╲ )

CREATE TABLE split_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_key TEXT NOT NULL,
  version INT NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'suspended', 'retired')),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  remainder_recipient_type TEXT NOT NULL,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  source_reference TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (policy_key, version),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to > effective_from)
);

CREATE TABLE split_policy_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID NOT NULL REFERENCES split_policies(id) ON DELETE RESTRICT,
  rule_order INT NOT NULL CHECK (rule_order >= 0),
  recipient_type TEXT NOT NULL,
  basis_points INT NOT NULL CHECK (basis_points >= 0 AND basis_points <= 10000),
  recipient_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (policy_id, rule_order),
  UNIQUE (policy_id, recipient_type)
);

CREATE TABLE settlement_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  settlement_ref TEXT NOT NULL,
  policy_id UUID NOT NULL REFERENCES split_policies(id) ON DELETE RESTRICT,
  policy_version INT NOT NULL CHECK (policy_version > 0),
  allocation_index INT NOT NULL CHECK (allocation_index >= 0),
  recipient_type TEXT NOT NULL,
  recipient_ref TEXT,
  currency TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
  basis_points INT NOT NULL DEFAULT 0 CHECK (basis_points >= 0 AND basis_points <= 10000),
  remainder_minor BIGINT NOT NULL DEFAULT 0 CHECK (remainder_minor >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (settlement_ref, allocation_index)
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
  entry_type TEXT NOT NULL CHECK (entry_type IN ('credit', 'reserve', 'release', 'debit', 'adjustment')),
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
CREATE INDEX idx_settlement_allocations_settlement
  ON settlement_allocations(settlement_ref, created_at);
CREATE INDEX idx_settlement_allocations_recipient
  ON settlement_allocations(recipient_type, recipient_ref, created_at DESC);
CREATE INDEX idx_payable_entries_account
  ON payable_entries(account_id, created_at, id);
CREATE INDEX idx_payable_entries_allocation
  ON payable_entries(allocation_id) WHERE allocation_id IS NOT NULL;
