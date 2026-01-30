const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { query } = require('../config/database');

const router = express.Router();

// Get yield analytics
router.get('/yield', authenticateToken, requirePermission('analytics:view'), async (req, res) => {
  try {
    const { organizationId, startDate, endDate, groupBy } = req.query;

    let whereClause = 'WHERE hb.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (startDate) {
      whereClause += ` AND hb.harvest_date >= $${paramCount++}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND hb.harvest_date <= $${paramCount++}`;
      queryParams.push(endDate);
    }

    let groupByClause = '';
    if (groupBy === 'room') {
      groupByClause = 'GROUP BY r.id, r.name';
    } else if (groupBy === 'batch') {
      groupByClause = 'GROUP BY hb.id, hb.harvest_name';
    } else {
      groupByClause = 'GROUP BY hb.harvest_date';
    }

    const result = await query(`
      SELECT 
        ${groupBy === 'room' ? 'r.id, r.name as group_name,' : ''}
        ${groupBy === 'batch' ? 'hb.id, hb.harvest_name as group_name,' : ''}
        ${!groupBy ? 'hb.harvest_date as group_name,' : ''}
        COUNT(DISTINCT hb.id) as batch_count,
        SUM(hb.plant_count) as total_plants,
        SUM(hb.wet_weight) as total_wet_weight,
        SUM(hb.dry_weight) as total_dry_weight,
        AVG(hb.dry_weight / NULLIF(hb.plant_count, 0)) as avg_yield_per_plant,
        AVG((hb.dry_weight / NULLIF(hb.wet_weight, 0)) * 100) as avg_dry_weight_percentage
      FROM harvest_batches hb
      LEFT JOIN rooms r ON hb.room_id = r.id
      ${whereClause}
      ${groupByClause}
      ORDER BY group_name DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get yield analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch yield analytics' });
  }
});

// Get loss & waste analytics
router.get('/waste', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    let whereClause = 'WHERE wl.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (startDate) {
      whereClause += ` AND wl.disposed_at >= $${paramCount++}`;
      queryParams.push(startDate);
    }

    if (endDate) {
      whereClause += ` AND wl.disposed_at <= $${paramCount++}`;
      queryParams.push(endDate);
    }

    const result = await query(`
      SELECT 
        wl.disposal_method,
        SUM(wl.quantity) as total_quantity,
        COUNT(*) as disposal_count,
        AVG(wl.quantity) as avg_quantity_per_disposal
      FROM waste_logs wl
      ${whereClause}
      GROUP BY wl.disposal_method
      ORDER BY total_quantity DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get waste analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch waste analytics' });
  }
});

// Get inventory aging
router.get('/inventory-aging', authenticateToken, requirePermission('analytics:view'), async (req, res) => {
  try {
    const { organizationId, facilityId } = req.query;

    let whereClause = 'WHERE i.status = \'available\' AND i.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    const result = await query(`
      SELECT 
        i.id,
        i.item_name,
        i.quantity,
        i.package_date,
        i.expiration_date,
        hb.harvest_date,
        CASE 
          WHEN i.expiration_date IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (i.expiration_date - CURRENT_DATE)) / 86400
          ELSE NULL
        END as days_until_expiration,
        CASE 
          WHEN i.package_date IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (CURRENT_DATE - i.package_date)) / 86400
          WHEN hb.harvest_date IS NOT NULL THEN
            EXTRACT(EPOCH FROM (CURRENT_DATE - hb.harvest_date)) / 86400
          ELSE NULL
        END as age_in_days
      FROM inventory i
      LEFT JOIN harvest_batches hb ON i.harvest_batch_id = hb.id
      ${whereClause}
      ORDER BY age_in_days DESC NULLS LAST
      LIMIT 100
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get inventory aging error:', error);
    res.status(500).json({ error: 'Failed to fetch inventory aging' });
  }
});

// Get compliance risk indicators
router.get('/compliance-risks', authenticateToken, requirePermission('analytics:view'), async (req, res) => {
  try {
    const { organizationId, facilityId } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    const orgId = organizationId || req.user.organizationId;
    if (orgId) {
      whereClause += ` AND cc.organization_id = $${paramCount++}`;
      queryParams.push(orgId);
    }

    if (facilityId) {
      whereClause += ` AND cc.facility_id = $${paramCount++}`;
      queryParams.push(facilityId);
    }

    const result = await query(`
      SELECT 
        cc.check_type,
        cc.status,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE cc.resolved = false) as unresolved_count
      FROM compliance_checks cc
      ${whereClause}
      GROUP BY cc.check_type, cc.status
      ORDER BY unresolved_count DESC, cc.check_type
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get compliance risks error:', error);
    res.status(500).json({ error: 'Failed to fetch compliance risks' });
  }
});

module.exports = router;
