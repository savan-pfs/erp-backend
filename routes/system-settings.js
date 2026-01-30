const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

// Middleware: Require Super Admin
const requireSuperAdmin = async (req, res, next) => {
    if (req.user.role === 'super_admin' || req.user.roleNames?.includes('super_admin') || req.user.roleNames?.includes('Super Admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Super Admin only.' });
    }
};

/**
 * GET /api/system-settings
 * Get all system settings
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT key, value FROM system_settings');

        // Convert to key-value object for easier frontend consumption
        const settings = {};
        result.rows.forEach(row => {
            settings[row.key] = row.value;
        });

        res.json(settings);
    } catch (error) {
        console.error('Error fetching system settings:', error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

/**
 * POST /api/system-settings
 * Update system settings (bulk)
 */
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const updates = req.body; // Expect { key: value, key2: value2 }
        const userId = req.user.id;

        // Start transaction manually since we are doing multiple updates
        // actually for simplicity we can just loop updates, it's not critical high-freq data

        const keys = Object.keys(updates);
        for (const key of keys) {
            await query(`
                INSERT INTO system_settings (key, value, updated_at, updated_by)
                VALUES ($1, $2, NOW(), $3)
                ON CONFLICT (key) 
                DO UPDATE SET value = $2, updated_at = NOW(), updated_by = $3
            `, [key, updates[key], userId]);
        }

        res.json({ message: 'Settings updated successfully' });
    } catch (error) {
        console.error('Error updating system settings:', error);
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

module.exports = router;
