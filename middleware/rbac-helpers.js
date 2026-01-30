const { query } = require('../config/database');

/**
 * Get all roles for a user (with organization scope)
 */
async function getUserRoles(userId, organizationId = null) {
  try {
    let whereClause = 'WHERE ur.user_id = $1 AND ur.is_active = true';
    let queryParams = [userId];
    let paramCount = 2;

    // Check for expired roles
    whereClause += ` AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)`;

    if (organizationId) {
      whereClause += ` AND (ur.organization_id = $${paramCount} OR ur.organization_id IS NULL)`;
      queryParams.push(organizationId);
      paramCount++;
    }

    const result = await query(`
      SELECT r.id, r.name, r.description,
             ur.organization_id
      FROM user_roles ur
      INNER JOIN roles r ON ur.role_id = r.id
      ${whereClause}
      ORDER BY r.name
    `, queryParams);

    return result.rows;
  } catch (error) {
    console.error('Error getting user roles:', error);
    return [];
  }
}

/**
 * Get all permissions for a user (aggregated from all their roles)
 */
async function getUserPermissions(userId, organizationId = null) {
  try {
    const roles = await getUserRoles(userId, organizationId);

    const roleIds = roles.map(r => r.id);

    const result = await query(`
      SELECT DISTINCT p.id, p.name, p.description
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = ANY($1)
      LEFT JOIN user_permissions up ON p.id = up.permission_id AND up.user_id = $2
      WHERE (rp.role_id IS NOT NULL OR up.user_id IS NOT NULL)
        AND p.is_active = true
      ORDER BY p.name
    `, [roleIds, userId]);

    return result.rows;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Check if user has a specific permission
 */
async function hasPermission(userId, permissionName, organizationId = null) {
  try {
    const permissions = await getUserPermissions(userId, organizationId);
    return permissions.some(p => p.name === permissionName);
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check if user has a specific role
 */
async function hasRole(userId, roleName, organizationId = null) {
  try {
    const roles = await getUserRoles(userId, organizationId);
    return roles.some(r => r.name === roleName);
  } catch (error) {
    console.error('Error checking role:', error);
    return false;
  }
}

/**
 * Check if user has any of the specified roles
 */
async function hasAnyRole(userId, roleNames, organizationId = null) {
  try {
    const roles = await getUserRoles(userId, organizationId);
    const userRoleNames = roles.map(r => r.name);
    return roleNames.some(roleName => userRoleNames.includes(roleName));
  } catch (error) {
    console.error('Error checking roles:', error);
    return false;
  }
}

/**
 * Get user's primary role (first active role, or fallback to old role column)
 */
async function getPrimaryRole(userId) {
  try {
    const roles = await getUserRoles(userId);
    if (roles.length > 0) {
      return roles[0].name;
    }

    // Fallback to old role column for backward compatibility
    const result = await query(`
      SELECT role FROM users WHERE id = $1
    `, [userId]);

    if (result.rows.length > 0 && result.rows[0].role) {
      return result.rows[0].role;
    }

    return null;
  } catch (error) {
    console.error('Error getting primary role:', error);
    return null;
  }
}

module.exports = {
  getUserRoles,
  getUserPermissions,
  hasPermission,
  hasRole,
  hasAnyRole,
  getPrimaryRole,
};
