-- Add subscription fields to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'Basic',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'Active',
ADD COLUMN IF NOT EXISTS subscription_amount DECIMAL(10, 2) DEFAULT 0.00,
ADD COLUMN IF NOT EXISTS billing_cycle VARCHAR(20) DEFAULT 'Monthly', -- Monthly, Yearly
ADD COLUMN IF NOT EXISTS next_billing_date DATE,
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMP;

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) DEFAULT 'Pending', -- Paid, Pending, Failed, Cancelled
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE,
    paid_at TIMESTAMP,
    pdf_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organizations_subscription_status ON organizations(subscription_status);
CREATE INDEX IF NOT EXISTS idx_organizations_next_billing ON organizations(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_invoices_organization_id ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);

-- Trigger for invoices updated_at
CREATE TRIGGER update_invoices_updated_at 
    BEFORE UPDATE ON invoices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Seed some initial subscription data for existing organizations (optional but helpful)
UPDATE organizations 
SET subscription_plan = 'Pro', 
    subscription_amount = 299.00, 
    next_billing_date = CURRENT_DATE + INTERVAL '1 month' 
WHERE subscription_plan = 'Basic';
