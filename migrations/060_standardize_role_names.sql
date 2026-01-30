-- Migration 060: Standardize Role Names and Clean Up Duplicates
-- This migration consolidates duplicate roles created by migrations 028 and 040
-- Standardizes on Title Case format (from migration 040)

-- Step 0: Update the users role check constraint to allow Title Case role names
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN (
  -- Old snake_case formats (for backward compatibility during migration)
  'admin',
  'super_admin',
  'org_admin',
  'farmer',
  'expert',
  'cultivation_manager',
  'grower',
  'manufacturing_manager',
  'inventory_manager',
  'qa_compliance',
  'auditor',
  'shipper',
  'processor',
  -- New Title Case formats (standardized)
  'Super Admin',
  'Org Admin',
  'Cultivation Manager',
  'Technician / Grower',
  'Inventory Clerk',
  'QA / Lab Manager',
  'Processor / Mfg Operator',
  'Shipper / Logistics',
  'Auditor / Compliance',
  'Read-only Viewer'
));

COMMENT ON CONSTRAINT users_role_check ON users IS 'Allows both old snake_case and new Title Case RBAC roles for multi-tenant system';

-- Step 1: Create a mapping table for role consolidation
DO $$
DECLARE
    old_role_id INTEGER;
    new_role_id INTEGER;
BEGIN
    -- Map super_admin -> Super Admin
    SELECT id INTO old_role_id FROM roles WHERE name = 'super_admin' AND is_active = true;
    SELECT id INTO new_role_id FROM roles WHERE name = 'Super Admin' AND is_active = true;
    
    IF old_role_id IS NOT NULL AND new_role_id IS NOT NULL AND old_role_id != new_role_id THEN
        -- Update user_roles to point to new role
        UPDATE user_roles SET role_id = new_role_id WHERE role_id = old_role_id;
        -- Deactivate old role
        UPDATE roles SET is_active = false WHERE id = old_role_id;
        RAISE NOTICE 'Migrated super_admin (%) to Super Admin (%)', old_role_id, new_role_id;
    END IF;

    -- Map org_admin -> Org Admin
    SELECT id INTO old_role_id FROM roles WHERE name = 'org_admin' AND is_active = true;
    SELECT id INTO new_role_id FROM roles WHERE name = 'Org Admin' AND is_active = true;
    
    IF old_role_id IS NOT NULL AND new_role_id IS NOT NULL AND old_role_id != new_role_id THEN
        UPDATE user_roles SET role_id = new_role_id WHERE role_id = old_role_id;
        UPDATE roles SET is_active = false WHERE id = old_role_id;
        RAISE NOTICE 'Migrated org_admin (%) to Org Admin (%)', old_role_id, new_role_id;
    END IF;

    -- Map cultivation_manager -> Cultivation Manager
    SELECT id INTO old_role_id FROM roles WHERE name = 'cultivation_manager' AND is_active = true;
    SELECT id INTO new_role_id FROM roles WHERE name = 'Cultivation Manager' AND is_active = true;
    
    IF old_role_id IS NOT NULL AND new_role_id IS NOT NULL AND old_role_id != new_role_id THEN
        UPDATE user_roles SET role_id = new_role_id WHERE role_id = old_role_id;
        UPDATE roles SET is_active = false WHERE id = old_role_id;
        RAISE NOTICE 'Migrated cultivation_manager (%) to Cultivation Manager (%)', old_role_id, new_role_id;
    END IF;

    -- Map grower -> Technician / Grower
    SELECT id INTO old_role_id FROM roles WHERE name = 'grower' AND is_active = true;
    SELECT id INTO new_role_id FROM roles WHERE name = 'Technician / Grower' AND is_active = true;
    
    IF old_role_id IS NOT NULL AND new_role_id IS NOT NULL AND old_role_id != new_role_id THEN
        UPDATE user_roles SET role_id = new_role_id WHERE role_id = old_role_id;
        UPDATE roles SET is_active = false WHERE id = old_role_id;
        RAISE NOTICE 'Migrated grower (%) to Technician / Grower (%)', old_role_id, new_role_id;
    END IF;

    -- Map manufacturing_manager -> Processor / Mfg Operator
    SELECT id INTO old_role_id FROM roles WHERE name = 'manufacturing_manager' AND is_active = true;
    SELECT id INTO new_role_id FROM roles WHERE name = 'Processor / Mfg Operator' AND is_active = true;
    
    IF old_role_id IS NOT NULL AND new_role_id IS NOT NULL AND old_role_id != new_role_id THEN
        UPDATE user_roles SET role_id = new_role_id WHERE role_id = old_role_id;
        UPDATE roles SET is_active = false WHERE id = old_role_id;
        RAISE NOTICE 'Migrated manufacturing_manager (%) to Processor / Mfg Operator (%)', old_role_id, new_role_id;
    END IF;

    -- Map inventory_manager -> Inventory Clerk
    SELECT id INTO old_role_id FROM roles WHERE name = 'inventory_manager' AND is_active = true;
    SELECT id INTO new_role_id FROM roles WHERE name = 'Inventory Clerk' AND is_active = true;
    
    IF old_role_id IS NOT NULL AND new_role_id IS NOT NULL AND old_role_id != new_role_id THEN
        UPDATE user_roles SET role_id = new_role_id WHERE role_id = old_role_id;
        UPDATE roles SET is_active = false WHERE id = old_role_id;
        RAISE NOTICE 'Migrated inventory_manager (%) to Inventory Clerk (%)', old_role_id, new_role_id;
    END IF;

    -- Map qa_compliance -> QA / Lab Manager
    SELECT id INTO old_role_id FROM roles WHERE name = 'qa_compliance' AND is_active = true;
    SELECT id INTO new_role_id FROM roles WHERE name = 'QA / Lab Manager' AND is_active = true;
    
    IF old_role_id IS NOT NULL AND new_role_id IS NOT NULL AND old_role_id != new_role_id THEN
        UPDATE user_roles SET role_id = new_role_id WHERE role_id = old_role_id;
        UPDATE roles SET is_active = false WHERE id = old_role_id;
        RAISE NOTICE 'Migrated qa_compliance (%) to QA / Lab Manager (%)', old_role_id, new_role_id;
    END IF;

    -- Map auditor -> Auditor / Compliance
    SELECT id INTO old_role_id FROM roles WHERE name = 'auditor' AND is_active = true;
    SELECT id INTO new_role_id FROM roles WHERE name = 'Auditor / Compliance' AND is_active = true;
    
    IF old_role_id IS NOT NULL AND new_role_id IS NOT NULL AND old_role_id != new_role_id THEN
        UPDATE user_roles SET role_id = new_role_id WHERE role_id = old_role_id;
        UPDATE roles SET is_active = false WHERE id = old_role_id;
        RAISE NOTICE 'Migrated auditor (%) to Auditor / Compliance (%)', old_role_id, new_role_id;
    END IF;
END $$;

-- Step 2: Update users table legacy 'role' column to use Title Case format
UPDATE users SET role = 'Super Admin' WHERE role = 'super_admin';
UPDATE users SET role = 'Org Admin' WHERE role = 'org_admin';
UPDATE users SET role = 'Cultivation Manager' WHERE role = 'cultivation_manager';
UPDATE users SET role = 'Technician / Grower' WHERE role = 'grower';
UPDATE users SET role = 'Processor / Mfg Operator' WHERE role = 'manufacturing_manager';
UPDATE users SET role = 'Inventory Clerk' WHERE role = 'inventory_manager';
UPDATE users SET role = 'QA / Lab Manager' WHERE role = 'qa_compliance';
UPDATE users SET role = 'Auditor / Compliance' WHERE role = 'auditor';

-- Step 3: Clean up duplicate permissions (prefer org:* over organization:*)
-- Deactivate old format permissions that have new equivalents
UPDATE permissions SET is_active = false 
WHERE name IN (
    'organization:view',
    'organization:update', 
    'organization:delete',
    'document:view',
    'document:upload',
    'document:approve'
)
AND EXISTS (
    SELECT 1 FROM permissions p2 
    WHERE p2.name IN ('org:view', 'org:update', 'documents:view', 'documents:upload', 'documents:approve')
    AND p2.is_active = true
);

-- Step 4: Ensure all new format permissions exist with correct resource_type
UPDATE permissions SET resource_type = 'organization' WHERE name LIKE 'org:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'cultivation' WHERE name LIKE 'cultivation:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'inventory' WHERE name LIKE 'inventory:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'manufacturing' WHERE name LIKE 'manufacturing:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'lab' WHERE name LIKE 'lab:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'shipping' WHERE name LIKE 'shipping:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'compliance' WHERE name LIKE 'compliance:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'audit' WHERE name LIKE 'audit:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'analytics' WHERE name LIKE 'analytics:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'documents' WHERE name LIKE 'documents:%' AND resource_type IS NULL;
UPDATE permissions SET resource_type = 'platform' WHERE name LIKE 'platform:%' AND resource_type IS NULL;

-- Step 5: Add user management permissions if they don't exist
INSERT INTO permissions (name, display_name, description, resource_type, action, is_active) VALUES
('user:view', 'View Users', 'View user details', 'user', 'read', true),
('user:create', 'Create Users', 'Create new users', 'user', 'create', true),
('user:update', 'Update Users', 'Update user details', 'user', 'update', true),
('user:delete', 'Delete Users', 'Delete users', 'user', 'delete', true)
ON CONFLICT (name) DO UPDATE SET is_active = true;

-- Step 6: Ensure Org Admin has user management permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Org Admin'
AND p.name IN ('user:view', 'user:create', 'user:update', 'user:delete', 'audit:view')
AND r.is_active = true
AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Step 7: Ensure cultivation:delete permission exists for Org Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Org Admin'
AND p.name = 'cultivation:delete'
AND r.is_active = true
AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Step 8: Ensure Super Admin has all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Super Admin'
AND r.is_active = true
AND p.is_active = true
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Step 9: Add display_name to roles if missing
UPDATE roles SET display_name = name WHERE display_name IS NULL OR display_name = '';

-- Step 10: Mark all Title Case roles as system roles
UPDATE roles SET is_system_role = true 
WHERE name IN (
    'Super Admin',
    'Org Admin', 
    'Cultivation Manager',
    'Technician / Grower',
    'Inventory Clerk',
    'QA / Lab Manager',
    'Processor / Mfg Operator',
    'Shipper / Logistics',
    'Auditor / Compliance',
    'Read-only Viewer'
);

-- Verify migration
DO $$
DECLARE
    active_roles INTEGER;
    active_permissions INTEGER;
BEGIN
    SELECT COUNT(*) INTO active_roles FROM roles WHERE is_active = true;
    SELECT COUNT(*) INTO active_permissions FROM permissions WHERE is_active = true;
    RAISE NOTICE 'Migration complete: % active roles, % active permissions', active_roles, active_permissions;
END $$;
