const { query } = require('../config/database');

/**
 * Create inventory ledger entry
 * This function records all inventory movements for audit trail
 */
async function createLedgerEntry({
  inventoryId,
  harvestBatchId,
  roomId,
  transactionType,
  quantityChange,
  quantityBefore,
  unit = 'g',
  referenceId = null,
  referenceType = null,
  performedBy,
  notes = null
}) {
  try {
    const quantityAfter = quantityBefore + quantityChange;

    // Check for negative inventory (should be caught by trigger, but double-check)
    if (quantityAfter < 0) {
      throw new Error(`Negative inventory not allowed. Current: ${quantityBefore}, Change: ${quantityChange}`);
    }

    const result = await query(`
      INSERT INTO inventory_ledger (
        inventory_id, harvest_batch_id, room_id, transaction_type,
        quantity_change, quantity_before, quantity_after, unit,
        reference_id, reference_type, performed_by, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, quantity_after, created_at
    `, [
      inventoryId,
      harvestBatchId,
      roomId,
      transactionType,
      quantityChange,
      quantityBefore,
      quantityAfter,
      unit,
      referenceId,
      referenceType,
      performedBy,
      notes
    ]);

    // Update inventory quantity
    await query(`
      UPDATE inventory
      SET quantity = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [quantityAfter, inventoryId]);

    return result.rows[0];
  } catch (error) {
    console.error('Error creating ledger entry:', error);
    throw error;
  }
}

/**
 * Get inventory ledger entries
 */
async function getLedgerEntries(inventoryId, limit = 100) {
  try {
    const result = await query(`
      SELECT il.*,
             u.email as performed_by_email
      FROM inventory_ledger il
      LEFT JOIN users u ON il.performed_by = u.id
      WHERE il.inventory_id = $1
      ORDER BY il.created_at DESC
      LIMIT $2
    `, [inventoryId, limit]);

    return result.rows;
  } catch (error) {
    console.error('Error getting ledger entries:', error);
    throw error;
  }
}

/**
 * Get current inventory quantity from ledger
 */
async function getCurrentQuantity(inventoryId) {
  try {
    const result = await query(`
      SELECT quantity_after
      FROM inventory_ledger
      WHERE inventory_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [inventoryId]);

    if (result.rows.length === 0) {
      // Check inventory table directly
      const invResult = await query(`
        SELECT quantity FROM inventory WHERE id = $1
      `, [inventoryId]);
      return invResult.rows.length > 0 ? parseFloat(invResult.rows[0].quantity) : 0;
    }

    return parseFloat(result.rows[0].quantity_after);
  } catch (error) {
    console.error('Error getting current quantity:', error);
    throw error;
  }
}

module.exports = {
  createLedgerEntry,
  getLedgerEntries,
  getCurrentQuantity
};
