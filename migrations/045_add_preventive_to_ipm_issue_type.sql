-- Add 'preventive' to allowed issue_type values in ipm_logs table
-- Preventive treatments are a valid IPM practice

-- Drop the existing check constraint
ALTER TABLE ipm_logs DROP CONSTRAINT IF EXISTS ipm_logs_issue_type_check;

-- Add new check constraint with 'preventive' included
ALTER TABLE ipm_logs ADD CONSTRAINT ipm_logs_issue_type_check 
  CHECK (issue_type IN ('pest', 'disease', 'deficiency', 'toxicity', 'environmental', 'preventive'));
