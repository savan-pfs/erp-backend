-- Create harvest_batches table
CREATE TABLE IF NOT EXISTS harvest_batches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    harvest_name VARCHAR(255) NOT NULL,
    harvest_date DATE NOT NULL,
    plant_count INTEGER DEFAULT 0,
    wet_weight DECIMAL(10, 2), -- in grams or pounds
    dry_weight DECIMAL(10, 2),
    weight_unit VARCHAR(10) DEFAULT 'g',
    trim_weight DECIMAL(10, 2),
    waste_weight DECIMAL(10, 2),
    drying_method VARCHAR(100),
    drying_start_date DATE,
    drying_end_date DATE,
    curing_start_date DATE,
    curing_end_date DATE,
    storage_location VARCHAR(255),
    quality_grade VARCHAR(50),
    thc_percentage DECIMAL(5, 2),
    cbd_percentage DECIMAL(5, 2),
    terpene_profile TEXT,
    notes TEXT,
    status VARCHAR(50) DEFAULT 'drying' CHECK (status IN ('harvested', 'drying', 'curing', 'trimmed', 'tested', 'packaged', 'completed')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_harvest_batches_user_id ON harvest_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_batch_id ON harvest_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_room_id ON harvest_batches(room_id);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_harvest_date ON harvest_batches(harvest_date);
CREATE INDEX IF NOT EXISTS idx_harvest_batches_status ON harvest_batches(status);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_harvest_batches_updated_at 
    BEFORE UPDATE ON harvest_batches 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
