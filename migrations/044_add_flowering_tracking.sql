-- Add flowering_start_date to batches table for tracking when batch entered flowering stage
ALTER TABLE batches ADD COLUMN IF NOT EXISTS flowering_start_date DATE;

-- Create index for flowering_start_date
CREATE INDEX IF NOT EXISTS idx_batches_flowering_start_date ON batches(flowering_start_date);

-- Ensure expected_harvest_date exists (should already exist from migration 017)
ALTER TABLE batches ADD COLUMN IF NOT EXISTS expected_harvest_date DATE;

-- Ensure current_stage exists (should already exist from migration 017)
ALTER TABLE batches ADD COLUMN IF NOT EXISTS current_stage VARCHAR(50) DEFAULT 'seed' CHECK (current_stage IN ('seed', 'germination', 'seedling', 'clone', 'vegetative', 'pre_flower', 'flowering', 'harvest'));

-- Ensure stage_changed_at exists (should already exist from migration 017)
ALTER TABLE batches ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
