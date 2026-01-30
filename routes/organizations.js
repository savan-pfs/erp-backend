const express = require('express');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { query } = require('../config/database');
const { createNotification, createNotificationsForUsers } = require('../utils/notifications');

const router = express.Router();

// Get all organizations (Super Admin only, or user's own organization)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // If user is Super Admin, show all. Otherwise, show only their organization
    let result;
    const isSuperAdmin = req.user.role === 'super_admin' || 
                        req.user.roleNames?.includes('super_admin') ||
                        req.user.roleNames?.includes('Super Admin');
    
    if (isSuperAdmin) {
      result = await query(`
        SELECT id, name, legal_name, tax_id, description, is_active, 
               approval_status, location_state_code, location_country_code,
               approved_by, approved_at, rejection_reason,
               created_at, updated_at
        FROM organizations
        ORDER BY 
          CASE approval_status
            WHEN 'PENDING_APPROVAL' THEN 1
            WHEN 'APPROVED' THEN 2
            WHEN 'REJECTED' THEN 3
            ELSE 4
          END,
          created_at DESC
      `);
    } else {
      result = await query(`
        SELECT o.id, o.name, o.legal_name, o.tax_id, o.description, o.is_active,
               o.approval_status, o.location_state_code, o.location_country_code,
               o.created_at, o.updated_at
        FROM organizations o
        INNER JOIN users u ON u.organization_id = o.id
        WHERE u.id = $1
      `, [req.user.id]);
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Failed to fetch organizations' });
  }
});

// Get pending organizations (Super Admin only)
router.get('/pending', authenticateToken, authorizeRole(['super_admin']), async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        o.id, o.name, o.legal_name, o.tax_id, o.description,
        o.approval_status, o.location_state_code, o.location_country_code,
        o.created_at, o.updated_at,
        u.id as admin_user_id, u.email as admin_email, 
        u.first_name as admin_first_name, u.last_name as admin_last_name,
        os.signup_data,
        d.id as license_document_id, d.file_name as license_file_name,
        d.status as license_status
      FROM organizations o
      INNER JOIN organization_signups os ON o.id = os.organization_id
      INNER JOIN users u ON os.user_id = u.id
      LEFT JOIN documents d ON o.cultivation_license_document_id = d.id
      WHERE o.approval_status = 'PENDING_APPROVAL'
      ORDER BY o.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Get pending organizations error:', error);
    res.status(500).json({ error: 'Failed to fetch pending organizations' });
  }
});

// Get single organization
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);

    // Check access - user must belong to this organization or be Super Admin
    const isSuperAdmin = req.user.role === 'super_admin' || req.user.roleNames?.includes('super_admin');
    if (!isSuperAdmin && req.user.organizationId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(`
      SELECT 
        o.id, o.name, o.legal_name, o.tax_id, o.description, o.is_active,
        o.approval_status, o.approved_by, o.approved_at, o.rejection_reason,
        o.location_state_code, o.location_country_code,
        o.cultivation_license_document_id,
        o.created_at, o.updated_at,
        approver.email as approved_by_email,
        d.id as license_document_id, d.file_name as license_file_name,
        d.status as license_status
      FROM organizations o
      LEFT JOIN users approver ON o.approved_by = approver.id
      LEFT JOIN documents d ON o.cultivation_license_document_id = d.id
      WHERE o.id = $1
    `, [orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to fetch organization' });
  }
});

// Get users in organization
router.get('/:id/users', authenticateToken, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);

    // Check access - user must belong to this organization or be Super Admin
    const isSuperAdmin = req.user.role === 'super_admin' || req.user.roleNames?.includes('super_admin');
    if (!isSuperAdmin && req.user.organizationId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
        u.is_active, u.approval_status, u.created_at,
        array_agg(DISTINCT r.name) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.organization_id = $1
      GROUP BY u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.is_active, u.approval_status, u.created_at
      ORDER BY u.created_at DESC
    `, [orgId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get organization users error:', error);
    res.status(500).json({ error: 'Failed to fetch organization users' });
  }
});

// Create organization (Super Admin only)
router.post('/', authenticateToken, authorizeRole(['super_admin']), async (req, res) => {
  try {
    const { name, legalName, taxId, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    const result = await query(`
      INSERT INTO organizations (name, legal_name, tax_id, description)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, legal_name, tax_id, description, is_active, created_at
    `, [name, legalName, taxId, description]);

    res.status(201).json({
      message: 'Organization created successfully',
      organization: result.rows[0]
    });
  } catch (error) {
    console.error('Create organization error:', error);
    res.status(500).json({ error: 'Failed to create organization' });
  }
});

// Approve organization (Super Admin only)
router.post('/:id/approve', authenticateToken, authorizeRole(['super_admin']), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);

    // Update organization status
    const result = await query(`
      UPDATE organizations
      SET approval_status = 'APPROVED',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP,
          rejection_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND approval_status = 'PENDING_APPROVAL'
      RETURNING id, name, approval_status, approved_at
    `, [req.user.id, orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found or already processed' });
    }

    const organization = result.rows[0];

    // Update organization signup status
    await query(`
      UPDATE organization_signups
      SET status = 'APPROVED',
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP
      WHERE organization_id = $2
    `, [req.user.id, orgId]);

    // Get organization admin user
    const adminResult = await query(`
      SELECT u.id, u.email
      FROM users u
      WHERE u.organization_id = $1 AND u.role = 'org_admin'
      LIMIT 1
    `, [orgId]);

    // Notify organization admin
    if (adminResult.rows.length > 0) {
      await createNotification({
        userId: adminResult.rows[0].id,
        type: 'success',
        title: 'Organization Approved',
        message: `Your organization "${organization.name}" has been approved. You now have full access to the system.`,
        entityType: 'organization',
        entityId: orgId
      });
    }

    res.json({
      message: 'Organization approved successfully',
      organization: organization
    });
  } catch (error) {
    console.error('Approve organization error:', error);
    res.status(500).json({ error: 'Failed to approve organization' });
  }
});

// Reject organization (Super Admin only)
router.post('/:id/reject', authenticateToken, authorizeRole(['super_admin']), async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    const { rejectionReason } = req.body;

    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    // Update organization status
    const result = await query(`
      UPDATE organizations
      SET approval_status = 'REJECTED',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP,
          rejection_reason = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND approval_status = 'PENDING_APPROVAL'
      RETURNING id, name, approval_status, rejection_reason
    `, [req.user.id, rejectionReason, orgId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found or already processed' });
    }

    const organization = result.rows[0];

    // Update organization signup status
    await query(`
      UPDATE organization_signups
      SET status = 'REJECTED',
          reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = $2
      WHERE organization_id = $3
    `, [req.user.id, rejectionReason, orgId]);

    // Get organization admin user
    const adminResult = await query(`
      SELECT u.id, u.email
      FROM users u
      WHERE u.organization_id = $1 AND u.role = 'org_admin'
      LIMIT 1
    `, [orgId]);

    // Notify organization admin
    if (adminResult.rows.length > 0) {
      await createNotification({
        userId: adminResult.rows[0].id,
        type: 'error',
        title: 'Organization Rejected',
        message: `Your organization "${organization.name}" has been rejected. Reason: ${rejectionReason}`,
        entityType: 'organization',
        entityId: orgId,
        metadata: { rejectionReason }
      });
    }

    res.json({
      message: 'Organization rejected',
      organization: organization
    });
  } catch (error) {
    console.error('Reject organization error:', error);
    res.status(500).json({ error: 'Failed to reject organization' });
  }
});

// Update organization (Super Admin or Org Admin)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const orgId = parseInt(req.params.id);
    const { name, legalName, taxId, description, isActive, locationStateCode, locationCountryCode } = req.body;

    // Check access
    const isSuperAdmin = req.user.role === 'super_admin' || req.user.roleNames?.includes('super_admin');
    if (!isSuperAdmin && req.user.organizationId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Org Admin cannot change approval status or is_active
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (legalName !== undefined) {
      updateFields.push(`legal_name = $${paramCount++}`);
      values.push(legalName);
    }
    if (taxId !== undefined) {
      updateFields.push(`tax_id = $${paramCount++}`);
      values.push(taxId);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (locationStateCode !== undefined) {
      updateFields.push(`location_state_code = $${paramCount++}`);
      values.push(locationStateCode);
    }
    if (locationCountryCode !== undefined) {
      updateFields.push(`location_country_code = $${paramCount++}`);
      values.push(locationCountryCode);
    }
    // Only Super Admin can change is_active
    if (isActive !== undefined && isSuperAdmin) {
      updateFields.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(orgId);

    const result = await query(`
      UPDATE organizations
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, name, legal_name, tax_id, description, is_active, 
                approval_status, location_state_code, location_country_code,
                updated_at
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json({
      message: 'Organization updated successfully',
      organization: result.rows[0]
    });
  } catch (error) {
    console.error('Update organization error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

module.exports = router;
