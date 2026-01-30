-- Add organization_id to roles for tenant-specific roles
ALTER TABLE roles 
ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE;

-- Drop existing unique constraint on name
ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;

-- Add new unique constraint: Name must be unique within an organization, 
-- or unique among global roles (organization_id IS NULL)
-- Note: In Postgres, multiple NULLs are distinct for UNIQUE constraints, so we need a partial index or composite.
-- Actually, we want to allow 'Admin' in Org A and 'Admin' in Org B.
-- But 'Admin' (Global) should be unique.

-- Strategy: Use a unique index on (name, organization_id)
-- However, we still want to prevent multiple global roles with same name.
-- Standard UNIQUE (name, organization_id) works for (Name, 1) and (Name, 2).
-- For (Name, NULL) and (Name, NULL), we DO NOT want duplicates.
-- So we create a unique index for nulls using partial index.

CREATE UNIQUE INDEX idx_roles_name_org ON roles(name, organization_id) WHERE organization_id IS NOT NULL;
CREATE UNIQUE INDEX idx_roles_name_global ON roles(name) WHERE organization_id IS NULL;

-- Index for searching roles by org
CREATE INDEX idx_roles_organization ON roles(organization_id);
