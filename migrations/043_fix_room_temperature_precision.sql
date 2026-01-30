-- Fix numeric field overflow for temperature fields
-- Increase precision from DECIMAL(5,2) to DECIMAL(6,2) to allow larger temperature values
-- This supports both Celsius and Fahrenheit temperature scales

ALTER TABLE rooms 
  ALTER COLUMN temperature_min TYPE DECIMAL(6, 2),
  ALTER COLUMN temperature_max TYPE DECIMAL(6, 2);

-- Note: Humidity fields remain DECIMAL(5,2) as they should be 0-100 (percentage)
-- Validation should be added in application code to ensure humidity values are within 0-100 range
