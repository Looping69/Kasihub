-- Author: Klaasvaakie ( |╲ )
-- Throttles provider backfill when a final Didit webhook is delayed or lost.
ALTER TABLE kyc_cases
  ADD COLUMN didit_last_synced_at TIMESTAMPTZ;
