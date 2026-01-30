const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { requirePermission, requireRole } = require('../middleware/permissions');
const { query } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { createNotification, createNotificationsForUsers } = require('../utils/notifications');

const router = express.Router();

// Ensure upload directories exist
const ensureUploadDirs = async (orgId) => {
  const baseDir = path.join(process.cwd(), 'uploads', 'documents', 'organizations', String(orgId));
  const licensesDir = path.join(baseDir, 'licenses');
  const otherDir = path.join(baseDir, 'other');

  await fs.mkdir(licensesDir, { recursive: true }).catch(() => { });
  await fs.mkdir(otherDir, { recursive: true }).catch(() => { });

  return { baseDir, licensesDir, otherDir };
};

// Configure multer for file uploads with organization-based storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const orgId = req.body.organizationId || req.user?.organizationId;
      if (!orgId) {
        return cb(new Error('Organization ID is required'));
      }

      const { otherDir, licensesDir } = await ensureUploadDirs(orgId);
      const isLicense = req.body.documentType === 'CULTIVATION_LICENSE';
      cb(null, isLicense ? licensesDir : otherDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const orgId = req.body.organizationId || req.user?.organizationId;
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = `${timestamp}_${orgId}_${file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    cb(null, name);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF, images, and common document formats
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images, and Word documents are allowed.'));
    }
  }
});

// Get all documents (filtered by organization/facility)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { organizationId, facilityId, documentType, status } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    // Filter by organization - Super Admin can see all, others only see their org's documents
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    if (!isSuperAdmin && req.user.organizationId) {
      whereClause += ` AND d.organization_id = $${paramCount++}`;
      queryParams.push(req.user.organizationId);
    } else if (organizationId && isSuperAdmin) {
      whereClause += ` AND d.organization_id = $${paramCount++}`;
      queryParams.push(organizationId);
    }

    if (facilityId) {
      whereClause += ` AND d.facility_id = $${paramCount++}`;
      queryParams.push(facilityId);
    }

    if (documentType) {
      whereClause += ` AND d.document_type = $${paramCount++}`;
      queryParams.push(documentType);
    }

    if (status) {
      whereClause += ` AND d.status = $${paramCount++}`;
      queryParams.push(status);
    }

    const result = await query(`
      SELECT d.id, d.organization_id, d.facility_id, d.uploaded_by,
             d.document_type, d.name, d.description, d.file_name, d.file_size,
             d.mime_type, d.status, d.approved_by, d.approved_at, d.rejection_reason,
             d.expires_at, d.metadata, d.is_active, d.created_at, d.updated_at,
             u.email as uploaded_by_email,
             approver.email as approved_by_email,
             o.name as organization_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN users approver ON d.approved_by = approver.id
      LEFT JOIN organizations o ON d.organization_id = o.id
      ${whereClause}
      ORDER BY d.created_at DESC
    `, queryParams);

    res.json(result.rows);
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Get single document
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    const result = await query(`
      SELECT d.*,
             u.email as uploaded_by_email,
             approver.email as approved_by_email,
             o.name as organization_name
      FROM documents d
      LEFT JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN users approver ON d.approved_by = approver.id
      LEFT JOIN organizations o ON d.organization_id = o.id
      WHERE d.id = $1
    `, [documentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];

    // Check access
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    if (!isSuperAdmin && req.user.organizationId !== doc.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(doc);
  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// Upload document
router.post('/', authenticateToken, requirePermission('document:upload'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const {
      organizationId,
      facilityId,
      documentType,
      name,
      description,
      expiresAt
    } = req.body;

    if (!documentType || !name) {
      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(400).json({ error: 'Document type and name are required' });
    }

    // Determine organization_id
    let orgId = organizationId || req.user.organizationId;
    if (!orgId) {
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Check access
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    if (!isSuperAdmin && req.user.organizationId !== orgId) {
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(`
      INSERT INTO documents (
        organization_id, facility_id, uploaded_by, document_type,
        name, description, file_name, file_path, file_size, mime_type,
        expires_at, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING_APPROVAL')
      RETURNING id, organization_id, facility_id, document_type, name,
                file_name, status, created_at
    `, [
      orgId,
      facilityId || null,
      req.user.id,
      documentType,
      name,
      description,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      expiresAt || null
    ]);

    res.status(201).json({
      message: 'Document uploaded successfully. Pending Super Admin approval.',
      document: result.rows[0]
    });
  } catch (error) {
    console.error('Upload document error:', error);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => { });
    }
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Approve document (Super Admin only)
router.post('/:id/approve', authenticateToken, requirePermission('document:approve'), async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    // Verify user is Super Admin
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Only Super Admin can approve documents' });
    }

    const result = await query(`
      UPDATE documents
      SET status = 'APPROVED',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP,
          rejection_reason = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
        AND status = 'PENDING_APPROVAL'
      RETURNING id, status, approved_by, approved_at
    `, [req.user.id, documentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or already processed' });
    }

    const document = result.rows[0];

    // Get document details to check if it's a cultivation license
    const docDetails = await query(`
      SELECT d.organization_id, d.document_type, d.uploaded_by, o.name as org_name
      FROM documents d
      LEFT JOIN organizations o ON d.organization_id = o.id
      WHERE d.id = $1
    `, [documentId]);

    if (docDetails.rows.length > 0) {
      const doc = docDetails.rows[0];

      // If cultivation license approved, update license status
      if (doc.document_type === 'CULTIVATION_LICENSE') {
        await query(`
          UPDATE licenses
          SET status = 'ACTIVE',
              approved_by = $1,
              approved_at = CURRENT_TIMESTAMP
          WHERE document_id = $2 AND status = 'PENDING_APPROVAL'
        `, [req.user.id, documentId]);
      }

      // Notify organization admin
      if (doc.uploaded_by) {
        await createNotification({
          userId: doc.uploaded_by,
          type: 'success',
          title: 'Document Approved',
          message: `Your ${doc.document_type} document has been approved.`,
          entityType: 'document',
          entityId: documentId
        });
      }
    }

    res.json({
      message: 'Document approved successfully',
      document: document
    });
  } catch (error) {
    console.error('Approve document error:', error);
    res.status(500).json({ error: 'Failed to approve document' });
  }
});

// Reject document (Super Admin only)
router.post('/:id/reject', authenticateToken, requirePermission('document:approve'), async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const { rejectionReason } = req.body;

    // Verify user is Super Admin
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Only Super Admin can reject documents' });
    }

    const result = await query(`
      UPDATE documents
      SET status = 'REJECTED',
          approved_by = $1,
          approved_at = CURRENT_TIMESTAMP,
          rejection_reason = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
        AND status = 'PENDING_APPROVAL'
      RETURNING id, status, rejection_reason
    `, [req.user.id, rejectionReason || 'No reason provided', documentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found or already processed' });
    }

    res.json({
      message: 'Document rejected',
      document: result.rows[0]
    });
  } catch (error) {
    console.error('Reject document error:', error);
    res.status(500).json({ error: 'Failed to reject document' });
  }
});

// Upload cultivation license (special endpoint that creates both document and license)
router.post('/cultivation-license', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    const {
      organizationId,
      licenseNumber,
      stateCode,
      issuedDate,
      expiresDate,
      issuedBy,
      description
    } = req.body;

    // Validate required fields
    if (!licenseNumber || !stateCode) {
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(400).json({ error: 'License number and state code are required' });
    }

    // Determine organization_id
    let orgId = organizationId || req.user.organizationId;
    if (!orgId) {
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Convert both to numbers for comparison
    const userOrgId = req.user.organizationId ? Number(req.user.organizationId) : null;
    const targetOrgId = Number(orgId);

    // Check access - allow org_admin and super_admin
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');
    const isOrgAdmin = req.user.role === 'org_admin' ||
      req.user.roleNames?.includes('org_admin') ||
      req.user.roleNames?.includes('Org Admin');

    // Super admin can upload for any organization
    // Org admin can only upload for their own organization
    if (!isSuperAdmin && (!isOrgAdmin || userOrgId !== targetOrgId)) {
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(403).json({
        error: 'Access denied. You can only upload licenses for your own organization.',
        debug: {
          userOrgId,
          targetOrgId,
          userRole: req.user.role,
          roleNames: req.user.roleNames,
          isSuperAdmin,
          isOrgAdmin
        }
      });
    }

    // Verify organization exists
    const orgCheck = await query(`
      SELECT id, name FROM organizations WHERE id = $1
    `, [orgId]);

    if (orgCheck.rows.length === 0) {
      await fs.unlink(req.file.path).catch(() => { });
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Use issuedDate as effectiveDate if provided, otherwise use today
    const effectiveDate = issuedDate || new Date().toISOString().split('T')[0];

    // Create document record
    const docResult = await query(`
      INSERT INTO documents (
        organization_id, uploaded_by, document_type,
        name, description, file_name, file_path, file_size, mime_type,
        expires_at, status
      )
      VALUES ($1, $2, 'CULTIVATION_LICENSE', $3, $4, $5, $6, $7, $8, $9, 'PENDING_APPROVAL')
      RETURNING id, organization_id, document_type, name, file_name, status, created_at
    `, [
      orgId,
      req.user.id,
      `Cultivation License - ${licenseNumber}`,
      description || `Cultivation license for ${stateCode}`,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      expiresDate || null
    ]);

    const document = docResult.rows[0];

    // Create license record
    // Note: facility_id was removed in migration 042, so licenses are organization-level only
    const licenseResult = await query(`
      INSERT INTO licenses (
        organization_id, document_id, license_type,
        license_number, state_code, country_code, issued_by,
        issued_date, effective_date, expires_date, notes, status
      )
      VALUES ($1, $2, 'CULTIVATION', $3, $4, 'US', $5, $6, $7, $8, $9, 'PENDING_APPROVAL')
      ON CONFLICT (organization_id, license_number, state_code)
      DO UPDATE SET
        document_id = EXCLUDED.document_id,
        issued_by = EXCLUDED.issued_by,
        issued_date = EXCLUDED.issued_date,
        effective_date = EXCLUDED.effective_date,
        expires_date = EXCLUDED.expires_date,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, organization_id, license_type, license_number, state_code, status, created_at
    `, [
      orgId,
      document.id,
      licenseNumber,
      stateCode.toUpperCase(),
      issuedBy || null,
      issuedDate || null,
      effectiveDate,
      expiresDate || null,
      description || null
    ]);

    const license = licenseResult.rows[0];

    // Update organization's cultivation_license_document_id
    await query(`
      UPDATE organizations
      SET cultivation_license_document_id = $1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [document.id, orgId]);

    // Notify Super Admins about new cultivation license upload
    const superAdmins = await query(`
      SELECT id FROM users
      WHERE role = 'super_admin' OR id IN (
        SELECT user_id FROM user_roles ur
        JOIN roles r ON ur.role_id = r.id
        WHERE r.name = 'super_admin' OR r.name = 'Super Admin'
      )
    `);

    if (superAdmins.rows.length > 0) {
      await createNotificationsForUsers(
        superAdmins.rows.map(u => u.id),
        {
          type: 'info',
          title: 'New Cultivation License Upload',
          message: `${orgCheck.rows[0].name} has uploaded a cultivation license (${licenseNumber}) for review.`,
          entityType: 'document',
          entityId: document.id
        }
      );
    }

    res.status(201).json({
      message: 'Cultivation license uploaded successfully. Pending Super Admin approval.',
      document: document,
      license: license
    });
  } catch (error) {
    console.error('Upload cultivation license error:', error);
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => { });
    }
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'License with this number already exists for this organization/state' });
    }
    res.status(500).json({ error: 'Failed to upload cultivation license' });
  }
});

// Download document file
router.get('/:id/download', authenticateToken, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);

    const result = await query(`
      SELECT d.file_path, d.file_name, d.mime_type, d.organization_id
      FROM documents d
      WHERE d.id = $1
    `, [documentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    const doc = result.rows[0];

    // Check access - Super Admin can download any document, others only their org's documents
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    const userOrgId = req.user.organizationId ? Number(req.user.organizationId) : null;
    const docOrgId = doc.organization_id ? Number(doc.organization_id) : null;

    if (!isSuperAdmin && userOrgId !== docOrgId) {
      return res.status(403).json({
        error: 'Access denied',
        details: `User orgId: ${userOrgId}, Document orgId: ${docOrgId}, User role: ${req.user.role}`
      });
    }

    // Check if file exists
    try {
      await fs.access(doc.file_path);
    } catch {
      return res.status(404).json({ error: 'Document file not found' });
    }

    res.setHeader('Content-Type', doc.mime_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.file_name}"`);

    // Stream file
    const fileStream = require('fs').createReadStream(doc.file_path);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Download document error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

module.exports = router;
