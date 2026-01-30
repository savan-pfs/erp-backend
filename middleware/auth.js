const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { getUserRoles, getUserPermissions, getPrimaryRole } = require('./rbac-helpers');

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Verify user still exists and is active
    const result = await query(`
      SELECT id, email, role, organization_id, is_active, approval_status
      FROM users 
      WHERE id = $1 AND is_active = true
    `, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    const user = result.rows[0];

    // Load user roles and permissions from RBAC system
    const roles = await getUserRoles(user.id, user.organization_id);
    const permissions = await getUserPermissions(user.id, user.organization_id);
    const primaryRole = await getPrimaryRole(user.id) || user.role;

    // Get organization approval status if user has organization
    let organizationApprovalStatus = null;
    if (user.organization_id) {
      const orgResult = await query(`
        SELECT approval_status, is_active
        FROM organizations
        WHERE id = $1
      `, [user.organization_id]);

      if (orgResult.rows.length > 0) {
        organizationApprovalStatus = orgResult.rows[0].approval_status;
      }
    }

    // Attach user info to request
    let effectiveOrganizationId = user.organization_id;

    // Allow Super Admin to switch organization context via header
    const requestedOrgId = req.headers['x-organization-id'];
    const isSuperAdmin = user.role === 'super_admin' || user.role === 'Super Admin' || (roles && roles.some(r => r.name === 'Super Admin'));

    if (isSuperAdmin && requestedOrgId) {
      // Allow switching context
      // Verify the organization exists (optional but good practice)
      const orgCheck = await query('SELECT id, approval_status FROM organizations WHERE id = $1', [requestedOrgId]);
      if (orgCheck.rows.length > 0) {
        effectiveOrganizationId = parseInt(requestedOrgId);
        // Update approval status to match the selected organization
        organizationApprovalStatus = orgCheck.rows[0].approval_status;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: primaryRole, // Primary role for backward compatibility
      organizationId: effectiveOrganizationId,
      originalOrganizationId: user.organization_id, // Keep track of home org
      isActive: user.is_active,
      approvalStatus: user.approval_status,
      organizationApprovalStatus: organizationApprovalStatus, // Organization approval status
      roles: roles, // All roles with scope
      roleNames: roles.map(r => r.name), // Array of role names for easy checking
      permissions: permissions // All permissions aggregated from roles
    };

    next();

  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const authorizeRole = (roles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    const userRoleNames = req.user.roleNames || [];

    // Helper function to normalize role names for comparison
    const normalizeRole = (role) => role?.toLowerCase().replace(/[\s\/]+/g, '_');

    // Super Admin always has access (check first for performance)
    const isSuperAdmin = normalizeRole(userRole) === 'super_admin' ||
                         userRoleNames.some(r => normalizeRole(r) === 'super_admin');
    
    if (isSuperAdmin) {
      return next();
    }

    // Normalize all role names for comparison
    const normalizedRequiredRoles = roles.map(normalizeRole);
    const normalizedUserRole = normalizeRole(userRole);
    const normalizedUserRoleNames = userRoleNames.map(normalizeRole);

    // Check if user has any of the required roles
    const hasAccess = 
      // Check primary role
      normalizedRequiredRoles.includes(normalizedUserRole) ||
      // Check role names array (exact match)
      roles.some(role => userRoleNames.includes(role)) ||
      // Check role names array (normalized)
      normalizedUserRoleNames.some(r => normalizedRequiredRoles.includes(r));

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        details: `Required roles: ${roles.join(', ')}, User role: ${userRole}`
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  authorizeRole
};
