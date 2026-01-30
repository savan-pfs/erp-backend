-- Add indexes to improve Super Admin Dashboard performance

-- Index for filtering organizations by approval status
CREATE INDEX IF NOT EXISTS idx_organizations_approval_status ON organizations(approval_status);

-- Index for sorting/filtering users by role and organization
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);

-- Index for searching users by name (using gin/trigram if available, or just btree for prefix)
-- Using simple btree for now as extensions might not be enabled
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_lastname ON users(last_name);

-- Index for user approvals
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
