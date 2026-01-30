const { query } = require('../config/database');

/**
 * Create a notification for a user
 * @param {Object} options
 * @param {number} options.userId - User ID to notify
 * @param {string} options.type - Notification type: 'info', 'success', 'warning', 'error', 'task', 'alert', 'system'
 * @param {string} options.title - Notification title
 * @param {string} [options.message] - Notification message
 * @param {string} [options.entityType] - Related entity type (e.g., 'task', 'batch', 'plant')
 * @param {number} [options.entityId] - Related entity ID
 * @param {Object} [options.metadata] - Additional metadata as JSON
 * @returns {Promise<Object>} Created notification
 */
async function createNotification({
  userId,
  type = 'info',
  title,
  message,
  entityType,
  entityId,
  metadata
}) {
  try {
    const result = await query(`
      INSERT INTO notifications (
        user_id, type, title, message, entity_type, entity_id, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      userId,
      type,
      title,
      message || null,
      entityType || null,
      entityId || null,
      metadata ? JSON.stringify(metadata) : null
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users
 * @param {Array<number>} userIds - Array of user IDs
 * @param {Object} notificationData - Notification data (same as createNotification)
 * @returns {Promise<Array>} Created notifications
 */
async function createNotificationsForUsers(userIds, notificationData) {
  const notifications = [];
  for (const userId of userIds) {
    try {
      const notification = await createNotification({
        ...notificationData,
        userId
      });
      notifications.push(notification);
    } catch (error) {
      console.error(`Error creating notification for user ${userId}:`, error);
    }
  }
  return notifications;
}

module.exports = {
  createNotification,
  createNotificationsForUsers
};
