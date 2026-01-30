const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/permissions');

// Middleware: Require Super Admin for most billing routes
const requireSuperAdmin = async (req, res, next) => {
    if (req.user.role === 'super_admin' || req.user.roleNames?.includes('super_admin') || req.user.roleNames?.includes('Super Admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Super Admin only.' });
    }
};

/**
 * GET /api/billing/overview
 * Returns KPI stats: Total MRR, Active Subscribers, Avg Revenue/User, Churn Rate
 */
router.get('/overview', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        // 1. Total MRR (Sum of subscription_amount for active orgs)
        const mrrResult = await query(`
            SELECT SUM(subscription_amount) as total_mrr 
            FROM organizations 
            WHERE subscription_status = 'Active' AND is_active = true
        `);
        const totalMrr = parseFloat(mrrResult.rows[0].total_mrr || 0);

        // 2. Active Subscribers count
        const activeSubsResult = await query(`
            SELECT COUNT(*) as count 
            FROM organizations 
            WHERE subscription_status = 'Active' AND is_active = true
        `);
        const activeSubscribers = parseInt(activeSubsResult.rows[0].count || 0);

        // 3. Avg Revenue Per User (ARPU) - simple calculation
        const arpu = activeSubscribers > 0 ? Math.round(totalMrr / activeSubscribers) : 0;

        // 4. Churn Rate (Mock calculation for now, or based on recent cancellations)
        // In a real system, you'd query cancellations in the last 30 days / total subs at start of month
        const churnResult = await query(`
            SELECT COUNT(*) as count 
            FROM organizations 
            WHERE subscription_status = 'Cancelled' 
            AND updated_at > NOW() - INTERVAL '30 days'
        `);
        const churnedCount = parseInt(churnResult.rows[0].count || 0);
        const totalOrgsWindow = activeSubscribers + churnedCount;
        const churnRate = totalOrgsWindow > 0 ? ((churnedCount / totalOrgsWindow) * 100).toFixed(1) : 0;

        // 5. Plan Distribution
        const distributionResult = await query(`
            SELECT subscription_plan as name, COUNT(*) as count, SUM(subscription_amount) as revenue
            FROM organizations
            WHERE subscription_status = 'Active'
            GROUP BY subscription_plan
        `);

        // 6. Revenue History (Mocking actual historical snapshot for now, or aggregations from invoices)
        // Ideally, you'd group 'paid' invoices by month
        const revenueHistoryResult = await query(`
            SELECT TO_CHAR(issue_date, 'Mon') as month, SUM(amount) as revenue
            FROM invoices
            WHERE status = 'Paid' AND issue_date > NOW() - INTERVAL '6 months'
            GROUP BY TO_CHAR(issue_date, 'Mon'), DATE_TRUNC('month', issue_date)
            ORDER BY DATE_TRUNC('month', issue_date) ASC
        `);

        // Return constructed stats object
        res.json({
            kpi: {
                mrr: totalMrr,
                activeSubscribers: activeSubscribers,
                arpu: arpu,
                churnRate: churnRate
            },
            planDistribution: distributionResult.rows,
            revenueHistory: revenueHistoryResult.rows.map(r => ({ ...r, revenue: parseFloat(r.revenue) }))
        });

    } catch (error) {
        console.error('Error fetching billing overview:', error);
        res.status(500).json({ error: 'Failed to fetch billing overview' });
    }
});

/**
 * GET /api/billing/subscriptions
 * List all organizations with their billing status
 */
router.get('/subscriptions', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                o.id, 
                o.name, 
                o.subscription_plan, 
                o.subscription_status as status, 
                o.subscription_amount as amount, 
                o.next_billing_date,
                (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id AND u.is_active = true) as user_count
            FROM organizations o
            ORDER BY o.created_at DESC
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        res.status(500).json({ error: 'Failed to fetch subscriptions' });
    }
});

/**
 * GET /api/billing/invoices
 * List recent invoices
 */
router.get('/invoices', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const result = await query(`
            SELECT i.*, o.name as organization_name
            FROM invoices i
            JOIN organizations o ON i.organization_id = o.id
            ORDER BY i.issue_date DESC
            LIMIT 50
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

// ... existing code ...

/**
 * GET /api/billing/export
 * Export subscriptions report as CSV
 */
router.get('/export', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                o.name as "Organization",
                o.subscription_plan as "Plan",
                o.subscription_status as "Status",
                o.subscription_amount as "Amount",
                o.billing_cycle as "Cycle",
                TO_CHAR(o.next_billing_date, 'YYYY-MM-DD') as "Next Billing",
                (SELECT COUNT(*) FROM users u WHERE u.organization_id = o.id AND u.is_active = true) as "Users"
            FROM organizations o
            ORDER BY o.name
        `);

        // Convert to CSV
        const fields = ['Organization', 'Plan', 'Status', 'Amount', 'Cycle', 'Next Billing', 'Users'];
        const csv = [
            fields.join(','),
            ...result.rows.map(row => fields.map(field => `"${row[field] || ''}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=subscriptions_report.csv');
        res.send(csv);

    } catch (error) {
        console.error('Error exporting report:', error);
        res.status(500).json({ error: 'Failed to export report' });
    }
});

/**
 * GET /api/billing/invoices/:orgId
 * Get invoices for a specific organization
 */
router.get('/invoices/:orgId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const result = await query(`
            SELECT * FROM invoices 
            WHERE organization_id = $1 
            ORDER BY issue_date DESC
        `, [orgId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching organization invoices:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
});

/**
 * PUT /api/billing/subscriptions/:orgId
 * Update organization subscription plan
 */
router.put('/subscriptions/:orgId', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { plan, amount, cycle } = req.body;

        await query(`
            UPDATE organizations 
            SET 
                subscription_plan = $1,
                subscription_amount = $2,
                billing_cycle = $3,
                subscription_status = 'Active', -- Reactivate if it was cancelled
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $4
        `, [plan, amount, cycle || 'Monthly', orgId]);

        res.json({ message: 'Subscription updated successfully' });
    } catch (error) {
        console.error('Error updating subscription:', error);
        res.status(500).json({ error: 'Failed to update subscription' });
    }
});

/**
 * POST /api/billing/subscriptions/:orgId/cancel
 * Cancel organization subscription
 */
router.post('/subscriptions/:orgId/cancel', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.params;

        await query(`
            UPDATE organizations 
            SET 
                subscription_status = 'Cancelled',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
        `, [orgId]);

        res.json({ message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({ error: 'Failed to cancel subscription' });
    }
});

/**
 * POST /api/billing/invoices/generate
 * manually create a new invoice for an organization
 */
router.post('/invoices/generate', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { orgId } = req.body;

        // Fetch org details to calculate amount
        const orgResult = await query('SELECT * FROM organizations WHERE id = $1', [orgId]);
        if (orgResult.rows.length === 0) return res.status(404).json({ error: 'Organization not found' });
        const org = orgResult.rows[0];

        // Create invoice
        const amount = org.subscription_amount || 0;
        const invoiceNumber = `INV-${Date.now()}`;
        const issueDate = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30); // Net 30

        const insertResult = await query(`
            INSERT INTO invoices 
            (organization_id, invoice_number, amount, status, issue_date, due_date)
            VALUES ($1, $2, $3, 'Pending', $4, $5)
            RETURNING *
        `, [orgId, invoiceNumber, amount, issueDate, dueDate]);

        res.json(insertResult.rows[0]);

    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).json({ error: 'Failed to generate invoice' });
    }
});

/**
 * GET /api/billing/invoices/:id/pdf
 * Download invoice as PDF
 */
router.get('/invoices/:id/pdf', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Fetch invoice with org details
        const result = await query(`
            SELECT i.*, o.name as org_name, o.subscription_plan, 
                   o.subscription_amount, o.billing_cycle, o.address, o.email
            FROM invoices i
            JOIN organizations o ON i.organization_id = o.id
            WHERE i.id = $1
        `, [id]);

        if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
        const invoice = result.rows[0];

        // Format for generator
        const organization = {
            name: invoice.org_name,
            subscription_plan: invoice.subscription_plan,
            address: invoice.address, // assuming these columns might exist or be null
            email: invoice.email
        };

        const { generateInvoicePDF } = require('../utils/invoiceGenerator');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${invoice.invoice_number}.pdf`);

        generateInvoicePDF(invoice, organization, req.user, res);

    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});


module.exports = router;
