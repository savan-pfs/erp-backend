const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get all mothers for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { geneticId, roomId, isActive } = req.query;

    let whereClause = 'WHERE m.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (geneticId) {
      whereClause += ` AND genetic_id = $${paramCount++}`;
      queryParams.push(geneticId);
    }
    if (roomId) {
      whereClause += ` AND room_id = $${paramCount++}`;
      queryParams.push(roomId);
    }
    if (isActive !== undefined) {
      whereClause += ` AND is_active = $${paramCount++}`;
      queryParams.push(isActive === 'true');
    }

    const result = await query(`
      SELECT m.*, g.strain_name, r.name as room_name
      FROM mothers m
      LEFT JOIN genetics g ON m.genetic_id = g.id
      LEFT JOIN rooms r ON m.room_id = r.id
      ${whereClause}
      ORDER BY m.created_at DESC
    `, queryParams);

    const mothers = result.rows.map(mother => ({
      id: mother.id,
      motherName: mother.mother_name,
      genetic: mother.genetic_id ? {
        id: mother.genetic_id,
        strainName: mother.strain_name
      } : null,
      room: mother.room_id ? {
        id: mother.room_id,
        name: mother.room_name
      } : null,
      cloneCount: mother.clone_count,
      ageDays: mother.age_days,
      healthStatus: mother.health_status,
      lastCloneDate: mother.last_clone_date,
      nextCloneDate: mother.next_clone_date,
      floweringCompatible: mother.flowering_compatible,
      notes: mother.notes,
      isActive: mother.is_active,
      createdAt: mother.created_at,
      updatedAt: mother.updated_at
    }));

    res.json(mothers);
  } catch (error) {
    console.error('Get mothers error:', error);
    res.status(500).json({ error: 'Failed to fetch mothers' });
  }
});

// Get single mother by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const motherId = parseInt(req.params.id);

    const result = await query(`
      SELECT m.*, g.strain_name, r.name as room_name
      FROM mothers m
      LEFT JOIN genetics g ON m.genetic_id = g.id
      LEFT JOIN rooms r ON m.room_id = r.id
      WHERE m.id = $1 AND m.user_id = $2
    `, [motherId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mother not found' });
    }

    const mother = result.rows[0];

    res.json({
      id: mother.id,
      motherName: mother.mother_name,
      genetic: mother.genetic_id ? {
        id: mother.genetic_id,
        strainName: mother.strain_name
      } : null,
      room: mother.room_id ? {
        id: mother.room_id,
        name: mother.room_name
      } : null,
      cloneCount: mother.clone_count,
      ageDays: mother.age_days,
      healthStatus: mother.health_status,
      lastCloneDate: mother.last_clone_date,
      nextCloneDate: mother.next_clone_date,
      floweringCompatible: mother.flowering_compatible,
      notes: mother.notes,
      isActive: mother.is_active,
      createdAt: mother.created_at,
      updatedAt: mother.updated_at
    });
  } catch (error) {
    console.error('Get mother error:', error);
    res.status(500).json({ error: 'Failed to fetch mother' });
  }
});

// Create new mother
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      motherName,
      geneticId,
      roomId,
      cloneCount = 0,
      ageDays = 0,
      healthStatus = 'healthy',
      lastCloneDate,
      nextCloneDate,
      floweringCompatible = true,
      notes
    } = req.body;

    const result = await query(`
      INSERT INTO mothers (
        user_id, genetic_id, room_id, mother_name, clone_count, age_days,
        health_status, last_clone_date, next_clone_date, flowering_compatible, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      req.user.id, geneticId, roomId, motherName, cloneCount, ageDays,
      healthStatus, lastCloneDate, nextCloneDate, floweringCompatible, notes
    ]);

    const mother = result.rows[0];

    res.status(201).json({
      id: mother.id,
      motherName: mother.mother_name,
      geneticId: mother.genetic_id,
      roomId: mother.room_id,
      cloneCount: mother.clone_count,
      ageDays: mother.age_days,
      healthStatus: mother.health_status,
      lastCloneDate: mother.last_clone_date,
      nextCloneDate: mother.next_clone_date,
      floweringCompatible: mother.flowering_compatible,
      notes: mother.notes,
      isActive: mother.is_active,
      createdAt: mother.created_at,
      updatedAt: mother.updated_at
    });
  } catch (error) {
    console.error('Create mother error:', error);
    res.status(500).json({ error: 'Failed to create mother' });
  }
});

// Update mother
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const motherId = parseInt(req.params.id);
    const {
      motherName,
      geneticId,
      roomId,
      cloneCount,
      ageDays,
      healthStatus,
      lastCloneDate,
      nextCloneDate,
      floweringCompatible,
      notes,
      isActive
    } = req.body;

    const result = await query(`
      UPDATE mothers SET
        genetic_id = COALESCE($1, genetic_id),
        room_id = COALESCE($2, room_id),
        mother_name = COALESCE($3, mother_name),
        clone_count = COALESCE($4, clone_count),
        age_days = COALESCE($5, age_days),
        health_status = COALESCE($6, health_status),
        last_clone_date = COALESCE($7, last_clone_date),
        next_clone_date = COALESCE($8, next_clone_date),
        flowering_compatible = COALESCE($9, flowering_compatible),
        notes = COALESCE($10, notes),
        is_active = COALESCE($11, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12 AND user_id = $13
      RETURNING *
    `, [
      geneticId, roomId, motherName, cloneCount, ageDays, healthStatus,
      lastCloneDate, nextCloneDate, floweringCompatible, notes, isActive,
      motherId, req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mother not found' });
    }

    const mother = result.rows[0];

    res.json({
      id: mother.id,
      motherName: mother.mother_name,
      geneticId: mother.genetic_id,
      roomId: mother.room_id,
      cloneCount: mother.clone_count,
      ageDays: mother.age_days,
      healthStatus: mother.health_status,
      lastCloneDate: mother.last_clone_date,
      nextCloneDate: mother.next_clone_date,
      floweringCompatible: mother.flowering_compatible,
      notes: mother.notes,
      isActive: mother.is_active,
      updatedAt: mother.updated_at
    });
  } catch (error) {
    console.error('Update mother error:', error);
    res.status(500).json({ error: 'Failed to update mother' });
  }
});

// Delete mother
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const motherId = parseInt(req.params.id);

    // Verify mother exists and belongs to user
    const motherCheck = await query(
      'SELECT id, mother_name, clone_count FROM mothers WHERE id = $1 AND user_id = $2',
      [motherId, req.user.id]
    );

    if (motherCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mother plant not found' });
    }

    const mother = motherCheck.rows[0];

    // Check if mother has active batches
    const batchesCheck = await query(
      'SELECT COUNT(*) as count FROM batches WHERE mother_id = $1 AND user_id = $2 AND is_active = true',
      [motherId, req.user.id]
    );

    const batchCount = parseInt(batchesCheck.rows[0].count || 0);
    if (batchCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete mother plant. It is currently used by ${batchCount} active batch(es). Please remove or deactivate the batches first.` 
      });
    }

    // Hard delete - permanently remove from database
    // Note: Related records will be handled by foreign key constraints:
    // - batches: ON DELETE SET NULL (mother_id will be set to NULL)
    const result = await query(
      'DELETE FROM mothers WHERE id = $1 AND user_id = $2 RETURNING id, mother_name, clone_count',
      [motherId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Mother plant not found or already deleted' });
    }

    const deletedMother = result.rows[0];
    const cloneCount = parseInt(deletedMother.clone_count || 0);

    res.json({
      message: cloneCount > 0 
        ? `Mother plant deleted successfully. Note: This mother had ${cloneCount} clones taken.`
        : 'Mother plant deleted successfully',
      mother: {
        id: deletedMother.id,
        mother_name: deletedMother.mother_name
      }
    });

  } catch (error) {
    console.error('Delete mother error:', error);
    res.status(500).json({ error: 'Failed to delete mother plant' });
  }
});

// Clone from mother - cultivation endpoint
router.post('/:id/clone', authenticateToken, async (req, res) => {
  try {
    const motherId = parseInt(req.params.id);
    const { cloneCount = 1, batchName, roomId } = req.body;

    // Verify mother exists and belongs to user
    const motherResult = await query(
      'SELECT * FROM mothers WHERE id = $1 AND user_id = $2',
      [motherId, req.user.id]
    );

    if (motherResult.rows.length === 0) {
      return res.status(404).json({ error: 'Mother not found' });
    }

    const mother = motherResult.rows[0];

    // Create batch from clones
    const batchResult = await query(`
      INSERT INTO batches (
        user_id, batch_name, batch_type, genetic_id, mother_id,
        total_clones, source_date, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      req.user.id,
      batchName || `Clone batch from ${mother.mother_name}`,
      'clone',
      mother.genetic_id,
      motherId,
      cloneCount,
      new Date().toISOString().split('T')[0],
      true
    ]);

    const batch = batchResult.rows[0];

    // Update mother's clone count and last clone date
    await query(`
      UPDATE mothers SET
        clone_count = clone_count + $1,
        last_clone_date = CURRENT_DATE,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [cloneCount, motherId]);

    // Create plants from the batch
    const plants = [];
    for (let i = 1; i <= cloneCount; i++) {
      const plantResult = await query(`
        INSERT INTO plants (
          user_id, batch_id, genetic_id, room_id, plant_number,
          growth_stage, planting_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        req.user.id,
        batch.id,
        mother.genetic_id,
        roomId || mother.room_id,
        i,
        'seedling',
        new Date().toISOString().split('T')[0]
      ]);
      plants.push(plantResult.rows[0]);
    }

    res.status(201).json({
      batch: {
        id: batch.id,
        batchName: batch.batch_name,
        batchType: batch.batch_type,
        totalClones: batch.total_clones,
        createdAt: batch.created_at
      },
      plants: plants.map(p => ({
        id: p.id,
        plantNumber: p.plant_number,
        growthStage: p.growth_stage,
        plantingDate: p.planting_date
      })),
      message: `Successfully cloned ${cloneCount} plants from mother`
    });
  } catch (error) {
    console.error('Clone mother error:', error);
    res.status(500).json({ error: 'Failed to clone from mother' });
  }
});

module.exports = router;