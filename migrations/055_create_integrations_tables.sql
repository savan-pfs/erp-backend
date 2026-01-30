-- Available Integrations Catalog
CREATE TABLE integrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50), -- Compliance, Finance, Sales, Communication
    icon_name VARCHAR(50), -- Map to frontend icon names
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Organization Internal Integrations
CREATE TABLE organization_integrations (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    integration_id INTEGER REFERENCES integrations(id) ON DELETE CASCADE,
    config JSONB DEFAULT '{}', -- Store API keys, settings
    is_connected BOOLEAN DEFAULT false,
    connected_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(organization_id, integration_id)
);

-- Seed Initial Integrations
INSERT INTO integrations (name, slug, description, category, icon_name) VALUES
('Metrc', 'metrc', 'Compliance tracking system integration', 'Compliance', 'Box'),
('QuickBooks', 'quickbooks', 'Sync financial data automatically', 'Finance', 'Cloud'),
('LeafLink', 'leaflink', 'Wholesale marketplace connectivity', 'Sales', 'Plug'),
('Slack', 'slack', 'Receive alerts and notifications in Slack', 'Communication', 'Lock')
ON CONFLICT (slug) DO NOTHING;
