-- Update tasks table status column to support new status values
-- New statuses: TODO, IN_PROCESS, IN_REVIEW, HOLD, BLOCKED, DONE

-- First, drop the existing check constraint
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;

-- Update existing status values to new format
-- pending -> TODO
-- in_progress -> IN_PROCESS
-- completed -> DONE
-- cancelled -> BLOCKED (or we can keep cancelled, but let's map to BLOCKED)
UPDATE tasks SET status = 'TODO' WHERE status = 'pending';
UPDATE tasks SET status = 'IN_PROCESS' WHERE status = 'in_progress';
UPDATE tasks SET status = 'DONE' WHERE status = 'completed';
UPDATE tasks SET status = 'BLOCKED' WHERE status = 'cancelled';

-- Add new check constraint with new status values
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
  CHECK (status IN ('TODO', 'IN_PROCESS', 'IN_REVIEW', 'HOLD', 'BLOCKED', 'DONE'));

-- Update default status
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'TODO';
