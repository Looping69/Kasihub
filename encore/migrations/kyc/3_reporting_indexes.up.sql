-- Author: Klaasvaakie ( |╲ )
CREATE INDEX IF NOT EXISTS idx_kyc_cases_profile_submitted
  ON kyc_cases(profile_id, submitted_at DESC NULLS LAST);
