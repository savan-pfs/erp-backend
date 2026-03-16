const { hasPermission, hasRole, hasAnyRole } = require('./rbac-helpers');

const normalizeRole = (role) => (role || '').toLowerCase().replace(/[\s\/]+/g, '_');

function isSuperAdmin(req) {
  if (!req.user) return false;
  if (normalizeRole(req.user.role) === 'super_admin') return true;
  return (req.user.roleNames || []).some((r) => normalizeRole(r) === 'super_admin');
}

/**
 * Middleware to check if user has a specific permission
 * Usage: requirePermission('cultivation:create_plant')
 */
function requirePermission(permissionName) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Super Admin bypasses all permission checks (handles Title Case "Super Admin")
      if (isSuperAdmin(req)) {
        return next();
      }

      const organizationId = req.user.organizationId || req.body.organizationId || req.query.organizationId;

      const hasAccess = await hasPermission(
        req.user.id,
        permissionName,
        organizationId
      );

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permissionName
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

/**
 * Middleware to check if user has a specific role
 * Usage: requireRole('cultivation_manager')
 */
function requireRole(roleName) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Super Admin bypasses all role checks
      if (isSuperAdmin(req)) {
        return next();
      }

      const organizationId = req.user.organizationId || req.body.organizationId || req.query.organizationId;

      const hasAccess = await hasRole(
        req.user.id,
        roleName,
        organizationId
      );

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Insufficient role',
          required: roleName
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Role check failed' });
    }
  };
}

/**
 * Middleware to check if user has any of the specified roles
 * Usage: requireAnyRole(['cultivation_manager', 'org_admin'])
 */
function requireAnyRole(roleNames) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Super Admin bypasses all role checks
      if (isSuperAdmin(req)) {
        return next();
      }

      const organizationId = req.user.organizationId || req.body.organizationId || req.query.organizationId;

      const hasAccess = await hasAnyRole(
        req.user.id,
        roleNames,
        organizationId
      );

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Insufficient role',
          required: roleNames
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Role check failed' });
    }
  };
}

/**
 * Middleware to check if user has any of the specified permissions
 * Usage: requireAnyPermission(['cultivation:create_plant', 'cultivation:update_plant'])
 */
function requireAnyPermission(permissionNames) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Super Admin bypasses all permission checks
      if (isSuperAdmin(req)) {
        return next();
      }

      const organizationId = req.user.organizationId || req.body.organizationId || req.query.organizationId;

      // Check if user has any of the required permissions
      let hasAccess = false;
      for (const permissionName of permissionNames) {
        const has = await hasPermission(
          req.user.id,
          permissionName,
          organizationId
        );
        if (has) {
          hasAccess = true;
          break;
        }
      }

      if (!hasAccess) {
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          required: permissionNames
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Permission check failed' });
    }
  };
}

module.exports = {
  requirePermission,
  requireRole,
  requireAnyRole,
  requireAnyPermission
};
