const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get all rooms for authenticated user (filtered by organization)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { roomType, isActive } = req.query;

    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    let paramCount = 1;

    // Filter by organization - user can only see rooms in their organization
    if (req.user.organization_id) {
      // Rooms belong to organization via user_id
      whereClause += ` AND r.user_id IN (SELECT id FROM users WHERE organization_id = $${paramCount})`;
      queryParams.push(req.user.organization_id);
      paramCount++;
    } else {
      // Fallback to user_id for backward compatibility
      whereClause += ` AND r.user_id = $${paramCount++}`;
      queryParams.push(req.user.id);
    }

    if (roomType) {
      whereClause += ` AND room_type = $${paramCount++}`;
      queryParams.push(roomType);
    }
    if (isActive !== undefined) {
      whereClause += ` AND is_active = $${paramCount++}`;
      queryParams.push(isActive === 'true');
    }

    const result = await query(`
      SELECT r.id, r.name, r.description, r.room_type, r.capacity, r.current_plants,
             r.dimensions_length, r.dimensions_width, r.dimensions_height,
             r.temperature_min, r.temperature_max, r.humidity_min, r.humidity_max,
             r.lighting_type, r.ventilation_system, r.co2_system, r.is_active,
             r.created_at, r.updated_at
      FROM rooms r
      ${whereClause}
      ORDER BY r.created_at DESC
    `, queryParams);

    const rooms = result.rows.map(room => ({
      id: room.id,
      name: room.name,
      description: room.description,
      roomType: room.room_type,
      capacity: room.capacity,
      currentPlants: room.current_plants,
      dimensions: {
        length: parseFloat(room.dimensions_length),
        width: parseFloat(room.dimensions_width),
        height: parseFloat(room.dimensions_height)
      },
      temperature: {
        min: parseFloat(room.temperature_min),
        max: parseFloat(room.temperature_max)
      },
      humidity: {
        min: parseFloat(room.humidity_min),
        max: parseFloat(room.humidity_max)
      },
      lightingType: room.lighting_type,
      ventilationSystem: room.ventilation_system,
      co2System: room.co2_system,
      isActive: room.is_active,
      createdAt: room.created_at,
      updatedAt: room.updated_at
    }));

    res.json(rooms);

  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get single room by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);

    const result = await query(`
      SELECT id, name, description, room_type, capacity, current_plants,
             dimensions_length, dimensions_width, dimensions_height,
             temperature_min, temperature_max, humidity_min, humidity_max,
             lighting_type, ventilation_system, co2_system, is_active,
             created_at, updated_at
      FROM rooms 
      WHERE id = $1 AND user_id = $2
    `, [roomId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = result.rows[0];

    res.json({
      id: room.id,
      name: room.name,
      description: room.description,
      roomType: room.room_type,
      capacity: room.capacity,
      currentPlants: room.current_plants,
      dimensions: {
        length: parseFloat(room.dimensions_length),
        width: parseFloat(room.dimensions_width),
        height: parseFloat(room.dimensions_height)
      },
      temperature: {
        min: parseFloat(room.temperature_min),
        max: parseFloat(room.temperature_max)
      },
      humidity: {
        min: parseFloat(room.humidity_min),
        max: parseFloat(room.humidity_max)
      },
      lightingType: room.lighting_type,
      ventilationSystem: room.ventilation_system,
      co2System: room.co2_system,
      isActive: room.is_active,
      createdAt: room.created_at,
      updatedAt: room.updated_at
    });

  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Create new room
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      name, description, roomType, capacity, dimensions,
      temperature, humidity, lightingType, ventilationSystem, co2System
    } = req.body;

    // Validate temperature values (allow -1000 to 10000 to support both Celsius and Fahrenheit)
    if (temperature) {
      if (temperature.min !== undefined && temperature.min !== null) {
        if (temperature.min < -1000 || temperature.min > 10000) {
          return res.status(400).json({ 
            error: 'Temperature minimum must be between -1000 and 10000' 
          });
        }
      }
      if (temperature.max !== undefined && temperature.max !== null) {
        if (temperature.max < -1000 || temperature.max > 10000) {
          return res.status(400).json({ 
            error: 'Temperature maximum must be between -1000 and 10000' 
          });
        }
      }
      if (temperature.min !== undefined && temperature.max !== undefined && 
          temperature.min !== null && temperature.max !== null &&
          temperature.min > temperature.max) {
        return res.status(400).json({ 
          error: 'Temperature minimum must be less than or equal to maximum' 
        });
      }
    }

    // Validate humidity values (must be 0-100 for percentage)
    if (humidity) {
      if (humidity.min !== undefined && humidity.min !== null) {
        if (humidity.min < 0 || humidity.min > 100) {
          return res.status(400).json({ 
            error: 'Humidity minimum must be between 0 and 100' 
          });
        }
      }
      if (humidity.max !== undefined && humidity.max !== null) {
        if (humidity.max < 0 || humidity.max > 100) {
          return res.status(400).json({ 
            error: 'Humidity maximum must be between 0 and 100' 
          });
        }
      }
      if (humidity.min !== undefined && humidity.max !== undefined && 
          humidity.min !== null && humidity.max !== null &&
          humidity.min > humidity.max) {
        return res.status(400).json({ 
          error: 'Humidity minimum must be less than or equal to maximum' 
        });
      }
    }

    const result = await query(`
      INSERT INTO rooms (user_id, name, description, room_type, capacity,
                        dimensions_length, dimensions_width, dimensions_height,
                        temperature_min, temperature_max, humidity_min, humidity_max,
                        lighting_type, ventilation_system, co2_system)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id, name, description, room_type, capacity, current_plants,
                dimensions_length, dimensions_width, dimensions_height,
                temperature_min, temperature_max, humidity_min, humidity_max,
                lighting_type, ventilation_system, co2_system, created_at
    `, [
      req.user.id, name, description, roomType, capacity,
      dimensions?.length, dimensions?.width, dimensions?.height,
      temperature?.min, temperature?.max, humidity?.min, humidity?.max,
      lightingType, ventilationSystem, co2System
    ]);

    const room = result.rows[0];

    res.status(201).json({
      message: 'Room created successfully',
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        roomType: room.room_type,
        capacity: room.capacity,
        currentPlants: room.current_plants,
        dimensions: {
          length: parseFloat(room.dimensions_length),
          width: parseFloat(room.dimensions_width),
          height: parseFloat(room.dimensions_height)
        },
        temperature: {
          min: parseFloat(room.temperature_min),
          max: parseFloat(room.temperature_max)
        },
        humidity: {
          min: parseFloat(room.humidity_min),
          max: parseFloat(room.humidity_max)
        },
        lightingType: room.lighting_type,
        ventilationSystem: room.ventilation_system,
        co2System: room.co2_system,
        createdAt: room.created_at
      }
    });

  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Update room
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);
    const {
      name, description, roomType, capacity, dimensions,
      temperature, humidity, lightingType, ventilationSystem, co2System, isActive
    } = req.body;

    // Validate temperature values (allow -1000 to 10000 to support both Celsius and Fahrenheit)
    if (temperature) {
      if (temperature.min !== undefined && temperature.min !== null) {
        if (temperature.min < -1000 || temperature.min > 10000) {
          return res.status(400).json({ 
            error: 'Temperature minimum must be between -1000 and 10000' 
          });
        }
      }
      if (temperature.max !== undefined && temperature.max !== null) {
        if (temperature.max < -1000 || temperature.max > 10000) {
          return res.status(400).json({ 
            error: 'Temperature maximum must be between -1000 and 10000' 
          });
        }
      }
      if (temperature.min !== undefined && temperature.max !== undefined && 
          temperature.min !== null && temperature.max !== null &&
          temperature.min > temperature.max) {
        return res.status(400).json({ 
          error: 'Temperature minimum must be less than or equal to maximum' 
        });
      }
    }

    // Validate humidity values (must be 0-100 for percentage)
    if (humidity) {
      if (humidity.min !== undefined && humidity.min !== null) {
        if (humidity.min < 0 || humidity.min > 100) {
          return res.status(400).json({ 
            error: 'Humidity minimum must be between 0 and 100' 
          });
        }
      }
      if (humidity.max !== undefined && humidity.max !== null) {
        if (humidity.max < 0 || humidity.max > 100) {
          return res.status(400).json({ 
            error: 'Humidity maximum must be between 0 and 100' 
          });
        }
      }
      if (humidity.min !== undefined && humidity.max !== undefined && 
          humidity.min !== null && humidity.max !== null &&
          humidity.min > humidity.max) {
        return res.status(400).json({ 
          error: 'Humidity minimum must be less than or equal to maximum' 
        });
      }
    }

    // If deactivating, check for active assignments
    if (isActive !== undefined && isActive === false) {
      const batchesCheck = await query(
        'SELECT COUNT(*) as count FROM batches WHERE room_id = $1 AND user_id = $2 AND is_active = true',
        [roomId, req.user.id]
      );
      const batchCount = parseInt(batchesCheck.rows[0].count || 0);
      
      const plantsCheck = await query(
        'SELECT COUNT(*) as count FROM plants WHERE room_id = $1 AND user_id = $2 AND is_active = true',
        [roomId, req.user.id]
      );
      const plantCount = parseInt(plantsCheck.rows[0].count || 0);
      
      if (batchCount > 0 || plantCount > 0) {
        return res.status(400).json({ 
          error: `Cannot deactivate room. It has ${batchCount} active batch(es) and ${plantCount} active plant(s). Please move them to another room first.` 
        });
      }
    }

    const result = await query(`
      UPDATE rooms 
      SET name = COALESCE($1, name), 
          description = COALESCE($2, description), 
          room_type = COALESCE($3, room_type), 
          capacity = COALESCE($4, capacity),
          dimensions_length = COALESCE($5, dimensions_length), 
          dimensions_width = COALESCE($6, dimensions_width), 
          dimensions_height = COALESCE($7, dimensions_height),
          temperature_min = COALESCE($8, temperature_min), 
          temperature_max = COALESCE($9, temperature_max), 
          humidity_min = COALESCE($10, humidity_min), 
          humidity_max = COALESCE($11, humidity_max),
          lighting_type = COALESCE($12, lighting_type), 
          ventilation_system = COALESCE($13, ventilation_system), 
          co2_system = COALESCE($14, co2_system),
          is_active = COALESCE($15, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $16 AND user_id = $17
      RETURNING id, name, description, room_type, capacity, current_plants,
                dimensions_length, dimensions_width, dimensions_height,
                temperature_min, temperature_max, humidity_min, humidity_max,
                lighting_type, ventilation_system, co2_system, is_active, updated_at
    `, [
      name, description, roomType, capacity,
      dimensions?.length, dimensions?.width, dimensions?.height,
      temperature?.min, temperature?.max, humidity?.min, humidity?.max,
      lightingType, ventilationSystem, co2System, isActive,
      roomId, req.user.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = result.rows[0];

    res.json({
      message: 'Room updated successfully',
      room: {
        id: room.id,
        name: room.name,
        description: room.description,
        roomType: room.room_type,
        capacity: room.capacity,
        currentPlants: room.current_plants,
        dimensions: {
          length: parseFloat(room.dimensions_length),
          width: parseFloat(room.dimensions_width),
          height: parseFloat(room.dimensions_height)
        },
        temperature: {
          min: parseFloat(room.temperature_min),
          max: parseFloat(room.temperature_max)
        },
        humidity: {
          min: parseFloat(room.humidity_min),
          max: parseFloat(room.humidity_max)
        },
        lightingType: room.lighting_type,
        ventilationSystem: room.ventilation_system,
        co2System: room.co2_system,
        isActive: room.is_active,
        updatedAt: room.updated_at
      }
    });

  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Delete room (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);

    // Verify room exists and belongs to user
    const roomCheck = await query(
      'SELECT id, name FROM rooms WHERE id = $1 AND user_id = $2',
      [roomId, req.user.id]
    );

    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    // Check if room has assigned batches
    const batchesCheck = await query(
      'SELECT COUNT(*) as count FROM batches WHERE room_id = $1 AND user_id = $2 AND is_active = true',
      [roomId, req.user.id]
    );

    const batchCount = parseInt(batchesCheck.rows[0].count || 0);
    if (batchCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete room. It currently has ${batchCount} active batch(es) assigned. Please move the batches to another room first.` 
      });
    }

    // Check if room has assigned plants (check ALL plants, not just active ones)
    // Since plants.room_id is NOT NULL, we cannot delete a room with any plants
    const plantsCheck = await query(
      'SELECT COUNT(*) as count FROM plants WHERE room_id = $1 AND user_id = $2',
      [roomId, req.user.id]
    );

    const plantCount = parseInt(plantsCheck.rows[0].count || 0);
    if (plantCount > 0) {
      // Check active vs inactive for better error message
      const activePlantsCheck = await query(
        'SELECT COUNT(*) as count FROM plants WHERE room_id = $1 AND user_id = $2 AND is_active = true',
        [roomId, req.user.id]
      );
      const activePlantCount = parseInt(activePlantsCheck.rows[0].count || 0);
      const inactivePlantCount = plantCount - activePlantCount;
      
      let errorMsg = `Cannot delete room. It has ${plantCount} plant(s) assigned`;
      if (activePlantCount > 0 && inactivePlantCount > 0) {
        errorMsg += ` (${activePlantCount} active, ${inactivePlantCount} inactive)`;
      } else if (activePlantCount > 0) {
        errorMsg += ` (${activePlantCount} active)`;
      } else {
        errorMsg += ` (${inactivePlantCount} inactive)`;
      }
      errorMsg += `. Since plants require a room, please move or delete the plants first.`;
      
      return res.status(400).json({ error: errorMsg });
    }

    // Check if room has assigned harvest batches
    const harvestCheck = await query(
      'SELECT COUNT(*) as count FROM harvest_batches WHERE room_id = $1 AND user_id = $2',
      [roomId, req.user.id]
    );

    const harvestCount = parseInt(harvestCheck.rows[0].count || 0);
    if (harvestCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete room. It has ${harvestCount} harvest batch(es) associated with it. Please remove the harvest batches first.` 
      });
    }

    // Check if room has assigned mother plants
    const mothersCheck = await query(
      'SELECT COUNT(*) as count FROM mothers WHERE room_id = $1 AND user_id = $2 AND is_active = true',
      [roomId, req.user.id]
    );

    const mothersCount = parseInt(mothersCheck.rows[0].count || 0);
    if (mothersCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete room. It currently has ${mothersCount} active mother plant(s) assigned. Please move the mother plants to another room first.` 
      });
    }

    // Hard delete - permanently remove from database
    // Note: Related records will be handled by foreign key constraints:
    // - environmental_logs: ON DELETE CASCADE (will be deleted)
    // - batches, plants, mothers, harvest_batches: ON DELETE SET NULL (room_id will be set to NULL)
    const result = await query(`
      DELETE FROM rooms 
      WHERE id = $1 AND user_id = $2
      RETURNING id, name
    `, [roomId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found or already deleted' });
    }

    res.json({
      message: 'Room deleted successfully',
      room: result.rows[0]
    });

  } catch (error) {
    console.error('Delete room error:', error);
    
    // Check for foreign key constraint violations
    if (error.code === '23503') {
      return res.status(400).json({ 
        error: 'Cannot delete room. It is still referenced by other records. Please remove all plants, batches, and related data first.' 
      });
    }
    
    // Check for other constraint violations
    if (error.code === '23514') {
      return res.status(400).json({ 
        error: error.message || 'Cannot delete room due to constraint violation.' 
      });
    }
    
    res.status(500).json({ 
      error: error.message || 'Failed to delete room',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get plants in room - cultivation endpoint
router.get('/:id/plants', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);

    // Verify room belongs to user
    const roomCheck = await query(
      'SELECT id FROM rooms WHERE id = $1 AND user_id = $2',
      [roomId, req.user.id]
    );

    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const result = await query(`
      SELECT p.*, b.batch_name, g.strain_name
      FROM plants p
      LEFT JOIN batches b ON p.batch_id = b.id
      LEFT JOIN genetics g ON p.genetic_id = g.id
      WHERE p.room_id = $1 AND p.user_id = $2 AND p.is_active = true
      ORDER BY p.plant_number ASC
    `, [roomId, req.user.id]);

    const plants = result.rows.map(plant => ({
      id: plant.id,
      plantName: plant.plant_name,
      plantNumber: plant.plant_number,
      growthStage: plant.growth_stage,
      healthStatus: plant.health_status,
      batch: plant.batch_id ? {
        id: plant.batch_id,
        batchName: plant.batch_name
      } : null,
      genetic: plant.genetic_id ? {
        id: plant.genetic_id,
        strainName: plant.strain_name
      } : null,
      height: plant.height,
      lastWatered: plant.last_watered,
      lastFed: plant.last_fed
    }));

    res.json(plants);
  } catch (error) {
    console.error('Get room plants error:', error);
    res.status(500).json({ error: 'Failed to fetch plants in room' });
  }
});

// Move plants to room - cultivation endpoint
router.post('/:id/move-plants', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);
    const { plantIds } = req.body;

    if (!Array.isArray(plantIds) || plantIds.length === 0) {
      return res.status(400).json({ error: 'Plant IDs array is required' });
    }

    // Verify room belongs to user
    const roomCheck = await query(
      'SELECT id, capacity, current_plants FROM rooms WHERE id = $1 AND user_id = $2',
      [roomId, req.user.id]
    );

    if (roomCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = roomCheck.rows[0];

    // Check capacity
    if (room.current_plants + plantIds.length > room.capacity) {
      return res.status(400).json({ error: 'Room capacity exceeded' });
    }

    // Update plants' room
    const result = await query(`
      UPDATE plants SET
        room_id = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ANY($2) AND user_id = $3
      RETURNING id
    `, [roomId, plantIds, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No plants found or access denied' });
    }

    // Update room's current plant count
    await query(`
      UPDATE rooms SET
        current_plants = current_plants + $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [result.rows.length, roomId]);

    res.json({
      message: `${result.rows.length} plants moved to room successfully`,
      movedCount: result.rows.length
    });
  } catch (error) {
    console.error('Move plants to room error:', error);
    res.status(500).json({ error: 'Failed to move plants to room' });
  }
});

// Get room environmental summary - cultivation endpoint
router.get('/:id/environment', authenticateToken, async (req, res) => {
  try {
    const roomId = parseInt(req.params.id);

    const result = await query(`
      SELECT temperature_min, temperature_max, humidity_min, humidity_max,
             lighting_type, ventilation_system, co2_system
      FROM rooms
      WHERE id = $1 AND user_id = $2
    `, [roomId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = result.rows[0];

    // Get current plant count by growth stage
    const plantsResult = await query(`
      SELECT growth_stage, COUNT(*) as count
      FROM plants
      WHERE room_id = $1 AND user_id = $2 AND is_active = true
      GROUP BY growth_stage
    `, [roomId, req.user.id]);

    const plantStages = {};
    plantsResult.rows.forEach(row => {
      plantStages[row.growth_stage] = parseInt(row.count);
    });

    res.json({
      environmental: {
        temperature: {
          min: parseFloat(room.temperature_min),
          max: parseFloat(room.temperature_max)
        },
        humidity: {
          min: parseFloat(room.humidity_min),
          max: parseFloat(room.humidity_max)
        },
        lightingType: room.lighting_type,
        ventilationSystem: room.ventilation_system,
        co2System: room.co2_system
      },
      plantsByStage: plantStages
    });
  } catch (error) {
    console.error('Get room environment error:', error);
    res.status(500).json({ error: 'Failed to fetch room environment' });
  }
});

module.exports = router;
