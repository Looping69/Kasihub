-- Author: Klaasvaakie ( |╲ )
CREATE INDEX IF NOT EXISTS idx_share_certificates_profile_status
  ON share_certificates(profile_id, status);
