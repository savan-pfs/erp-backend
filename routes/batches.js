const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get all batches for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { geneticId, motherId, batchType, isActive } = req.query;

    let whereClause = 'WHERE b.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (geneticId) {
      whereClause += ` AND b.genetic_id = $${paramCount++}`;
      queryParams.push(geneticId);
    }
    if (motherId) {
      whereClause += ` AND b.mother_id = $${paramCount++}`;
      queryParams.push(motherId);
    }
    if (batchType) {
      whereClause += ` AND b.batch_type = $${paramCount++}`;
      queryParams.push(batchType);
    }
    if (isActive !== undefined) {
      whereClause += ` AND b.is_active = $${paramCount++}`;
      queryParams.push(isActive === 'true');
    }

    const result = await query(`
      SELECT b.*, g.strain_name, g.flowering_time, m.mother_name, r.name as room_name
      FROM batches b
      LEFT JOIN genetics g ON b.genetic_id = g.id
      LEFT JOIN mothers m ON b.mother_id = m.id
      LEFT JOIN rooms r ON b.room_id = r.id
      ${whereClause}
      ORDER BY b.created_at DESC
    `, queryParams);

    const batches = result.rows.map(batch => ({
      id: batch.id,
      batchName: batch.batch_name,
      batchType: batch.batch_type,
      genetic: batch.genetic_id ? {
        id: batch.genetic_id,
        strainName: batch.strain_name,
        floweringTime: batch.flowering_time
      } : null,
      mother: batch.mother_id ? {
        id: batch.mother_id,
        motherName: batch.mother_name
      } : null,
      room: batch.room_id ? {
        id: batch.room_id,
        name: batch.room_name
      } : null,
      currentStage: batch.current_stage,
      floweringStartDate: batch.flowering_start_date,
      expectedHarvestDate: batch.expected_harvest_date,
      stageChangedAt: batch.stage_changed_at,
      sourceSupplier: batch.source_supplier,
      sourceDate: batch.source_date,
      totalSeeds: batch.total_seeds,
      totalClones: batch.total_clones,
      germinationRate: batch.germination_rate,
      successRate: batch.success_rate,
      purchasePrice: batch.purchase_price,
      purchaseCurrency: batch.purchase_currency,
      storageLocation: batch.storage_location,
      storageConditions: batch.storage_conditions,
      notes: batch.notes,
      isActive: batch.is_active,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at
    }));

    res.json(batches);
  } catch (error) {
    console.error('Get batches error:', error);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// Get single batch by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);

    const result = await query(`
      SELECT b.*, g.strain_name, g.flowering_time, m.mother_name, r.name as room_name
      FROM batches b
      LEFT JOIN genetics g ON b.genetic_id = g.id
      LEFT JOIN mothers m ON b.mother_id = m.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.id = $1 AND b.user_id = $2
    `, [batchId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const batch = result.rows[0];
    
    // Return batch with all fields including stage tracking
    res.json({
      id: batch.id,
      batchName: batch.batch_name,
      batchType: batch.batch_type,
      genetic: batch.genetic_id ? {
        id: batch.genetic_id,
        strainName: batch.strain_name,
        floweringTime: batch.flowering_time
      } : null,
      mother: batch.mother_id ? {
        id: batch.mother_id,
        motherName: batch.mother_name
      } : null,
      room: batch.room_id ? {
        id: batch.room_id,
        name: batch.room_name
      } : null,
      currentStage: batch.current_stage,
      floweringStartDate: batch.flowering_start_date,
      expectedHarvestDate: batch.expected_harvest_date,
      stageChangedAt: batch.stage_changed_at,
      sourceSupplier: batch.source_supplier,
      sourceDate: batch.source_date,
      totalSeeds: batch.total_seeds,
      totalClones: batch.total_clones,
      germinationRate: batch.germination_rate,
      successRate: batch.success_rate,
      purchasePrice: batch.purchase_price,
      purchaseCurrency: batch.purchase_currency,
      storageLocation: batch.storage_location,
      storageConditions: batch.storage_conditions,
      notes: batch.notes,
      isActive: batch.is_active,
      createdAt: batch.created_at,
      updatedAt: batch.updated_at
    });
  } catch (error) {
    console.error('Get batch error:', error);
    res.status(500).json({ error: 'Failed to fetch batch' });
  }
});

// Create new batch
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      batchName,
      batchType = 'seed',
      geneticId,
      motherId,
      roomId,
      sourceSupplier,
      sourceDate,
      totalSeeds = 0,
      totalClones = 0,
      germinationRate,
      successRate,
      purchasePrice,
      purchaseCurrency = 'USD',
      storageLocation,
      storageConditions,
      notes
    } = req.body;

    const result = await query(`
      INSERT INTO batches (
        user_id, batch_name, batch_type, genetic_id, mother_id, room_id,
        source_supplier, source_date, total_seeds, total_clones,
        germination_rate, success_rate, purchase_price, purchase_currency,
        storage_location, storage_conditions, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *
    `, [
      req.user.id, batchName, batchType, geneticId, motherId, roomId,
      sourceSupplier, sourceDate, totalSeeds, totalClones,
      germinationRate, successRate, purchasePrice, purchaseCurrency,
      storageLocation, storageConditions, notes
    ]);

    const batch = result.rows[0];

    // Set initial stage if roomId was provided
    if (roomId) {
      const roomResult = await query(`
        SELECT room_type FROM rooms WHERE id = $1 AND user_id = $2
      `, [roomId, req.user.id]);
      
      if (roomResult.rows.length > 0) {
        const { getStageForRoomType } = require('../utils/stage-validation');
        const initialStage = getStageForRoomType(roomResult.rows[0].room_type) || 'seed';
        
        await query(`
          UPDATE batches SET
            current_stage = $1,
            stage_changed_at = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [initialStage, batch.id]);
      }
    }

    // Fetch the updated batch with all fields including stage tracking
    const updatedBatch = await query(`
      SELECT b.*, g.strain_name, g.flowering_time, m.mother_name, r.name as room_name
      FROM batches b
      LEFT JOIN genetics g ON b.genetic_id = g.id
      LEFT JOIN mothers m ON b.mother_id = m.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.id = $1
    `, [batch.id]);

    const batchData = updatedBatch.rows[0];

    res.status(201).json({
      id: batchData.id,
      batchName: batchData.batch_name,
      batchType: batchData.batch_type,
      genetic: batchData.genetic_id ? {
        id: batchData.genetic_id,
        strainName: batchData.strain_name,
        floweringTime: batchData.flowering_time
      } : null,
      mother: batchData.mother_id ? {
        id: batchData.mother_id,
        motherName: batchData.mother_name
      } : null,
      room: batchData.room_id ? {
        id: batchData.room_id,
        name: batchData.room_name
      } : null,
      currentStage: batchData.current_stage,
      floweringStartDate: batchData.flowering_start_date,
      expectedHarvestDate: batchData.expected_harvest_date,
      stageChangedAt: batchData.stage_changed_at,
      sourceSupplier: batchData.source_supplier,
      sourceDate: batchData.source_date,
      totalSeeds: batchData.total_seeds,
      totalClones: batchData.total_clones,
      germinationRate: batchData.germination_rate,
      successRate: batchData.success_rate,
      purchasePrice: batchData.purchase_price,
      purchaseCurrency: batchData.purchase_currency,
      storageLocation: batchData.storage_location,
      storageConditions: batchData.storage_conditions,
      notes: batchData.notes,
      isActive: batchData.is_active,
      createdAt: batchData.created_at,
      updatedAt: batchData.updated_at
    });
  } catch (error) {
    console.error('Create batch error:', error);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// Update batch
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const {
      batchName,
      batchType,
      geneticId,
      motherId,
      roomId,
      sourceSupplier,
      sourceDate,
      totalSeeds,
      totalClones,
      germinationRate,
      successRate,
      purchasePrice,
      purchaseCurrency,
      storageLocation,
      storageConditions,
      notes,
      isActive
    } = req.body;

    // If roomId is being updated, validate the transition and track stage changes
    let newStage = null;
    let expectedHarvestDate = null;
    let floweringStartDate = null;
    
    if (roomId !== undefined) {
      const currentBatch = await query(`
        SELECT b.room_id, b.current_stage, b.genetic_id, b.flowering_start_date, b.expected_harvest_date,
               r.room_type as current_room_type
        FROM batches b
        LEFT JOIN rooms r ON b.room_id = r.id
        WHERE b.id = $1 AND b.user_id = $2
      `, [batchId, req.user.id]);

      if (currentBatch.rows.length === 0) {
        return res.status(404).json({ error: 'Batch not found' });
      }

      const batch = currentBatch.rows[0];
      const currentRoomType = batch.current_room_type;
      const currentStage = batch.current_stage || 'seed';
      
      if (roomId) {
        // Verify target room exists
        const targetRoom = await query(`
          SELECT room_type, capacity, current_plants, is_active
          FROM rooms 
          WHERE id = $1 AND user_id = $2
        `, [roomId, req.user.id]);

        if (targetRoom.rows.length === 0) {
          return res.status(404).json({ error: 'Target room not found' });
        }

        if (!targetRoom.rows[0].is_active) {
          return res.status(400).json({ error: 'Cannot move batch to an inactive room' });
        }

        const targetRoomType = targetRoom.rows[0].room_type;

        // Validate room transition if moving from one room to another
        if (currentRoomType && batch.room_id !== roomId) {
          const { isValidRoomTransition } = require('../utils/room-validation');
          const { validateRoomToStageTransition, getStageForRoomType } = require('../utils/stage-validation');
          
          if (!isValidRoomTransition(currentRoomType, targetRoomType)) {
            return res.status(400).json({ 
              error: `Invalid room transition. Cannot move batch from ${currentRoomType} room to ${targetRoomType} room.` 
            });
          }

          // Validate stage transition
          const stageValidation = validateRoomToStageTransition(currentStage, currentRoomType, targetRoomType);
          if (!stageValidation.valid) {
            return res.status(400).json({ error: stageValidation.error });
          }

          newStage = stageValidation.newStage;

          // If entering FLOWERING room, calculate expected harvest date and set flowering start date
          if (targetRoomType === 'FLOWERING' && currentStage !== 'flowering') {
            floweringStartDate = new Date().toISOString().split('T')[0];
            
            // Get genetics.flowering_time to calculate expected harvest date
            if (batch.genetic_id) {
              const geneticResult = await query(`
                SELECT flowering_time FROM genetics WHERE id = $1 AND user_id = $2
              `, [batch.genetic_id, req.user.id]);
              
              if (geneticResult.rows.length > 0 && geneticResult.rows[0].flowering_time) {
                const floweringTimeDays = parseInt(geneticResult.rows[0].flowering_time) || 56; // Default 8 weeks
                const expectedDate = new Date();
                expectedDate.setDate(expectedDate.getDate() + floweringTimeDays);
                expectedHarvestDate = expectedDate.toISOString().split('T')[0];
              }
            }
          }

          // Check capacity
          const plantCountResult = await query(`
            SELECT COUNT(*) as plant_count
            FROM plants
            WHERE batch_id = $1 AND user_id = $2 AND is_active = true
          `, [batchId, req.user.id]);

          const plantCount = parseInt(plantCountResult.rows[0].plant_count || 0);
          
          if (targetRoom.rows[0].current_plants + plantCount > targetRoom.rows[0].capacity) {
            return res.status(400).json({ 
              error: `Room capacity exceeded. Room has ${targetRoom.rows[0].current_plants}/${targetRoom.rows[0].capacity} plants. Batch contains ${plantCount} plants.` 
            });
          }
        } else if (batch.room_id === roomId && currentRoomType) {
          // Same room, but ensure stage matches room type
          const { getStageForRoomType } = require('../utils/stage-validation');
          const roomStage = getStageForRoomType(currentRoomType);
          if (roomStage && currentStage !== roomStage) {
            newStage = roomStage;
          }
        }
      }
    }

    // Build dynamic update query for stage tracking
    let updateFields = [
      'batch_name = COALESCE($1, batch_name)',
      'batch_type = COALESCE($2, batch_type)',
      'genetic_id = COALESCE($3, genetic_id)',
      'mother_id = COALESCE($4, mother_id)',
      'room_id = COALESCE($5, room_id)',
      'source_supplier = COALESCE($6, source_supplier)',
      'source_date = COALESCE($7, source_date)',
      'total_seeds = COALESCE($8, total_seeds)',
      'total_clones = COALESCE($9, total_clones)',
      'germination_rate = COALESCE($10, germination_rate)',
      'success_rate = COALESCE($11, success_rate)',
      'purchase_price = COALESCE($12, purchase_price)',
      'purchase_currency = COALESCE($13, purchase_currency)',
      'storage_location = COALESCE($14, storage_location)',
      'storage_conditions = COALESCE($15, storage_conditions)',
      'notes = COALESCE($16, notes)',
      'is_active = COALESCE($17, is_active)',
      'updated_at = CURRENT_TIMESTAMP'
    ];
    
    let paramCount = 18;
    let queryParams = [
      batchName, batchType, geneticId, motherId, roomId,
      sourceSupplier, sourceDate, totalSeeds, totalClones,
      germinationRate, successRate, purchasePrice, purchaseCurrency,
      storageLocation, storageConditions, notes, isActive
    ];

    // Add stage tracking updates if stage is changing
    if (newStage) {
      updateFields.push(`current_stage = $${paramCount++}`);
      updateFields.push(`stage_changed_at = CURRENT_TIMESTAMP`);
      queryParams.push(newStage);
    }

    // Add flowering_start_date if entering flowering
    if (floweringStartDate) {
      updateFields.push(`flowering_start_date = $${paramCount++}`);
      queryParams.push(floweringStartDate);
    }

    // Add expected_harvest_date if calculated
    if (expectedHarvestDate) {
      updateFields.push(`expected_harvest_date = $${paramCount++}`);
      queryParams.push(expectedHarvestDate);
    }

    queryParams.push(batchId, req.user.id);
    const whereClause = `WHERE id = $${paramCount++} AND user_id = $${paramCount}`;

    const result = await query(`
      UPDATE batches SET
        ${updateFields.join(', ')}
      ${whereClause}
      RETURNING *
    `, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // If room was changed, update plant rooms and room capacities
    if (roomId !== undefined && roomId !== null) {
      const currentBatch = await query(`
        SELECT room_id FROM batches WHERE id = $1
      `, [batchId]);
      
      const oldRoomId = currentBatch.rows[0]?.room_id;
      
      if (oldRoomId !== roomId) {
        // Get plant count
        const plantCountResult = await query(`
          SELECT COUNT(*) as plant_count
          FROM plants
          WHERE batch_id = $1 AND user_id = $2 AND is_active = true
        `, [batchId, req.user.id]);
        const plantCount = parseInt(plantCountResult.rows[0].plant_count || 0);

        // Update all plants in batch to new room
        await query(`
          UPDATE plants SET
            room_id = $1,
            updated_at = CURRENT_TIMESTAMP
          WHERE batch_id = $2 AND user_id = $3
        `, [roomId, batchId, req.user.id]);

        // Update room capacities
        if (oldRoomId) {
          await query(`
            UPDATE rooms SET
              current_plants = GREATEST(0, current_plants - $1),
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [plantCount, oldRoomId]);
        }

        if (roomId) {
          await query(`
            UPDATE rooms SET
              current_plants = current_plants + $1,
              updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
          `, [plantCount, roomId]);
        }
      }
    }

    const batch = result.rows[0];

    res.json({
      id: batch.id,
      batchName: batch.batch_name,
      batchType: batch.batch_type,
      geneticId: batch.genetic_id,
      motherId: batch.mother_id,
      roomId: batch.room_id,
      currentStage: batch.current_stage,
      floweringStartDate: batch.flowering_start_date,
      expectedHarvestDate: batch.expected_harvest_date,
      sourceSupplier: batch.source_supplier,
      sourceDate: batch.source_date,
      totalSeeds: batch.total_seeds,
      totalClones: batch.total_clones,
      germinationRate: batch.germination_rate,
      successRate: batch.success_rate,
      purchasePrice: batch.purchase_price,
      purchaseCurrency: batch.purchase_currency,
      storageLocation: batch.storage_location,
      storageConditions: batch.storage_conditions,
      notes: batch.notes,
      isActive: batch.is_active,
      updatedAt: batch.updated_at
    });
  } catch (error) {
    console.error('Update batch error:', error);
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

// Delete batch
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);

    // Verify batch exists and belongs to user
    const batchCheck = await query(
      'SELECT id, batch_name FROM batches WHERE id = $1 AND user_id = $2',
      [batchId, req.user.id]
    );

    if (batchCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Check if batch has active plants
    const plantsCheck = await query(
      'SELECT COUNT(*) as count FROM plants WHERE batch_id = $1 AND user_id = $2 AND is_active = true',
      [batchId, req.user.id]
    );

    const plantCount = parseInt(plantsCheck.rows[0].count || 0);
    if (plantCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete batch. It currently has ${plantCount} active plant(s). Please remove or deactivate the plants first.` 
      });
    }

    // Check if batch has associated harvest batches
    const harvestCheck = await query(
      'SELECT COUNT(*) as count FROM harvest_batches WHERE batch_id = $1 AND user_id = $2',
      [batchId, req.user.id]
    );

    const harvestCount = parseInt(harvestCheck.rows[0].count || 0);
    if (harvestCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete batch. It has ${harvestCount} associated harvest batch(es). Please remove the harvest batches first.` 
      });
    }

    // Hard delete - permanently remove from database
    // Note: Related records will be handled by foreign key constraints:
    // - plants: ON DELETE SET NULL (batch_id will be set to NULL)
    // - harvest_batches: ON DELETE SET NULL (batch_id will be set to NULL)
    const result = await query(
      'DELETE FROM batches WHERE id = $1 AND user_id = $2 RETURNING id, batch_name',
      [batchId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found or already deleted' });
    }

    res.json({ 
      message: 'Batch deleted successfully',
      batch: result.rows[0]
    });
  } catch (error) {
    console.error('Delete batch error:', error);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

// Germinate seeds from batch - cultivation endpoint
router.post('/:id/germinate', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const { seedCount, roomId, germinationDate } = req.body;

    // Verify batch exists and belongs to user
    const batchResult = await query(
      'SELECT * FROM batches WHERE id = $1 AND user_id = $2',
      [batchId, req.user.id]
    );

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const batch = batchResult.rows[0];

    if (batch.total_seeds < seedCount) {
      return res.status(400).json({ error: 'Not enough seeds in batch' });
    }

    // Create plants from germinated seeds
    const plants = [];
    for (let i = 1; i <= seedCount; i++) {
      const plantResult = await query(`
        INSERT INTO plants (
          user_id, batch_id, genetic_id, room_id, plant_number,
          growth_stage, germination_date, planting_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        req.user.id,
        batchId,
        batch.genetic_id,
        roomId,
        i,
        'seedling',
        germinationDate || new Date().toISOString().split('T')[0],
        germinationDate || new Date().toISOString().split('T')[0]
      ]);
      plants.push(plantResult.rows[0]);
    }

    // Update batch germination rate
    const germinationRate = (seedCount / batch.total_seeds) * 100;
    await query(`
      UPDATE batches SET
        germination_rate = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [germinationRate, batchId]);

    res.status(201).json({
      plants: plants.map(p => ({
        id: p.id,
        plantNumber: p.plant_number,
        growthStage: p.growth_stage,
        germinationDate: p.germination_date,
        plantingDate: p.planting_date
      })),
      germinationRate,
      message: `Successfully germinated ${seedCount} seeds`
    });
  } catch (error) {
    console.error('Germinate batch error:', error);
    res.status(500).json({ error: 'Failed to germinate seeds' });
  }
});

// Move batch to different room - cultivation endpoint
router.post('/:id/move', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.id);
    const { roomId } = req.body;

    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    // Verify batch exists and belongs to user
    const batchResult = await query(`
      SELECT b.*, r.room_type as current_room_type
      FROM batches b
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.id = $1 AND b.user_id = $2
    `, [batchId, req.user.id]);

    if (batchResult.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const batch = batchResult.rows[0];

    // Verify target room exists and belongs to user
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
      return res.status(400).json({ error: 'Cannot move batch to an inactive room' });
    }

    // Validate room type transition if batch is currently in a room
    if (batch.room_id && batch.current_room_type) {
      const { isValidRoomTransition } = require('../utils/room-validation');
      
      if (!isValidRoomTransition(batch.current_room_type, targetRoom.room_type)) {
        return res.status(400).json({ 
          error: `Invalid room transition. Cannot move batch from ${batch.current_room_type} room to ${targetRoom.room_type} room. Valid transitions from ${batch.current_room_type} are: ${require('../utils/room-validation').getAllowedRoomTransitions(batch.current_room_type).join(', ') || 'none'}` 
        });
      }
    }

    // Check room capacity (count plants in batch)
    const plantCountResult = await query(`
      SELECT COUNT(*) as plant_count
      FROM plants
      WHERE batch_id = $1 AND user_id = $2 AND is_active = true
    `, [batchId, req.user.id]);

    const plantCount = parseInt(plantCountResult.rows[0].plant_count || 0);
    
    if (targetRoom.current_plants + plantCount > targetRoom.capacity) {
      return res.status(400).json({ 
        error: `Room capacity exceeded. Room has ${targetRoom.current_plants}/${targetRoom.capacity} plants. Batch contains ${plantCount} plants.` 
      });
    }

    // Get old room ID and current stage for capacity update and stage tracking
    const oldRoomId = batch.room_id;
    const currentStage = batch.current_stage || 'seed';

    // Use targetRoom from earlier query (line 647) - no need to query again
    const targetRoomType = targetRoom.room_type;
    const { validateRoomToStageTransition, getStageForRoomType } = require('../utils/stage-validation');
    
    // Validate stage transition (handle null current_room_type for batches without a room)
    const stageValidation = validateRoomToStageTransition(currentStage, batch.current_room_type || null, targetRoomType);
    if (!stageValidation.valid) {
      return res.status(400).json({ error: stageValidation.error });
    }

    const newStage = stageValidation.newStage;
    let expectedHarvestDate = null;
    let floweringStartDate = null;

    // If entering FLOWERING room, calculate expected harvest date and set flowering start date
    if (targetRoomType === 'FLOWERING' && currentStage !== 'flowering') {
      floweringStartDate = new Date().toISOString().split('T')[0];
      
      // Get genetics.flowering_time to calculate expected harvest date
      if (batch.genetic_id) {
        const geneticResult = await query(`
          SELECT flowering_time FROM genetics WHERE id = $1 AND user_id = $2
        `, [batch.genetic_id, req.user.id]);
        
        if (geneticResult.rows.length > 0 && geneticResult.rows[0].flowering_time) {
          const floweringTimeDays = parseInt(geneticResult.rows[0].flowering_time) || 56; // Default 8 weeks
          const expectedDate = new Date();
          expectedDate.setDate(expectedDate.getDate() + floweringTimeDays);
          expectedHarvestDate = expectedDate.toISOString().split('T')[0];
        }
      }
    }

    // Build update query with stage tracking
    const updateFields = ['room_id = $1', 'current_stage = $2', 'stage_changed_at = CURRENT_TIMESTAMP', 'updated_at = CURRENT_TIMESTAMP'];
    const updateParams = [roomId, newStage];
    let paramCount = 3;

    if (floweringStartDate) {
      updateFields.push(`flowering_start_date = $${paramCount++}`);
      updateParams.push(floweringStartDate);
    }

    if (expectedHarvestDate) {
      updateFields.push(`expected_harvest_date = $${paramCount++}`);
      updateParams.push(expectedHarvestDate);
    }

    updateParams.push(batchId);

    // Update batch room and stage
    await query(`
      UPDATE batches SET
        ${updateFields.join(', ')}
      WHERE id = $${paramCount}
    `, updateParams);

    // Update all plants in this batch to the new room
    await query(`
      UPDATE plants SET
        room_id = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE batch_id = $2 AND user_id = $3
    `, [roomId, batchId, req.user.id]);

    // Update room capacities
    if (oldRoomId) {
      // Decrease old room capacity
      await query(`
        UPDATE rooms SET
          current_plants = GREATEST(0, current_plants - $1),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [plantCount, oldRoomId]);
    }

    // Increase new room capacity
    await query(`
      UPDATE rooms SET
        current_plants = current_plants + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [plantCount, roomId]);

    res.json({ 
      message: 'Batch and associated plants moved successfully',
      fromRoomType: batch.current_room_type,
      toRoomType: targetRoom.room_type
    });
  } catch (error) {
    console.error('Move batch error:', error);
    res.status(500).json({ error: 'Failed to move batch' });
  }
});

module.exports = router;