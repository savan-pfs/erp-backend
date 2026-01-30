-- Add extended columns to batches table for full lifecycle tracking
ALTER TABLE batches ADD COLUMN IF NOT EXISTS room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS batch_number VARCHAR(255) UNIQUE;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS current_stage VARCHAR(50) DEFAULT 'seed' CHECK (current_stage IN ('seed', 'germination', 'seedling', 'clone', 'vegetative', 'pre_flower', 'flowering', 'harvest'));
ALTER TABLE batches ADD COLUMN IF NOT EXISTS initial_count INTEGER DEFAULT 0;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS current_count INTEGER DEFAULT 0;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS expected_harvest_date DATE;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE batches ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived'));

-- Create index for room_id if not exists
CREATE INDEX IF NOT EXISTS idx_batches_room_id ON batches(room_id);
CREATE INDEX IF NOT EXISTS idx_batches_current_stage ON batches(current_stage);
CREATE INDEX IF NOT EXISTS idx_batches_status ON batches(status);
