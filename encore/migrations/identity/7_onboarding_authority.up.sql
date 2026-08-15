-- Author: Klaasvaakie ( |╲ )
-- Persist the authority selected at registration. Citizenship alone cannot
-- determine KYC/payment routing because local applicants may opt out of InstaPay.
ALTER TABLE profiles
  ADD COLUMN onboarding_authority TEXT NOT NULL DEFAULT 'instapay'
  CHECK (onboarding_authority IN ('instapay', 'kasihub'));

UPDATE profiles
SET onboarding_authority = 'kasihub'
WHERE citizenship_type IN ('SA_CITIZEN_ABROAD', 'FOREIGN_CITIZEN_ABROAD', 'INTL_COMPANY');
