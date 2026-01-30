-- Create state_legality_rules table for cannabis legality enforcement
-- This table defines what cannabis activities are legal in each state
CREATE TABLE IF NOT EXISTS state_legality_rules (
    id SERIAL PRIMARY KEY,
    state_code VARCHAR(2) NOT NULL UNIQUE,
    country_code VARCHAR(2) DEFAULT 'US',
    cannabis_legal BOOLEAN DEFAULT false, -- Is cannabis legal in this state?
    medical_legal BOOLEAN DEFAULT false, -- Is medical cannabis legal?
    recreational_legal BOOLEAN DEFAULT false, -- Is recreational cannabis legal?
    cultivation_allowed BOOLEAN DEFAULT false, -- Is cultivation allowed?
    manufacturing_allowed BOOLEAN DEFAULT false, -- Is manufacturing allowed?
    retail_allowed BOOLEAN DEFAULT false, -- Is retail allowed?
    home_grow_allowed BOOLEAN DEFAULT false, -- Is home growing allowed?
    max_plants_per_household INTEGER, -- Max plants for home grow
    license_required BOOLEAN DEFAULT true, -- Is license required?
    notes TEXT, -- Additional state-specific notes
    effective_date DATE, -- When these rules became effective
    expires_date DATE, -- When these rules expire (NULL = indefinite)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT state_legality_state_code_check CHECK (LENGTH(state_code) = 2),
    CONSTRAINT state_legality_country_code_check CHECK (LENGTH(country_code) = 2)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_state_legality_state_code ON state_legality_rules(state_code);
CREATE INDEX IF NOT EXISTS idx_state_legality_country_code ON state_legality_rules(country_code);
CREATE INDEX IF NOT EXISTS idx_state_legality_active ON state_legality_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_state_legality_dates ON state_legality_rules(effective_date, expires_date);

-- Trigger to update updated_at timestamp
CREATE TRIGGER update_state_legality_rules_updated_at 
    BEFORE UPDATE ON state_legality_rules 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert seed data for US states (cannabis-legal states)
-- This is a basic seed - should be updated with actual current legality
INSERT INTO state_legality_rules (state_code, country_code, cannabis_legal, medical_legal, recreational_legal, cultivation_allowed, manufacturing_allowed, retail_allowed, license_required, is_active) VALUES
('CA', 'US', true, true, true, true, true, true, true, true), -- California
('CO', 'US', true, true, true, true, true, true, true, true), -- Colorado
('WA', 'US', true, true, true, true, true, true, true, true), -- Washington
('OR', 'US', true, true, true, true, true, true, true, true), -- Oregon
('NV', 'US', true, true, true, true, true, true, true, true), -- Nevada
('MA', 'US', true, true, true, true, true, true, true, true), -- Massachusetts
('ME', 'US', true, true, true, true, true, true, true, true), -- Maine
('VT', 'US', true, true, true, true, true, true, true, true), -- Vermont
('MI', 'US', true, true, true, true, true, true, true, true), -- Michigan
('IL', 'US', true, true, true, true, true, true, true, true), -- Illinois
('AZ', 'US', true, true, true, true, true, true, true, true), -- Arizona
('NJ', 'US', true, true, true, true, true, true, true, true), -- New Jersey
('NY', 'US', true, true, true, true, true, true, true, true), -- New York
('CT', 'US', true, true, true, true, true, true, true, true), -- Connecticut
('VA', 'US', true, true, true, true, true, true, true, true), -- Virginia
('NM', 'US', true, true, true, true, true, true, true, true), -- New Mexico
('MT', 'US', true, true, true, true, true, true, true, true), -- Montana
('SD', 'US', true, true, true, true, true, true, true, true) -- South Dakota
ON CONFLICT (state_code) DO NOTHING;
