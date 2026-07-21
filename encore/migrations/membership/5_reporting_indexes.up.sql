-- Author: Klaasvaakie ( |╲ )
CREATE INDEX IF NOT EXISTS idx_subscriptions_profile_starts
  ON subscriptions(profile_id, starts_at DESC);
