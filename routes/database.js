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
 * GET /api/database/stats
 * Get database statistics (tables, sizes, row counts)
 */
router.get('/stats', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        // Query to get table sizes and row counts
        const result = await query(`
            SELECT
                relname AS table_name,
                n_live_tup AS row_count,
                pg_size_pretty(pg_total_relation_size(relid)) AS total_size
            FROM pg_stat_user_tables
            ORDER BY pg_total_relation_size(relid) DESC;
        `);

        // Get DB connection count
        const connResult = await query(`
            SELECT count(*) from pg_stat_activity;
        `);
        const connections = parseInt(connResult.rows[0].count);

        // Get DB Size
        const dbSizeResult = await query(`
            SELECT pg_size_pretty(pg_database_size(current_database()));
        `);
        const dbSize = dbSizeResult.rows[0].pg_size_pretty;

        res.json({
            tables: result.rows,
            summary: {
                connections,
                dbSize,
                totalTables: result.rows.length
            }
        });

    } catch (error) {
        console.error('Error fetching database stats:', error);
        res.status(500).json({ error: 'Failed to fetch database stats' });
    }
});

module.exports = router;
