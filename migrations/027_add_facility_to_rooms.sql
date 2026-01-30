-- Add facility_id to rooms table
-- Rooms belong to facilities (which belong to organizations)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS facility_id INTEGER REFERENCES facilities(id) ON DELETE CASCADE;

-- Create index for facility_id
CREATE INDEX IF NOT EXISTS idx_rooms_facility_id ON rooms(facility_id);

-- Migrate existing rooms to facilities
-- Assign rooms to facilities based on user's organization's first facility
DO $$
DECLARE
    default_org_id INTEGER;
BEGIN
    -- Get default organization
    SELECT id INTO default_org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;
    
    IF default_org_id IS NOT NULL THEN
        -- Assign rooms to first facility in user's organization
        UPDATE rooms r
        SET facility_id = (
            SELECT f.id 
            FROM facilities f
            INNER JOIN users u ON f.organization_id = u.organization_id
            WHERE u.id = r.user_id
            ORDER BY f.created_at ASC
            LIMIT 1
        )
        WHERE r.facility_id IS NULL;
        
        -- For rooms without a matching facility, assign to first facility in default org
        UPDATE rooms r
        SET facility_id = (
            SELECT id FROM facilities WHERE organization_id = default_org_id ORDER BY created_at ASC LIMIT 1
        )
        WHERE r.facility_id IS NULL;
    END IF;
END $$;

-- Make facility_id required for new rooms (but allow NULL for existing during transition)
-- We'll enforce NOT NULL in a later migration after all data is migrated
