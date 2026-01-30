-- Remove facility/location logic from the system
-- This migration removes facility_id references and drops facility/location tables

-- Step 1: Remove facility_id from rooms table
ALTER TABLE rooms DROP CONSTRAINT IF EXISTS fk_rooms_facility;
ALTER TABLE rooms DROP COLUMN IF EXISTS facility_id;
DROP INDEX IF EXISTS idx_rooms_facility_id;

-- Step 2: Remove facility_id from user_roles table
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_facility_id_fkey;
ALTER TABLE user_roles DROP COLUMN IF EXISTS facility_id;
DROP INDEX IF EXISTS idx_user_roles_facility_id;

-- Step 3: Remove facility_id from other tables
ALTER TABLE manufacturing_batches DROP CONSTRAINT IF EXISTS manufacturing_batches_facility_id_fkey;
ALTER TABLE manufacturing_batches DROP COLUMN IF EXISTS facility_id;
DROP INDEX IF EXISTS idx_manufacturing_batches_facility_id;

ALTER TABLE compliance_checks DROP CONSTRAINT IF EXISTS compliance_checks_facility_id_fkey;
ALTER TABLE compliance_checks DROP COLUMN IF EXISTS facility_id;

ALTER TABLE recalls DROP CONSTRAINT IF EXISTS recalls_facility_id_fkey;
ALTER TABLE recalls DROP COLUMN IF EXISTS facility_id;

ALTER TABLE incidents DROP CONSTRAINT IF EXISTS incidents_facility_id_fkey;
ALTER TABLE incidents DROP COLUMN IF EXISTS facility_id;

ALTER TABLE licenses DROP CONSTRAINT IF EXISTS licenses_facility_id_fkey;
ALTER TABLE licenses DROP COLUMN IF EXISTS facility_id;
DROP INDEX IF EXISTS idx_licenses_facility_id;

-- Step 4: Drop locations table (depends on facilities)
DROP TABLE IF EXISTS locations CASCADE;

-- Step 5: Drop facilities table
DROP TABLE IF EXISTS facilities CASCADE;

-- Step 6: Update user_roles unique constraint (remove facility_id)
ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_id_organization_id_facility_id_key;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_user_id_role_id_organization_id_key 
  UNIQUE(user_id, role_id, organization_id);
