const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const { validateRoomForPlantOperation, validatePlantRoomTransition } = require('../utils/room-validation');

const router = express.Router();

// Get all plants for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { batchId, geneticId, roomId, growthStage, healthStatus, isActive } = req.query;

    let whereClause = 'WHERE p.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (batchId) {
      whereClause += ` AND p.batch_id = $${paramCount++}`;
      queryParams.push(batchId);
    }
    if (geneticId) {
      whereClause += ` AND p.genetic_id = $${paramCount++}`;
      queryParams.push(geneticId);
    }
    if (roomId) {
      whereClause += ` AND p.room_id = $${paramCount++}`;
      queryParams.push(roomId);
    }
    if (growthStage) {
      whereClause += ` AND p.growth_stage = $${paramCount++}`;
      queryParams.push(growthStage);
    }
    if (healthStatus) {
      whereClause += ` AND p.health_status = $${paramCount++}`;
      queryParams.push(healthStatus);
    }
    if (isActive !== undefined) {
      whereClause += ` AND p.is_active = $${paramCount++}`;
      queryParams.push(isActive === 'true');
    }

    const result = await query(`
      SELECT p.*, b.batch_name, g.strain_name, r.name as room_name
      FROM plants p
      LEFT JOIN batches b ON p.batch_id = b.id
      LEFT JOIN genetics g ON p.genetic_id = g.id
      LEFT JOIN rooms r ON p.room_id = r.id
      ${whereClause}
      ORDER BY p.plant_number ASC
    `, queryParams);

    const plants = result.rows.map(plant => ({
      id: plant.id,
      batch: plant.batch_id ? {
        id: plant.batch_id,
        batchName: plant.batch_name
      } : null,
      genetic: plant.genetic_id ? {
        id: plant.genetic_id,
        strainName: plant.strain_name
      } : null,
      room: plant.room_id ? {
        id: plant.room_id,
        name: plant.room_name
      } : null,
      plantName: plant.plant_name,
      plantNumber: plant.plant_number,
      growthStage: plant.growth_stage,
      healthStatus: plant.health_status,
      gender: plant.gender,
      plantingDate: plant.planting_date,
      germinationDate: plant.germination_date,
      vegetativeStartDate: plant.vegetative_start_date,
      floweringStartDate: plant.flowering_start_date,
      harvestDate: plant.harvest_date,
      expectedHarvestDate: plant.expected_harvest_date,
      height: plant.height,
      canopyWidth: plant.canopy_width,
      potSize: plant.pot_size,
      medium: plant.medium,
      trainingMethod: plant.training_method,
      feedingSchedule: plant.feeding_schedule,
      lastWatered: plant.last_watered,
      lastFed: plant.last_fed,
      lastTransplantDate: plant.last_transplant_date,
      transplantCount: plant.transplant_count,
      trichomeStatus: plant.trichome_status,
      aromaIntensity: plant.aroma_intensity,
      pestIssues: plant.pest_issues,
      diseaseIssues: plant.disease_issues,
      notes: plant.notes,
      isActive: plant.is_active,
      createdAt: plant.created_at,
      updatedAt: plant.updated_at
    }));

    res.json(plants);
  } catch (error) {
    console.error('Get plants error:', error);
    res.status(500).json({ error: 'Failed to fetch plants' });
  }
});

// Get single plant by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);

    const result = await query(`
      SELECT p.*, b.batch_name, g.strain_name, r.name as room_name
      FROM plants p
      LEFT JOIN batches b ON p.batch_id = b.id
      LEFT JOIN genetics g ON p.genetic_id = g.id
      LEFT JOIN rooms r ON p.room_id = r.id
      WHERE p.id = $1 AND p.user_id = $2
    `, [plantId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const plant = result.rows[0];

    res.json({
      id: plant.id,
      batch: plant.batch_id ? {
        id: plant.batch_id,
        batchName: plant.batch_name
      } : null,
      genetic: plant.genetic_id ? {
        id: plant.genetic_id,
        strainName: plant.strain_name
      } : null,
      room: plant.room_id ? {
        id: plant.room_id,
        name: plant.room_name
      } : null,
      plantName: plant.plant_name,
      plantNumber: plant.plant_number,
      growthStage: plant.growth_stage,
      healthStatus: plant.health_status,
      gender: plant.gender,
      plantingDate: plant.planting_date,
      germinationDate: plant.germination_date,
      vegetativeStartDate: plant.vegetative_start_date,
      floweringStartDate: plant.flowering_start_date,
      harvestDate: plant.harvest_date,
      expectedHarvestDate: plant.expected_harvest_date,
      height: plant.height,
      canopyWidth: plant.canopy_width,
      potSize: plant.pot_size,
      medium: plant.medium,
      trainingMethod: plant.training_method,
      feedingSchedule: plant.feeding_schedule,
      lastWatered: plant.last_watered,
      lastFed: plant.last_fed,
      lastTransplantDate: plant.last_transplant_date,
      transplantCount: plant.transplant_count,
      trichomeStatus: plant.trichome_status,
      aromaIntensity: plant.aroma_intensity,
      pestIssues: plant.pest_issues,
      diseaseIssues: plant.disease_issues,
      notes: plant.notes,
      isActive: plant.is_active,
      createdAt: plant.created_at,
      updatedAt: plant.updated_at
    });
  } catch (error) {
    console.error('Get plant error:', error);
    res.status(500).json({ error: 'Failed to fetch plant' });
  }
});

// Create new plant
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      batchId,
      geneticId,
      roomId,
      plantName,
      plantNumber,
      growthStage = 'seedling',
      healthStatus = 'healthy',
      gender = 'unknown',
      plantingDate,
      germinationDate,
      height,
      potSize,
      medium,
      notes
    } = req.body;

    // Room ID is required
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required. Plants must be assigned to a room.' });
    }

    // Validate room for plant creation operation
    const roomValidation = await validateRoomForPlantOperation(roomId, 'create_plant');
    if (!roomValidation.valid) {
      return res.status(400).json({ error: roomValidation.error });
    }

    const result = await query(`
      INSERT INTO plants (
        user_id, batch_id, genetic_id, room_id, plant_name, plant_number,
        growth_stage, health_status, gender, planting_date, germination_date,
        height, pot_size, medium, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING *
    `, [
      req.user.id, batchId, geneticId, roomId, plantName, plantNumber,
      growthStage, healthStatus, gender, plantingDate, germinationDate,
      height, potSize, medium, notes
    ]);

    const plant = result.rows[0];

    res.status(201).json({
      id: plant.id,
      batchId: plant.batch_id,
      geneticId: plant.genetic_id,
      roomId: plant.room_id,
      plantName: plant.plant_name,
      plantNumber: plant.plant_number,
      growthStage: plant.growth_stage,
      healthStatus: plant.health_status,
      gender: plant.gender,
      plantingDate: plant.planting_date,
      germinationDate: plant.germination_date,
      height: plant.height,
      potSize: plant.pot_size,
      medium: plant.medium,
      notes: plant.notes,
      isActive: plant.is_active,
      createdAt: plant.created_at,
      updatedAt: plant.updated_at
    });
  } catch (error) {
    console.error('Create plant error:', error);
    res.status(500).json({ error: 'Failed to create plant' });
  }
});

// Update plant
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const {
      batchId,
      geneticId,
      roomId,
      plantName,
      plantNumber,
      growthStage,
      healthStatus,
      gender,
      plantingDate,
      germinationDate,
      vegetativeStartDate,
      floweringStartDate,
      harvestDate,
      expectedHarvestDate,
      height,
      canopyWidth,
      potSize,
      medium,
      trainingMethod,
      feedingSchedule,
      lastWatered,
      lastFed,
      lastTransplantDate,
      transplantCount,
      trichomeStatus,
      aromaIntensity,
      pestIssues,
      diseaseIssues,
      notes,
      isActive
    } = req.body;

    const result = await query(`
      UPDATE plants SET
        batch_id = COALESCE($1, batch_id),
        genetic_id = COALESCE($2, genetic_id),
        room_id = COALESCE($3, room_id),
        plant_name = COALESCE($4, plant_name),
        plant_number = COALESCE($5, plant_number),
        growth_stage = COALESCE($6, growth_stage),
        health_status = COALESCE($7, health_status),
        gender = COALESCE($8, gender),
        planting_date = COALESCE($9, planting_date),
        germination_date = COALESCE($10, germination_date),
        vegetative_start_date = COALESCE($11, vegetative_start_date),
        flowering_start_date = COALESCE($12, flowering_start_date),
        harvest_date = COALESCE($13, harvest_date),
        expected_harvest_date = COALESCE($14, expected_harvest_date),
        height = COALESCE($15, height),
        canopy_width = COALESCE($16, canopy_width),
        pot_size = COALESCE($17, pot_size),
        medium = COALESCE($18, medium),
        training_method = COALESCE($19, training_method),
        feeding_schedule = COALESCE($20, feeding_schedule),
        last_watered = COALESCE($21, last_watered),
        last_fed = COALESCE($22, last_fed),
        last_transplant_date = COALESCE($23, last_transplant_date),
        transplant_count = COALESCE($24, transplant_count),
        trichome_status = COALESCE($25, trichome_status),
        aroma_intensity = COALESCE($26, aroma_intensity),
        pest_issues = COALESCE($27, pest_issues),
        disease_issues = COALESCE($28, disease_issues),
        notes = COALESCE($29, notes),
        is_active = COALESCE($30, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $31 AND user_id = $32
      RETURNING *
    `, [
      batchId, geneticId, roomId, plantName, plantNumber, growthStage,
      healthStatus, gender, plantingDate, germinationDate, vegetativeStartDate,
      floweringStartDate, harvestDate, expectedHarvestDate, height, canopyWidth,
      potSize, medium, trainingMethod, feedingSchedule, lastWatered, lastFed,
      lastTransplantDate, transplantCount, trichomeStatus, aromaIntensity,
      pestIssues, diseaseIssues, notes, isActive, plantId, req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const plant = result.rows[0];

    res.json({
      id: plant.id,
      batchId: plant.batch_id,
      geneticId: plant.genetic_id,
      roomId: plant.room_id,
      plantName: plant.plant_name,
      plantNumber: plant.plant_number,
      growthStage: plant.growth_stage,
      healthStatus: plant.health_status,
      gender: plant.gender,
      plantingDate: plant.planting_date,
      germinationDate: plant.germination_date,
      vegetativeStartDate: plant.vegetative_start_date,
      floweringStartDate: plant.flowering_start_date,
      harvestDate: plant.harvest_date,
      expectedHarvestDate: plant.expected_harvest_date,
      height: plant.height,
      canopyWidth: plant.canopy_width,
      potSize: plant.pot_size,
      medium: plant.medium,
      trainingMethod: plant.training_method,
      feedingSchedule: plant.feeding_schedule,
      lastWatered: plant.last_watered,
      lastFed: plant.last_fed,
      lastTransplantDate: plant.last_transplant_date,
      transplantCount: plant.transplant_count,
      trichomeStatus: plant.trichome_status,
      aromaIntensity: plant.aroma_intensity,
      pestIssues: plant.pest_issues,
      diseaseIssues: plant.disease_issues,
      notes: plant.notes,
      isActive: plant.is_active,
      updatedAt: plant.updated_at
    });
  } catch (error) {
    console.error('Update plant error:', error);
    res.status(500).json({ error: 'Failed to update plant' });
  }
});

// Delete plant
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);

    // Verify plant exists and belongs to user
    const plantCheck = await query(
      'SELECT id, batch_id, room_id, plant_name FROM plants WHERE id = $1 AND user_id = $2',
      [plantId, req.user.id]
    );

    if (plantCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const plant = plantCheck.rows[0];

    // Check if plant is in an active batch
    if (plant.batch_id) {
      const batchCheck = await query(
        'SELECT is_active FROM batches WHERE id = $1 AND user_id = $2',
        [plant.batch_id, req.user.id]
      );
      
      if (batchCheck.rows.length > 0 && batchCheck.rows[0].is_active) {
        return res.status(400).json({ 
          error: 'Cannot delete plant. It is part of an active batch. Please deactivate the batch first or remove the plant from the batch.' 
        });
      }
    }

    // Check if plant has associated harvest batches
    // Since harvest_batches references batches (not individual plants),
    // we check if the plant's batch_id is referenced by any harvest batches
    if (plant.batch_id) {
      const harvestCheck = await query(
        'SELECT COUNT(*) as count FROM harvest_batches WHERE batch_id = $1 AND user_id = $2',
        [plant.batch_id, req.user.id]
      );

      const harvestCount = parseInt(harvestCheck.rows[0].count || 0);
      if (harvestCount > 0) {
        return res.status(400).json({ 
          error: `Cannot delete plant. The batch it belongs to is associated with ${harvestCount} harvest batch(es). Please remove the plant from the batch or remove the harvest batches first.` 
        });
      }
    }

    // Hard delete - permanently remove from database
    // Note: Related records will be handled by foreign key constraints:
    // - feeding_logs, ipm_logs, environmental_logs: ON DELETE CASCADE (will be deleted)
    // - batches: ON DELETE SET NULL (if plant was in a batch)
    // - rooms: ON DELETE SET NULL (if plant was in a room)
    const result = await query(
      'DELETE FROM plants WHERE id = $1 AND user_id = $2 RETURNING id, plant_name, plant_number',
      [plantId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found or already deleted' });
    }

    const deletedPlant = result.rows[0];

    // Update room capacity if plant was in a room
    if (plant.room_id) {
      await query(`
        UPDATE rooms SET
          current_plants = GREATEST(0, current_plants - 1),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [plant.room_id]);
    }

    res.json({ 
      message: 'Plant deleted successfully',
      plant: {
        id: deletedPlant.id,
        plantName: deletedPlant.plant_name || `Plant #${deletedPlant.plant_number}`
      }
    });
  } catch (error) {
    console.error('Delete plant error:', error);
    res.status(500).json({ error: 'Failed to delete plant' });
  }
});

// Change growth stage - cultivation endpoint
router.post('/:id/stage', authenticateToken, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const { growthStage, stageDate } = req.body;

    const validStages = ['seedling', 'vegetative', 'flowering', 'ripening', 'harvested', 'dead'];
    if (!validStages.includes(growthStage)) {
      return res.status(400).json({ error: 'Invalid growth stage' });
    }

    let updateField = '';
    let updateValue = stageDate || new Date().toISOString().split('T')[0];

    switch (growthStage) {
      case 'vegetative':
        updateField = 'vegetative_start_date';
        break;
      case 'flowering':
        updateField = 'flowering_start_date';
        break;
      case 'harvested':
        updateField = 'harvest_date';
        break;
    }

    const result = await query(`
      UPDATE plants SET
        growth_stage = $1,
        ${updateField ? `${updateField} = $2,` : ''}
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `, updateField ? [growthStage, updateValue, plantId, req.user.id] : [growthStage, plantId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const plant = result.rows[0];

    res.json({
      id: plant.id,
      growthStage: plant.growth_stage,
      vegetativeStartDate: plant.vegetative_start_date,
      floweringStartDate: plant.flowering_start_date,
      harvestDate: plant.harvest_date,
      message: `Plant moved to ${growthStage} stage`
    });
  } catch (error) {
    console.error('Change plant stage error:', error);
    res.status(500).json({ error: 'Failed to change plant stage' });
  }
});

// Move plant to different room - cultivation endpoint
router.post('/:id/move', authenticateToken, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    // Get current plant and room info
    const plantResult = await query(`
      SELECT p.room_id as current_room_id, r.room_type as current_room_type
      FROM plants p
      LEFT JOIN rooms r ON p.room_id = r.id
      WHERE p.id = $1 AND p.user_id = $2
    `, [plantId, req.user.id]);

    if (plantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    const currentRoomId = plantResult.rows[0].current_room_id;
    const currentRoomType = plantResult.rows[0].current_room_type;

    // Verify target room exists and is active
    const targetRoomResult = await query(`
      SELECT id, room_type, capacity, current_plants, is_active
      FROM rooms 
      WHERE id = $1 AND user_id = $2
    `, [roomId, req.user.id]);

    if (targetRoomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Target room not found' });
    }

    const targetRoom = targetRoomResult.rows[0];

    if (!targetRoom.is_active) {
      return res.status(400).json({ error: 'Cannot move plant to an inactive room' });
    }

    // Validate room transition if moving from one room to another
    if (currentRoomType && currentRoomId !== roomId) {
      const { validatePlantRoomTransition } = require('../utils/room-validation');
      const validation = await validatePlantRoomTransition(plantId, currentRoomId, roomId);
      
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }
    }

    // Check room capacity
    if (targetRoom.current_plants >= targetRoom.capacity) {
      return res.status(400).json({ 
        error: `Room capacity exceeded. Room is at full capacity (${targetRoom.capacity} plants).` 
      });
    }

    // Update plant room
    const result = await query(`
      UPDATE plants SET
        room_id = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `, [roomId, plantId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    // Update room capacities
    if (currentRoomId) {
      await query(`
        UPDATE rooms SET
          current_plants = GREATEST(0, current_plants - 1),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `, [currentRoomId]);
    }

    await query(`
      UPDATE rooms SET
        current_plants = current_plants + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [roomId]);

    res.json({ 
      message: 'Plant moved successfully',
      fromRoomType: currentRoomType,
      toRoomType: targetRoom.room_type
    });
  } catch (error) {
    console.error('Move plant error:', error);
    res.status(500).json({ error: 'Failed to move plant' });
  }
});

// Record watering - cultivation endpoint
router.post('/:id/water', authenticateToken, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const { waterDate } = req.body;

    const result = await query(`
      UPDATE plants SET
        last_watered = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND user_id = $3
      RETURNING *
    `, [waterDate || new Date().toISOString().split('T')[0], plantId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    res.json({ message: 'Watering recorded successfully' });
  } catch (error) {
    console.error('Record watering error:', error);
    res.status(500).json({ error: 'Failed to record watering' });
  }
});

// Record feeding - cultivation endpoint
router.post('/:id/feed', authenticateToken, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const { feedDate, feedingSchedule } = req.body;

    const result = await query(`
      UPDATE plants SET
        last_fed = $1,
        feeding_schedule = COALESCE($2, feeding_schedule),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND user_id = $4
      RETURNING *
    `, [feedDate || new Date().toISOString().split('T')[0], feedingSchedule, plantId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    res.json({ message: 'Feeding recorded successfully' });
  } catch (error) {
    console.error('Record feeding error:', error);
    res.status(500).json({ error: 'Failed to record feeding' });
  }
});

// Record transplant - cultivation endpoint
router.post('/:id/transplant', authenticateToken, async (req, res) => {
  try {
    const plantId = parseInt(req.params.id);
    const { transplantDate, potSize, medium } = req.body;

    const result = await query(`
      UPDATE plants SET
        last_transplant_date = $1,
        pot_size = COALESCE($2, pot_size),
        medium = COALESCE($3, medium),
        transplant_count = transplant_count + 1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND user_id = $5
      RETURNING *
    `, [transplantDate || new Date().toISOString().split('T')[0], potSize, medium, plantId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    res.json({ message: 'Transplant recorded successfully' });
  } catch (error) {
    console.error('Record transplant error:', error);
    res.status(500).json({ error: 'Failed to record transplant' });
  }
});

module.exports = router;