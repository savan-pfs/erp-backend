const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { farmValidation, validate } = require('../middleware/validation');
const { query } = require('../config/database');

const router = express.Router();

// Get all farms for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, name, description, location_address, latitude, longitude, 
             total_area, soil_type, water_source, ownership_type, is_active, 
             created_at, updated_at
      FROM farms 
      WHERE user_id = $1 AND is_active = true
      ORDER BY created_at DESC
    `, [req.user.id]);

    const farms = result.rows.map(farm => ({
      id: farm.id,
      name: farm.name,
      description: farm.description,
      locationAddress: farm.location_address,
      latitude: farm.latitude,
      longitude: farm.longitude,
      totalArea: parseFloat(farm.total_area),
      soilType: farm.soil_type,
      waterSource: farm.water_source,
      ownershipType: farm.ownership_type,
      isActive: farm.is_active,
      createdAt: farm.created_at,
      updatedAt: farm.updated_at
    }));

    res.json(farms);

  } catch (error) {
    console.error('Get farms error:', error);
    res.status(500).json({ error: 'Failed to fetch farms' });
  }
});

// Get single farm by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const farmId = parseInt(req.params.id);

    const result = await query(`
      SELECT id, name, description, location_address, latitude, longitude, 
             total_area, soil_type, water_source, ownership_type, is_active, 
             created_at, updated_at
      FROM farms 
      WHERE id = $1 AND user_id = $2
    `, [farmId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const farm = result.rows[0];

    res.json({
      id: farm.id,
      name: farm.name,
      description: farm.description,
      locationAddress: farm.location_address,
      latitude: farm.latitude,
      longitude: farm.longitude,
      totalArea: parseFloat(farm.total_area),
      soilType: farm.soil_type,
      waterSource: farm.water_source,
      ownershipType: farm.ownership_type,
      isActive: farm.is_active,
      createdAt: farm.created_at,
      updatedAt: farm.updated_at
    });

  } catch (error) {
    console.error('Get farm error:', error);
    res.status(500).json({ error: 'Failed to fetch farm' });
  }
});

// Create new farm
router.post('/', authenticateToken, validate(farmValidation.create), async (req, res) => {
  try {
    const {
      name, description, locationAddress, latitude, longitude,
      totalArea, soilType, waterSource, ownershipType
    } = req.body;

    const result = await query(`
      INSERT INTO farms (user_id, name, description, location_address, latitude, 
                        longitude, total_area, soil_type, water_source, ownership_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, name, description, location_address, latitude, longitude, 
                total_area, soil_type, water_source, ownership_type, created_at
    `, [
      req.user.id, name, description, locationAddress, latitude, longitude,
      totalArea, soilType, waterSource, ownershipType
    ]);

    const farm = result.rows[0];

    res.status(201).json({
      message: 'Farm created successfully',
      farm: {
        id: farm.id,
        name: farm.name,
        description: farm.description,
        locationAddress: farm.location_address,
        latitude: farm.latitude,
        longitude: farm.longitude,
        totalArea: parseFloat(farm.total_area),
        soilType: farm.soil_type,
        waterSource: farm.water_source,
        ownershipType: farm.ownership_type,
        createdAt: farm.created_at
      }
    });

  } catch (error) {
    console.error('Create farm error:', error);
    res.status(500).json({ error: 'Failed to create farm' });
  }
});

// Update farm
router.put('/:id', authenticateToken, validate(farmValidation.update), async (req, res) => {
  try {
    const farmId = parseInt(req.params.id);
    const {
      name, description, locationAddress, latitude, longitude,
      totalArea, soilType, waterSource, ownershipType
    } = req.body;

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];
    let paramCount = 1;

    if (name !== undefined) {
      updateFields.push(`name = $${paramCount++}`);
      updateValues.push(name);
    }
    if (description !== undefined) {
      updateFields.push(`description = $${paramCount++}`);
      updateValues.push(description);
    }
    if (locationAddress !== undefined) {
      updateFields.push(`location_address = $${paramCount++}`);
      updateValues.push(locationAddress);
    }
    if (latitude !== undefined) {
      updateFields.push(`latitude = $${paramCount++}`);
      updateValues.push(latitude);
    }
    if (longitude !== undefined) {
      updateFields.push(`longitude = $${paramCount++}`);
      updateValues.push(longitude);
    }
    if (totalArea !== undefined) {
      updateFields.push(`total_area = $${paramCount++}`);
      updateValues.push(totalArea);
    }
    if (soilType !== undefined) {
      updateFields.push(`soil_type = $${paramCount++}`);
      updateValues.push(soilType);
    }
    if (waterSource !== undefined) {
      updateFields.push(`water_source = $${paramCount++}`);
      updateValues.push(waterSource);
    }
    if (ownershipType !== undefined) {
      updateFields.push(`ownership_type = $${paramCount++}`);
      updateValues.push(ownershipType);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(farmId, req.user.id);

    const result = await query(`
      UPDATE farms 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND user_id = $${paramCount++}
      RETURNING id, name, description, location_address, latitude, longitude, 
                total_area, soil_type, water_source, ownership_type, updated_at
    `, updateValues);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    const farm = result.rows[0];

    res.json({
      message: 'Farm updated successfully',
      farm: {
        id: farm.id,
        name: farm.name,
        description: farm.description,
        locationAddress: farm.location_address,
        latitude: farm.latitude,
        longitude: farm.longitude,
        totalArea: parseFloat(farm.total_area),
        soilType: farm.soil_type,
        waterSource: farm.water_source,
        ownershipType: farm.ownership_type,
        updatedAt: farm.updated_at
      }
    });

  } catch (error) {
    console.error('Update farm error:', error);
    res.status(500).json({ error: 'Failed to update farm' });
  }
});

// Delete farm (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const farmId = parseInt(req.params.id);

    const result = await query(`
      UPDATE farms 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id, name
    `, [farmId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Farm not found' });
    }

    res.json({
      message: 'Farm deleted successfully',
      farm: result.rows[0]
    });

  } catch (error) {
    console.error('Delete farm error:', error);
    res.status(500).json({ error: 'Failed to delete farm' });
  }
});

module.exports = router;
