const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    // Get total plants count
    const plantsResult = await query(
      'SELECT COUNT(*) as count FROM plants WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );

    // Get active batches count
    const batchesResult = await query(
      'SELECT COUNT(*) as count FROM batches WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );

    // Get active rooms count
    const roomsResult = await query(
      'SELECT COUNT(*) as count FROM rooms WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );

    // Get inventory lots count
    const inventoryResult = await query(
      'SELECT COUNT(*) as count FROM inventory WHERE user_id = $1 AND status = $2',
      [req.user.id, 'available']
    );

    // Get pending tasks count
    const pendingTasksResult = await query(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1 AND status = $2',
      [req.user.id, 'pending']
    );

    // Get completed tasks today count
    const today = new Date().toISOString().split('T')[0];
    const completedTodayResult = await query(
      'SELECT COUNT(*) as count FROM tasks WHERE user_id = $1 AND status = $2 AND DATE(completed_at) = $3',
      [req.user.id, 'completed', today]
    );

    // Calculate capacity percentage (rooms)
    const capacityResult = await query(`
      SELECT 
        SUM(current_plants) as current,
        SUM(capacity) as total
      FROM rooms 
      WHERE user_id = $1 AND is_active = true
    `, [req.user.id]);

    const capacityPercent = capacityResult.rows[0].total > 0 
      ? Math.round((capacityResult.rows[0].current / capacityResult.rows[0].total) * 100)
      : 0;

    res.json({
      totalPlants: parseInt(plantsResult.rows[0].count) || 0,
      activeBatches: parseInt(batchesResult.rows[0].count) || 0,
      activeRooms: parseInt(roomsResult.rows[0].count) || 0,
      inventoryLots: parseInt(inventoryResult.rows[0].count) || 0,
      pendingTasks: parseInt(pendingTasksResult.rows[0].count) || 0,
      completedToday: parseInt(completedTodayResult.rows[0].count) || 0,
      capacityPercent: capacityPercent,
      complianceScore: 98 // This would be calculated based on your compliance requirements
    });

  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// Get recent activities
router.get('/activities', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // This would combine various activity types
    // For now, returning recent task completions
    const result = await query(`
      SELECT 
        'task' as activity_type,
        id,
        title as description,
        completed_at as timestamp
      FROM tasks
      WHERE user_id = $1 AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT $2
    `, [req.user.id, limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Get alerts and notifications
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    const alerts = [];

    // Check for overdue tasks
    const overdueTasksResult = await query(`
      SELECT COUNT(*) as count
      FROM tasks
      WHERE user_id = $1 AND status = 'pending' AND due_date < CURRENT_DATE
    `, [req.user.id]);

    if (parseInt(overdueTasksResult.rows[0].count) > 0) {
      alerts.push({
        type: 'warning',
        title: 'Overdue Tasks',
        message: `You have ${overdueTasksResult.rows[0].count} overdue tasks`,
        priority: 'high'
      });
    }

    // Check for upcoming harvests (within 7 days)
    const upcomingHarvestsResult = await query(`
      SELECT COUNT(*) as count
      FROM batches
      WHERE user_id = $1 
        AND is_active = true 
        AND expected_harvest_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    `, [req.user.id]);

    if (parseInt(upcomingHarvestsResult.rows[0].count) > 0) {
      alerts.push({
        type: 'info',
        title: 'Upcoming Harvests',
        message: `${upcomingHarvestsResult.rows[0].count} batches ready for harvest within 7 days`,
        priority: 'medium'
      });
    }

    // Check for active IPM issues
    const activeIPMResult = await query(`
      SELECT COUNT(*) as count
      FROM ipm_logs
      WHERE user_id = $1 AND follow_up_required = true AND treatment_result IS NULL
    `, [req.user.id]);

    if (parseInt(activeIPMResult.rows[0].count) > 0) {
      alerts.push({
        type: 'warning',
        title: 'IPM Follow-ups',
        message: `${activeIPMResult.rows[0].count} pest/disease issues require attention`,
        priority: 'high'
      });
    }

    res.json(alerts);
  } catch (error) {
    console.error('Get alerts error:', error);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

module.exports = router;
