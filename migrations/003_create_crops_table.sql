-- Create crops table
CREATE TABLE IF NOT EXISTS crops (
    id SERIAL PRIMARY KEY,
    farm_id INTEGER NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    crop_name VARCHAR(100) NOT NULL,
    variety VARCHAR(100),
    planting_date DATE,
    expected_harvest_date DATE,
    actual_harvest_date DATE,
    area_planted DECIMAL(10, 2) NOT NULL, -- in hectares
    planting_method VARCHAR(50),
    irrigation_method VARCHAR(50),
    fertilizer_used TEXT,
    pesticide_used TEXT,
    growth_stage VARCHAR(50) DEFAULT 'planned' CHECK (
        growth_stage IN ('planned', 'planted', 'germinated', 'vegetative', 'flowering', 'fruiting', 'harvested', 'failed')
    ),
    health_status VARCHAR(50) DEFAULT 'healthy' CHECK (
        health_status IN ('healthy', 'stressed', 'diseased', 'pest_damage', 'drought_stress', 'nutrient_deficient')
    ),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_crops_farm_id ON crops(farm_id);
CREATE INDEX IF NOT EXISTS idx_crops_growth_stage ON crops(growth_stage);
CREATE INDEX IF NOT EXISTS idx_crops_planting_date ON crops(planting_date);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_crops_updated_at 
    BEFORE UPDATE ON crops 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
