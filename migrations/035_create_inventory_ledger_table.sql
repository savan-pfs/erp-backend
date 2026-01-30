-- Create inventory_ledger table for gram-level inventory tracking
-- Every inventory movement is recorded here for full audit trail
CREATE TABLE IF NOT EXISTS inventory_ledger (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
    harvest_batch_id INTEGER REFERENCES harvest_batches(id) ON DELETE SET NULL,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN (
        'INITIAL',          -- Initial inventory creation
        'ADJUSTMENT',       -- Manual adjustment
        'TRANSFER',         -- Transfer between rooms/locations
        'SPLIT',            -- Batch split
        'MERGE',            -- Batch merge
        'SALE',             -- Sale/transfer out
        'WASTE',            -- Waste/destruction
        'PACKAGING',        -- Packaging operation
        'MANUFACTURING_IN', -- Input to manufacturing
        'MANUFACTURING_OUT' -- Output from manufacturing
    )),
    quantity_change DECIMAL(10, 3) NOT NULL, -- Positive for additions, negative for removals (grams)
    quantity_before DECIMAL(10, 3) NOT NULL, -- Quantity before transaction
    quantity_after DECIMAL(10, 3) NOT NULL,  -- Quantity after transaction
    unit VARCHAR(10) DEFAULT 'g',
    reference_id INTEGER, -- Reference to related record (e.g., sale_id, waste_id)
    reference_type VARCHAR(50), -- Type of reference
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_inventory_id ON inventory_ledger(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_harvest_batch_id ON inventory_ledger(harvest_batch_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_room_id ON inventory_ledger(room_id);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_transaction_type ON inventory_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_created_at ON inventory_ledger(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_performed_by ON inventory_ledger(performed_by);

-- Function to prevent negative inventory
CREATE OR REPLACE FUNCTION check_negative_inventory()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.quantity_after < 0 THEN
        RAISE EXCEPTION 'Negative inventory not allowed. Current quantity: %, Attempted change: %', 
            NEW.quantity_before, NEW.quantity_change;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to prevent negative inventory
CREATE TRIGGER trigger_prevent_negative_inventory
    BEFORE INSERT ON inventory_ledger
    FOR EACH ROW
    EXECUTE FUNCTION check_negative_inventory();
