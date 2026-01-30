-- Create compliance-related tables
-- Lab tests, compliance checks, recalls, incidents

-- Lab tests table
CREATE TABLE IF NOT EXISTS lab_tests (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
    harvest_batch_id INTEGER REFERENCES harvest_batches(id) ON DELETE SET NULL,
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
    manufacturing_batch_id INTEGER REFERENCES manufacturing_batches(id) ON DELETE SET NULL,
    lab_name VARCHAR(255) NOT NULL,
    lab_license_number VARCHAR(255),
    test_type VARCHAR(50) NOT NULL CHECK (test_type IN (
        'POTENCY',
        'PESTICIDES',
        'HEAVY_METALS',
        'MICROBIOLOGICAL',
        'RESIDUAL_SOLVENTS',
        'TERPENES',
        'MOISTURE',
        'WATER_ACTIVITY',
        'FULL_PANEL',
        'OTHER'
    )),
    test_date DATE NOT NULL,
    results JSONB NOT NULL, -- Flexible JSON structure for test results
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'PASSED',
        'FAILED',
        'CONDITIONAL'
    )),
    certificate_number VARCHAR(255),
    certificate_url TEXT,
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Compliance checks - Automated compliance validation results
CREATE TABLE IF NOT EXISTS compliance_checks (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
    check_type VARCHAR(50) NOT NULL CHECK (check_type IN (
        'STATE_LEGALITY',
        'LICENSE_VALIDITY',
        'LAB_TEST_REQUIRED',
        'BATCH_TRACEABILITY',
        'INVENTORY_ACCURACY',
        'ROOM_COMPLIANCE',
        'DOCUMENT_EXPIRATION',
        'OTHER'
    )),
    resource_type VARCHAR(50), -- Type of resource being checked
    resource_id INTEGER, -- ID of resource
    status VARCHAR(50) NOT NULL CHECK (status IN (
        'PASS',
        'FAIL',
        'WARNING',
        'PENDING'
    )),
    check_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    result_details JSONB, -- Detailed check results
    resolved BOOLEAN DEFAULT false,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recalls table
CREATE TABLE IF NOT EXISTS recalls (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
    recall_type VARCHAR(50) NOT NULL CHECK (recall_type IN (
        'VOLUNTARY',
        'MANDATORY',
        'PREVENTIVE'
    )),
    reason TEXT NOT NULL,
    affected_batches INTEGER[], -- Array of harvest_batch_ids
    affected_inventory INTEGER[], -- Array of inventory_ids
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE',
        'RESOLVED',
        'CANCELLED'
    )),
    initiated_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    initiated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    resolution_notes TEXT,
    notes TEXT
);

-- Incidents table
CREATE TABLE IF NOT EXISTS incidents (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN (
        'SAFETY',
        'QUALITY',
        'COMPLIANCE',
        'SECURITY',
        'ENVIRONMENTAL',
        'OTHER'
    )),
    severity VARCHAR(50) DEFAULT 'LOW' CHECK (severity IN (
        'LOW',
        'MEDIUM',
        'HIGH',
        'CRITICAL'
    )),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    occurred_at TIMESTAMP NOT NULL,
    reported_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'OPEN' CHECK (status IN (
        'OPEN',
        'INVESTIGATING',
        'RESOLVED',
        'CLOSED'
    )),
    resolution TEXT,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    affected_resources JSONB, -- Related resources (batches, inventory, etc.)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lab_tests_organization_id ON lab_tests(organization_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_harvest_batch_id ON lab_tests(harvest_batch_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_inventory_id ON lab_tests(inventory_id);
CREATE INDEX IF NOT EXISTS idx_lab_tests_status ON lab_tests(status);
CREATE INDEX IF NOT EXISTS idx_lab_tests_test_date ON lab_tests(test_date);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_organization_id ON compliance_checks(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_status ON compliance_checks(status);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_resolved ON compliance_checks(resolved);
CREATE INDEX IF NOT EXISTS idx_recalls_organization_id ON recalls(organization_id);
CREATE INDEX IF NOT EXISTS idx_recalls_status ON recalls(status);
CREATE INDEX IF NOT EXISTS idx_incidents_organization_id ON incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);

-- Triggers
CREATE TRIGGER update_lab_tests_updated_at 
    BEFORE UPDATE ON lab_tests 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at 
    BEFORE UPDATE ON incidents 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
