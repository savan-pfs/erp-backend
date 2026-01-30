-- Add organization_id to users table for multi-tenant support
ALTER TABLE users ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;

-- Create index for organization_id
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);

-- Note: Existing users will have NULL organization_id
-- These should be assigned to organizations via admin interface or migration script
