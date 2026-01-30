-- Create genetics table
CREATE TABLE IF NOT EXISTS genetics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    strain_name VARCHAR(255) NOT NULL,
    breeder VARCHAR(255),
    genetic_lineage TEXT,
    indica_percentage DECIMAL(5, 2) CHECK (indica_percentage >= 0 AND indica_percentage <= 100),
    sativa_percentage DECIMAL(5, 2) CHECK (sativa_percentage >= 0 AND sativa_percentage <= 100),
    ruderalis_percentage DECIMAL(5, 2) CHECK (ruderalis_percentage >= 0 AND ruderalis_percentage <= 100),
    thc_content DECIMAL(5, 2), -- in percentage
    cbd_content DECIMAL(5, 2), -- in percentage
    flowering_time INTEGER, -- in days
    harvest_time INTEGER, -- in days
    difficulty_level VARCHAR(20) DEFAULT 'moderate' CHECK (difficulty_level IN ('easy', 'moderate', 'difficult')),
    yield_indoor DECIMAL(8, 2), -- grams per square meter
    yield_outdoor DECIMAL(8, 2), -- grams per plant
    height_indoor_min DECIMAL(5, 2), -- in cm
    height_indoor_max DECIMAL(5, 2), -- in cm
    height_outdoor_min DECIMAL(5, 2), -- in cm
    height_outdoor_max DECIMAL(5, 2), -- in cm
    climate_preference VARCHAR(100),
    aroma_profile TEXT,
    effects TEXT,
    medical_uses TEXT,
    growth_notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_genetics_user_id ON genetics(user_id);
CREATE INDEX IF NOT EXISTS idx_genetics_strain_name ON genetics(strain_name);
CREATE INDEX IF NOT EXISTS idx_genetics_active ON genetics(is_active);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_genetics_updated_at 
    BEFORE UPDATE ON genetics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
