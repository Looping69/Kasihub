-- Author: Klaasvaakie ( |╲ )
-- Temporary QA identities for the current mock-data testing environment.
-- Passwords are not stored in plaintext; only scrypt hashes are persisted.
-- Remove/rotate these fixtures before real-money production rollout.

INSERT INTO users (id, email, password_hash, status)
VALUES
  (
    '10000000-0000-4000-8000-000000000001',
    'test.admin@kasihub.test',
    'scrypt:4ca5681c539b0c150eb4c282782ec906:c4c4b63911c537871c85a489f66a3c30bb0a0f4a130a2153fd2a7be9e4f9e182bbeff405a0a47d1999bbfaca0db395d10c0c7e28ce8593f38686e1915b615d4a',
    'active'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'test.international@kasihub.test',
    'scrypt:48948576975729eaa818cb680832cc2b:526889dc62741113806612ccd70e1fc9cd6ff7084d5a73c9d5a022b4d896a98935c5879fbcb89fd1ca1ec236eaea0c678830d0f7042236187e6818b34b89df5b',
    'active'
  )
ON CONFLICT (email) DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    status = 'active',
    updated_at = now();

INSERT INTO profiles (
  id,
  user_id,
  profile_type,
  unique_profile_number,
  first_name,
  surname,
  country,
  status,
  membership_type,
  citizenship_type,
  instapay_status,
  upline_confirmed
)
SELECT
  '20000000-0000-4000-8000-000000000001',
  u.id,
  'individual',
  'KSI-TESTADMIN',
  'Test',
  'Administrator',
  'ZA',
  'active',
  'INDIVIDUAL',
  'SA_CITIZEN_SA',
  'NONE',
  false
FROM users u
WHERE lower(u.email) = lower('test.admin@kasihub.test')
ON CONFLICT (unique_profile_number) DO UPDATE
SET user_id = EXCLUDED.user_id,
    first_name = EXCLUDED.first_name,
    surname = EXCLUDED.surname,
    country = EXCLUDED.country,
    status = EXCLUDED.status,
    membership_type = EXCLUDED.membership_type,
    citizenship_type = EXCLUDED.citizenship_type,
    instapay_status = EXCLUDED.instapay_status,
    updated_at = now();

INSERT INTO profiles (
  id,
  user_id,
  profile_type,
  unique_profile_number,
  first_name,
  surname,
  country,
  status,
  membership_type,
  citizenship_type,
  instapay_status,
  upline_confirmed
)
SELECT
  '20000000-0000-4000-8000-000000000002',
  u.id,
  'individual',
  'KSI-TESTINTL',
  'International',
  'Tester',
  'GB',
  'active',
  'INDIVIDUAL',
  'SA_CITIZEN_ABROAD',
  'NONE',
  false
FROM users u
WHERE lower(u.email) = lower('test.international@kasihub.test')
ON CONFLICT (unique_profile_number) DO UPDATE
SET user_id = EXCLUDED.user_id,
    first_name = EXCLUDED.first_name,
    surname = EXCLUDED.surname,
    country = EXCLUDED.country,
    status = EXCLUDED.status,
    membership_type = EXCLUDED.membership_type,
    citizenship_type = EXCLUDED.citizenship_type,
    instapay_status = EXCLUDED.instapay_status,
    updated_at = now();

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name IN ('member', 'admin')
WHERE lower(u.email) = lower('test.admin@kasihub.test')
ON CONFLICT (user_id, role_id) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'member'
WHERE lower(u.email) = lower('test.international@kasihub.test')
ON CONFLICT (user_id, role_id) DO NOTHING;
