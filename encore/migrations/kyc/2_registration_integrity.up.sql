-- Author: Klaasvaakie ( |╲ )
ALTER TABLE kyc_cases ADD COLUMN registration_id UUID;
CREATE UNIQUE INDEX idx_kyc_cases_registration
  ON kyc_cases(registration_id) WHERE registration_id IS NOT NULL;
