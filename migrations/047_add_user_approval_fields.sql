-- Add approval and tracking fields to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) DEFAULT 'APPROVED' CHECK (approval_status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_users_approval_status ON users(approval_status);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by);

-- Update existing users to APPROVED status
UPDATE users SET approval_status = 'APPROVED' WHERE approval_status IS NULL;

-- Add comments
COMMENT ON COLUMN users.approval_status IS 'User approval status: PENDING_APPROVAL, APPROVED, REJECTED';
COMMENT ON COLUMN users.created_by IS 'User ID who created this user account';
