const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get all waste logs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { wasteType, roomId, batchId, startDate, endDate } = req.query;

    let whereClause = 'WHERE wl.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (wasteType) {
      whereClause += ` AND wl.waste_type = $${paramCount++}`;
      queryParams.push(wasteType);
    }
    if (roomId) {
      whereClause += ` AND wl.room_id = $${paramCount++}`;
      queryParams.push(roomId);
    }
    if (batchId) {
      whereClause += ` AND wl.batch_id = $${paramCount++}`;
      queryParams.push(batchId);
    }
    if (startDate) {
      whereClause += ` AND wl.disposed_at >= $${paramCount++}`;
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND wl.disposed_at <= $${paramCount++}`;
      queryParams.push(endDate);
    }

    const result = await query(`
      SELECT wl.*,
             r.name as room_name,
             b.batch_name,
             p.plant_name,
             u.first_name || ' ' || u.last_name as disposed_by_name
      FROM waste_logs wl
      LEFT JOIN rooms r ON wl.room_id = r.id
      LEFT JOIN batches b ON wl.batch_id = b.id
      LEFT JOIN plants p ON wl.plant_id = p.id
      LEFT JOIN users u ON wl.disposed_by = u.id
      ${whereClause}
      ORDER BY wl.disposed_at DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get waste logs error:', error);
    res.status(500).json({ error: 'Failed to fetch waste logs' });
  }
});

// Create waste log
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      roomId, batchId, harvestBatchId, plantId, wasteType, reason, quantity, unit,
      disposalMethod, disposedBy, complianceNotes, witnessName,
      authorizationCode, images, disposedAt
    } = req.body;

    if (!wasteType || !reason || !quantity) {
      return res.status(400).json({ error: 'Waste type, reason, and quantity are required' });
    }

    // If harvestBatchId is provided, verify it exists and belongs to user
    if (harvestBatchId) {
      const harvestCheck = await query(
        'SELECT id, status FROM harvest_batches WHERE id = $1 AND user_id = $2',
        [harvestBatchId, req.user.id]
      );
      if (harvestCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Harvest batch not found' });
      }
    }

    const result = await query(`
      INSERT INTO waste_logs (
        user_id, room_id, batch_id, plant_id, waste_type, reason, quantity,
        unit, disposal_method, disposed_by, compliance_notes, witness_name,
        authorization_code, images, disposed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      req.user.id, roomId || null, batchId || null, plantId || null, wasteType,
      reason, parseFloat(quantity), unit || 'g', disposalMethod || null, disposedBy || req.user.id,
      complianceNotes || null, witnessName || null, authorizationCode || null, images || null, disposedAt || new Date()
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create waste log error:', error);
    res.status(500).json({ error: 'Failed to create waste log' });
  }
});

// Get waste summary stats
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let whereClause = 'WHERE user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (startDate) {
      whereClause += ` AND disposed_at >= $${paramCount++}`;
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND disposed_at <= $${paramCount++}`;
      queryParams.push(endDate);
    }

    const result = await query(`
      SELECT 
        waste_type,
        COUNT(*) as count,
        SUM(quantity) as total_quantity,
        unit
      FROM waste_logs
      ${whereClause}
      GROUP BY waste_type, unit
      ORDER BY total_quantity DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get waste stats error:', error);
    res.status(500).json({ error: 'Failed to fetch waste statistics' });
  }
});

module.exports = router;
