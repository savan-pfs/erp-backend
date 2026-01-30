const { query } = require('../config/database');

/**
 * Middleware to check if user's organization is approved
 * Blocks access if organization is not approved (except for Super Admin)
 */
const requireOrganizationApproval = async (req, res, next) => {
  try {
    // Super Admin can always access
    if (req.user.role === 'super_admin' || req.user.roleNames?.includes('super_admin')) {
      return next();
    }

    // If user has no organization, deny access
    if (!req.user.organizationId) {
      return res.status(403).json({ 
        error: 'No organization assigned. Please contact support.' 
      });
    }

    // Check organization approval status
    const orgResult = await query(`
      SELECT approval_status, is_active
      FROM organizations
      WHERE id = $1
    `, [req.user.organizationId]);

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const organization = orgResult.rows[0];

    // Check if organization is active
    if (!organization.is_active) {
      return res.status(403).json({ 
        error: 'Your organization has been deactivated. Please contact support.' 
      });
    }

    // Check approval status
    if (organization.approval_status !== 'APPROVED') {
      return res.status(403).json({ 
        error: 'Your organization is pending approval. Please wait for Super Admin approval.',
        approvalStatus: organization.approval_status
      });
    }

    // Attach organization approval status to request
    req.organization = {
      id: req.user.organizationId,
      approvalStatus: organization.approval_status,
      isActive: organization.is_active
    };

    next();
  } catch (error) {
    console.error('Organization access check error:', error);
    return res.status(500).json({ error: 'Failed to verify organization access' });
  }
};

/**
 * Middleware to allow access only if organization is pending
 * Used for blurred dashboard access
 */
const allowPendingOrganization = async (req, res, next) => {
  try {
    // Super Admin can always access
    if (req.user.role === 'super_admin' || req.user.roleNames?.includes('super_admin')) {
      return next();
    }

    // If user has no organization, deny access
    if (!req.user.organizationId) {
      return res.status(403).json({ 
        error: 'No organization assigned. Please contact support.' 
      });
    }

    // Check organization approval status
    const orgResult = await query(`
      SELECT approval_status, is_active
      FROM organizations
      WHERE id = $1
    `, [req.user.organizationId]);

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const organization = orgResult.rows[0];

    // Allow access if pending or approved (for dashboard)
    if (organization.approval_status === 'PENDING_APPROVAL' || 
        organization.approval_status === 'APPROVED') {
      req.organization = {
        id: req.user.organizationId,
        approvalStatus: organization.approval_status,
        isActive: organization.is_active
      };
      return next();
    }

    // Rejected organizations cannot access
    return res.status(403).json({ 
      error: 'Your organization has been rejected. Please contact support.',
      approvalStatus: organization.approval_status
    });
  } catch (error) {
    console.error('Pending organization check error:', error);
    return res.status(500).json({ error: 'Failed to verify organization status' });
  }
};

module.exports = {
  requireOrganizationApproval,
  allowPendingOrganization
};
