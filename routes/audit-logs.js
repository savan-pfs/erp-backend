const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requireRole } = require('../middleware/permissions');

// Helper to check for Super Admin (reused logic, ideally moved to middleware completely)
const requireSuperAdmin = async (req, res, next) => {
    if (req.user.role === 'super_admin' || req.user.roleNames?.includes('super_admin') || req.user.roleNames?.includes('Super Admin')) {
        next();
    } else {
        res.status(403).json({ error: 'Access denied. Super Admin only.' });
    }
};

/**
 * GET /api/audit-logs
 * Fetch audit logs with filtering and pagination
 */
router.get('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { limit = 50, offset = 0, action, user, date } = req.query;
        let queryText = `
            SELECT 
                al.*,
                CONCAT(u.first_name, ' ', u.last_name) as user_name,
                u.email as user_email
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE 1=1
        `;
        const params = [];
        let paramIndex = 1;

        if (action) {
            queryText += ` AND al.action ILIKE $${paramIndex}`;
            params.push(`%${action}%`);
            paramIndex++;
        }

        if (user) {
            queryText += ` AND (u.first_name ILIKE $${paramIndex} OR u.last_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
            params.push(`%${user}%`);
            paramIndex++;
        }


        if (date) {
            queryText += ` AND DATE(al.created_at) = $${paramIndex}`;
            params.push(date);
            paramIndex++;
        }

        queryText += ` ORDER BY al.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
        params.push(limit, offset);

        const result = await query(queryText, params);
        res.json(result.rows);

    } catch (error) {
        console.error('Error fetching audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

module.exports = router;
