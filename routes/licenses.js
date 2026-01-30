const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { query } = require('../config/database');

const router = express.Router();

// Get all licenses (filtered by organization/facility)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { organizationId, licenseType, status, stateCode } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    // Filter by organization
    if (req.user.organizationId) {
      whereClause += ` AND l.organization_id = $${paramCount++}`;
      queryParams.push(req.user.organizationId);
    } else if (organizationId && req.user.role === 'super_admin') {
      whereClause += ` AND l.organization_id = $${paramCount++}`;
      queryParams.push(organizationId);
    }

    if (facilityId) {
      whereClause += ` AND l.facility_id = $${paramCount++}`;
      queryParams.push(facilityId);
    }

    if (licenseType) {
      whereClause += ` AND l.license_type = $${paramCount++}`;
      queryParams.push(licenseType);
    }

    if (status) {
      whereClause += ` AND l.status = $${paramCount++}`;
      queryParams.push(status);
    }

    if (stateCode) {
      whereClause += ` AND l.state_code = $${paramCount++}`;
      queryParams.push(stateCode);
    }

    const result = await query(`
      SELECT l.id, l.organization_id, l.facility_id, l.document_id,
             l.license_type, l.license_number, l.state_code, l.country_code,
             l.issued_by, l.issued_date, l.effective_date, l.expires_date,
             l.status, l.approved_by, l.approved_at, l.suspension_reason,
             l.revocation_reason, l.notes, l.is_active, l.created_at, l.updated_at,
             d.name as document_name, d.status as document_status,
             o.name as organization_name,
             f.name as facility_name,
             approver.email as approved_by_email
      FROM licenses l
      LEFT JOIN documents d ON l.document_id = d.id
      LEFT JOIN organizations o ON l.organization_id = o.id
      LEFT JOIN facilities f ON l.facility_id = f.id
      LEFT JOIN users approver ON l.approved_by = approver.id
      ${whereClause}
      ORDER BY l.created_at DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get licenses error:', error);
    res.status(500).json({ error: 'Failed to fetch licenses' });
  }
});

// Get single license
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const licenseId = parseInt(req.params.id);

    const result = await query(`
      SELECT l.*,
             d.name as document_name, d.status as document_status, d.file_name,
             o.name as organization_name,
             f.name as facility_name,
             approver.email as approved_by_email
      FROM licenses l
      LEFT JOIN documents d ON l.document_id = d.id
      LEFT JOIN organizations o ON l.organization_id = o.id
      LEFT JOIN facilities f ON l.facility_id = f.id
      LEFT JOIN users approver ON l.approved_by = approver.id
      WHERE l.id = $1
    `, [licenseId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'License not found' });
    }

    const license = result.rows[0];

    // Check access
    if (req.user.role !== 'super_admin' && req.user.organizationId !== license.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(license);
  } catch (error) {
    console.error('Get license error:', error);
    res.status(500).json({ error: 'Failed to fetch license' });
  }
});

// Create license
router.post('/', authenticateToken, requirePermission('license:create'), async (req, res) => {
  try {
    const {
      organizationId,
      facilityId,
      documentId,
      licenseType,
      licenseNumber,
      stateCode,
      countryCode,
      issuedBy,
      issuedDate,
      effectiveDate,
      expiresDate,
      notes
    } = req.body;

    if (!licenseType || !licenseNumber || !stateCode || !effectiveDate || !documentId) {
      return res.status(400).json({ error: 'License type, number, state code, effective date, and document ID are required' });
    }

    // Determine organization_id
    let orgId = organizationId || req.user.organizationId;
    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Check access
    if (req.user.role !== 'super_admin' && req.user.organizationId !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Verify document exists and belongs to organization
    const docCheck = await query(`
      SELECT id, organization_id, status FROM documents WHERE id = $1
    `, [documentId]);

    if (docCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (docCheck.rows[0].organization_id !== orgId) {
      return res.status(403).json({ error: 'Document does not belong to organization' });
    }

    const result = await query(`
      INSERT INTO licenses (
        organization_id, facility_id, document_id, license_type,
        license_number, state_code, country_code, issued_by,
        issued_date, effective_date, expires_date, notes, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING_APPROVAL')
      ON CONFLICT (organization_id, facility_id, license_number, state_code)
      DO UPDATE SET
        document_id = EXCLUDED.document_id,
        license_type = EXCLUDED.license_type,
        issued_by = EXCLUDED.issued_by,
        issued_date = EXCLUDED.issued_date,
        effective_date = EXCLUDED.effective_date,
        expires_date = EXCLUDED.expires_date,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, organization_id, facility_id, license_type, license_number,
                state_code, status, created_at
    `, [
      orgId,
      facilityId || null,
      documentId,
      licenseType,
      licenseNumber,
      stateCode,
      countryCode || 'US',
      issuedBy,
      issuedDate || null,
      effectiveDate,
      expiresDate || null,
      notes || null
    ]);

    res.status(201).json({
      message: 'License created successfully. Status depends on document approval.',
      license: result.rows[0]
    });
  } catch (error) {
    console.error('Create license error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'License with this number already exists for this organization/facility/state' });
    }
    res.status(500).json({ error: 'Failed to create license' });
  }
});

// Update license
router.put('/:id', authenticateToken, requirePermission('license:update'), async (req, res) => {
  try {
    const licenseId = parseInt(req.params.id);
    const {
      licenseNumber,
      issuedBy,
      issuedDate,
      effectiveDate,
      expiresDate,
      notes
    } = req.body;

    // Check access
    const licenseCheck = await query(`
      SELECT organization_id FROM licenses WHERE id = $1
    `, [licenseId]);

    if (licenseCheck.rows.length === 0) {
      return res.status(404).json({ error: 'License not found' });
    }

    if (req.user.role !== 'super_admin' && req.user.organizationId !== licenseCheck.rows[0].organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(`
      UPDATE licenses
      SET license_number = COALESCE($1, license_number),
          issued_by = COALESCE($2, issued_by),
          issued_date = COALESCE($3, issued_date),
          effective_date = COALESCE($4, effective_date),
          expires_date = COALESCE($5, expires_date),
          notes = COALESCE($6, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING id, license_number, effective_date, expires_date, updated_at
    `, [licenseNumber, issuedBy, issuedDate, effectiveDate, expiresDate, notes, licenseId]);

    res.json({
      message: 'License updated successfully',
      license: result.rows[0]
    });
  } catch (error) {
    console.error('Update license error:', error);
    res.status(500).json({ error: 'Failed to update license' });
  }
});

// Check if license is valid for an operation
router.get('/check/:licenseType/:stateCode', authenticateToken, async (req, res) => {
  try {
    const { licenseType, stateCode } = req.params;
    const { facilityId } = req.query;

    if (!req.user.organizationId) {
      return res.status(400).json({ error: 'User must belong to an organization' });
    }

    let whereClause = `
      WHERE l.organization_id = $1
        AND l.license_type = $2
        AND l.state_code = $3
        AND l.status = 'ACTIVE'
        AND l.is_active = true
        AND (l.expires_date IS NULL OR l.expires_date > CURRENT_DATE)
        AND l.effective_date <= CURRENT_DATE
    `;
    let queryParams = [req.user.organizationId, licenseType, stateCode];
    let paramCount = 4;

    if (facilityId) {
      whereClause += ` AND (l.facility_id = $${paramCount} OR l.facility_id IS NULL)`;
      queryParams.push(facilityId);
    } else {
      whereClause += ` AND l.facility_id IS NULL`;
    }

    const result = await query(`
      SELECT l.id, l.license_number, l.license_type, l.state_code,
             l.effective_date, l.expires_date, l.status
      FROM licenses l
      ${whereClause}
      ORDER BY l.facility_id NULLS LAST, l.created_at DESC
      LIMIT 1
    `, queryParams);

    if (result.rows.length === 0) {
      return res.json({
        valid: false,
        message: 'No valid active license found for this operation'
      });
    }

    res.json({
      valid: true,
      license: result.rows[0]
    });
  } catch (error) {
    console.error('Check license error:', error);
    res.status(500).json({ error: 'Failed to check license' });
  }
});

module.exports = router;
