const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { query } = require('../config/database');

const router = express.Router();

// Get all recipes
router.get('/recipes', authenticateToken, async (req, res) => {
  try {
    const { organizationId, recipeType, isActive } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    if (req.user.organizationId) {
      whereClause += ` AND r.organization_id = $${paramCount++}`;
      queryParams.push(req.user.organizationId);
    } else if (organizationId && req.user.role === 'super_admin') {
      whereClause += ` AND r.organization_id = $${paramCount++}`;
      queryParams.push(organizationId);
    }

    if (recipeType) {
      whereClause += ` AND r.recipe_type = $${paramCount++}`;
      queryParams.push(recipeType);
    }

    if (isActive !== undefined) {
      whereClause += ` AND r.is_active = $${paramCount++}`;
      queryParams.push(isActive === 'true');
    }

    const result = await query(`
      SELECT r.*,
             creator.email as created_by_email,
             approver.email as approved_by_email
      FROM recipes r
      LEFT JOIN users creator ON r.created_by = creator.id
      LEFT JOIN users approver ON r.approved_by = approver.id
      ${whereClause}
      ORDER BY r.created_at DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get recipes error:', error);
    res.status(500).json({ error: 'Failed to fetch recipes' });
  }
});

// Get recipe with ingredients
router.get('/recipes/:id', authenticateToken, async (req, res) => {
  try {
    const recipeId = parseInt(req.params.id);

    const recipeResult = await query(`
      SELECT r.*,
             creator.email as created_by_email,
             approver.email as approved_by_email
      FROM recipes r
      LEFT JOIN users creator ON r.created_by = creator.id
      LEFT JOIN users approver ON r.approved_by = approver.id
      WHERE r.id = $1
    `, [recipeId]);

    if (recipeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const ingredientsResult = await query(`
      SELECT ri.*, i.item_name as inventory_item_name
      FROM recipe_ingredients ri
      LEFT JOIN inventory i ON ri.inventory_id = i.id
      WHERE ri.recipe_id = $1
      ORDER BY ri.sequence_order, ri.id
    `, [recipeId]);

    res.json({
      ...recipeResult.rows[0],
      ingredients: ingredientsResult.rows
    });
  } catch (error) {
    console.error('Get recipe error:', error);
    res.status(500).json({ error: 'Failed to fetch recipe' });
  }
});

// Create recipe
router.post('/recipes', authenticateToken, requirePermission('manufacturing:create'), async (req, res) => {
  try {
    const {
      organizationId,
      name,
      description,
      recipeType,
      version,
      ingredients
    } = req.body;

    if (!name || !recipeType) {
      return res.status(400).json({ error: 'Recipe name and type are required' });
    }

    const orgId = organizationId || req.user.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Create recipe
    const recipeResult = await query(`
      INSERT INTO recipes (
        organization_id, name, description, recipe_type, version, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, recipe_type, version, created_at
    `, [orgId, name, description, recipeType, version || '1.0', req.user.id]);

    const recipe = recipeResult.rows[0];

    // Add ingredients if provided
    if (ingredients && Array.isArray(ingredients)) {
      for (const ingredient of ingredients) {
        await query(`
          INSERT INTO recipe_ingredients (
            recipe_id, ingredient_type, inventory_id, item_name, quantity, unit, sequence_order, notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          recipe.id,
          ingredient.ingredientType || 'NON_CANNABIS',
          ingredient.inventoryId || null,
          ingredient.itemName,
          ingredient.quantity,
          ingredient.unit || 'g',
          ingredient.sequenceOrder || 0,
          ingredient.notes || null
        ]);
      }
    }

    res.status(201).json({
      message: 'Recipe created successfully',
      recipe
    });
  } catch (error) {
    console.error('Create recipe error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Recipe with this name and version already exists' });
    }
    res.status(500).json({ error: 'Failed to create recipe' });
  }
});

// Get manufacturing batches
router.get('/batches', authenticateToken, async (req, res) => {
  try {
    const { organizationId, facilityId, status } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    if (req.user.organizationId) {
      whereClause += ` AND mb.organization_id = $${paramCount++}`;
      queryParams.push(req.user.organizationId);
    }

    if (facilityId) {
      whereClause += ` AND mb.facility_id = $${paramCount++}`;
      queryParams.push(facilityId);
    }

    if (status) {
      whereClause += ` AND mb.status = $${paramCount++}`;
      queryParams.push(status);
    }

    const result = await query(`
      SELECT mb.*,
             r.name as recipe_name,
             r.recipe_type,
             creator.email as created_by_email
      FROM manufacturing_batches mb
      LEFT JOIN recipes r ON mb.recipe_id = r.id
      LEFT JOIN users creator ON mb.created_by = creator.id
      ${whereClause}
      ORDER BY mb.created_at DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get manufacturing batches error:', error);
    res.status(500).json({ error: 'Failed to fetch manufacturing batches' });
  }
});

// Create manufacturing batch
router.post('/batches', authenticateToken, requirePermission('manufacturing:create'), async (req, res) => {
  try {
    const {
      organizationId,
      recipeId,
      batchNumber,
      batchName,
      roomId,
      plannedQuantity,
      inputBatches
    } = req.body;

    if (!recipeId || !batchNumber || !batchName || !plannedQuantity) {
      return res.status(400).json({ error: 'Recipe ID, batch number, batch name, and planned quantity are required' });
    }

    const orgId = organizationId || req.user.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    const result = await query(`
      INSERT INTO manufacturing_batches (
        organization_id, recipe_id, batch_number, batch_name,
        room_id, planned_quantity, status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'PLANNED', $7)
      RETURNING id, batch_number, batch_name, status, created_at
    `, [orgId, recipeId, batchNumber, batchName, roomId || null, plannedQuantity, req.user.id]);

    const batch = result.rows[0];

    // Add input batches if provided
    if (inputBatches && Array.isArray(inputBatches)) {
      for (const input of inputBatches) {
        await query(`
          INSERT INTO manufacturing_batch_inputs (
            manufacturing_batch_id, input_batch_id, inventory_id, quantity_used, unit
          )
          VALUES ($1, $2, $3, $4, $5)
        `, [batch.id, input.batchId, input.inventoryId || null, input.quantity, input.unit || 'g']);
      }
    }

    res.status(201).json({
      message: 'Manufacturing batch created successfully',
      batch
    });
  } catch (error) {
    console.error('Create manufacturing batch error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Batch number already exists' });
    }
    res.status(500).json({ error: 'Failed to create manufacturing batch' });
  }
});

module.exports = router;
