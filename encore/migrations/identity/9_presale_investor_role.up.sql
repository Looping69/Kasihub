-- Author: Klaasvaakie ( |╲ )
INSERT INTO roles (name)
VALUES ('presale_investor')
ON CONFLICT (name) DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT DISTINCT p.user_id, r.id
FROM profiles p
JOIN roles r ON r.name = 'presale_investor'
WHERE p.citizenship_type IN ('PRESALE_INVESTOR', 'PRESALE_TRUST')
ON CONFLICT (user_id, role_id) DO NOTHING;

UPDATE profiles
SET membership_type = CASE
  WHEN citizenship_type = 'PRESALE_TRUST' THEN 'PRESALE_TRUST'
  WHEN profile_type = 'company' THEN 'PRESALE_COMPANY'
  ELSE 'PRESALE_INDIVIDUAL'
END
WHERE citizenship_type IN ('PRESALE_INVESTOR', 'PRESALE_TRUST');

DELETE FROM user_roles ur
USING roles r
WHERE ur.role_id = r.id
  AND r.name = 'member'
  AND EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = ur.user_id
      AND p.citizenship_type IN ('PRESALE_INVESTOR', 'PRESALE_TRUST')
  )
  AND NOT EXISTS (
    SELECT 1 FROM registration_workflows rw
    WHERE rw.user_id = ur.user_id AND rw.state = 'completed'
  );
