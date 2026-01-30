-- Refactor inventory to be batch-first
-- Make harvest_batch_id required and add room_id

-- First, ensure all inventory has a harvest_batch_id
-- Assign to a default batch if missing (for existing data)
DO $$
DECLARE
    default_batch_id INTEGER;
BEGIN
    -- Find or create a default batch for orphaned inventory
    SELECT id INTO default_batch_id
    FROM harvest_batches
    ORDER BY created_at ASC
    LIMIT 1;
    
    -- If no batches exist, we can't assign - will need manual intervention
    IF default_batch_id IS NOT NULL THEN
        UPDATE inventory
        SET harvest_batch_id = default_batch_id
        WHERE harvest_batch_id IS NULL;
    END IF;
END $$;

-- Add room_id to inventory (inventory is room-scoped)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL;

-- Create index for room_id
CREATE INDEX IF NOT EXISTS idx_inventory_room_id ON inventory(room_id);

-- Make harvest_batch_id NOT NULL (after ensuring all records have one)
-- Note: This will fail if there are still NULL values - manual cleanup required
-- ALTER TABLE inventory ALTER COLUMN harvest_batch_id SET NOT NULL;

-- Add constraint to prevent negative inventory at DB level
-- This is enforced via trigger on inventory_ledger, but also add check constraint
ALTER TABLE inventory ADD CONSTRAINT inventory_quantity_non_negative 
    CHECK (quantity >= 0);

-- Add batch number index if not exists
CREATE INDEX IF NOT EXISTS idx_inventory_batch_number ON inventory(batch_number);

-- Update inventory to ensure batch_number is populated from harvest_batch
UPDATE inventory i
SET batch_number = hb.harvest_name
FROM harvest_batches hb
WHERE i.harvest_batch_id = hb.id
  AND (i.batch_number IS NULL OR i.batch_number = '');
