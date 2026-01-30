const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get calendar events
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, eventType, status, roomId, batchId } = req.query;

    let whereClause = 'WHERE ce.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (startDate) {
      whereClause += ` AND ce.start_date >= $${paramCount++}`;
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND ce.start_date <= $${paramCount++}`;
      queryParams.push(endDate);
    }
    if (eventType) {
      whereClause += ` AND ce.event_type = $${paramCount++}`;
      queryParams.push(eventType);
    }
    if (status) {
      whereClause += ` AND ce.status = $${paramCount++}`;
      queryParams.push(status);
    }
    if (roomId) {
      whereClause += ` AND ce.room_id = $${paramCount++}`;
      queryParams.push(roomId);
    }
    if (batchId) {
      whereClause += ` AND ce.batch_id = $${paramCount++}`;
      queryParams.push(batchId);
    }

    const result = await query(`
      SELECT ce.*,
             r.name as room_name,
             b.batch_name
      FROM calendar_events ce
      LEFT JOIN rooms r ON ce.room_id = r.id
      LEFT JOIN batches b ON ce.batch_id = b.id
      ${whereClause}
      ORDER BY ce.start_date ASC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get calendar events error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Get single calendar event
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    const result = await query(`
      SELECT ce.*,
             r.name as room_name,
             b.batch_name
      FROM calendar_events ce
      LEFT JOIN rooms r ON ce.room_id = r.id
      LEFT JOIN batches b ON ce.batch_id = b.id
      WHERE ce.id = $1 AND ce.user_id = $2
    `, [eventId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get calendar event error:', error);
    res.status(500).json({ error: 'Failed to fetch calendar event' });
  }
});

// Create calendar event
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title, description, eventType, relatedEntityType, relatedEntityId,
      roomId, batchId, startDate, endDate, allDay, recurring, recurrencePattern,
      color, priority, status, reminderMinutes, attendees
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }
    if (!startDate) {
      return res.status(400).json({ error: 'Start date is required' });
    }

    const result = await query(`
      INSERT INTO calendar_events (
        user_id, title, description, event_type, related_entity_type,
        related_entity_id, room_id, batch_id, start_date, end_date, all_day,
        recurring, recurrence_pattern, color, priority, status, reminder_minutes,
        attendees
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      req.user.id, title, description, eventType || 'task', relatedEntityType,
      relatedEntityId, roomId, batchId, startDate, endDate, allDay || false,
      recurring || false, recurrencePattern, color, priority || 'medium',
      status || 'scheduled', reminderMinutes, attendees
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create calendar event error:', error);
    if (error.code === '23502') {
      // NOT NULL constraint violation
      return res.status(400).json({ 
        error: 'Required field is missing', 
        details: error.message 
      });
    }
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// Update calendar event
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const {
      title, description, eventType, startDate, endDate, status, priority,
      reminderMinutes, attendees, roomId, batchId
    } = req.body;

    const result = await query(`
      UPDATE calendar_events SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        event_type = COALESCE($3, event_type),
        start_date = COALESCE($4, start_date),
        end_date = COALESCE($5, end_date),
        status = COALESCE($6, status),
        priority = COALESCE($7, priority),
        reminder_minutes = COALESCE($8, reminder_minutes),
        attendees = COALESCE($9, attendees),
        room_id = COALESCE($10, room_id),
        batch_id = COALESCE($11, batch_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND user_id = $13
      RETURNING *
    `, [
      title, description, eventType, startDate, endDate, status, priority,
      reminderMinutes, attendees, roomId, batchId, eventId, req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update calendar event error:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// Delete calendar event
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    const result = await query(
      'DELETE FROM calendar_events WHERE id = $1 AND user_id = $2 RETURNING id',
      [eventId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar event not found' });
    }

    res.json({ message: 'Calendar event deleted successfully' });
  } catch (error) {
    console.error('Delete calendar event error:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

module.exports = router;
