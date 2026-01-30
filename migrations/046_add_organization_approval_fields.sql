-- Add approval fields to organizations table for multi-tenant approval workflow
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'APPROVED' CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS location_state_code VARCHAR(2),
ADD COLUMN IF NOT EXISTS location_country_code VARCHAR(2) DEFAULT 'US',
ADD COLUMN IF NOT EXISTS cultivation_license_document_id INTEGER REFERENCES documents(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organizations_approval_status ON organizations(approval_status);
CREATE INDEX IF NOT EXISTS idx_organizations_approved_by ON organizations(approved_by);
CREATE INDEX IF NOT EXISTS idx_organizations_location_state ON organizations(location_state_code);
CREATE INDEX IF NOT EXISTS idx_organizations_cultivation_license ON organizations(cultivation_license_document_id);

-- Update existing organizations to APPROVED status
UPDATE organizations SET approval_status = 'APPROVED' WHERE approval_status IS NULL;

-- Add comments
COMMENT ON COLUMN organizations.approval_status IS 'Organization approval status: PENDING_APPROVAL, APPROVED, REJECTED';
COMMENT ON COLUMN organizations.approved_by IS 'Super Admin user ID who approved/rejected the organization';
COMMENT ON COLUMN organizations.approved_at IS 'Timestamp when organization was approved or rejected';
COMMENT ON COLUMN organizations.rejection_reason IS 'Reason for rejection if organization was rejected';
COMMENT ON COLUMN organizations.location_state_code IS 'Primary location state code (2-letter US state code)';
COMMENT ON COLUMN organizations.location_country_code IS 'Primary location country code (default: US)';
COMMENT ON COLUMN organizations.cultivation_license_document_id IS 'Reference to the cultivation license document';
