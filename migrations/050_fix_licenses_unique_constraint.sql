-- Fix licenses table unique constraint after facility_id removal
-- The original constraint included facility_id, which was removed in migration 042
-- This migration ensures the unique constraint exists without facility_id

-- Drop the old constraint if it still exists (it should have been auto-dropped, but just in case)
ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_organization_id_facility_id_license_number_state_code_key;

-- Add new unique constraint without facility_id
-- This ensures one license per organization, license number, and state combination
ALTER TABLE licenses 
ADD CONSTRAINT licenses_organization_id_license_number_state_code_key 
UNIQUE(organization_id, license_number, state_code);

-- Add comment
COMMENT ON CONSTRAINT licenses_organization_id_license_number_state_code_key ON licenses IS 
'Ensures unique license per organization, license number, and state (facility_id was removed in migration 042)';
