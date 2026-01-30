/**
 * Script to check for overdue tasks and create notifications
 * This can be run as a cron job or scheduled task
 */
require('dotenv').config();
const { query } = require('../config/database');
const { createNotification } = require('../utils/notifications');

async function checkOverdueTasks() {
  try {
    // Find all overdue tasks that haven't been notified
    const result = await query(`
      SELECT DISTINCT t.id, t.user_id, t.title, t.due_date, t.assigned_to
      FROM tasks t
      WHERE t.due_date < CURRENT_DATE
        AND t.status NOT IN ('completed', 'cancelled')
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.entity_type = 'task'
            AND n.entity_id = t.id
            AND n.type = 'warning'
            AND n.title LIKE '%Overdue%'
            AND n.created_at > CURRENT_DATE - INTERVAL '1 day'
        )
    `);

    console.log(`Found ${result.rows.length} overdue tasks to notify`);

    for (const task of result.rows) {
      // Notify task owner
      try {
        await createNotification({
          userId: task.user_id,
          type: 'warning',
          title: 'Overdue Task',
          message: `Task "${task.title}" is overdue`,
          entityType: 'task',
          entityId: task.id,
          metadata: { dueDate: task.due_date }
        });
      } catch (error) {
        console.error(`Error creating notification for task ${task.id}:`, error);
      }

      // Notify assigned user if different
      if (task.assigned_to && task.assigned_to !== task.user_id) {
        try {
          await createNotification({
            userId: task.assigned_to,
            type: 'warning',
            title: 'Overdue Task',
            message: `Task "${task.title}" is overdue`,
            entityType: 'task',
            entityId: task.id,
            metadata: { dueDate: task.due_date }
          });
        } catch (error) {
          console.error(`Error creating notification for assigned user ${task.assigned_to}:`, error);
        }
      }
    }

    console.log('Overdue task notifications created successfully');
  } catch (error) {
    console.error('Error checking overdue tasks:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  checkOverdueTasks()
    .then(() => {
      console.log('Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Failed:', error);
      process.exit(1);
    });
}

module.exports = { checkOverdueTasks };
