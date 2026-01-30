-- System Settings Key-Value Store
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER -- ID of user who last updated
);

-- Seed defaults
INSERT INTO system_settings (key, value, description) VALUES
('platform_name', '"CannaCultivate ERP"', 'The name displayed in the application header'),
('support_email', '"support@cannacultivate.com"', 'Email address for support inquiries'),
('maintenance_mode', 'false', 'If true, only super admins can login'),
('allow_registration', 'true', 'If true, new organizations can register')
ON CONFLICT (key) DO NOTHING;
