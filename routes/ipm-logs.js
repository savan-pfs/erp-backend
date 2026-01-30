const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get IPM logs
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { roomId, batchId, plantId, issueType, severity } = req.query;

    let whereClause = 'WHERE il.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (roomId) {
      whereClause += ` AND il.room_id = $${paramCount++}`;
      queryParams.push(roomId);
    }
    if (batchId) {
      whereClause += ` AND il.batch_id = $${paramCount++}`;
      queryParams.push(batchId);
    }
    if (plantId) {
      whereClause += ` AND il.plant_id = $${paramCount++}`;
      queryParams.push(plantId);
    }
    if (issueType) {
      whereClause += ` AND il.issue_type = $${paramCount++}`;
      queryParams.push(issueType);
    }
    if (severity) {
      whereClause += ` AND il.severity = $${paramCount++}`;
      queryParams.push(severity);
    }

    const result = await query(`
      SELECT il.*,
             r.name as room_name,
             b.batch_name,
             p.plant_name
      FROM ipm_logs il
      LEFT JOIN rooms r ON il.room_id = r.id
      LEFT JOIN batches b ON il.batch_id = b.id
      LEFT JOIN plants p ON il.plant_id = p.id
      ${whereClause}
      ORDER BY il.detected_at DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get IPM logs error:', error);
    res.status(500).json({ error: 'Failed to fetch IPM logs' });
  }
});

// Create IPM log
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      roomId, batchId, plantId, issueType, pestName, severity,
      treatmentMethod, productUsed, productConcentration, applicationMethod,
      affectedArea, treatmentResult, followUpRequired, followUpDate,
      notes, images, detectedAt, treatedAt
    } = req.body;

    const result = await query(`
      INSERT INTO ipm_logs (
        user_id, room_id, batch_id, plant_id, issue_type, pest_name, severity,
        treatment_method, product_used, product_concentration, application_method,
        affected_area, treatment_result, follow_up_required, follow_up_date,
        notes, images, detected_at, treated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `, [
      req.user.id, roomId, batchId, plantId, 
      issueType && ['pest', 'disease', 'deficiency', 'toxicity', 'environmental', 'preventive'].includes(issueType.toLowerCase()) 
        ? issueType.toLowerCase() 
        : 'pest',
      pestName, severity || 'low', treatmentMethod, productUsed,
      productConcentration, applicationMethod, affectedArea, treatmentResult,
      followUpRequired || false, followUpDate, notes, images,
      detectedAt || new Date(), treatedAt
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create IPM log error:', error);
    res.status(500).json({ error: 'Failed to create IPM log' });
  }
});

// Update IPM log
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const ipmId = parseInt(req.params.id);
    const {
      roomId, batchId, plantId, issueType, pestName, severity,
      treatmentMethod, productUsed, productConcentration, applicationMethod,
      affectedArea, treatmentResult, followUpRequired, followUpDate,
      notes, images, detectedAt, treatedAt
    } = req.body;

    // Verify IPM log exists and belongs to user
    const logCheck = await query(
      'SELECT id FROM ipm_logs WHERE id = $1 AND user_id = $2',
      [ipmId, req.user.id]
    );

    if (logCheck.rows.length === 0) {
      return res.status(404).json({ error: 'IPM log not found' });
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (roomId !== undefined) {
      updateFields.push(`room_id = $${paramCount++}`);
      updateValues.push(roomId);
    }
    if (batchId !== undefined) {
      updateFields.push(`batch_id = $${paramCount++}`);
      updateValues.push(batchId);
    }
    if (plantId !== undefined) {
      updateFields.push(`plant_id = $${paramCount++}`);
      updateValues.push(plantId);
    }
    if (issueType !== undefined) {
      const validIssueType = issueType && ['pest', 'disease', 'deficiency', 'toxicity', 'environmental', 'preventive'].includes(issueType.toLowerCase())
        ? issueType.toLowerCase()
        : 'pest';
      updateFields.push(`issue_type = $${paramCount++}`);
      updateValues.push(validIssueType);
    }
    if (pestName !== undefined) {
      updateFields.push(`pest_name = $${paramCount++}`);
      updateValues.push(pestName);
    }
    if (severity !== undefined) {
      updateFields.push(`severity = $${paramCount++}`);
      updateValues.push(severity);
    }
    if (treatmentMethod !== undefined) {
      updateFields.push(`treatment_method = $${paramCount++}`);
      updateValues.push(treatmentMethod);
    }
    if (productUsed !== undefined) {
      updateFields.push(`product_used = $${paramCount++}`);
      updateValues.push(productUsed);
    }
    if (productConcentration !== undefined) {
      updateFields.push(`product_concentration = $${paramCount++}`);
      updateValues.push(productConcentration);
    }
    if (applicationMethod !== undefined) {
      updateFields.push(`application_method = $${paramCount++}`);
      updateValues.push(applicationMethod);
    }
    if (affectedArea !== undefined) {
      updateFields.push(`affected_area = $${paramCount++}`);
      updateValues.push(affectedArea);
    }
    if (treatmentResult !== undefined) {
      updateFields.push(`treatment_result = $${paramCount++}`);
      updateValues.push(treatmentResult);
    }
    if (followUpRequired !== undefined) {
      updateFields.push(`follow_up_required = $${paramCount++}`);
      updateValues.push(followUpRequired);
    }
    if (followUpDate !== undefined) {
      updateFields.push(`follow_up_date = $${paramCount++}`);
      updateValues.push(followUpDate);
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      updateValues.push(notes);
    }
    if (images !== undefined) {
      updateFields.push(`images = $${paramCount++}`);
      updateValues.push(images);
    }
    if (detectedAt !== undefined) {
      updateFields.push(`detected_at = $${paramCount++}`);
      updateValues.push(detectedAt);
    }
    if (treatedAt !== undefined) {
      updateFields.push(`treated_at = $${paramCount++}`);
      updateValues.push(treatedAt);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Add WHERE clause parameters
    updateValues.push(ipmId, req.user.id);

    const result = await query(`
      UPDATE ipm_logs SET
        ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND user_id = $${paramCount++}
      RETURNING *
    `, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'IPM log not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update IPM log error:', error);
    res.status(500).json({ error: 'Failed to update IPM log' });
  }
});

// Delete IPM log
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const ipmId = parseInt(req.params.id);

    // Verify IPM log exists and belongs to user
    const logCheck = await query(
      'SELECT id, issue_type, pest_name FROM ipm_logs WHERE id = $1 AND user_id = $2',
      [ipmId, req.user.id]
    );

    if (logCheck.rows.length === 0) {
      return res.status(404).json({ error: 'IPM log not found' });
    }

    // Hard delete - permanently remove from database
    const result = await query(
      'DELETE FROM ipm_logs WHERE id = $1 AND user_id = $2 RETURNING id, issue_type, pest_name',
      [ipmId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'IPM log not found or already deleted' });
    }

    const deletedLog = result.rows[0];

    res.json({
      message: 'IPM log deleted successfully',
      log: {
        id: deletedLog.id,
        issueType: deletedLog.issue_type,
        pestName: deletedLog.pest_name
      }
    });
  } catch (error) {
    console.error('Delete IPM log error:', error);
    res.status(500).json({ error: 'Failed to delete IPM log' });
  }
});

// Get single IPM log by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const ipmId = parseInt(req.params.id);

    const result = await query(`
      SELECT il.*,
             r.name as room_name,
             b.batch_name,
             p.plant_name
      FROM ipm_logs il
      LEFT JOIN rooms r ON il.room_id = r.id
      LEFT JOIN batches b ON il.batch_id = b.id
      LEFT JOIN plants p ON il.plant_id = p.id
      WHERE il.id = $1 AND il.user_id = $2
    `, [ipmId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'IPM log not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get IPM log error:', error);
    res.status(500).json({ error: 'Failed to fetch IPM log' });
  }
});

module.exports = router;
