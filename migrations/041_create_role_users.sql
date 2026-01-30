-- Create users for each role with test passwords
-- Password for all: 'Test123!' (hashed with bcrypt)

-- Super Admin
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
VALUES (
  'superadmin@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'Super',
  'Admin',
  NULL, -- Super Admin doesn't belong to an organization
  true
)
ON CONFLICT (email) DO NOTHING
RETURNING id;

-- Get Super Admin user ID and assign role
DO $$
DECLARE
  super_admin_user_id INTEGER;
  super_admin_role_id INTEGER;
BEGIN
  SELECT id INTO super_admin_user_id FROM users WHERE email = 'superadmin@passionfarms.com';
  SELECT id INTO super_admin_role_id FROM roles WHERE name = 'Super Admin';
  
  IF super_admin_user_id IS NOT NULL AND super_admin_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, is_active)
    VALUES (super_admin_user_id, super_admin_role_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;

-- Org Admin
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
SELECT 
  'orgadmin@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'Org',
  'Admin',
  (SELECT id FROM organizations LIMIT 1),
  true
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  org_admin_user_id INTEGER;
  org_admin_role_id INTEGER;
  org_id INTEGER;
BEGIN
  SELECT id INTO org_admin_user_id FROM users WHERE email = 'orgadmin@passionfarms.com';
  SELECT id INTO org_admin_role_id FROM roles WHERE name = 'Org Admin';
  SELECT organization_id INTO org_id FROM users WHERE email = 'orgadmin@passionfarms.com';
  
  IF org_admin_user_id IS NOT NULL AND org_admin_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    VALUES (org_admin_user_id, org_admin_role_id, org_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;

-- Cultivation Manager
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
SELECT 
  'cultivation@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'Cultivation',
  'Manager',
  (SELECT id FROM organizations LIMIT 1),
  true
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  cult_user_id INTEGER;
  cult_role_id INTEGER;
  org_id INTEGER;
BEGIN
  SELECT id INTO cult_user_id FROM users WHERE email = 'cultivation@passionfarms.com';
  SELECT id INTO cult_role_id FROM roles WHERE name = 'Cultivation Manager';
  SELECT organization_id INTO org_id FROM users WHERE email = 'cultivation@passionfarms.com';
  
  IF cult_user_id IS NOT NULL AND cult_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    VALUES (cult_user_id, cult_role_id, org_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;

-- Technician / Grower
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
SELECT 
  'grower@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'Grower',
  'Tech',
  (SELECT id FROM organizations LIMIT 1),
  true
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  grower_user_id INTEGER;
  grower_role_id INTEGER;
  org_id INTEGER;
BEGIN
  SELECT id INTO grower_user_id FROM users WHERE email = 'grower@passionfarms.com';
  SELECT id INTO grower_role_id FROM roles WHERE name = 'Technician / Grower';
  SELECT organization_id INTO org_id FROM users WHERE email = 'grower@passionfarms.com';
  
  IF grower_user_id IS NOT NULL AND grower_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    VALUES (grower_user_id, grower_role_id, org_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;

-- Inventory Clerk
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
SELECT 
  'inventory@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'Inventory',
  'Clerk',
  (SELECT id FROM organizations LIMIT 1),
  true
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  inv_user_id INTEGER;
  inv_role_id INTEGER;
  org_id INTEGER;
BEGIN
  SELECT id INTO inv_user_id FROM users WHERE email = 'inventory@passionfarms.com';
  SELECT id INTO inv_role_id FROM roles WHERE name = 'Inventory Clerk';
  SELECT organization_id INTO org_id FROM users WHERE email = 'inventory@passionfarms.com';
  
  IF inv_user_id IS NOT NULL AND inv_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    VALUES (inv_user_id, inv_role_id, org_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;

-- QA / Lab Manager
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
SELECT 
  'qa@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'QA',
  'Manager',
  (SELECT id FROM organizations LIMIT 1),
  true
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  qa_user_id INTEGER;
  qa_role_id INTEGER;
  org_id INTEGER;
BEGIN
  SELECT id INTO qa_user_id FROM users WHERE email = 'qa@passionfarms.com';
  SELECT id INTO qa_role_id FROM roles WHERE name = 'QA / Lab Manager';
  SELECT organization_id INTO org_id FROM users WHERE email = 'qa@passionfarms.com';
  
  IF qa_user_id IS NOT NULL AND qa_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    VALUES (qa_user_id, qa_role_id, org_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;

-- Processor / Mfg Operator
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
SELECT 
  'processor@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'Processor',
  'Operator',
  (SELECT id FROM organizations LIMIT 1),
  true
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  proc_user_id INTEGER;
  proc_role_id INTEGER;
  org_id INTEGER;
BEGIN
  SELECT id INTO proc_user_id FROM users WHERE email = 'processor@passionfarms.com';
  SELECT id INTO proc_role_id FROM roles WHERE name = 'Processor / Mfg Operator';
  SELECT organization_id INTO org_id FROM users WHERE email = 'processor@passionfarms.com';
  
  IF proc_user_id IS NOT NULL AND proc_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    VALUES (proc_user_id, proc_role_id, org_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;

-- Shipper / Logistics
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
SELECT 
  'shipper@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'Shipper',
  'Logistics',
  (SELECT id FROM organizations LIMIT 1),
  true
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  ship_user_id INTEGER;
  ship_role_id INTEGER;
  org_id INTEGER;
BEGIN
  SELECT id INTO ship_user_id FROM users WHERE email = 'shipper@passionfarms.com';
  SELECT id INTO ship_role_id FROM roles WHERE name = 'Shipper / Logistics';
  SELECT organization_id INTO org_id FROM users WHERE email = 'shipper@passionfarms.com';
  
  IF ship_user_id IS NOT NULL AND ship_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    VALUES (ship_user_id, ship_role_id, org_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;

-- Auditor / Compliance
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
SELECT 
  'auditor@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'Auditor',
  'Compliance',
  (SELECT id FROM organizations LIMIT 1),
  true
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  audit_user_id INTEGER;
  audit_role_id INTEGER;
  org_id INTEGER;
BEGIN
  SELECT id INTO audit_user_id FROM users WHERE email = 'auditor@passionfarms.com';
  SELECT id INTO audit_role_id FROM roles WHERE name = 'Auditor / Compliance';
  SELECT organization_id INTO org_id FROM users WHERE email = 'auditor@passionfarms.com';
  
  IF audit_user_id IS NOT NULL AND audit_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    VALUES (audit_user_id, audit_role_id, org_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;

-- Read-only Viewer
INSERT INTO users (email, password_hash, first_name, last_name, organization_id, is_active)
SELECT 
  'viewer@passionfarms.com',
  '$2a$12$Nm0rhawrSaw3chVvt1yipuV3wAw4ui2.gBNJL56Nape5frxz8l6Ry', -- Test123!
  'Read',
  'Only',
  (SELECT id FROM organizations LIMIT 1),
  true
WHERE EXISTS (SELECT 1 FROM organizations LIMIT 1)
ON CONFLICT (email) DO NOTHING;

DO $$
DECLARE
  viewer_user_id INTEGER;
  viewer_role_id INTEGER;
  org_id INTEGER;
BEGIN
  SELECT id INTO viewer_user_id FROM users WHERE email = 'viewer@passionfarms.com';
  SELECT id INTO viewer_role_id FROM roles WHERE name = 'Read-only Viewer';
  SELECT organization_id INTO org_id FROM users WHERE email = 'viewer@passionfarms.com';
  
  IF viewer_user_id IS NOT NULL AND viewer_role_id IS NOT NULL THEN
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    VALUES (viewer_user_id, viewer_role_id, org_id, true)
    ON CONFLICT (user_id, role_id, organization_id, facility_id) DO UPDATE SET is_active = true;
  END IF;
END $$;
