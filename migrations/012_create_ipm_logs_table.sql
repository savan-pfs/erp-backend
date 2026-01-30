-- Create ipm_logs table (Integrated Pest Management)
CREATE TABLE IF NOT EXISTS ipm_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
    batch_id INTEGER REFERENCES batches(id) ON DELETE SET NULL,
    plant_id INTEGER REFERENCES plants(id) ON DELETE SET NULL,
    issue_type VARCHAR(50) DEFAULT 'pest' CHECK (issue_type IN ('pest', 'disease', 'deficiency', 'toxicity', 'environmental')),
    pest_name VARCHAR(255),
    severity VARCHAR(20) DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    treatment_method VARCHAR(100),
    product_used VARCHAR(255),
    product_concentration VARCHAR(100),
    application_method VARCHAR(100),
    affected_area TEXT,
    treatment_result VARCHAR(50),
    follow_up_required BOOLEAN DEFAULT false,
    follow_up_date DATE,
    notes TEXT,
    images TEXT[], -- Array of image URLs
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    treated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ipm_logs_user_id ON ipm_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ipm_logs_room_id ON ipm_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_ipm_logs_batch_id ON ipm_logs(batch_id);
CREATE INDEX IF NOT EXISTS idx_ipm_logs_plant_id ON ipm_logs(plant_id);
CREATE INDEX IF NOT EXISTS idx_ipm_logs_issue_type ON ipm_logs(issue_type);
CREATE INDEX IF NOT EXISTS idx_ipm_logs_severity ON ipm_logs(severity);
CREATE INDEX IF NOT EXISTS idx_ipm_logs_detected_at ON ipm_logs(detected_at);
