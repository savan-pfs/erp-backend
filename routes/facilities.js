const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get all facilities (filtered by user's organization)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { organizationId, stateCode, isActive } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    // Filter by organization - user can only see facilities in their organization
    if (req.user.organization_id) {
      whereClause += ` AND f.organization_id = $${paramCount++}`;
      queryParams.push(req.user.organization_id);
    } else if (organizationId && req.user.role === 'super_admin') {
      whereClause += ` AND f.organization_id = $${paramCount++}`;
      queryParams.push(organizationId);
    }

    if (stateCode) {
      whereClause += ` AND f.state_code = $${paramCount++}`;
      queryParams.push(stateCode);
    }
    if (isActive !== undefined) {
      whereClause += ` AND f.is_active = $${paramCount++}`;
      queryParams.push(isActive === 'true');
    }

    const result = await query(`
      SELECT f.id, f.organization_id, f.name, f.description,
             f.address_line1, f.address_line2, f.city, f.state_code, f.country_code,
             f.postal_code, f.latitude, f.longitude, f.license_number, f.license_type,
             f.is_active, f.created_at, f.updated_at,
             o.name as organization_name
      FROM facilities f
      LEFT JOIN organizations o ON f.organization_id = o.id
      ${whereClause}
      ORDER BY f.created_at DESC
    `, queryParams);

    const facilities = result.rows.map(facility => ({
      id: facility.id,
      organizationId: facility.organization_id,
      organizationName: facility.organization_name,
      name: facility.name,
      description: facility.description,
      address: {
        line1: facility.address_line1,
        line2: facility.address_line2,
        city: facility.city,
        stateCode: facility.state_code,
        countryCode: facility.country_code,
        postalCode: facility.postal_code
      },
      location: {
        latitude: parseFloat(facility.latitude),
        longitude: parseFloat(facility.longitude)
      },
      license: {
        number: facility.license_number,
        type: facility.license_type
      },
      isActive: facility.is_active,
      createdAt: facility.created_at,
      updatedAt: facility.updated_at
    }));

    res.json(facilities);
  } catch (error) {
    console.error('Get facilities error:', error);
    res.status(500).json({ error: 'Failed to fetch facilities' });
  }
});

// Get single facility
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const facilityId = parseInt(req.params.id);

    const result = await query(`
      SELECT f.id, f.organization_id, f.name, f.description,
             f.address_line1, f.address_line2, f.city, f.state_code, f.country_code,
             f.postal_code, f.latitude, f.longitude, f.license_number, f.license_type,
             f.is_active, f.created_at, f.updated_at,
             o.name as organization_name
      FROM facilities f
      LEFT JOIN organizations o ON f.organization_id = o.id
      WHERE f.id = $1
    `, [facilityId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    const facility = result.rows[0];

    // Check access - user must belong to facility's organization
    if (req.user.role !== 'super_admin' && req.user.organization_id !== facility.organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: facility.id,
      organizationId: facility.organization_id,
      organizationName: facility.organization_name,
      name: facility.name,
      description: facility.description,
      address: {
        line1: facility.address_line1,
        line2: facility.address_line2,
        city: facility.city,
        stateCode: facility.state_code,
        countryCode: facility.country_code,
        postalCode: facility.postal_code
      },
      location: {
        latitude: parseFloat(facility.latitude),
        longitude: parseFloat(facility.longitude)
      },
      license: {
        number: facility.license_number,
        type: facility.license_type
      },
      isActive: facility.is_active,
      createdAt: facility.created_at,
      updatedAt: facility.updated_at
    });
  } catch (error) {
    console.error('Get facility error:', error);
    res.status(500).json({ error: 'Failed to fetch facility' });
  }
});

// Create facility
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      organizationId,
      name,
      description,
      address,
      location,
      license,
      isActive
    } = req.body;

    if (!name || !address?.stateCode) {
      return res.status(400).json({ error: 'Facility name and state code are required' });
    }

    // Determine organization_id - use provided or user's organization
    let orgId = organizationId;
    if (!orgId) {
      if (!req.user.organization_id) {
        return res.status(400).json({ error: 'Organization ID is required' });
      }
      orgId = req.user.organization_id;
    }

    // Check access - user must belong to the organization
    if (req.user.role !== 'super_admin' && req.user.organization_id !== orgId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(`
      INSERT INTO facilities (
        organization_id, name, description,
        address_line1, address_line2, city, state_code, country_code, postal_code,
        latitude, longitude, license_number, license_type, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, organization_id, name, description,
                address_line1, address_line2, city, state_code, country_code, postal_code,
                latitude, longitude, license_number, license_type, is_active, created_at
    `, [
      orgId,
      name,
      description,
      address?.line1,
      address?.line2,
      address?.city,
      address?.stateCode,
      address?.countryCode || 'US',
      address?.postalCode,
      location?.latitude,
      location?.longitude,
      license?.number,
      license?.type,
      isActive !== undefined ? isActive : true
    ]);

    const facility = result.rows[0];

    // Create primary location for facility
    await query(`
      INSERT INTO locations (facility_id, state_code, country_code, jurisdiction_name, is_primary)
      VALUES ($1, $2, $3, $4, true)
    `, [
      facility.id,
      facility.state_code,
      facility.country_code,
      null // jurisdiction_name can be populated later
    ]);

    res.status(201).json({
      message: 'Facility created successfully',
      facility: {
        id: facility.id,
        organizationId: facility.organization_id,
        name: facility.name,
        description: facility.description,
        address: {
          line1: facility.address_line1,
          line2: facility.address_line2,
          city: facility.city,
          stateCode: facility.state_code,
          countryCode: facility.country_code,
          postalCode: facility.postal_code
        },
        location: {
          latitude: parseFloat(facility.latitude),
          longitude: parseFloat(facility.longitude)
        },
        license: {
          number: facility.license_number,
          type: facility.license_type
        },
        isActive: facility.is_active,
        createdAt: facility.created_at
      }
    });
  } catch (error) {
    console.error('Create facility error:', error);
    res.status(500).json({ error: 'Failed to create facility' });
  }
});

// Update facility
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const facilityId = parseInt(req.params.id);
    const {
      name,
      description,
      address,
      location,
      license,
      isActive
    } = req.body;

    // Check access
    const facilityCheck = await query(`
      SELECT organization_id FROM facilities WHERE id = $1
    `, [facilityId]);

    if (facilityCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Facility not found' });
    }

    if (req.user.role !== 'super_admin' && req.user.organization_id !== facilityCheck.rows[0].organization_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(`
      UPDATE facilities
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          address_line1 = COALESCE($3, address_line1),
          address_line2 = COALESCE($4, address_line2),
          city = COALESCE($5, city),
          state_code = COALESCE($6, state_code),
          country_code = COALESCE($7, country_code),
          postal_code = COALESCE($8, postal_code),
          latitude = COALESCE($9, latitude),
          longitude = COALESCE($10, longitude),
          license_number = COALESCE($11, license_number),
          license_type = COALESCE($12, license_type),
          is_active = COALESCE($13, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $14
      RETURNING id, organization_id, name, description,
                address_line1, address_line2, city, state_code, country_code, postal_code,
                latitude, longitude, license_number, license_type, is_active, updated_at
    `, [
      name,
      description,
      address?.line1,
      address?.line2,
      address?.city,
      address?.stateCode,
      address?.countryCode,
      address?.postalCode,
      location?.latitude,
      location?.longitude,
      license?.number,
      license?.type,
      isActive,
      facilityId
    ]);

    const facility = result.rows[0];

    res.json({
      message: 'Facility updated successfully',
      facility: {
        id: facility.id,
        organizationId: facility.organization_id,
        name: facility.name,
        description: facility.description,
        address: {
          line1: facility.address_line1,
          line2: facility.address_line2,
          city: facility.city,
          stateCode: facility.state_code,
          countryCode: facility.country_code,
          postalCode: facility.postal_code
        },
        location: {
          latitude: parseFloat(facility.latitude),
          longitude: parseFloat(facility.longitude)
        },
        license: {
          number: facility.license_number,
          type: facility.license_type
        },
        isActive: facility.is_active,
        updatedAt: facility.updated_at
      }
    });
  } catch (error) {
    console.error('Update facility error:', error);
    res.status(500).json({ error: 'Failed to update facility' });
  }
});

module.exports = router;
