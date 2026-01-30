const { query } = require('../config/database');

/**
 * Audit logging middleware
 * Logs all actions for compliance and audit trail
 */
function auditLog(actionType, resourceType, options = {}) {
  return async (req, res, next) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override res.json to capture response
    res.json = function(data) {
      // Log the action
      logAuditEntry({
        userId: req.user?.id,
        organizationId: req.user?.organizationId,
        facilityId: options.facilityId || req.body?.facilityId || req.query?.facilityId,
        actionType,
        resourceType,
        resourceId: options.resourceId || req.params?.id || req.body?.id,
        action: options.action || req.method.toLowerCase(),
        description: options.description || `${actionType} - ${req.method} ${req.path}`,
        oldValues: options.oldValues,
        newValues: options.newValues || (req.method !== 'GET' ? req.body : null),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        success: res.statusCode < 400,
        errorMessage: res.statusCode >= 400 ? (data?.error || data?.message) : null,
        metadata: {
          path: req.path,
          method: req.method,
          statusCode: res.statusCode,
          ...options.metadata
        }
      }).catch(err => {
        console.error('Audit logging error:', err);
        // Don't fail the request if audit logging fails
      });

      // Call original json method
      return originalJson(data);
    };

    next();
  };
}

/**
 * Log audit entry to database
 */
async function logAuditEntry({
  userId,
  organizationId,
  facilityId,
  actionType,
  resourceType,
  resourceId,
  action,
  description,
  oldValues = null,
  newValues = null,
  ipAddress = null,
  userAgent = null,
  success = true,
  errorMessage = null,
  metadata = null
}) {
  try {
    await query(`
      INSERT INTO audit_logs (
        user_id, organization_id, facility_id, action_type, resource_type,
        resource_id, action, description, old_values, new_values,
        ip_address, user_agent, success, error_message, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      userId,
      organizationId,
      facilityId ? parseInt(facilityId) : null,
      actionType,
      resourceType,
      resourceId ? parseInt(resourceId) : null,
      action,
      description,
      oldValues ? JSON.stringify(oldValues) : null,
      newValues ? JSON.stringify(newValues) : null,
      ipAddress,
      userAgent,
      success,
      errorMessage,
      metadata ? JSON.stringify(metadata) : null
    ]);
  } catch (error) {
    console.error('Error logging audit entry:', error);
    // Don't throw - audit logging should not break the application
  }
}

/**
 * Get audit logs
 */
async function getAuditLogs(filters = {}) {
  try {
    const {
      userId,
      organizationId,
      facilityId,
      actionType,
      resourceType,
      resourceId,
      startDate,
      endDate,
      limit = 100
    } = filters;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    if (userId) {
      whereClause += ` AND user_id = $${paramCount++}`;
      queryParams.push(userId);
    }
    if (organizationId) {
      whereClause += ` AND organization_id = $${paramCount++}`;
      queryParams.push(organizationId);
    }
    if (facilityId) {
      whereClause += ` AND facility_id = $${paramCount++}`;
      queryParams.push(facilityId);
    }
    if (actionType) {
      whereClause += ` AND action_type = $${paramCount++}`;
      queryParams.push(actionType);
    }
    if (resourceType) {
      whereClause += ` AND resource_type = $${paramCount++}`;
      queryParams.push(resourceType);
    }
    if (resourceId) {
      whereClause += ` AND resource_id = $${paramCount++}`;
      queryParams.push(resourceId);
    }
    if (startDate) {
      whereClause += ` AND created_at >= $${paramCount++}`;
      queryParams.push(startDate);
    }
    if (endDate) {
      whereClause += ` AND created_at <= $${paramCount++}`;
      queryParams.push(endDate);
    }

    const result = await query(`
      SELECT al.*,
             u.email as user_email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramCount}
    `, [...queryParams, limit]);

    return result.rows;
  } catch (error) {
    console.error('Error getting audit logs:', error);
    throw error;
  }
}

module.exports = {
  auditLog,
  logAuditEntry,
  getAuditLogs
};
