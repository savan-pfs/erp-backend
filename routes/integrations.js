const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /api/integrations
 * List all integrations with connection status for the current user's organization
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        const result = await query(`
            SELECT 
                i.id, 
                i.name, 
                i.slug, 
                i.description, 
                i.category, 
                i.icon_name,
                COALESCE(oi.is_connected, false) as status,
                oi.config,
                oi.connected_at
            FROM integrations i
            LEFT JOIN organization_integrations oi 
                ON i.id = oi.integration_id AND oi.organization_id = $1
            WHERE i.is_active = true
            ORDER BY i.name
        `, [organizationId]);

        // Transform boolean status to string for frontend compatibility if needed
        // but frontend mock used 'connected'/'disconnected', let's stick to boolean or map it here
        const mapped = result.rows.map(row => ({
            ...row,
            status: row.status ? 'connected' : 'disconnected'
        }));

        res.json(mapped);
    } catch (error) {
        console.error('Error fetching integrations:', error);
        res.status(500).json({ error: 'Failed to fetch integrations' });
    }
});

/**
 * POST /api/integrations/:id/connect
 * Connect or update configuration for an integration
 */
router.post('/:id/connect', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;
        const config = req.body.config || {};

        // Upsert connection
        await query(`
            INSERT INTO organization_integrations (organization_id, integration_id, is_connected, config, connected_at, updated_at)
            VALUES ($1, $2, true, $3, NOW(), NOW())
            ON CONFLICT (organization_id, integration_id) 
            DO UPDATE SET 
                is_connected = true, 
                config = $3,
                connected_at = COALESCE(organization_integrations.connected_at, NOW()),
                updated_at = NOW()
        `, [organizationId, id, config]);

        res.json({ message: 'Integration connected successfully' });
    } catch (error) {
        console.error('Error connecting integration:', error);
        res.status(500).json({ error: 'Failed to connect integration' });
    }
});

/**
 * POST /api/integrations/:id/disconnect
 * Disconnect an integration
 */
router.post('/:id/disconnect', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        await query(`
            UPDATE organization_integrations
            SET is_connected = false, updated_at = NOW()
            WHERE organization_id = $1 AND integration_id = $2
        `, [organizationId, id]);

        res.json({ message: 'Integration disconnected successfully' });
    } catch (error) {
        console.error('Error disconnecting integration:', error);
        res.status(500).json({ error: 'Failed to disconnect integration' });
    }
});

module.exports = router;
