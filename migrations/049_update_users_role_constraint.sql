-- Update users table role constraint to allow new RBAC roles
-- This allows org_admin, super_admin, and other roles used in the multi-tenant system

-- Drop the old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- Add new constraint that allows all RBAC roles
ALTER TABLE users 
ADD CONSTRAINT users_role_check 
CHECK (role IN (
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
  'processor'
));

-- Add comment
COMMENT ON CONSTRAINT users_role_check ON users IS 'Allows all RBAC roles including org_admin and super_admin for multi-tenant system';
