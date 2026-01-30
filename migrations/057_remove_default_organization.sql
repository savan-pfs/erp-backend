-- Remove Default Organization if it exists and has no critical data
-- Note: This is careful deletion. If there are constraints, it might fail, which is good.

DO $$
DECLARE
    default_org_id INTEGER;
BEGIN
    SELECT id INTO default_org_id FROM organizations WHERE name = 'Default Organization';

    IF default_org_id IS NOT NULL THEN
        -- Optional: Check if referenced by valid users (other than initial seed if any)
        -- For now, we attempt to delete. If users are linked, it will fail due to FKs unless we handle it.
        -- Assuming "Default Organization" is just trash/seed data.
        
        -- Delete related data first if we want to force clean (OPTIONAL - use with caution)
        -- DELETE FROM organization_integrations WHERE organization_id = default_org_id;
        
        -- Try to delete the organization
        DELETE FROM organizations WHERE id = default_org_id;
        
        RAISE NOTICE 'Deleted Default Organization (ID: %)', default_org_id;
    ELSE
        RAISE NOTICE 'Default Organization not found.';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not delete Default Organization: %', SQLERRM;
END $$;
