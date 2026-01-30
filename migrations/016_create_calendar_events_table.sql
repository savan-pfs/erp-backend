-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    event_type VARCHAR(50) DEFAULT 'task' CHECK (event_type IN ('task', 'harvest', 'feeding', 'inspection', 'maintenance', 'meeting', 'deadline', 'other')),
    related_entity_type VARCHAR(50), -- task, batch, room, etc
    related_entity_id INTEGER,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    all_day BOOLEAN DEFAULT false,
    recurring BOOLEAN DEFAULT false,
    recurrence_pattern VARCHAR(50), -- daily, weekly, monthly
    color VARCHAR(20),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
    reminder_minutes INTEGER,
    attendees TEXT[], -- Array of user IDs or names
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_user_id ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_room_id ON calendar_events(room_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_batch_id ON calendar_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_events_event_type ON calendar_events(event_type);
CREATE INDEX IF NOT EXISTS idx_calendar_events_status ON calendar_events(status);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_calendar_events_updated_at 
    BEFORE UPDATE ON calendar_events 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
