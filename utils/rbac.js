/**
 * RBAC (Role-Based Access Control) Configuration
 * Defines roles, permissions, and permission checking utilities
 */

// Role definitions
const ROLES = {
  SUPER_ADMIN: 'Super Admin',
  ORG_ADMIN: 'Org Admin',
  CULTIVATION_MANAGER: 'Cultivation Manager',
  TECHNICIAN_GROWER: 'Technician / Grower',
  INVENTORY_CLERK: 'Inventory Clerk',
  QA_LAB_MANAGER: 'QA / Lab Manager',
  PROCESSOR_MFG: 'Processor / Mfg Operator',
  SHIPPER_LOGISTICS: 'Shipper / Logistics',
  AUDITOR_COMPLIANCE: 'Auditor / Compliance',
  READ_ONLY_VIEWER: 'Read-only Viewer',
};

// Permission definitions organized by module
const PERMISSIONS = {
  // Platform/Organization
  PLATFORM_MANAGE: 'platform:manage',
  PLATFORM_BILLING: 'platform:billing',
  PLATFORM_INTEGRATIONS: 'platform:integrations',
  ORG_VIEW: 'org:view',
  ORG_UPDATE: 'org:update',
  ORG_MANAGE_USERS: 'org:manage_users',
  ORG_MANAGE_ROLES: 'org:manage_roles',
  ORG_MANAGE_LOCATIONS: 'org:manage_locations',
  ORG_MANAGE_STRAINS: 'org:manage_strains',
  ORG_MANAGE_LICENSES: 'org:manage_licenses',

  // Cultivation
  CULTIVATION_VIEW: 'cultivation:view',
  CULTIVATION_CREATE: 'cultivation:create',
  CULTIVATION_UPDATE: 'cultivation:update',
  CULTIVATION_DELETE: 'cultivation:delete',
  CULTIVATION_MOVE: 'cultivation:move',
  CULTIVATION_STAGE_CHANGE: 'cultivation:stage_change',
  CULTIVATION_HARVEST_SCHEDULE: 'cultivation:harvest_schedule',
  CULTIVATION_HARVEST_APPROVE: 'cultivation:harvest_approve',
  CULTIVATION_WORK_ORDERS: 'cultivation:work_orders',
  CULTIVATION_RECORD_WEIGHTS: 'cultivation:record_weights',

  // Inventory
  INVENTORY_VIEW: 'inventory:view',
  INVENTORY_CREATE: 'inventory:create',
  INVENTORY_UPDATE: 'inventory:update',
  INVENTORY_DELETE: 'inventory:delete',
  INVENTORY_TRANSFER: 'inventory:transfer',
  INVENTORY_ADJUST: 'inventory:adjust',
  INVENTORY_CYCLE_COUNT: 'inventory:cycle_count',
  INVENTORY_PACKAGE: 'inventory:package',

  // Manufacturing
  MANUFACTURING_VIEW: 'manufacturing:view',
  MANUFACTURING_CREATE: 'manufacturing:create',
  MANUFACTURING_UPDATE: 'manufacturing:update',
  MANUFACTURING_DELETE: 'manufacturing:delete',
  MANUFACTURING_RUN: 'manufacturing:run',

  // QA/Lab
  LAB_VIEW: 'lab:view',
  LAB_CREATE: 'lab:create',
  LAB_UPDATE: 'lab:update',
  LAB_APPROVE: 'lab:approve',
  LAB_ANNOTATE: 'lab:annotate',

  // Shipping/Logistics
  SHIPPING_VIEW: 'shipping:view',
  SHIPPING_CREATE: 'shipping:create',
  SHIPPING_UPDATE: 'shipping:update',
  SHIPPING_BOOK: 'shipping:book',

  // Compliance/Audit
  COMPLIANCE_VIEW: 'compliance:view',
  COMPLIANCE_EXPORT: 'compliance:export',
  AUDIT_VIEW: 'audit:view',
  AUDIT_EXPORT: 'audit:export',

  // Analytics/Reports
  ANALYTICS_VIEW: 'analytics:view',
  ANALYTICS_EXPORT: 'analytics:export',

  // Documents
  DOCUMENTS_VIEW: 'documents:view',
  DOCUMENTS_UPLOAD: 'documents:upload',
  DOCUMENTS_APPROVE: 'documents:approve',
  DOCUMENTS_DELETE: 'documents:delete',
};

// Permission groups for easier checking
const PERMISSION_GROUPS = {
  CULTIVATION: [
    PERMISSIONS.CULTIVATION_VIEW,
    PERMISSIONS.CULTIVATION_CREATE,
    PERMISSIONS.CULTIVATION_UPDATE,
    PERMISSIONS.CULTIVATION_DELETE,
    PERMISSIONS.CULTIVATION_MOVE,
    PERMISSIONS.CULTIVATION_STAGE_CHANGE,
    PERMISSIONS.CULTIVATION_HARVEST_SCHEDULE,
    PERMISSIONS.CULTIVATION_HARVEST_APPROVE,
    PERMISSIONS.CULTIVATION_WORK_ORDERS,
    PERMISSIONS.CULTIVATION_RECORD_WEIGHTS,
  ],
  INVENTORY: [
    PERMISSIONS.INVENTORY_VIEW,
    PERMISSIONS.INVENTORY_CREATE,
    PERMISSIONS.INVENTORY_UPDATE,
    PERMISSIONS.INVENTORY_DELETE,
    PERMISSIONS.INVENTORY_TRANSFER,
    PERMISSIONS.INVENTORY_ADJUST,
    PERMISSIONS.INVENTORY_CYCLE_COUNT,
    PERMISSIONS.INVENTORY_PACKAGE,
  ],
  MANUFACTURING: [
    PERMISSIONS.MANUFACTURING_VIEW,
    PERMISSIONS.MANUFACTURING_CREATE,
    PERMISSIONS.MANUFACTURING_UPDATE,
    PERMISSIONS.MANUFACTURING_DELETE,
    PERMISSIONS.MANUFACTURING_RUN,
  ],
  LAB: [
    PERMISSIONS.LAB_VIEW,
    PERMISSIONS.LAB_CREATE,
    PERMISSIONS.LAB_UPDATE,
    PERMISSIONS.LAB_APPROVE,
    PERMISSIONS.LAB_ANNOTATE,
  ],
  SHIPPING: [
    PERMISSIONS.SHIPPING_VIEW,
    PERMISSIONS.SHIPPING_CREATE,
    PERMISSIONS.SHIPPING_UPDATE,
    PERMISSIONS.SHIPPING_BOOK,
  ],
};

/**
 * Check if user has a specific permission
 * @param {Object} user - User object with roles and permissions
 * @param {string} permission - Permission name to check
 * @returns {boolean}
 */
const hasPermission = (user, permission) => {
  if (!user) return false;

  // Super Admin has all permissions
  if (user.roles?.some(r => r.name === ROLES.SUPER_ADMIN)) {
    return true;
  }

  // Check if user has the permission through their roles
  if (user.permissions && Array.isArray(user.permissions)) {
    return user.permissions.some(p => p.name === permission || p === permission);
  }

  return false;
};

/**
 * Check if user has any of the specified permissions
 * @param {Object} user - User object with roles and permissions
 * @param {string[]} permissions - Array of permission names to check
 * @returns {boolean}
 */
const hasAnyPermission = (user, permissions) => {
  if (!user || !permissions || permissions.length === 0) return false;
  return permissions.some(permission => hasPermission(user, permission));
};

/**
 * Check if user has all of the specified permissions
 * @param {Object} user - User object with roles and permissions
 * @param {string[]} permissions - Array of permission names to check
 * @returns {boolean}
 */
const hasAllPermissions = (user, permissions) => {
  if (!user || !permissions || permissions.length === 0) return false;
  return permissions.every(permission => hasPermission(user, permission));
};

/**
 * Check if user has a specific role
 * @param {Object} user - User object with roles
 * @param {string} roleName - Role name to check
 * @returns {boolean}
 */
const hasRole = (user, roleName) => {
  if (!user) return false;
  
  if (user.roles && Array.isArray(user.roles)) {
    return user.roles.some(r => r.name === roleName || r === roleName);
  }

  // Fallback for old role format
  if (user.role === roleName) {
    return true;
  }

  return false;
};

/**
 * Check if user has any of the specified roles
 * @param {Object} user - User object with roles
 * @param {string[]} roleNames - Array of role names to check
 * @returns {boolean}
 */
const hasAnyRole = (user, roleNames) => {
  if (!user || !roleNames || roleNames.length === 0) return false;
  return roleNames.some(roleName => hasRole(user, roleName));
};

/**
 * Get all permissions for a user (flattened from roles)
 * @param {Object} user - User object with roles
 * @returns {string[]} Array of permission names
 */
const getUserPermissions = (user) => {
  if (!user) return [];

  // Super Admin has all permissions
  if (hasRole(user, ROLES.SUPER_ADMIN)) {
    return Object.values(PERMISSIONS);
  }

  // Collect permissions from user's roles
  const permissions = new Set();
  
  if (user.permissions && Array.isArray(user.permissions)) {
    user.permissions.forEach(p => {
      permissions.add(typeof p === 'string' ? p : p.name);
    });
  }

  return Array.from(permissions);
};

/**
 * Check if user can perform action on resource (ABAC - Attribute-Based Access Control)
 * This allows location-scoped or other attribute-based access control
 * @param {Object} user - User object
 * @param {string} permission - Permission to check
 * @param {Object} resource - Resource object with attributes (e.g., { facilityId, organizationId })
 * @returns {boolean}
 */
const canAccessResource = (user, permission, resource = {}) => {
  // First check basic permission
  if (!hasPermission(user, permission)) {
    return false;
  }

  // Super Admin can access everything
  if (hasRole(user, ROLES.SUPER_ADMIN)) {
    return true;
  }

  // Check organization scope
  if (resource.organizationId && user.organizationId) {
    if (resource.organizationId !== user.organizationId) {
      return false;
    }
  }

  // Check facility scope (if user has facility restrictions)
  if (resource.facilityId && user.facilityIds && Array.isArray(user.facilityIds)) {
    if (!user.facilityIds.includes(resource.facilityId)) {
      return false;
    }
  }

  return true;
};

module.exports = {
  ROLES,
  PERMISSIONS,
  PERMISSION_GROUPS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  hasAnyRole,
  getUserPermissions,
  canAccessResource,
};
