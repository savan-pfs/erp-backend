-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) DEFAULT 'general' CHECK (task_type IN ('general', 'watering', 'feeding', 'pruning', 'training', 'inspection', 'harvest', 'cleaning', 'maintenance')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
    related_entity_type VARCHAR(50), -- plant, batch, room, etc
    related_entity_id INTEGER,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
    due_date DATE,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_room_id ON tasks(room_id);
CREATE INDEX IF NOT EXISTS idx_tasks_batch_id ON tasks(batch_id);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_tasks_updated_at 
    BEFORE UPDATE ON tasks 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
