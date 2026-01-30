const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get environmental logs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { roomId, startDate, endDate } = req.query;

    let whereClause = 'WHERE el.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (roomId) {
      whereClause += ` AND el.room_id = $${paramCount++}`;
      queryParams.push(roomId);
    }
    if (startDate) {
      whereClause += ` AND el.recorded_at >= $${paramCount++}`;
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND el.recorded_at <= $${paramCount++}`;
      queryParams.push(endDate);
    }

    const result = await query(`
      SELECT el.*, r.name as room_name
      FROM environmental_logs el
      LEFT JOIN rooms r ON el.room_id = r.id
      ${whereClause}
      ORDER BY el.recorded_at DESC
      LIMIT 1000
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get environmental logs error:', error);
    res.status(500).json({ error: 'Failed to fetch environmental logs' });
  }
});

// Create environmental log
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      roomId, temperature, humidity, vpd, co2Level,
      lightIntensity, airCirculation, notes, recordedAt
    } = req.body;

    const result = await query(`
      INSERT INTO environmental_logs (
        user_id, room_id, temperature, humidity, vpd, co2_level,
        light_intensity, air_circulation, notes, recorded_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      req.user.id, roomId, temperature, humidity, vpd, co2Level,
      lightIntensity, airCirculation, notes, recordedAt || new Date()
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create environmental log error:', error);
    res.status(500).json({ error: 'Failed to create environmental log' });
  }
});

// Get latest reading for a room
router.get('/latest/:roomId', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);

    const result = await query(`
      SELECT * FROM environmental_logs
      WHERE user_id = $1 AND room_id = $2
      ORDER BY recorded_at DESC
      LIMIT 1
    `, [req.user.id, roomId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No logs found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get latest log error:', error);
    res.status(500).json({ error: 'Failed to fetch latest log' });
  }
});

// Delete environmental log
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const logId = parseInt(req.params.id);

    // Verify log exists and belongs to user
    const logCheck = await query(
      'SELECT id, room_id, recorded_at FROM environmental_logs WHERE id = $1 AND user_id = $2',
      [logId, req.user.id]
    );

    if (logCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Environmental log not found' });
    }

    // Hard delete - permanently remove from database
    const result = await query(
      'DELETE FROM environmental_logs WHERE id = $1 AND user_id = $2 RETURNING id, room_id, recorded_at',
      [logId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Environmental log not found or already deleted' });
    }

    res.json({ 
      message: 'Environmental log deleted successfully',
      log: {
        id: result.rows[0].id,
        roomId: result.rows[0].room_id,
        recordedAt: result.rows[0].recorded_at
      }
    });
  } catch (error) {
    console.error('Delete environmental log error:', error);
    res.status(500).json({ error: 'Failed to delete environmental log' });
  }
});

module.exports = router;
