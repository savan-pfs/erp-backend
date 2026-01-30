-- Comprehensive Permissions Migration
-- This migration creates all permissions and assigns them to roles

-- First, ensure all roles exist
INSERT INTO roles (name, display_name, description) VALUES
('Super Admin', 'Super Admin', 'Platform-level control, manage orgs, billing, integrations; full rights'),
('Org Admin', 'Org Admin', 'Manage users, roles (not superadmin), locations, strains, licenses'),
('Cultivation Manager', 'Cultivation Manager', 'Full lifecycle control of plants/batches, schedule harvests, approve harvests'),
('Technician / Grower', 'Technician / Grower', 'Update plant stages, execute work orders, record weights'),
('Inventory Clerk', 'Inventory Clerk', 'Packaging runs, transfers, cycle counts, move inventory'),
('QA / Lab Manager', 'QA / Lab Manager', 'Create lab submissions, accept/reject CoAs, annotate lab results'),
('Processor / Mfg Operator', 'Processor / Mfg Operator', 'Create and run recipes for extracts/edibles'),
('Shipper / Logistics', 'Shipper / Logistics', 'Create transfer manifests, book shipments'),
('Auditor / Compliance', 'Auditor / Compliance', 'Read-only access to full logs, export reports'),
('Read-only Viewer', 'Read-only Viewer', 'Limited dashboard/report view')
ON CONFLICT (name) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

-- Create all permissions organized by module
INSERT INTO permissions (name, display_name, description) VALUES
-- Platform/Organization permissions
('platform:manage', 'Manage Platform', 'Manage platform settings and organizations'),
('platform:billing', 'Manage Billing', 'Manage billing and subscriptions'),
('platform:integrations', 'Manage Integrations', 'Manage integrations (Metrc, etc.)'),
('org:view', 'View Organization', 'View organization details'),
('org:update', 'Update Organization', 'Update organization details'),
('org:manage_users', 'Manage Users', 'Manage users within organization'),
('org:manage_roles', 'Manage Roles', 'Manage roles (except Super Admin)'),
('org:manage_locations', 'Manage Locations', 'Manage locations and facilities'),
('org:manage_strains', 'Manage Strains', 'Manage genetics/strains'),
('org:manage_licenses', 'Manage Licenses', 'Manage licenses'),

-- Cultivation permissions
('cultivation:view', 'View Cultivation', 'View cultivation data'),
('cultivation:create', 'Create Cultivation', 'Create plants, batches, rooms'),
('cultivation:update', 'Update Cultivation', 'Update cultivation data'),
('cultivation:delete', 'Delete Cultivation', 'Delete cultivation data'),
('cultivation:move', 'Move Plants', 'Move plants between rooms'),
('cultivation:stage_change', 'Change Plant Stage', 'Change plant growth stages'),
('cultivation:harvest_schedule', 'Schedule Harvest', 'Schedule harvests'),
('cultivation:harvest_approve', 'Approve Harvest', 'Approve harvests'),
('cultivation:work_orders', 'Work Orders', 'Create and execute work orders'),
('cultivation:record_weights', 'Record Weights', 'Record plant weights'),

-- Inventory permissions
('inventory:view', 'View Inventory', 'View inventory'),
('inventory:create', 'Create Inventory', 'Create inventory items'),
('inventory:update', 'Update Inventory', 'Update inventory items'),
('inventory:delete', 'Delete Inventory', 'Delete inventory items'),
('inventory:transfer', 'Transfer Inventory', 'Transfer inventory between locations'),
('inventory:adjust', 'Adjust Inventory', 'Adjust inventory quantities'),
('inventory:cycle_count', 'Cycle Count', 'Perform cycle counts'),
('inventory:package', 'Package Inventory', 'Create packaging runs'),

-- Manufacturing permissions
('manufacturing:view', 'View Manufacturing', 'View manufacturing data'),
('manufacturing:create', 'Create Manufacturing', 'Create recipes and manufacturing batches'),
('manufacturing:update', 'Update Manufacturing', 'Update manufacturing data'),
('manufacturing:delete', 'Delete Manufacturing', 'Delete manufacturing data'),
('manufacturing:run', 'Run Manufacturing', 'Run manufacturing recipes'),

-- QA/Lab permissions
('lab:view', 'View Lab Tests', 'View lab test results'),
('lab:create', 'Create Lab Test', 'Create lab submissions'),
('lab:update', 'Update Lab Test', 'Update lab test results'),
('lab:approve', 'Approve Lab Test', 'Approve/reject Certificates of Analysis (CoAs)'),
('lab:annotate', 'Annotate Lab Results', 'Annotate lab results'),

-- Shipping/Logistics permissions
('shipping:view', 'View Shipping', 'View shipping and transfer data'),
('shipping:create', 'Create Transfer', 'Create transfer manifests'),
('shipping:update', 'Update Shipping', 'Update shipping data'),
('shipping:book', 'Book Shipment', 'Book shipments'),

-- Compliance/Audit permissions
('compliance:view', 'View Compliance', 'View compliance data'),
('compliance:export', 'Export Compliance', 'Export compliance reports'),
('audit:view', 'View Audit Logs', 'View audit logs'),
('audit:export', 'Export Audit Logs', 'Export audit reports'),

-- Analytics/Reports permissions
('analytics:view', 'View Analytics', 'View analytics and reports'),
('analytics:export', 'Export Analytics', 'Export reports'),

-- Documents permissions
('documents:view', 'View Documents', 'View documents'),
('documents:upload', 'Upload Documents', 'Upload documents'),
('documents:approve', 'Approve Documents', 'Approve documents (Super Admin only)'),
('documents:delete', 'Delete Documents', 'Delete documents')
ON CONFLICT (name) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description;

-- Assign permissions to Super Admin (all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Super Admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Org Admin
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Org Admin'
AND p.name IN (
  'org:view', 'org:update', 'org:manage_users', 'org:manage_roles',
  'org:manage_locations', 'org:manage_strains', 'org:manage_licenses',
  'cultivation:view', 'cultivation:create', 'cultivation:update',
  'inventory:view', 'inventory:create', 'inventory:update',
  'manufacturing:view', 'manufacturing:create', 'manufacturing:update',
  'lab:view', 'lab:create', 'lab:update',
  'shipping:view', 'shipping:create', 'shipping:update',
  'compliance:view', 'compliance:export',
  'analytics:view', 'analytics:export',
  'documents:view', 'documents:upload'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Cultivation Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Cultivation Manager'
AND p.name IN (
  'cultivation:view', 'cultivation:create', 'cultivation:update',
  'cultivation:move', 'cultivation:stage_change',
  'cultivation:harvest_schedule', 'cultivation:harvest_approve',
  'cultivation:work_orders', 'cultivation:record_weights',
  'inventory:view', 'inventory:create', 'inventory:update',
  'analytics:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Technician / Grower
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Technician / Grower'
AND p.name IN (
  'cultivation:view', 'cultivation:update',
  'cultivation:move', 'cultivation:stage_change',
  'cultivation:work_orders', 'cultivation:record_weights',
  'inventory:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Inventory Clerk
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Inventory Clerk'
AND p.name IN (
  'inventory:view', 'inventory:create', 'inventory:update',
  'inventory:transfer', 'inventory:adjust', 'inventory:cycle_count',
  'inventory:package'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to QA / Lab Manager
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'QA / Lab Manager'
AND p.name IN (
  'lab:view', 'lab:create', 'lab:update', 'lab:approve', 'lab:annotate',
  'inventory:view', 'compliance:view', 'compliance:export',
  'analytics:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Processor / Mfg Operator
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Processor / Mfg Operator'
AND p.name IN (
  'manufacturing:view', 'manufacturing:create', 'manufacturing:update',
  'manufacturing:run', 'inventory:view', 'inventory:create', 'inventory:update'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Shipper / Logistics
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Shipper / Logistics'
AND p.name IN (
  'shipping:view', 'shipping:create', 'shipping:update', 'shipping:book',
  'inventory:view', 'inventory:transfer'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Auditor / Compliance
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Auditor / Compliance'
AND p.name IN (
  'audit:view', 'audit:export', 'compliance:view', 'compliance:export',
  'analytics:view', 'analytics:export',
  'cultivation:view', 'inventory:view', 'manufacturing:view',
  'lab:view', 'shipping:view', 'documents:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assign permissions to Read-only Viewer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Read-only Viewer'
AND p.name IN (
  'cultivation:view', 'inventory:view', 'manufacturing:view',
  'lab:view', 'shipping:view', 'analytics:view'
)
ON CONFLICT (role_id, permission_id) DO NOTHING;
