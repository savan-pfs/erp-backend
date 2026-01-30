-- Migration: Add User Management Permissions to Org Admin
-- This ensures Org Admin can create, update, and delete users within their organization

-- Step 1: Ensure user management permissions exist
INSERT INTO permissions (name, display_name, description, resource_type, action, is_active)
VALUES 
  ('user:create', 'Create User', 'Create new users within organization', 'user', 'create', true),
  ('user:update', 'Update User', 'Update user details within organization', 'user', 'update', true),
  ('user:delete', 'Delete User', 'Delete/deactivate users within organization', 'user', 'delete', true),
  ('user:view', 'View Users', 'View users within organization', 'user', 'view', true)
ON CONFLICT (name) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  is_active = true;

-- Step 2: Assign user management permissions to Org Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Org Admin'
AND p.name IN ('user:create', 'user:update', 'user:delete', 'user:view')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Step 3: Assign user view permission to Cultivation Manager (can see team members)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cultivation Manager'
AND p.name = 'user:view'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Step 4: Also assign to Super Admin (they should have all permissions already, but ensure)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Super Admin'
AND p.name IN ('user:create', 'user:update', 'user:delete', 'user:view')
ON CONFLICT (role_id, permission_id) DO NOTHING;
