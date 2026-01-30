const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get all harvest batches
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, batchId, roomId } = req.query;

    let whereClause = 'WHERE hb.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (status) {
      whereClause += ` AND hb.status = $${paramCount++}`;
      queryParams.push(status);
    }
    if (batchId) {
      whereClause += ` AND hb.batch_id = $${paramCount++}`;
      queryParams.push(batchId);
    }
    if (roomId) {
      whereClause += ` AND hb.room_id = $${paramCount++}`;
      queryParams.push(roomId);
    }

    const result = await query(`
      SELECT hb.*,
             b.batch_name,
             r.name as room_name,
             r.room_type
      FROM harvest_batches hb
      LEFT JOIN batches b ON hb.batch_id = b.id
      LEFT JOIN rooms r ON hb.room_id = r.id
      ${whereClause}
      ORDER BY hb.harvest_date DESC
    `, queryParams);

    const harvestBatches = result.rows.map(row => ({
      id: row.id,
      batchId: row.batch_id,
      roomId: row.room_id,
      roomType: row.room_type,
      harvestName: row.harvest_name,
      harvestDate: row.harvest_date,
      plantCount: row.plant_count,
      wetWeight: row.wet_weight,
      dryWeight: row.dry_weight,
      status: row.status,
      batchName: row.batch_name,
      roomName: row.room_name,
    }));

    res.json(harvestBatches);
  } catch (error) {
    console.error('Get harvest batches error:', error);
    res.status(500).json({ error: 'Failed to fetch harvest batches' });
  }
});

// Get single harvest batch
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const harvestId = parseInt(req.params.id);

    const result = await query(`
      SELECT hb.*,
             b.batch_name,
             r.name as room_name
      FROM harvest_batches hb
      LEFT JOIN batches b ON hb.batch_id = b.id
      LEFT JOIN rooms r ON hb.room_id = r.id
      WHERE hb.id = $1 AND hb.user_id = $2
    `, [harvestId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Harvest batch not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get harvest batch error:', error);
    res.status(500).json({ error: 'Failed to fetch harvest batch' });
  }
});

// Create harvest batch
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      batchId, roomId, harvestName, harvestDate, plantCount, wetWeight,
      dryWeight, weightUnit, trimWeight, wasteWeight, dryingMethod,
      dryingStartDate, dryingEndDate, curingStartDate, curingEndDate,
      storageLocation, qualityGrade, thcPercentage, cbdPercentage,
      terpeneProfile, notes, status
    } = req.body;

    // Comprehensive validation for harvest
    if (batchId) {
      const batchCheck = await query(`
        SELECT b.id, b.room_id, b.current_stage, b.genetic_id, b.flowering_start_date, 
               b.expected_harvest_date, b.stage_changed_at, b.is_active,
               r.room_type, g.flowering_time
        FROM batches b
        LEFT JOIN rooms r ON b.room_id = r.id
        LEFT JOIN genetics g ON b.genetic_id = g.id
        WHERE b.id = $1 AND b.user_id = $2
      `, [batchId, req.user.id]);

      if (batchCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = batchCheck.rows[0];
      
      // Check if batch is active
      if (!batch.is_active) {
        return res.status(400).json({ 
          error: 'Cannot harvest an inactive batch' 
        });
      }

      // Check if batch is in FLOWERING room
      if (!batch.room_id) {
        return res.status(400).json({ 
          error: 'Batch must be assigned to a room before harvesting. Please move the batch to a Flowering room first.' 
        });
      }

      if (batch.room_type !== 'FLOWERING') {
        return res.status(400).json({ 
          error: 'Batch must be in FLOWERING stage before it can be harvested. Current room type: ' + (batch.room_type || 'Unknown') + '. Please move the batch to a Flowering room first.' 
        });
      }

      // Check batch current_stage is 'flowering'
      if (batch.current_stage !== 'flowering') {
        return res.status(400).json({
          error: `Batch must be in 'flowering' stage to harvest. Current stage: ${batch.current_stage || 'unknown'}. Please ensure the batch has progressed through the proper cultivation stages.`
        });
      }

      // Validate minimum flowering duration (80% of genetics.flowering_time)
      const floweringTimeDays = parseInt(batch.flowering_time) || 56; // Default 8 weeks if not set
      const minimumFloweringDays = Math.floor(floweringTimeDays * 0.8); // 80% of recommended time
      
      let daysInFlowering = 0;
      const floweringStart = batch.flowering_start_date || batch.stage_changed_at;
      
      if (floweringStart) {
        const startDate = new Date(floweringStart);
        const today = new Date();
        daysInFlowering = Math.floor((today - startDate) / (1000 * 60 * 60 * 24));
      }

      if (daysInFlowering < minimumFloweringDays) {
        return res.status(400).json({
          error: `Batch has only been in flowering for ${daysInFlowering} days. Minimum flowering duration is ${minimumFloweringDays} days (80% of ${floweringTimeDays} days). Please wait ${minimumFloweringDays - daysInFlowering} more days before harvesting.`
        });
      }

      // Validate expected harvest date (allow harvest 7 days before or after expected date)
      if (batch.expected_harvest_date) {
        const expectedDate = new Date(batch.expected_harvest_date);
        const today = new Date();
        const daysUntilExpected = Math.floor((expectedDate - today) / (1000 * 60 * 60 * 24));
        
        // Allow harvest if within 7 days before or after expected date
        if (daysUntilExpected < -7) {
          return res.status(400).json({
            error: `Expected harvest date was ${Math.abs(daysUntilExpected)} days ago. Please verify the batch is still suitable for harvest or update the expected harvest date.`
          });
        }
      }

      // Check plant readiness - verify 80% of plants are in 'flowering' or 'ripening' stage
      const plantsCheck = await query(`
        SELECT 
          COUNT(*) as total_plants,
          COUNT(*) FILTER (WHERE growth_stage IN ('flowering', 'ripening')) as ready_plants
        FROM plants
        WHERE batch_id = $1 AND user_id = $2 AND is_active = true
      `, [batchId, req.user.id]);

      const totalPlants = parseInt(plantsCheck.rows[0].total_plants || 0);
      const readyPlants = parseInt(plantsCheck.rows[0].ready_plants || 0);
      
      if (totalPlants > 0) {
        const readinessPercentage = (readyPlants / totalPlants) * 100;
        if (readinessPercentage < 80) {
          return res.status(400).json({
            error: `Only ${readinessPercentage.toFixed(1)}% of plants (${readyPlants}/${totalPlants}) are in flowering or ripening stage. At least 80% of plants must be ready before harvesting.`
          });
        }
      }
    }

    const result = await query(`
      INSERT INTO harvest_batches (
        user_id, batch_id, room_id, harvest_name, harvest_date, plant_count,
        wet_weight, dry_weight, weight_unit, trim_weight, waste_weight,
        drying_method, drying_start_date, drying_end_date, curing_start_date,
        curing_end_date, storage_location, quality_grade, thc_percentage,
        cbd_percentage, terpene_profile, notes, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *
    `, [
      req.user.id, batchId, roomId, harvestName, harvestDate, plantCount,
      wetWeight, dryWeight, weightUnit || 'g', trimWeight, wasteWeight,
      dryingMethod, dryingStartDate, dryingEndDate, curingStartDate,
      curingEndDate, storageLocation, qualityGrade, thcPercentage,
      cbdPercentage, terpeneProfile, notes, status || 'drying'
    ]);

    // Mark source batch as inactive and update stage after harvest
    if (batchId) {
      await query(`
        UPDATE batches 
        SET is_active = false, 
            current_stage = 'harvest',
            stage_changed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2
      `, [batchId, req.user.id]);

      // Update all plants in batch to harvested state
      const harvestDateValue = harvestDate || new Date().toISOString().split('T')[0];
      await query(`
        UPDATE plants SET
          growth_stage = 'harvested',
          harvest_date = $1,
          is_active = false,
          updated_at = CURRENT_TIMESTAMP
        WHERE batch_id = $2 AND user_id = $3 AND is_active = true
      `, [harvestDateValue, batchId, req.user.id]);
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create harvest batch error:', error);
    res.status(500).json({ error: 'Failed to create harvest batch' });
  }
});

// Update harvest batch
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const harvestId = parseInt(req.params.id);
    const {
      dryWeight, trimWeight, wasteWeight, dryingEndDate, curingStartDate,
      curingEndDate, qualityGrade, thcPercentage, cbdPercentage,
      terpeneProfile, status, roomId, notes
    } = req.body;

    const result = await query(`
      UPDATE harvest_batches SET
        dry_weight = COALESCE($1, dry_weight),
        trim_weight = COALESCE($2, trim_weight),
        waste_weight = COALESCE($3, waste_weight),
        drying_end_date = COALESCE($4, drying_end_date),
        curing_start_date = COALESCE($5, curing_start_date),
        curing_end_date = COALESCE($6, curing_end_date),
        quality_grade = COALESCE($7, quality_grade),
        thc_percentage = COALESCE($8, thc_percentage),
        cbd_percentage = COALESCE($9, cbd_percentage),
        terpene_profile = COALESCE($10, terpene_profile),
        status = COALESCE($11, status),
        room_id = COALESCE($12, room_id),
        notes = COALESCE($13, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $14 AND user_id = $15
      RETURNING *
    `, [
      dryWeight, trimWeight, wasteWeight, dryingEndDate, curingStartDate,
      curingEndDate, qualityGrade, thcPercentage, cbdPercentage,
      terpeneProfile, status, roomId, notes, harvestId, req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Harvest batch not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update harvest batch error:', error);
    res.status(500).json({ error: 'Failed to update harvest batch' });
  }
});

// Delete harvest batch
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const harvestId = parseInt(req.params.id);

    // Verify harvest batch exists and belongs to user
    const checkResult = await query(`
      SELECT id FROM harvest_batches WHERE id = $1 AND user_id = $2
    `, [harvestId, req.user.id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Harvest batch not found' });
    }

    // Delete the harvest batch
    await query(`
      DELETE FROM harvest_batches WHERE id = $1 AND user_id = $2
    `, [harvestId, req.user.id]);

    res.json({ message: 'Harvest batch deleted successfully' });
  } catch (error) {
    console.error('Delete harvest batch error:', error);
    res.status(500).json({ error: 'Failed to delete harvest batch' });
  }
});

module.exports = router;
