-- Author: Klaasvaakie ( |╲ )

ALTER TABLE settlement_allocation_runs
  ADD COLUMN allocation_fingerprint TEXT NOT NULL;

CREATE INDEX idx_settlement_allocation_runs_fingerprint
  ON settlement_allocation_runs(allocation_fingerprint);
