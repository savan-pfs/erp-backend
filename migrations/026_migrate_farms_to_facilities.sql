-- Migrate existing farms data to facilities
-- This migration creates a default organization and migrates farms to facilities

-- Step 1: Create a default organization for existing users (if it doesn't exist)

-- Step 2: Get the default organization ID (PostgreSQL doesn't support RETURNING INTO variable directly)
DO $$
DECLARE
    default_org_id INTEGER;
BEGIN
    -- Get or create default organization
    SELECT id INTO default_org_id FROM organizations WHERE name = 'Default Organization' LIMIT 1;
    
    IF default_org_id IS NULL THEN
        INSERT INTO organizations (name, legal_name, is_active)
        VALUES ('Default Organization', 'Default Organization', true)
        RETURNING id INTO default_org_id;
    END IF;
    
    -- Step 3: Assign all existing users to default organization
    UPDATE users SET organization_id = default_org_id WHERE organization_id IS NULL;
    
    -- Step 4: Create facilities from farms
    INSERT INTO facilities (
        organization_id,
        name,
        description,
        address_line1,
        city,
        state_code,
        country_code,
        postal_code,
        latitude,
        longitude,
        is_active,
        created_at,
        updated_at
    )
    SELECT 
        COALESCE(u.organization_id, default_org_id),
        f.name,
        f.description,
        f.location_address,
        NULL, -- city - not in farms table
        'CA', -- Default to CA - should be updated manually
        'US',
        NULL, -- postal_code - not in farms table
        f.latitude,
        f.longitude,
        f.is_active,
        f.created_at,
        f.updated_at
    FROM farms f
    INNER JOIN users u ON f.user_id = u.id
    WHERE NOT EXISTS (
        SELECT 1 FROM facilities WHERE name = f.name AND organization_id = COALESCE(u.organization_id, default_org_id)
    );
    
    -- Step 5: Create locations for facilities
    INSERT INTO locations (facility_id, state_code, country_code, jurisdiction_name, is_primary)
    SELECT 
        fac.id,
        fac.state_code,
        fac.country_code,
        CASE fac.state_code
            WHEN 'CA' THEN 'California'
            WHEN 'CO' THEN 'Colorado'
            WHEN 'WA' THEN 'Washington'
            WHEN 'OR' THEN 'Oregon'
            WHEN 'NV' THEN 'Nevada'
            WHEN 'MA' THEN 'Massachusetts'
            WHEN 'ME' THEN 'Maine'
            WHEN 'VT' THEN 'Vermont'
            WHEN 'MI' THEN 'Michigan'
            WHEN 'IL' THEN 'Illinois'
            WHEN 'AZ' THEN 'Arizona'
            WHEN 'NJ' THEN 'New Jersey'
            WHEN 'NY' THEN 'New York'
            WHEN 'CT' THEN 'Connecticut'
            WHEN 'VA' THEN 'Virginia'
            WHEN 'NM' THEN 'New Mexico'
            WHEN 'MT' THEN 'Montana'
            WHEN 'SD' THEN 'South Dakota'
            ELSE 'Unknown'
        END,
        true
    FROM facilities fac
    WHERE NOT EXISTS (
        SELECT 1 FROM locations WHERE facility_id = fac.id AND is_primary = true
    );
END $$;

-- Note: Farms table is kept for backward compatibility but should not be used for new data
-- All new operations should use facilities instead
