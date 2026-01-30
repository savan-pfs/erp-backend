-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL DEFAULT 'info',
  title VARCHAR(255) NOT NULL,
  message TEXT,
  entity_type VARCHAR(50),
  entity_id INTEGER,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP,
  metadata JSONB,
  CONSTRAINT valid_type CHECK (type IN ('info', 'success', 'warning', 'error', 'task', 'alert', 'system'))
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);

-- Add comment
COMMENT ON TABLE notifications IS 'User notifications for real-time alerts and updates';
COMMENT ON COLUMN notifications.type IS 'Notification type: info, success, warning, error, task, alert, system';
COMMENT ON COLUMN notifications.entity_type IS 'Related entity type (e.g., task, batch, plant)';
COMMENT ON COLUMN notifications.entity_id IS 'Related entity ID';
COMMENT ON COLUMN notifications.metadata IS 'Additional notification data in JSON format';
