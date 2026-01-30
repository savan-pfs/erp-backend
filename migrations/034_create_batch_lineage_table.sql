-- Create batch_lineage table to track batch splits and merges
-- Critical for seed-to-sale traceability
CREATE TABLE IF NOT EXISTS batch_lineage (
    id SERIAL PRIMARY KEY,
    parent_batch_id INTEGER REFERENCES harvest_batches(id) ON DELETE SET NULL,
    child_batch_id INTEGER REFERENCES harvest_batches(id) ON DELETE SET NULL,
    lineage_type VARCHAR(50) NOT NULL CHECK (lineage_type IN (
        'SPLIT',        -- Parent batch split into child batches
        'MERGE',        -- Multiple parent batches merged into child batch
        'TRANSFORM'     -- Batch transformed (e.g., manufacturing)
    )),
    quantity DECIMAL(10, 3) NOT NULL, -- Quantity involved in operation (grams)
    unit VARCHAR(10) DEFAULT 'g',
    operation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_batch_lineage_parent_batch_id ON batch_lineage(parent_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_lineage_child_batch_id ON batch_lineage(child_batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_lineage_type ON batch_lineage(lineage_type);
CREATE INDEX IF NOT EXISTS idx_batch_lineage_operation_date ON batch_lineage(operation_date);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_batch_lineage_updated_at 
    BEFORE UPDATE ON batch_lineage 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
