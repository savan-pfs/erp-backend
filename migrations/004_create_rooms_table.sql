-- Create rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    room_type VARCHAR(50) DEFAULT 'vegetative' CHECK (room_type IN ('vegetative', 'flowering', 'cloning', 'drying', 'curing')),
    capacity INTEGER DEFAULT 0,
    current_plants INTEGER DEFAULT 0,
    dimensions_length DECIMAL(8, 2), -- in meters
    dimensions_width DECIMAL(8, 2), -- in meters
    dimensions_height DECIMAL(8, 2), -- in meters
    temperature_min DECIMAL(5, 2), -- in Celsius
    temperature_max DECIMAL(5, 2), -- in Celsius
    humidity_min DECIMAL(5, 2), -- in percentage
    humidity_max DECIMAL(5, 2), -- in percentage
    lighting_type VARCHAR(100),
    ventilation_system BOOLEAN DEFAULT false,
    co2_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rooms_user_id ON rooms(user_id);
CREATE INDEX IF NOT EXISTS idx_rooms_type ON rooms(room_type);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON rooms(is_active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_rooms_updated_at 
    BEFORE UPDATE ON rooms 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
