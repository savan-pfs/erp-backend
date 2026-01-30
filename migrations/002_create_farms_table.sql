-- Create farms table
CREATE TABLE IF NOT EXISTS farms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location_address TEXT,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    total_area DECIMAL(10, 2) NOT NULL, -- in hectares
    soil_type VARCHAR(100),
    water_source VARCHAR(100),
    ownership_type VARCHAR(50) DEFAULT 'owned' CHECK (ownership_type IN ('owned', 'rented', 'leased')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);
CREATE INDEX IF NOT EXISTS idx_farms_location ON farms(latitude, longitude);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_farms_updated_at 
    BEFORE UPDATE ON farms 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
