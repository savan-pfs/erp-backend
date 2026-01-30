-- Migrate existing users to RBAC system
-- Map old role column to new user_roles table

DO $$
DECLARE
    super_admin_role_id INTEGER;
    org_admin_role_id INTEGER;
    farmer_role_id INTEGER; -- Map to grower
    expert_role_id INTEGER; -- Map to cultivation_manager
    default_org_id INTEGER;
BEGIN
    -- Get role IDs
    SELECT id INTO super_admin_role_id FROM roles WHERE name = 'super_admin';
    SELECT id INTO org_admin_role_id FROM roles WHERE name = 'org_admin';
    SELECT id INTO farmer_role_id FROM roles WHERE name = 'grower';
    SELECT id INTO expert_role_id FROM roles WHERE name = 'cultivation_manager';
    
    -- Get default organization
    SELECT id INTO default_org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;
    
    -- Migrate users based on their old role
    -- admin -> super_admin (if no org) or org_admin (if has org)
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    SELECT 
        u.id,
        CASE 
            WHEN u.organization_id IS NULL THEN super_admin_role_id
            ELSE org_admin_role_id
        END,
        u.organization_id,
        true
    FROM users u
    WHERE u.role = 'admin'
      AND NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
      );
    
    -- farmer -> grower
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    SELECT 
        u.id,
        farmer_role_id,
        u.organization_id,
        true
    FROM users u
    WHERE u.role = 'farmer'
      AND NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
      );
    
    -- expert -> cultivation_manager
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    SELECT 
        u.id,
        expert_role_id,
        u.organization_id,
        true
    FROM users u
    WHERE u.role = 'expert'
      AND NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
      );
    
    -- For users without a role, assign grower role
    INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
    SELECT 
        u.id,
        farmer_role_id,
        COALESCE(u.organization_id, default_org_id),
        true
    FROM users u
    WHERE u.role IS NULL OR u.role NOT IN ('admin', 'farmer', 'expert')
      AND NOT EXISTS (
          SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
      );
END $$;

-- Note: The old 'role' column in users table is kept for backward compatibility
-- but should not be used for new role assignments. Use user_roles table instead.
