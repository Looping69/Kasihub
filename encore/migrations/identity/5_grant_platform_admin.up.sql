-- Author: Klaasvaakie ( |╲ )
INSERT INTO user_roles (user_id, role_id)
SELECT users.id, roles.id
FROM users
CROSS JOIN roles
WHERE lower(users.email) = lower('platform.admin.20260722@kasihub.co.za')
  AND roles.name = 'admin'
ON CONFLICT (user_id, role_id) DO NOTHING;
