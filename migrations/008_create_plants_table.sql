-- Create plants table
CREATE TABLE IF NOT EXISTS plants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
    genetic_id INTEGER REFERENCES genetics(id) ON DELETE SET NULL,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    plant_name VARCHAR(255),
    plant_number INTEGER NOT NULL,
    growth_stage VARCHAR(50) DEFAULT 'seedling' CHECK (
        growth_stage IN ('seedling', 'vegetative', 'flowering', 'ripening', 'harvested', 'dead')
    ),
    health_status VARCHAR(50) DEFAULT 'healthy' CHECK (
        health_status IN ('healthy', 'stressed', 'diseased', 'pest_damage', 'drought_stress', 'nutrient_deficient', 'root_bound')
    ),
    gender VARCHAR(20) DEFAULT 'unknown' CHECK (gender IN ('male', 'female', 'hermaphrodite', 'unknown')),
    planting_date DATE,
    germination_date DATE,
    vegetative_start_date DATE,
    flowering_start_date DATE,
    harvest_date DATE,
    expected_harvest_date DATE,
    height DECIMAL(6, 2), -- in cm
    canopy_width DECIMAL(6, 2), -- in cm
    pot_size DECIMAL(6, 2), -- in liters
    medium VARCHAR(100),
    training_method VARCHAR(100),
    feeding_schedule TEXT,
    last_watered DATE,
    last_fed DATE,
    last_transplant_date DATE,
    transplant_count INTEGER DEFAULT 0,
    trichome_status VARCHAR(50),
    aroma_intensity VARCHAR(20) CHECK (aroma_intensity IN ('none', 'low', 'medium', 'high', 'very_high')),
    pest_issues TEXT,
    disease_issues TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_plants_user_id ON plants(user_id);
CREATE INDEX IF NOT EXISTS idx_plants_batch_id ON plants(batch_id);
CREATE INDEX IF NOT EXISTS idx_plants_genetic_id ON plants(genetic_id);
CREATE INDEX IF NOT EXISTS idx_plants_room_id ON plants(room_id);
CREATE INDEX IF NOT EXISTS idx_plants_growth_stage ON plants(growth_stage);
CREATE INDEX IF NOT EXISTS idx_plants_health_status ON plants(health_status);
CREATE INDEX IF NOT EXISTS idx_plants_gender ON plants(gender);
CREATE INDEX IF NOT EXISTS idx_plants_active ON plants(is_active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_plants_updated_at 
    BEFORE UPDATE ON plants 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
