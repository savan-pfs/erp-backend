-- Create facilities table (replaces farms concept)
-- Facilities are physical locations belonging to organizations
CREATE TABLE IF NOT EXISTS facilities (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_code VARCHAR(2) NOT NULL, -- US state code (e.g., 'CA', 'CO')
    country_code VARCHAR(2) DEFAULT 'US', -- ISO country code
    postal_code VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    license_number VARCHAR(255), -- State license number
    license_type VARCHAR(100), -- e.g., 'CULTIVATION', 'MANUFACTURING', 'DISPENSARY'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT facilities_state_code_check CHECK (LENGTH(state_code) = 2),
    CONSTRAINT facilities_country_code_check CHECK (LENGTH(country_code) = 2)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_facilities_organization_id ON facilities(organization_id);
CREATE INDEX IF NOT EXISTS idx_facilities_state_code ON facilities(state_code);
CREATE INDEX IF NOT EXISTS idx_facilities_country_code ON facilities(country_code);
CREATE INDEX IF NOT EXISTS idx_facilities_location ON facilities(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_facilities_active ON facilities(is_active);
CREATE INDEX IF NOT EXISTS idx_facilities_license_number ON facilities(license_number);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_facilities_updated_at 
    BEFORE UPDATE ON facilities 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
