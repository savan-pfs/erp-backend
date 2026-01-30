const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get all notifications for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;

    let whereClause = 'WHERE user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (unreadOnly === 'true') {
      whereClause += ` AND read = FALSE`;
    }

    const result = await query(`
      SELECT *
      FROM notifications
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramCount}
    `, [...queryParams, parseInt(limit)]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread notification count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND read = FALSE
    `, [req.user.id]);

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);

    const result = await query(`
      UPDATE notifications
      SET read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [notificationId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      UPDATE notifications
      SET read = TRUE, read_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND read = FALSE
      RETURNING id
    `, [req.user.id]);

    res.json({ 
      message: 'All notifications marked as read',
      count: result.rows.length 
    });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);

    const result = await query(`
      DELETE FROM notifications
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `, [notificationId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Create notification (internal use - can be called by other routes)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      userId,
      type = 'info',
      title,
      message,
      entityType,
      entityId,
      metadata
    } = req.body;

    // Use provided userId or default to authenticated user
    const targetUserId = userId || req.user.id;

    const result = await query(`
      INSERT INTO notifications (
        user_id, type, title, message, entity_type, entity_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      targetUserId,
      type,
      title,
      message,
      entityType || null,
      entityId || null,
      metadata ? JSON.stringify(metadata) : null
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

module.exports = router;
