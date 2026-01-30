-- Create inventory table
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    harvest_batch_id INTEGER REFERENCES harvest_batches(id) ON DELETE SET NULL,
    genetic_id INTEGER REFERENCES genetics(id) ON DELETE SET NULL,
    lot_number VARCHAR(255) UNIQUE NOT NULL,
    item_type VARCHAR(50) DEFAULT 'flower' CHECK (item_type IN ('flower', 'trim', 'seeds', 'clones', 'pre_roll', 'concentrate', 'edible', 'other')),
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit VARCHAR(20) DEFAULT 'g',
    location VARCHAR(255),
    container_type VARCHAR(100),
    package_date DATE,
    expiration_date DATE,
    batch_number VARCHAR(255),
    test_results TEXT,
    compliance_tag VARCHAR(255),
    price_per_unit DECIMAL(10, 2),
    total_value DECIMAL(10, 2),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold', 'disposed', 'quarantine')),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_harvest_batch_id ON inventory(harvest_batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_genetic_id ON inventory(genetic_id);
CREATE INDEX IF NOT EXISTS idx_inventory_lot_number ON inventory(lot_number);
CREATE INDEX IF NOT EXISTS idx_inventory_item_type ON inventory(item_type);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_inventory_updated_at 
    BEFORE UPDATE ON inventory 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
