-- Author: Klaasvaakie ( |╲ )
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE matrix_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE,
  parent_node_id UUID,
  sponsor_profile_id UUID,
  position_index INT NOT NULL DEFAULT 0,
  depth INT NOT NULL DEFAULT 0,
  path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE matrix_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL UNIQUE,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'active',
  cached_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_matrix_nodes_profile_id ON matrix_nodes(profile_id);
CREATE INDEX idx_matrix_nodes_parent_node_id ON matrix_nodes(parent_node_id);
CREATE INDEX idx_matrix_nodes_path ON matrix_nodes(path);
CREATE INDEX idx_matrix_events_profile_id ON matrix_events(profile_id);
