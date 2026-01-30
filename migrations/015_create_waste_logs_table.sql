-- Create waste_logs table
CREATE TABLE IF NOT EXISTS waste_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
    plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    waste_type VARCHAR(50) DEFAULT 'plant_material' CHECK (waste_type IN ('plant_material', 'trim', 'roots', 'stems', 'leaves', 'defective', 'expired', 'contaminated', 'other')),
    reason VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'g',
    disposal_method VARCHAR(100),
    disposed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    compliance_notes TEXT,
    witness_name VARCHAR(255),
    authorization_code VARCHAR(255),
    images TEXT[], -- Array of image URLs
    disposed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waste_logs_user_id ON waste_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_room_id ON waste_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_batch_id ON waste_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_plant_id ON waste_logs(plant_id);
CREATE INDEX IF NOT EXISTS idx_waste_logs_waste_type ON waste_logs(waste_type);
CREATE INDEX IF NOT EXISTS idx_waste_logs_disposed_at ON waste_logs(disposed_at);
