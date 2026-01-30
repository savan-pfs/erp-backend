const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { cropValidation, validate } = require('../middleware/validation');
const { query } = require('../config/database');

const router = express.Router();

// Get all crops for user's farms
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { farmId, growthStage, healthStatus } = req.query;

    let whereClause = 'WHERE f.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (farmId) {
      whereClause += ` AND c.farm_id = $${paramCount++}`;
      queryParams.push(farmId);
    }
    if (growthStage) {
      whereClause += ` AND c.growth_stage = $${paramCount++}`;
      queryParams.push(growthStage);
    }
    if (healthStatus) {
      whereClause += ` AND c.health_status = $${paramCount++}`;
      queryParams.push(healthStatus);
    }

    const result = await query(`
      SELECT c.id, c.farm_id, c.crop_name, c.variety, c.planting_date, 
             c.expected_harvest_date, c.actual_harvest_date, c.area_planted,
             c.planting_method, c.irrigation_method, c.fertilizer_used,
             c.pesticide_used, c.growth_stage, c.health_status, c.notes,
             c.created_at, c.updated_at,
             f.name as farm_name
      FROM crops c
      JOIN farms f ON c.farm_id = f.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `, queryParams);

    const crops = result.rows.map(crop => ({
      id: crop.id,
      farmId: crop.farm_id,
      farmName: crop.farm_name,
      cropName: crop.crop_name,
      variety: crop.variety,
      plantingDate: crop.planting_date,
      expectedHarvestDate: crop.expected_harvest_date,
      actualHarvestDate: crop.actual_harvest_date,
      areaPlanted: parseFloat(crop.area_planted),
      plantingMethod: crop.planting_method,
      irrigationMethod: crop.irrigation_method,
      fertilizerUsed: crop.fertilizer_used,
      pesticideUsed: crop.pesticide_used,
      growthStage: crop.growth_stage,
      healthStatus: crop.health_status,
      notes: crop.notes,
      createdAt: crop.created_at,
      updatedAt: crop.updated_at
    }));

    res.json(crops);

  } catch (error) {
    console.error('Get crops error:', error);
    res.status(500).json({ error: 'Failed to fetch crops' });
  }
});

// Get single crop by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const cropId = parseInt(req.params.id);

    const result = await query(`
      SELECT c.id, c.farm_id, c.crop_name, c.variety, c.planting_date, 
             c.expected_harvest_date, c.actual_harvest_date, c.area_planted,
             c.planting_method, c.irrigation_method, c.fertilizer_used,
             c.pesticide_used, c.growth_stage, c.health_status, c.notes,
             c.created_at, c.updated_at,
             f.name as farm_name
      FROM crops c
      JOIN farms f ON c.farm_id = f.id
      WHERE c.id = $1 AND f.user_id = $2
    `, [cropId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Crop not found' });
    }

    const crop = result.rows[0];

    res.json({
      id: crop.id,
      farmId: crop.farm_id,
      farmName: crop.farm_name,
      cropName: crop.crop_name,
      variety: crop.variety,
      plantingDate: crop.planting_date,
      expectedHarvestDate: crop.expected_harvest_date,
      actualHarvestDate: crop.actual_harvest_date,
      areaPlanted: parseFloat(crop.area_planted),
      plantingMethod: crop.planting_method,
      irrigationMethod: crop.irrigation_method,
      fertilizerUsed: crop.fertilizer_used,
      pesticideUsed: crop.pesticide_used,
      growthStage: crop.growth_stage,
      healthStatus: crop.health_status,
      notes: crop.notes,
      createdAt: crop.created_at,
      updatedAt: crop.updated_at
    });

  } catch (error) {
    console.error('Get crop error:', error);
    res.status(500).json({ error: 'Failed to fetch crop' });
  }
});

// Create new crop
router.post('/', authenticateToken, validate(cropValidation.create), async (req, res) => {
  try {
    const {
      farmId, cropName, variety, plantingDate, expectedHarvestDate,
      actualHarvestDate, areaPlanted, plantingMethod, irrigationMethod,
      fertilizerUsed, pesticideUsed, growthStage, healthStatus, notes
    } = req.body;

    // Verify farm belongs to user
    const farmCheck = await query('SELECT id FROM farms WHERE id = $1 AND user_id = $2', [farmId, req.user.id]);
    if (farmCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Farm not found or access denied' });
    }

    const result = await query(`
      INSERT INTO crops (farm_id, crop_name, variety, planting_date, expected_harvest_date,
                         actual_harvest_date, area_planted, planting_method, irrigation_method,
                         fertilizer_used, pesticide_used, growth_stage, health_status, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, farm_id, crop_name, variety, planting_date, expected_harvest_date,
                actual_harvest_date, area_planted, planting_method, irrigation_method,
                fertilizer_used, pesticide_used, growth_stage, health_status, notes, created_at
    `, [
      farmId, cropName, variety, plantingDate, expectedHarvestDate,
      actualHarvestDate, areaPlanted, plantingMethod, irrigationMethod,
      fertilizerUsed, pesticideUsed, growthStage, healthStatus, notes
    ]);

    const crop = result.rows[0];

    res.status(201).json({
      message: 'Crop created successfully',
      crop: {
        id: crop.id,
        farmId: crop.farm_id,
        cropName: crop.crop_name,
        variety: crop.variety,
        plantingDate: crop.planting_date,
        expectedHarvestDate: crop.expected_harvest_date,
        actualHarvestDate: crop.actual_harvest_date,
        areaPlanted: parseFloat(crop.area_planted),
        plantingMethod: crop.planting_method,
        irrigationMethod: crop.irrigation_method,
        fertilizerUsed: crop.fertilizer_used,
        pesticideUsed: crop.pesticide_used,
        growthStage: crop.growth_stage,
        healthStatus: crop.health_status,
        notes: crop.notes,
        createdAt: crop.created_at
      }
    });

  } catch (error) {
    console.error('Create crop error:', error);
    res.status(500).json({ error: 'Failed to create crop' });
  }
});

// Update crop
router.put('/:id', authenticateToken, validate(cropValidation.update), async (req, res) => {
  try {
    const cropId = parseInt(req.params.id);
    const {
      cropName, variety, plantingDate, expectedHarvestDate, actualHarvestDate,
      areaPlanted, plantingMethod, irrigationMethod, fertilizerUsed,
      pesticideUsed, growthStage, healthStatus, notes
    } = req.body;

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (cropName !== undefined) {
      updateFields.push(`crop_name = $${paramCount++}`);
      updateValues.push(cropName);
    }
    if (variety !== undefined) {
      updateFields.push(`variety = $${paramCount++}`);
      updateValues.push(variety);
    }
    if (plantingDate !== undefined) {
      updateFields.push(`planting_date = $${paramCount++}`);
      updateValues.push(plantingDate);
    }
    if (expectedHarvestDate !== undefined) {
      updateFields.push(`expected_harvest_date = $${paramCount++}`);
      updateValues.push(expectedHarvestDate);
    }
    if (actualHarvestDate !== undefined) {
      updateFields.push(`actual_harvest_date = $${paramCount++}`);
      updateValues.push(actualHarvestDate);
    }
    if (areaPlanted !== undefined) {
      updateFields.push(`area_planted = $${paramCount++}`);
      updateValues.push(areaPlanted);
    }
    if (plantingMethod !== undefined) {
      updateFields.push(`planting_method = $${paramCount++}`);
      updateValues.push(plantingMethod);
    }
    if (irrigationMethod !== undefined) {
      updateFields.push(`irrigation_method = $${paramCount++}`);
      updateValues.push(irrigationMethod);
    }
    if (fertilizerUsed !== undefined) {
      updateFields.push(`fertilizer_used = $${paramCount++}`);
      updateValues.push(fertilizerUsed);
    }
    if (pesticideUsed !== undefined) {
      updateFields.push(`pesticide_used = $${paramCount++}`);
      updateValues.push(pesticideUsed);
    }
    if (growthStage !== undefined) {
      updateFields.push(`growth_stage = $${paramCount++}`);
      updateValues.push(growthStage);
    }
    if (healthStatus !== undefined) {
      updateFields.push(`health_status = $${paramCount++}`);
      updateValues.push(healthStatus);
    }
    if (notes !== undefined) {
      updateFields.push(`notes = $${paramCount++}`);
      updateValues.push(notes);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(cropId, req.user.id);

    const result = await query(`
      UPDATE crops c
      SET ${updateFields.join(', ')}
      FROM farms f
      WHERE c.id = $${paramCount++} AND c.farm_id = f.id AND f.user_id = $${paramCount++}
      RETURNING c.id, c.farm_id, c.crop_name, c.variety, c.planting_date, 
                c.expected_harvest_date, c.actual_harvest_date, c.area_planted,
                c.planting_method, c.irrigation_method, c.fertilizer_used,
                c.pesticide_used, c.growth_stage, c.health_status, c.notes, c.updated_at
    `, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Crop not found' });
    }

    const crop = result.rows[0];

    res.json({
      message: 'Crop updated successfully',
      crop: {
        id: crop.id,
        farmId: crop.farm_id,
        cropName: crop.crop_name,
        variety: crop.variety,
        plantingDate: crop.planting_date,
        expectedHarvestDate: crop.expected_harvest_date,
        actualHarvestDate: crop.actual_harvest_date,
        areaPlanted: parseFloat(crop.area_planted),
        plantingMethod: crop.planting_method,
        irrigationMethod: crop.irrigation_method,
        fertilizerUsed: crop.fertilizer_used,
        pesticideUsed: crop.pesticide_used,
        growthStage: crop.growth_stage,
        healthStatus: crop.health_status,
        notes: crop.notes,
        updatedAt: crop.updated_at
      }
    });

  } catch (error) {
    console.error('Update crop error:', error);
    res.status(500).json({ error: 'Failed to update crop' });
  }
});

// Delete crop
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const cropId = parseInt(req.params.id);

    const result = await query(`
      DELETE FROM crops c
      USING farms f
      WHERE c.id = $1 AND c.farm_id = f.id AND f.user_id = $2
      RETURNING c.id, c.crop_name
    `, [cropId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Crop not found' });
    }

    res.json({
      message: 'Crop deleted successfully',
      crop: result.rows[0]
    });

  } catch (error) {
    console.error('Delete crop error:', error);
    res.status(500).json({ error: 'Failed to delete crop' });
  }
});

module.exports = router;
