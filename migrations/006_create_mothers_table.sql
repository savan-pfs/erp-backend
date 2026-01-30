-- Create mothers table
CREATE TABLE IF NOT EXISTS mothers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    genetic_id INTEGER REFERENCES genetics(id) ON DELETE SET NULL,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    mother_name VARCHAR(255) NOT NULL,
    clone_count INTEGER DEFAULT 0,
    age_days INTEGER DEFAULT 0,
    health_status VARCHAR(50) DEFAULT 'healthy' CHECK (
        health_status IN ('healthy', 'stressed', 'diseased', 'pest_damage', 'nutrient_deficient', 'root_bound')
    ),
    last_clone_date DATE,
    next_clone_date DATE,
    flowering_compatible BOOLEAN DEFAULT true,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_mothers_user_id ON mothers(user_id);
CREATE INDEX IF NOT EXISTS idx_mothers_genetic_id ON mothers(genetic_id);
CREATE INDEX IF NOT EXISTS idx_mothers_room_id ON mothers(room_id);
CREATE INDEX IF NOT EXISTS idx_mothers_active ON mothers(is_active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_mothers_updated_at 
    BEFORE UPDATE ON mothers 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
