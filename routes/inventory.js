const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const { createLedgerEntry, getLedgerEntries, getCurrentQuantity } = require('../utils/inventory-ledger');

const router = express.Router();

// Get all inventory items
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { itemType, status, location } = req.query;

    let whereClause = 'WHERE i.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (itemType) {
      whereClause += ` AND i.item_type = $${paramCount++}`;
      queryParams.push(itemType);
    }
    if (status) {
      whereClause += ` AND i.status = $${paramCount++}`;
      queryParams.push(status);
    }
    if (location) {
      whereClause += ` AND i.location ILIKE $${paramCount++}`;
      queryParams.push(`%${location}%`);
    }

    const result = await query(`
      SELECT i.*,
             hb.harvest_name,
             g.strain_name as genetic_name
      FROM inventory i
      LEFT JOIN harvest_batches hb ON i.harvest_batch_id = hb.id
      LEFT JOIN genetics g ON i.genetic_id = g.id
      ${whereClause}
      ORDER BY i.created_at DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});

// Get single inventory item
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const inventoryId = parseInt(req.params.id);

    const result = await query(`
      SELECT i.*,
             hb.harvest_name,
             g.strain_name as genetic_name
      FROM inventory i
      LEFT JOIN harvest_batches hb ON i.harvest_batch_id = hb.id
      LEFT JOIN genetics g ON i.genetic_id = g.id
      WHERE i.id = $1 AND i.user_id = $2
    `, [inventoryId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get inventory item error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory item' });
  }
});

// Create inventory item (batch-first, requires harvest_batch_id)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      harvestBatchId, geneticId, lotNumber, itemType, itemName, quantity, unit,
      roomId, containerType, packageDate, expirationDate, batchNumber,
      testResults, complianceTag, pricePerUnit, totalValue, currency, status, notes
    } = req.body;

    // Harvest batch ID is required (batch-first inventory)
    if (!harvestBatchId) {
      return res.status(400).json({ error: 'Harvest batch ID is required. Inventory must be batch-scoped.' });
    }

    // Room ID is required (inventory is room-scoped)
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required. Inventory must be room-scoped.' });
    }

    if (!quantity || quantity <= 0) {
      return res.status(400).json({ error: 'Valid quantity is required' });
    }

    // Verify harvest batch exists and belongs to user
    const batchCheck = await query(`
      SELECT hb.id, hb.status, hb.batch_id
      FROM harvest_batches hb
      WHERE hb.id = $1 AND hb.user_id = $2
    `, [harvestBatchId, req.user.id]);

    if (batchCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Harvest batch not found' });
    }

    const harvestBatch = batchCheck.rows[0];
    
    // Ensure harvest batch is in a valid status for inventory creation (drying, curing, or completed)
    if (harvestBatch.status && !['drying', 'curing', 'completed'].includes(harvestBatch.status)) {
      return res.status(400).json({ 
        error: `Cannot create inventory from harvest batch in '${harvestBatch.status}' status. Harvest batch must be in drying, curing, or completed stage.` 
      });
    }

    // Create inventory item with initial quantity of 0 (will be set by ledger)
    const result = await query(`
      INSERT INTO inventory (
        user_id, harvest_batch_id, genetic_id, lot_number, item_type, item_name,
        quantity, unit, room_id, container_type, package_date, expiration_date,
        batch_number, test_results, compliance_tag, price_per_unit, total_value,
        currency, status, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, 0, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id, harvest_batch_id, room_id, quantity
    `, [
      req.user.id, harvestBatchId, geneticId, lotNumber, itemType || 'flower',
      itemName, unit || 'g', roomId, containerType, packageDate,
      expirationDate, batchNumber, testResults, complianceTag, pricePerUnit,
      totalValue, currency || 'USD', status || 'available', notes
    ]);

    const inventory = result.rows[0];

    // Create initial ledger entry
    await createLedgerEntry({
      inventoryId: inventory.id,
      harvestBatchId: inventory.harvest_batch_id,
      roomId: inventory.room_id,
      transactionType: 'INITIAL',
      quantityChange: parseFloat(quantity),
      quantityBefore: 0,
      unit: unit || 'g',
      performedBy: req.user.id,
      notes: 'Initial inventory creation'
    });

    // Get full inventory record
    const fullResult = await query(`
      SELECT i.*,
             hb.harvest_name,
             g.strain_name as genetic_name,
             r.name as room_name
      FROM inventory i
      LEFT JOIN harvest_batches hb ON i.harvest_batch_id = hb.id
      LEFT JOIN genetics g ON i.genetic_id = g.id
      LEFT JOIN rooms r ON i.room_id = r.id
      WHERE i.id = $1
    `, [inventory.id]);

    res.status(201).json(fullResult.rows[0]);
  } catch (error) {
    console.error('Create inventory item error:', error);
    res.status(500).json({ error: 'Failed to create inventory item' });
  }
});

// Update inventory item
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const inventoryId = parseInt(req.params.id);
    const {
      quantity, location, status, pricePerUnit, totalValue, testResults,
      complianceTag, notes
    } = req.body;

    const result = await query(`
      UPDATE inventory SET
        quantity = COALESCE($1, quantity),
        location = COALESCE($2, location),
        status = COALESCE($3, status),
        price_per_unit = COALESCE($4, price_per_unit),
        total_value = COALESCE($5, total_value),
        test_results = COALESCE($6, test_results),
        compliance_tag = COALESCE($7, compliance_tag),
        notes = COALESCE($8, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND user_id = $10
      RETURNING *
    `, [
      quantity, location, status, pricePerUnit, totalValue, testResults,
      complianceTag, notes, inventoryId, req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update inventory item error:', error);
    res.status(500).json({ error: 'Failed to update inventory item' });
  }
});

// Delete inventory item
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const inventoryId = parseInt(req.params.id);

    const result = await query(
      'DELETE FROM inventory WHERE id = $1 AND user_id = $2 RETURNING id',
      [inventoryId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    res.json({ message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Delete inventory item error:', error);
    res.status(500).json({ error: 'Failed to delete inventory item' });
  }
});

module.exports = router;
