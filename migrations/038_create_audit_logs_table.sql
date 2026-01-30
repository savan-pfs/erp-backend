-- Create audit_logs table for compliance and audit trail
-- Every action in the system is logged here
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
    action_type VARCHAR(100) NOT NULL, -- e.g., 'plant:create', 'inventory:adjust', 'harvest:complete'
    resource_type VARCHAR(50) NOT NULL, -- e.g., 'plant', 'inventory', 'harvest'
    resource_id INTEGER, -- ID of the affected resource
    action VARCHAR(50) NOT NULL, -- 'create', 'update', 'delete', 'view', 'approve', etc.
    description TEXT, -- Human-readable description
    old_values JSONB, -- Previous values (for updates)
    new_values JSONB, -- New values (for updates/creates)
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT,
    success BOOLEAN DEFAULT true,
    error_message TEXT, -- If action failed
    metadata JSONB, -- Additional context
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_facility_id ON audit_logs(facility_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_type ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_success ON audit_logs(success);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_resource ON audit_logs(organization_id, resource_type, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_date ON audit_logs(user_id, created_at);
