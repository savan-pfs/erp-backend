-- Create documents table for document management
-- Documents include licenses, SOPs, certifications, etc.
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE,
    uploaded_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN (
        'CULTIVATION_LICENSE',
        'MANUFACTURING_LICENSE',
        'DISPENSARY_LICENSE',
        'STATE_PERMIT',
        'SOP',
        'LAB_CERTIFICATION',
        'LEGAL_DOCUMENT',
        'OTHER'
    )),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL, -- Storage path
    file_size INTEGER, -- Size in bytes
    mime_type VARCHAR(100),
    status VARCHAR(50) DEFAULT 'PENDING_APPROVAL' CHECK (status IN (
        'PENDING_APPROVAL',
        'APPROVED',
        'REJECTED',
        'EXPIRED',
        'REVOKED'
    )),
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    rejection_reason TEXT,
    expires_at TIMESTAMP,
    metadata JSONB, -- Additional document metadata
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_documents_organization_id ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_facility_id ON documents(facility_id);
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_approved_by ON documents(approved_by);
CREATE INDEX IF NOT EXISTS idx_documents_expires_at ON documents(expires_at);
CREATE INDEX IF NOT EXISTS idx_documents_active ON documents(is_active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_documents_updated_at 
    BEFORE UPDATE ON documents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
