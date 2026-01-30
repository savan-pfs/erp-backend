-- Create locations table for jurisdiction hierarchy
-- This table stores state/jurisdiction metadata
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    state_code VARCHAR(2) NOT NULL,
    country_code VARCHAR(2) DEFAULT 'US',
    jurisdiction_name VARCHAR(255), -- e.g., 'California', 'Colorado'
    timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
    is_primary BOOLEAN DEFAULT false, -- Primary location for facility
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT locations_state_code_check CHECK (LENGTH(state_code) = 2),
    CONSTRAINT locations_country_code_check CHECK (LENGTH(country_code) = 2),
    UNIQUE(facility_id, state_code, country_code)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_locations_facility_id ON locations(facility_id);
CREATE INDEX IF NOT EXISTS idx_locations_state_code ON locations(state_code);
CREATE INDEX IF NOT EXISTS idx_locations_country_code ON locations(country_code);
CREATE INDEX IF NOT EXISTS idx_locations_primary ON locations(is_primary);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_locations_updated_at 
    BEFORE UPDATE ON locations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
