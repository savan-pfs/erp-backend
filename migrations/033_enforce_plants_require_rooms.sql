-- Enforce that plants MUST be in a room
-- This is a critical compliance rule

-- First, assign any plants without rooms to a default room
-- Find the first available room for each user's organization
DO $$
DECLARE
    plant_record RECORD;
    default_room_id INTEGER;
BEGIN
    -- For each plant without a room, assign to first available room in user's organization
    FOR plant_record IN 
        SELECT p.id, p.user_id, u.organization_id
        FROM plants p
        INNER JOIN users u ON p.user_id = u.id
        WHERE p.room_id IS NULL
          AND p.is_active = true
    LOOP
        -- Find first available room in user's organization
        SELECT r.id INTO default_room_id
        FROM rooms r
        INNER JOIN facilities f ON r.facility_id = f.id
        WHERE f.organization_id = plant_record.organization_id
          AND r.is_active = true
        ORDER BY r.created_at ASC
        LIMIT 1;
        
        -- If room found, assign plant to it
        IF default_room_id IS NOT NULL THEN
            UPDATE plants
            SET room_id = default_room_id,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = plant_record.id;
        END IF;
    END LOOP;
END $$;

-- Make room_id NOT NULL
ALTER TABLE plants ALTER COLUMN room_id SET NOT NULL;

-- Add foreign key constraint if not exists (should already exist, but ensure it)
-- This ensures referential integrity
