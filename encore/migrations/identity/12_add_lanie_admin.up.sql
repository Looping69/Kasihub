-- Author: Klaasvaakie ( |╲ )
-- Administrator account setup for lanie@msbs.co.za

INSERT INTO users (id, email, password_hash, status)
VALUES (
  '10000000-0000-4000-8000-000000000003',
  'lanie@msbs.co.za',
  'scrypt:ac3163dcd453f44a669a8279bdaa062d:d43c46635c571b58f51278349fb03040f79e6701aa1ff513c684d9924336ef88ab9d75e374d238b1da952baeac286b3b728ad701d0f82659fc62c57eb51de35f',
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
  '20000000-0000-4000-8000-000000000003',
  u.id,
  'individual',
  'KSI-LANIE-ADMIN',
  'Lanie',
  'Retief',
  'ZA',
  'active',
  'INDIVIDUAL',
  'SA_CITIZEN_SA',
  'NONE',
  false
FROM users u
WHERE lower(u.email) = lower('lanie@msbs.co.za')
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
WHERE lower(u.email) = lower('lanie@msbs.co.za')
ON CONFLICT (user_id, role_id) DO NOTHING;
