-- Create organization_signups table to track signup requests
CREATE TABLE IF NOT EXISTS organization_signups (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signup_data JSONB, -- Store form data: organizationName, legalName, taxId, location, etc.
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organization_signups_organization_id ON organization_signups(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_signups_user_id ON organization_signups(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_signups_status ON organization_signups(status);
CREATE INDEX IF NOT EXISTS idx_organization_signups_reviewed_by ON organization_signups(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_organization_signups_created_at ON organization_signups(created_at DESC);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_organization_signups_updated_at 
    BEFORE UPDATE ON organization_signups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments
COMMENT ON TABLE organization_signups IS 'Tracks organization signup requests for Super Admin review';
COMMENT ON COLUMN organization_signups.signup_data IS 'JSONB field storing original signup form data';
COMMENT ON COLUMN organization_signups.status IS 'Signup review status: PENDING, APPROVED, REJECTED';
COMMENT ON COLUMN organization_signups.reviewed_by IS 'Super Admin user ID who reviewed the signup';
COMMENT ON COLUMN organization_signups.review_notes IS 'Notes from Super Admin during review';
