const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');

// Get all available permissions (for UI selection)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const result = await query('SELECT * FROM permissions WHERE is_active = true ORDER BY resource_type, name');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

// Get user's explicit permissions (not inherited from roles)
router.get('/users/:userId/explicit', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;

        // Check access (Super Admin or Org Admin)
        // TODO: Add robust check

        const result = await query(`
        SELECT p.*, up.granted_at, grantor.first_name as grantor_name
        FROM user_permissions up
        JOIN permissions p ON up.permission_id = p.id
        LEFT JOIN users grantor ON up.granted_by = grantor.id
        WHERE up.user_id = $1
    `, [userId]);

        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching user explicit permissions:', error);
        res.status(500).json({ error: 'Failed to fetch user permissions' });
    }
});

// Grant permission to user
router.post('/users/:userId', authenticateToken, async (req, res) => {
    try {
        const { userId } = req.params;
        const { permissionId } = req.body;
        const grantedBy = req.user.id;

        if (!permissionId) {
            return res.status(400).json({ error: 'Permission ID is required' });
        }

        await query(`
        INSERT INTO user_permissions (user_id, permission_id, granted_by)
        VALUES ($1, $2, $3)
        ON CONFLICT (user_id, permission_id) DO NOTHING
    `, [userId, permissionId, grantedBy]);

        res.json({ message: 'Permission granted successfully' });
    } catch (error) {
        console.error('Error granting permission:', error);
        res.status(500).json({ error: 'Failed to grant permission' });
    }
});

// Revoke permission from user
router.delete('/users/:userId/:permissionId', authenticateToken, async (req, res) => {
    try {
        const { userId, permissionId } = req.params;

        await query(`
        DELETE FROM user_permissions 
        WHERE user_id = $1 AND permission_id = $2
    `, [userId, permissionId]);

        res.json({ message: 'Permission revoked successfully' });
    } catch (error) {
        console.error('Error revoking permission:', error);
        res.status(500).json({ error: 'Failed to revoke permission' });
    }
});

module.exports = router;
