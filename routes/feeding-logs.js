const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get feeding logs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { roomId, batchId, plantId, feedingType } = req.query;

    let whereClause = 'WHERE fl.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (roomId) {
      whereClause += ` AND fl.room_id = $${paramCount++}`;
      queryParams.push(roomId);
    }
    if (batchId) {
      whereClause += ` AND fl.batch_id = $${paramCount++}`;
      queryParams.push(batchId);
    }
    if (plantId) {
      whereClause += ` AND fl.plant_id = $${paramCount++}`;
      queryParams.push(plantId);
    }
    if (feedingType) {
      whereClause += ` AND fl.feeding_type = $${paramCount++}`;
      queryParams.push(feedingType);
    }

    const result = await query(`
      SELECT fl.*,
             r.name as room_name,
             b.batch_name,
             p.plant_name
      FROM feeding_logs fl
      LEFT JOIN rooms r ON fl.room_id = r.id
      LEFT JOIN batches b ON fl.batch_id = b.id
      LEFT JOIN plants p ON fl.plant_id = p.id
      ${whereClause}
      ORDER BY fl.fed_at DESC
      LIMIT 500
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get feeding logs error:', error);
    res.status(500).json({ error: 'Failed to fetch feeding logs' });
  }
});

// Create feeding log
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      roomId, batchId, plantId, feedingType, nutrientName, nutrientBrand,
      ecLevel, phLevel, ppm, volume, volumeUnit, feedingSchedule, notes, fedAt
    } = req.body;

    const result = await query(`
      INSERT INTO feeding_logs (
        user_id, room_id, batch_id, plant_id, feeding_type, nutrient_name,
        nutrient_brand, ec_level, ph_level, ppm, volume, volume_unit,
        feeding_schedule, notes, fed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      req.user.id, roomId, batchId, plantId, feedingType || 'nutrients',
      nutrientName, nutrientBrand, ecLevel, phLevel, ppm, volume,
      volumeUnit || 'L', feedingSchedule, notes, fedAt || new Date()
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create feeding log error:', error);
    res.status(500).json({ error: 'Failed to create feeding log' });
  }
});

module.exports = router;
