const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const { createNotification } = require('../utils/notifications');

const router = express.Router();

// Get all tasks for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, priority, assignedTo, roomId, batchId } = req.query;

    let whereClause = 'WHERE t.user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    // Handle status filter - 'overdue' needs special handling
    if (status) {
      if (status === 'overdue') {
        whereClause += ` AND t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status NOT IN ('DONE', 'BLOCKED')`;
      } else {
        whereClause += ` AND t.status = $${paramCount++}`;
        queryParams.push(status);
      }
    }
    
    // Handle priority filter - map 'critical' to 'urgent'
    if (priority) {
      const dbPriority = priority === 'critical' ? 'urgent' : priority;
      whereClause += ` AND t.priority = $${paramCount++}`;
      queryParams.push(dbPriority);
    }
    if (assignedTo) {
      whereClause += ` AND t.assigned_to = $${paramCount++}`;
      queryParams.push(assignedTo);
    }
    if (roomId) {
      whereClause += ` AND t.room_id = $${paramCount++}`;
      queryParams.push(roomId);
    }
    if (batchId) {
      whereClause += ` AND t.batch_id = $${paramCount++}`;
      queryParams.push(batchId);
    }

    const result = await query(`
      SELECT t.*, 
             u.first_name || ' ' || u.last_name as assigned_name,
             r.name as room_name,
             b.batch_name,
             CASE 
               WHEN t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status NOT IN ('DONE', 'BLOCKED') 
               THEN 'overdue'
               ELSE t.status
             END as display_status,
             CASE 
               WHEN t.priority = 'urgent' THEN 'critical'
               ELSE t.priority
             END as display_priority
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN batches b ON t.batch_id = b.id
      ${whereClause}
      ORDER BY 
        CASE t.priority 
          WHEN 'urgent' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        t.due_date ASC NULLS LAST,
        t.created_at DESC
    `, queryParams);

    // Transform results to include both original and display values
    const transformedRows = result.rows.map(row => ({
      ...row,
      status: row.display_status || row.status,
      priority: row.display_priority || row.priority
    }));

    res.json(transformedRows);
  } catch (error) {
    console.error('Get tasks error:', error);
    if (error.code === '42702') {
      // Ambiguous column reference
      return res.status(500).json({ 
        error: 'Database query error', 
        details: 'Column reference is ambiguous' 
      });
    }
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get single task by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);

    const result = await query(`
      SELECT t.*, 
             u.first_name || ' ' || u.last_name as assigned_name,
             r.name as room_name,
             b.batch_name,
             CASE 
               WHEN t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE AND t.status NOT IN ('DONE', 'BLOCKED') 
               THEN 'overdue'
               ELSE t.status
             END as display_status,
             CASE 
               WHEN t.priority = 'urgent' THEN 'critical'
               ELSE t.priority
             END as display_priority
      FROM tasks t
      LEFT JOIN users u ON t.assigned_to = u.id
      LEFT JOIN rooms r ON t.room_id = r.id
      LEFT JOIN batches b ON t.batch_id = b.id
      WHERE t.id = $1 AND t.user_id = $2
    `, [taskId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const row = result.rows[0];
    res.json({
      ...row,
      status: row.display_status || row.status,
      priority: row.display_priority || row.priority
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Create new task
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title, description, taskType, priority, status, assignedTo,
      relatedEntityType, relatedEntityId, roomId, batchId, dueDate
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Map 'critical' priority to 'urgent' for database
    const dbPriority = priority === 'critical' ? 'urgent' : (priority || 'medium');

    const result = await query(`
      INSERT INTO tasks (
        user_id, title, description, task_type, priority, status,
        assigned_to, related_entity_type, related_entity_id,
        room_id, batch_id, due_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      req.user.id, title, description, taskType || 'general',
      dbPriority, status || 'TODO', assignedTo,
      relatedEntityType, relatedEntityId, roomId, batchId, dueDate
    ]);

    // Transform response to include display values
    const row = result.rows[0];
    
    // Create notification for task creation
    try {
      await createNotification({
        userId: req.user.id,
        type: 'task',
        title: 'New Task Created',
        message: `Task "${title}" has been created`,
        entityType: 'task',
        entityId: row.id,
        metadata: { priority, status: row.status }
      });
    } catch (notifError) {
      console.error('Error creating task notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      ...row,
      priority: row.priority === 'urgent' ? 'critical' : row.priority,
      status: row.due_date && new Date(row.due_date) < new Date() && row.status !== 'DONE' && row.status !== 'BLOCKED' 
        ? 'overdue' 
        : row.status
    });
  } catch (error) {
    console.error('Create task error:', error);
    if (error.code === '23502') {
      // NOT NULL constraint violation
      return res.status(400).json({ 
        error: 'Required field is missing', 
        details: error.message 
      });
    }
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const { status, priority, assignedTo, dueDate, title, description } = req.body;

    // Validate title if provided (cannot be empty)
    if (title !== undefined && !title) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }

    // Map 'critical' priority to 'urgent' for database
    const dbPriority = priority === 'critical' ? 'urgent' : priority;

    const result = await query(`
      UPDATE tasks SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        assigned_to = COALESCE($5, assigned_to),
        due_date = COALESCE($6, due_date),
        completed_at = CASE WHEN $3 = 'DONE' THEN CURRENT_TIMESTAMP ELSE completed_at END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND user_id = $8
      RETURNING *
    `, [title, description, status, dbPriority, assignedTo, dueDate, taskId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Transform response to include display values
    const row = result.rows[0];
    
    // Create notification for task status changes
    if (status === 'DONE') {
      try {
        await createNotification({
          userId: req.user.id,
          type: 'success',
          title: 'Task Completed',
          message: `Task "${row.title}" has been completed`,
          entityType: 'task',
          entityId: taskId,
        });
      } catch (notifError) {
        console.error('Error creating completion notification:', notifError);
      }
    }
    
    res.json({
      ...row,
      priority: row.priority === 'urgent' ? 'critical' : row.priority,
      status: row.due_date && new Date(row.due_date) < new Date() && row.status !== 'DONE' && row.status !== 'BLOCKED' 
        ? 'overdue' 
        : row.status
    });
  } catch (error) {
    console.error('Update task error:', error);
    if (error.code === '23502') {
      // NOT NULL constraint violation
      return res.status(400).json({ 
        error: 'Required field is missing', 
        details: error.message 
      });
    }
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);

    const result = await query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING id',
      [taskId, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
