-- Author: Klaasvaakie ( |╲ )
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL,
  owner_id UUID NOT NULL,
  account_code TEXT NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
);

CREATE TABLE ledger_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type TEXT NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  description TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reversed_by_transaction_id UUID
);

CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES ledger_accounts(id),
  direction TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL
);

CREATE INDEX idx_ledger_transactions_reference ON ledger_transactions(reference_type, reference_id);
CREATE INDEX idx_ledger_entries_account_id ON ledger_entries(account_id);
