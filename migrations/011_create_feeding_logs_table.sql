-- Create feeding_logs table
CREATE TABLE IF NOT EXISTS feeding_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
    plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    feeding_type VARCHAR(50) DEFAULT 'nutrients' CHECK (feeding_type IN ('nutrients', 'water', 'foliar', 'compost_tea', 'amendments')),
    nutrient_name VARCHAR(255),
    nutrient_brand VARCHAR(255),
    ec_level DECIMAL(5, 2), -- Electrical Conductivity
    ph_level DECIMAL(4, 2),
    ppm INTEGER,
    volume DECIMAL(10, 2), -- in liters or gallons
    volume_unit VARCHAR(10) DEFAULT 'L',
    feeding_schedule VARCHAR(255),
    notes TEXT,
    fed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_feeding_logs_user_id ON feeding_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_feeding_logs_room_id ON feeding_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_feeding_logs_batch_id ON feeding_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_feeding_logs_plant_id ON feeding_logs(plant_id);
CREATE INDEX IF NOT EXISTS idx_feeding_logs_fed_at ON feeding_logs(fed_at);
