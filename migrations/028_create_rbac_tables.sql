-- Create RBAC (Role-Based Access Control) tables

-- Roles table - defines all available roles
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL, -- e.g., 'super_admin', 'org_admin', 'cultivation_manager'
    display_name VARCHAR(100) NOT NULL, -- e.g., 'Super Admin', 'Organization Admin'
    description TEXT,
    is_system_role BOOLEAN DEFAULT false, -- System roles cannot be deleted
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table - defines all available permissions
CREATE TABLE IF NOT EXISTS permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'cultivation:create_plant', 'inventory:view'
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    resource_type VARCHAR(50), -- e.g., 'cultivation', 'inventory', 'manufacturing'
    action VARCHAR(50), -- e.g., 'create', 'read', 'update', 'delete', 'approve'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-Permission mapping - defines which permissions each role has
CREATE TABLE IF NOT EXISTS role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(role_id, permission_id)
);

-- User-Role mapping - assigns roles to users (multi-role support)
CREATE TABLE IF NOT EXISTS user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE, -- Role scope (NULL = global)
    facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE, -- Role scope (NULL = organization-wide)
    granted_by INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Who granted this role
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP, -- Optional expiration
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role_id, organization_id, facility_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);
CREATE INDEX IF NOT EXISTS idx_permissions_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_permissions_resource_type ON permissions(resource_type);
CREATE INDEX IF NOT EXISTS idx_permissions_active ON permissions(is_active);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_organization_id ON user_roles(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_facility_id ON user_roles(facility_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);

-- Triggers
CREATE TRIGGER update_roles_updated_at 
    BEFORE UPDATE ON roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_permissions_updated_at 
    BEFORE UPDATE ON permissions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_roles_updated_at 
    BEFORE UPDATE ON user_roles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default system roles
INSERT INTO roles (name, display_name, description, is_system_role, is_active) VALUES
('super_admin', 'Super Admin', 'Full system access across all organizations. Can approve documents and manage system configuration.', true, true),
('org_admin', 'Organization Admin', 'Full access within their organization. Can manage users, facilities, and organization settings.', true, true),
('cultivation_manager', 'Cultivation Manager', 'Manages cultivation operations, rooms, plants, and batches within assigned facilities.', true, true),
('grower', 'Grower / Technician', 'Performs daily cultivation tasks, plant care, and room operations.', true, true),
('manufacturing_manager', 'Manufacturing Manager', 'Manages manufacturing operations, recipes, and manufacturing batches.', true, true),
('inventory_manager', 'Inventory Manager', 'Manages inventory, batches, and inventory movements.', true, true),
('qa_compliance', 'QA / Compliance', 'Manages quality assurance, lab tests, compliance checks, and approvals.', true, true),
('auditor', 'Auditor', 'Read-only access for auditing and compliance review. Cannot modify data.', true, true)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions (comprehensive permission set)
-- Format: resource:action (e.g., cultivation:create_plant)
INSERT INTO permissions (name, display_name, description, resource_type, action, is_active) VALUES
-- Organization permissions
('organization:view', 'View Organization', 'View organization details', 'organization', 'read', true),
('organization:update', 'Update Organization', 'Update organization settings', 'organization', 'update', true),
('organization:delete', 'Delete Organization', 'Delete organization', 'organization', 'delete', true),
-- Facility permissions
('facility:view', 'View Facility', 'View facility details', 'facility', 'read', true),
('facility:create', 'Create Facility', 'Create new facilities', 'facility', 'create', true),
('facility:update', 'Update Facility', 'Update facility settings', 'facility', 'update', true),
('facility:delete', 'Delete Facility', 'Delete facilities', 'facility', 'delete', true),
-- Room permissions
('room:view', 'View Room', 'View room details', 'room', 'read', true),
('room:create', 'Create Room', 'Create new rooms', 'room', 'create', true),
('room:update', 'Update Room', 'Update room settings', 'room', 'update', true),
('room:delete', 'Delete Room', 'Delete rooms', 'room', 'delete', true),
-- Plant permissions
('plant:view', 'View Plant', 'View plant details', 'plant', 'read', true),
('plant:create', 'Create Plant', 'Create new plants', 'plant', 'create', true),
('plant:update', 'Update Plant', 'Update plant information', 'plant', 'update', true),
('plant:delete', 'Delete Plant', 'Delete plants', 'plant', 'delete', true),
('plant:move', 'Move Plant', 'Move plants between rooms', 'plant', 'update', true),
-- Batch permissions
('batch:view', 'View Batch', 'View batch details', 'batch', 'read', true),
('batch:create', 'Create Batch', 'Create new batches', 'batch', 'create', true),
('batch:update', 'Update Batch', 'Update batch information', 'batch', 'update', true),
('batch:delete', 'Delete Batch', 'Delete batches', 'batch', 'delete', true),
-- Harvest permissions
('harvest:view', 'View Harvest', 'View harvest details', 'harvest', 'read', true),
('harvest:create', 'Create Harvest', 'Create harvest batches', 'harvest', 'create', true),
('harvest:update', 'Update Harvest', 'Update harvest information', 'harvest', 'update', true),
-- Inventory permissions
('inventory:view', 'View Inventory', 'View inventory items', 'inventory', 'read', true),
('inventory:create', 'Create Inventory', 'Create inventory items', 'inventory', 'create', true),
('inventory:update', 'Update Inventory', 'Update inventory items', 'inventory', 'update', true),
('inventory:delete', 'Delete Inventory', 'Delete inventory items', 'inventory', 'delete', true),
('inventory:adjust', 'Adjust Inventory', 'Adjust inventory quantities', 'inventory', 'update', true),
-- Manufacturing permissions
('manufacturing:view', 'View Manufacturing', 'View manufacturing operations', 'manufacturing', 'read', true),
('manufacturing:create', 'Create Manufacturing', 'Create manufacturing batches', 'manufacturing', 'create', true),
('manufacturing:update', 'Update Manufacturing', 'Update manufacturing batches', 'manufacturing', 'update', true),
-- Document permissions
('document:view', 'View Document', 'View documents', 'document', 'read', true),
('document:upload', 'Upload Document', 'Upload new documents', 'document', 'create', true),
('document:approve', 'Approve Document', 'Approve documents (Super Admin only)', 'document', 'approve', true),
-- License permissions
('license:view', 'View License', 'View licenses', 'license', 'read', true),
('license:create', 'Create License', 'Create licenses', 'license', 'create', true),
('license:update', 'Update License', 'Update licenses', 'license', 'update', true),
-- User permissions
('user:view', 'View User', 'View user details', 'user', 'read', true),
('user:create', 'Create User', 'Create new users', 'user', 'create', true),
('user:update', 'Update User', 'Update user information', 'user', 'update', true),
('user:delete', 'Delete User', 'Delete users', 'user', 'delete', true),
('user:assign_role', 'Assign Role', 'Assign roles to users', 'user', 'update', true),
-- Analytics permissions
('analytics:view', 'View Analytics', 'View analytics and reports', 'analytics', 'read', true),
('analytics:export', 'Export Analytics', 'Export analytics data', 'analytics', 'read', true),
-- Compliance permissions
('compliance:view', 'View Compliance', 'View compliance data', 'compliance', 'read', true),
('compliance:manage', 'Manage Compliance', 'Manage compliance checks and audits', 'compliance', 'update', true),
-- Lab test permissions
('lab_test:view', 'View Lab Test', 'View lab test results', 'lab_test', 'read', true),
('lab_test:create', 'Create Lab Test', 'Create lab test records', 'lab_test', 'create', true),
('lab_test:update', 'Update Lab Test', 'Update lab test records', 'lab_test', 'update', true)
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- Super Admin: All permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Org Admin: Most permissions except document approval and system-wide operations
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'org_admin'
  AND p.name NOT IN ('document:approve', 'organization:delete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Cultivation Manager: Cultivation-related permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'cultivation_manager'
  AND p.resource_type IN ('room', 'plant', 'batch', 'harvest', 'inventory')
  AND p.action IN ('read', 'create', 'update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Grower: Limited cultivation permissions (read + create/update for assigned tasks)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'grower'
  AND p.resource_type IN ('room', 'plant', 'batch')
  AND p.action IN ('read', 'update')
  AND p.name NOT IN ('room:delete', 'plant:delete', 'batch:delete')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Manufacturing Manager: Manufacturing and inventory permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'manufacturing_manager'
  AND p.resource_type IN ('manufacturing', 'inventory', 'batch')
  AND p.action IN ('read', 'create', 'update')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Inventory Manager: Inventory permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'inventory_manager'
  AND p.resource_type = 'inventory'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- QA/Compliance: Compliance, lab test, and read permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'qa_compliance'
  AND (p.resource_type IN ('compliance', 'lab_test') OR p.action = 'read')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Auditor: Read-only permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'auditor'
  AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;
