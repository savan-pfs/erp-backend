-- Update room types to include all required cannabis cultivation room types
-- Rooms are compliance boundaries

-- First, drop the existing check constraint (must be done before updates)
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS rooms_room_type_check;

-- Migrate existing room types to new format
UPDATE rooms SET room_type = 'VEGETATIVE' WHERE room_type = 'vegetative';
UPDATE rooms SET room_type = 'FLOWERING' WHERE room_type = 'flowering';
UPDATE rooms SET room_type = 'PROPAGATION' WHERE room_type = 'cloning';
UPDATE rooms SET room_type = 'DRYING' WHERE room_type = 'drying';
UPDATE rooms SET room_type = 'CURING' WHERE room_type = 'curing';

-- For any remaining invalid room types, set to PROPAGATION as default
UPDATE rooms SET room_type = 'PROPAGATION' 
WHERE room_type NOT IN (
  'PROPAGATION', 'VEGETATIVE', 'FLOWERING', 'DRYING', 'CURING',
  'TRIMMING', 'PACKAGING', 'PROCESSING', 'STORAGE', 'WASTE', 'QA_HOLD'
);

-- Add new check constraint with all required room types
ALTER TABLE rooms ADD CONSTRAINT rooms_room_type_check 
  CHECK (room_type IN (
    'PROPAGATION',      -- Seed/clone propagation
    'VEGETATIVE',       -- Vegetative growth
    'FLOWERING',        -- Flowering stage
    'DRYING',           -- Post-harvest drying
    'CURING',           -- Post-harvest curing
    'TRIMMING',         -- Trimming operations
    'PACKAGING',        -- Packaging operations
    'PROCESSING',       -- Manufacturing/processing
    'STORAGE',          -- Storage
    'WASTE',            -- Waste management
    'QA_HOLD'           -- QA hold/quarantine
  ));

-- Set default to PROPAGATION for new rooms
ALTER TABLE rooms ALTER COLUMN room_type SET DEFAULT 'PROPAGATION';
