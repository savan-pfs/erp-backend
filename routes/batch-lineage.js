const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { query } = require('../config/database');
const { createLedgerEntry, getCurrentQuantity, getLedgerEntries } = require('../utils/inventory-ledger');

const router = express.Router();

// Get batch lineage (traceability)
router.get('/:batchId', authenticateToken, async (req, res) => {
  try {
    const batchId = parseInt(req.params.batchId);

    // Get all lineage records for this batch (as parent or child)
    const result = await query(`
      SELECT bl.*,
             parent.harvest_name as parent_batch_name,
             child.harvest_name as child_batch_name,
             u.email as performed_by_email
      FROM batch_lineage bl
      LEFT JOIN harvest_batches parent ON bl.parent_batch_id = parent.id
      LEFT JOIN harvest_batches child ON bl.child_batch_id = child.id
      LEFT JOIN users u ON bl.performed_by = u.id
      WHERE bl.parent_batch_id = $1 OR bl.child_batch_id = $1
      ORDER BY bl.operation_date DESC
    `, [batchId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get batch lineage error:', error);
    res.status(500).json({ error: 'Failed to fetch batch lineage' });
  }
});

// Split batch
router.post('/split', authenticateToken, requirePermission('inventory:update'), async (req, res) => {
  try {
    const {
      parentBatchId,
      childBatches, // Array of {harvestBatchId, quantity}
      notes
    } = req.body;

    if (!parentBatchId || !childBatches || !Array.isArray(childBatches) || childBatches.length === 0) {
      return res.status(400).json({ error: 'Parent batch ID and child batches are required' });
    }

    // Verify parent batch exists
    const parentCheck = await query(`
      SELECT id, organization_id FROM harvest_batches WHERE id = $1
    `, [parentBatchId]);

    if (parentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Parent batch not found' });
    }

    // Check access
    if (req.user.role !== 'super_admin' && req.user.organizationId !== parentCheck.rows[0].organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Calculate total split quantity
    const totalSplit = childBatches.reduce((sum, child) => sum + parseFloat(child.quantity || 0), 0);

    // Get parent batch inventory
    const parentInventory = await query(`
      SELECT id, quantity, room_id FROM inventory
      WHERE harvest_batch_id = $1 AND status = 'available'
      ORDER BY quantity DESC
    `, [parentBatchId]);

    if (parentInventory.rows.length === 0) {
      return res.status(404).json({ error: 'No available inventory found for parent batch' });
    }

    // Check if enough inventory
    const totalAvailable = parentInventory.rows.reduce((sum, inv) => sum + parseFloat(inv.quantity), 0);
    if (totalAvailable < totalSplit) {
      return res.status(400).json({ 
        error: `Insufficient inventory. Available: ${totalAvailable}, Requested: ${totalSplit}` 
      });
    }

    // Create lineage records and update inventory
    const lineageRecords = [];
    let remainingToSplit = totalSplit;
    let inventoryIndex = 0;

      for (const childBatch of childBatches) {
      const childQuantity = parseFloat(childBatch.quantity);
      let remainingChildQuantity = childQuantity;

      // Create lineage record
      const lineageResult = await query(`
        INSERT INTO batch_lineage (
          parent_batch_id, child_batch_id, lineage_type, quantity, unit, performed_by, notes
        )
        VALUES ($1, $2, 'SPLIT', $3, 'g', $4, $5)
        RETURNING id, operation_date
      `, [parentBatchId, childBatch.harvestBatchId, childQuantity, req.user.id, notes]);

      lineageRecords.push(lineageResult.rows[0]);

      // Split inventory from parent to child
      while (remainingChildQuantity > 0 && inventoryIndex < parentInventory.rows.length) {
        const parentInv = parentInventory.rows[inventoryIndex];
        const currentQuantity = await getCurrentQuantity(parentInv.id);
        const splitAmount = Math.min(remainingChildQuantity, currentQuantity);

        if (splitAmount > 0) {
          // Deduct from parent
          await createLedgerEntry({
            inventoryId: parentInv.id,
            harvestBatchId: parentBatchId,
            roomId: parentInv.room_id,
            transactionType: 'SPLIT',
            quantityChange: -splitAmount,
            quantityBefore: currentQuantity,
            unit: 'g',
            referenceId: lineageResult.rows[0].id,
            referenceType: 'batch_lineage',
            performedBy: req.user.id,
            notes: `Split to batch ${childBatch.harvestBatchId}`
          });

          // Add to child (create inventory if needed)
          const childInvCheck = await query(`
            SELECT id, quantity FROM inventory
            WHERE harvest_batch_id = $1 AND room_id = $2
            LIMIT 1
          `, [childBatch.harvestBatchId, parentInv.room_id]);

          if (childInvCheck.rows.length > 0) {
            // Update existing child inventory
            const childCurrentQty = await getCurrentQuantity(childInvCheck.rows[0].id);
            await createLedgerEntry({
              inventoryId: childInvCheck.rows[0].id,
              harvestBatchId: childBatch.harvestBatchId,
              roomId: parentInv.room_id,
              transactionType: 'SPLIT',
              quantityChange: splitAmount,
              quantityBefore: childCurrentQty,
              unit: 'g',
              referenceId: lineageResult.rows[0].id,
              referenceType: 'batch_lineage',
              performedBy: req.user.id,
              notes: `Split from batch ${parentBatchId}`
            });
          } else {
            // Create new child inventory
            // This would require more fields - simplified for now
            // In production, you'd copy parent inventory fields
          }

          remainingChildQuantity -= splitAmount;
        }

        if (currentQuantity - splitAmount <= 0) {
          inventoryIndex++;
        }
      }
    }

    res.json({
      message: 'Batch split successfully',
      lineageRecords,
      totalSplit
    });
  } catch (error) {
    console.error('Split batch error:', error);
    res.status(500).json({ error: 'Failed to split batch' });
  }
});

// Get inventory ledger for an item
router.get('/inventory/:inventoryId/ledger', authenticateToken, async (req, res) => {
  try {
    const inventoryId = parseInt(req.params.inventoryId);

    // Verify access
    const invCheck = await query(`
      SELECT i.id, hb.organization_id
      FROM inventory i
      INNER JOIN harvest_batches hb ON i.harvest_batch_id = hb.id
      WHERE i.id = $1
    `, [inventoryId]);

    if (invCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }

    if (req.user.role !== 'super_admin' && req.user.organizationId !== invCheck.rows[0].organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const ledgerEntries = await getLedgerEntries(inventoryId);
    res.json(ledgerEntries);
  } catch (error) {
    console.error('Get inventory ledger error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory ledger' });
  }
});

module.exports = router;
