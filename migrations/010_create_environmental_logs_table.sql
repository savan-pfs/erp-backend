-- Create environmental_logs table
CREATE TABLE IF NOT EXISTS environmental_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    temperature DECIMAL(5, 2), -- in Celsius
    humidity DECIMAL(5, 2), -- in percentage
    vpd DECIMAL(5, 2), -- Vapor Pressure Deficit
    co2_level INTEGER, -- in PPM
    light_intensity INTEGER, -- in PPFD
    air_circulation VARCHAR(50),
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_environmental_logs_user_id ON environmental_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_environmental_logs_room_id ON environmental_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_environmental_logs_recorded_at ON environmental_logs(recorded_at);
