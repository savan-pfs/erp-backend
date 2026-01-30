-- Create manufacturing module tables
-- Manufacturing: Recipes, BOMs, Manufacturing batches, QA holds

-- Recipes table - Recipe definitions
CREATE TABLE IF NOT EXISTS recipes (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    facility_id INTEGER REFERENCES facilities(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    recipe_type VARCHAR(50) NOT NULL CHECK (recipe_type IN (
        'EXTRACTION',
        'EDIBLE',
        'TOPICAL',
        'TINCTURE',
        'CONCENTRATE',
        'PRE_ROLL',
        'OTHER'
    )),
    version VARCHAR(20) DEFAULT '1.0',
    is_active BOOLEAN DEFAULT true,
    approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMP,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, name, version)
);

-- Recipe ingredients (BOM - Bill of Materials)
CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_type VARCHAR(50) NOT NULL CHECK (ingredient_type IN (
        'INVENTORY',        -- From inventory (cannabis product)
        'NON_CANNABIS',     -- Non-cannabis ingredient
        'PACKAGING'         -- Packaging material
    )),
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(10) DEFAULT 'g',
    sequence_order INTEGER DEFAULT 0, -- Order of addition
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manufacturing batches
CREATE TABLE IF NOT EXISTS manufacturing_batches (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    facility_id INTEGER NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE RESTRICT,
    batch_number VARCHAR(255) UNIQUE NOT NULL,
    batch_name VARCHAR(255) NOT NULL,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'PLANNED' CHECK (status IN (
        'PLANNED',
        'IN_PROGRESS',
        'QA_HOLD',
        'RELEASED',
        'COMPLETED',
        'CANCELLED'
    )),
    planned_quantity DECIMAL(10, 3) NOT NULL, -- Planned output quantity
    actual_quantity DECIMAL(10, 3), -- Actual output quantity
    unit VARCHAR(10) DEFAULT 'g',
    start_date TIMESTAMP,
    completion_date TIMESTAMP,
    yield_percentage DECIMAL(5, 2), -- Actual yield / planned yield * 100
    notes TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manufacturing steps - Step-by-step process
CREATE TABLE IF NOT EXISTS manufacturing_steps (
    id SERIAL PRIMARY KEY,
    manufacturing_batch_id INTEGER NOT NULL REFERENCES manufacturing_batches(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_description TEXT,
    status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'IN_PROGRESS',
        'COMPLETED',
        'SKIPPED'
    )),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(manufacturing_batch_id, step_number)
);

-- Manufacturing batch inputs - Input batches used
CREATE TABLE IF NOT EXISTS manufacturing_batch_inputs (
    id SERIAL PRIMARY KEY,
    manufacturing_batch_id INTEGER NOT NULL REFERENCES manufacturing_batches(id) ON DELETE CASCADE,
    input_batch_id INTEGER NOT NULL REFERENCES harvest_batches(id) ON DELETE RESTRICT,
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
    quantity_used DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(10) DEFAULT 'g',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Manufacturing batch outputs - Output batches created
CREATE TABLE IF NOT EXISTS manufacturing_batch_outputs (
    id SERIAL PRIMARY KEY,
    manufacturing_batch_id INTEGER NOT NULL REFERENCES manufacturing_batches(id) ON DELETE CASCADE,
    output_batch_id INTEGER REFERENCES harvest_batches(id) ON DELETE SET NULL,
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE SET NULL,
    quantity_produced DECIMAL(10, 3) NOT NULL,
    unit VARCHAR(10) DEFAULT 'g',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- QA holds - Quality assurance hold/release tracking
CREATE TABLE IF NOT EXISTS qa_holds (
    id SERIAL PRIMARY KEY,
    manufacturing_batch_id INTEGER REFERENCES manufacturing_batches(id) ON DELETE CASCADE,
    inventory_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
    hold_type VARCHAR(50) NOT NULL CHECK (hold_type IN (
        'QUALITY',
        'COMPLIANCE',
        'SAFETY',
        'OTHER'
    )),
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'ACTIVE' CHECK (status IN (
        'ACTIVE',
        'RELEASED',
        'REJECTED'
    )),
    placed_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    placed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    released_at TIMESTAMP,
    rejection_reason TEXT,
    notes TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_recipes_organization_id ON recipes(organization_id);
CREATE INDEX IF NOT EXISTS idx_recipes_facility_id ON recipes(facility_id);
CREATE INDEX IF NOT EXISTS idx_recipes_recipe_type ON recipes(recipe_type);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_inventory_id ON recipe_ingredients(inventory_id);
CREATE INDEX IF NOT EXISTS idx_manufacturing_batches_organization_id ON manufacturing_batches(organization_id);
CREATE INDEX IF NOT EXISTS idx_manufacturing_batches_facility_id ON manufacturing_batches(facility_id);
CREATE INDEX IF NOT EXISTS idx_manufacturing_batches_recipe_id ON manufacturing_batches(recipe_id);
CREATE INDEX IF NOT EXISTS idx_manufacturing_batches_batch_number ON manufacturing_batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_manufacturing_batches_status ON manufacturing_batches(status);
CREATE INDEX IF NOT EXISTS idx_manufacturing_steps_batch_id ON manufacturing_steps(manufacturing_batch_id);
CREATE INDEX IF NOT EXISTS idx_manufacturing_batch_inputs_batch_id ON manufacturing_batch_inputs(manufacturing_batch_id);
CREATE INDEX IF NOT EXISTS idx_manufacturing_batch_outputs_batch_id ON manufacturing_batch_outputs(manufacturing_batch_id);
CREATE INDEX IF NOT EXISTS idx_qa_holds_manufacturing_batch_id ON qa_holds(manufacturing_batch_id);
CREATE INDEX IF NOT EXISTS idx_qa_holds_inventory_id ON qa_holds(inventory_id);
CREATE INDEX IF NOT EXISTS idx_qa_holds_status ON qa_holds(status);

-- Triggers
CREATE TRIGGER update_recipes_updated_at 
    BEFORE UPDATE ON recipes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manufacturing_batches_updated_at 
    BEFORE UPDATE ON manufacturing_batches 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manufacturing_steps_updated_at 
    BEFORE UPDATE ON manufacturing_steps 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
