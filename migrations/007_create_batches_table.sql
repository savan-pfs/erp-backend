-- Create batches table
CREATE TABLE IF NOT EXISTS batches (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_name VARCHAR(255) NOT NULL,
    batch_type VARCHAR(50) DEFAULT 'seed' CHECK (batch_type IN ('seed', 'clone', 'tissue')),
    genetic_id INTEGER REFERENCES genetics(id) ON DELETE SET NULL,
    mother_id INTEGER REFERENCES mothers(id) ON DELETE SET NULL,
    source_supplier VARCHAR(255),
    source_date DATE,
    total_seeds INTEGER DEFAULT 0,
    total_clones INTEGER DEFAULT 0,
    germination_rate DECIMAL(5, 2), -- in percentage
    success_rate DECIMAL(5, 2), -- in percentage
    purchase_price DECIMAL(10, 2),
    purchase_currency VARCHAR(3) DEFAULT 'USD',
    storage_location VARCHAR(255),
    storage_conditions TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_batches_user_id ON batches(user_id);
CREATE INDEX IF NOT EXISTS idx_batches_genetic_id ON batches(genetic_id);
CREATE INDEX IF NOT EXISTS idx_batches_mother_id ON batches(mother_id);
CREATE INDEX IF NOT EXISTS idx_batches_type ON batches(batch_type);
CREATE INDEX IF NOT EXISTS idx_batches_active ON batches(is_active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_batches_updated_at 
    BEFORE UPDATE ON batches 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
