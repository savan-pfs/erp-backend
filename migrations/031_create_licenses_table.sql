-- Create licenses table
-- Licenses reference documents and track license status
CREATE TABLE IF NOT EXISTS licenses (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE,
    document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    license_type VARCHAR(50) NOT NULL CHECK (license_type IN (
        'CULTIVATION',
        'MANUFACTURING',
        'DISPENSARY',
        'DISTRIBUTION',
        'TESTING',
        'TRANSPORT',
        'OTHER'
    )),
    license_number VARCHAR(255) NOT NULL, -- State-issued license number
    state_code VARCHAR(2) NOT NULL,
    country_code VARCHAR(2) DEFAULT 'US',
    issued_by VARCHAR(255), -- Issuing authority
    issued_date DATE,
    effective_date DATE NOT NULL,
    expires_date DATE,
    status VARCHAR(50) DEFAULT 'PENDING_APPROVAL' CHECK (status IN (
        'PENDING_APPROVAL',
        'ACTIVE',
        'SUSPENDED',
        'EXPIRED',
        'REVOKED'
    )),
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    suspension_reason TEXT,
    revocation_reason TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT licenses_state_code_check CHECK (LENGTH(state_code) = 2),
    CONSTRAINT licenses_country_code_check CHECK (LENGTH(country_code) = 2),
    UNIQUE(organization_id, facility_id, license_number, state_code)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_licenses_organization_id ON licenses(organization_id);
CREATE INDEX IF NOT EXISTS idx_licenses_facility_id ON licenses(facility_id);
CREATE INDEX IF NOT EXISTS idx_licenses_document_id ON licenses(document_id);
CREATE INDEX IF NOT EXISTS idx_licenses_license_type ON licenses(license_type);
CREATE INDEX IF NOT EXISTS idx_licenses_license_number ON licenses(license_number);
CREATE INDEX IF NOT EXISTS idx_licenses_state_code ON licenses(state_code);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);
CREATE INDEX IF NOT EXISTS idx_licenses_effective_date ON licenses(effective_date);
CREATE INDEX IF NOT EXISTS idx_licenses_expires_date ON licenses(expires_date);
CREATE INDEX IF NOT EXISTS idx_licenses_active ON licenses(is_active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_licenses_updated_at 
    BEFORE UPDATE ON licenses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to automatically set license status based on document approval
CREATE OR REPLACE FUNCTION update_license_status_on_document_approval()
RETURNS TRIGGER AS $$
BEGIN
    -- When document is approved, update related licenses
    IF NEW.status = 'APPROVED' AND OLD.status = 'PENDING_APPROVAL' THEN
        UPDATE licenses
        SET status = 'ACTIVE',
            approved_by = NEW.approved_by,
            approved_at = NEW.approved_at
        WHERE document_id = NEW.id
          AND status = 'PENDING_APPROVAL';
    END IF;
    
    -- When document is rejected, update related licenses
    IF NEW.status = 'REJECTED' AND OLD.status = 'PENDING_APPROVAL' THEN
        UPDATE licenses
        SET status = 'REVOKED',
            revocation_reason = 'Document rejected: ' || COALESCE(NEW.rejection_reason, 'No reason provided')
        WHERE document_id = NEW.id
          AND status = 'PENDING_APPROVAL';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_license_on_document_approval
    AFTER UPDATE ON documents
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION update_license_status_on_document_approval();
