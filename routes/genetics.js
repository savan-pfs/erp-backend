const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');

const router = express.Router();

// Get all genetics for authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { strainName, isActive } = req.query;

    let whereClause = 'WHERE user_id = $1';
    let queryParams = [req.user.id];
    let paramCount = 2;

    if (strainName) {
      whereClause += ` AND strain_name ILIKE $${paramCount++}`;
      queryParams.push(`%${strainName}%`);
    }
    if (isActive !== undefined) {
      whereClause += ` AND is_active = $${paramCount++}`;
      queryParams.push(isActive === 'true');
    }

    const result = await query(`
      SELECT id, strain_name, breeder, genetic_lineage, indica_percentage,
             sativa_percentage, ruderalis_percentage, thc_content, cbd_content,
             flowering_time, harvest_time, difficulty_level, yield_indoor,
             yield_outdoor, height_indoor_min, height_indoor_max,
             height_outdoor_min, height_outdoor_max, climate_preference,
             aroma_profile, effects, medical_uses, growth_notes, is_active,
             created_at, updated_at
      FROM genetics 
      ${whereClause}
      ORDER BY strain_name ASC
    `, queryParams);

    const genetics = result.rows.map(genetic => ({
      id: genetic.id,
      strainName: genetic.strain_name,
      breeder: genetic.breeder,
      geneticLineage: genetic.genetic_lineage,
      percentages: {
        indica: parseFloat(genetic.indica_percentage),
        sativa: parseFloat(genetic.sativa_percentage),
        ruderalis: parseFloat(genetic.ruderalis_percentage)
      },
      cannabinoids: {
        thc: genetic.thc_content ? parseFloat(genetic.thc_content) : null,
        cbd: genetic.cbd_content ? parseFloat(genetic.cbd_content) : null
      },
      timing: {
        flowering: genetic.flowering_time,
        harvest: genetic.harvest_time
      },
      difficulty: genetic.difficulty_level,
      yield: {
        indoor: genetic.yield_indoor ? parseFloat(genetic.yield_indoor) : null,
        outdoor: genetic.yield_outdoor ? parseFloat(genetic.yield_outdoor) : null
      },
      height: {
        indoor: {
          min: genetic.height_indoor_min ? parseFloat(genetic.height_indoor_min) : null,
          max: genetic.height_indoor_max ? parseFloat(genetic.height_indoor_max) : null
        },
        outdoor: {
          min: genetic.height_outdoor_min ? parseFloat(genetic.height_outdoor_min) : null,
          max: genetic.height_outdoor_max ? parseFloat(genetic.height_outdoor_max) : null
        }
      },
      climatePreference: genetic.climate_preference,
      aromaProfile: genetic.aroma_profile,
      effects: genetic.effects,
      medicalUses: genetic.medical_uses,
      growthNotes: genetic.growth_notes,
      isActive: genetic.is_active,
      createdAt: genetic.created_at,
      updatedAt: genetic.updated_at
    }));

    res.json(genetics);

  } catch (error) {
    console.error('Get genetics error:', error);
    res.status(500).json({ error: 'Failed to fetch genetics' });
  }
});

// Get single genetic by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const geneticId = parseInt(req.params.id);

    const result = await query(`
      SELECT id, strain_name, breeder, genetic_lineage, indica_percentage,
             sativa_percentage, ruderalis_percentage, thc_content, cbd_content,
             flowering_time, harvest_time, difficulty_level, yield_indoor,
             yield_outdoor, height_indoor_min, height_indoor_max,
             height_outdoor_min, height_outdoor_max, climate_preference,
             aroma_profile, effects, medical_uses, growth_notes, is_active,
             created_at, updated_at
      FROM genetics 
      WHERE id = $1 AND user_id = $2
    `, [geneticId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Genetic not found' });
    }

    const genetic = result.rows[0];

    res.json({
      id: genetic.id,
      strainName: genetic.strain_name,
      breeder: genetic.breeder,
      geneticLineage: genetic.genetic_lineage,
      percentages: {
        indica: parseFloat(genetic.indica_percentage),
        sativa: parseFloat(genetic.sativa_percentage),
        ruderalis: parseFloat(genetic.ruderalis_percentage)
      },
      cannabinoids: {
        thc: genetic.thc_content ? parseFloat(genetic.thc_content) : null,
        cbd: genetic.cbd_content ? parseFloat(genetic.cbd_content) : null
      },
      timing: {
        flowering: genetic.flowering_time,
        harvest: genetic.harvest_time
      },
      difficulty: genetic.difficulty_level,
      yield: {
        indoor: genetic.yield_indoor ? parseFloat(genetic.yield_indoor) : null,
        outdoor: genetic.yield_outdoor ? parseFloat(genetic.yield_outdoor) : null
      },
      height: {
        indoor: {
          min: genetic.height_indoor_min ? parseFloat(genetic.height_indoor_min) : null,
          max: genetic.height_indoor_max ? parseFloat(genetic.height_indoor_max) : null
        },
        outdoor: {
          min: genetic.height_outdoor_min ? parseFloat(genetic.height_outdoor_min) : null,
          max: genetic.height_outdoor_max ? parseFloat(genetic.height_outdoor_max) : null
        }
      },
      climatePreference: genetic.climate_preference,
      aromaProfile: genetic.aroma_profile,
      effects: genetic.effects,
      medicalUses: genetic.medical_uses,
      growthNotes: genetic.growth_notes,
      isActive: genetic.is_active,
      createdAt: genetic.created_at,
      updatedAt: genetic.updated_at
    });

  } catch (error) {
    console.error('Get genetic error:', error);
    res.status(500).json({ error: 'Failed to fetch genetic' });
  }
});

// Create new genetic
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      strainName, breeder, geneticLineage, percentages, cannabinoids,
      timing, difficulty, yield, height, climatePreference, aromaProfile,
      effects, medicalUses, growthNotes
    } = req.body;

    const result = await query(`
      INSERT INTO genetics (user_id, strain_name, breeder, genetic_lineage,
                           indica_percentage, sativa_percentage, ruderalis_percentage,
                           thc_content, cbd_content, flowering_time, harvest_time,
                           difficulty_level, yield_indoor, yield_outdoor,
                           height_indoor_min, height_indoor_max,
                           height_outdoor_min, height_outdoor_max,
                           climate_preference, aroma_profile, effects, medical_uses, growth_notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING id, strain_name, breeder, genetic_lineage, indica_percentage,
                sativa_percentage, ruderalis_percentage, thc_content, cbd_content,
                flowering_time, harvest_time, difficulty_level, yield_indoor,
                yield_outdoor, height_indoor_min, height_indoor_max,
                height_outdoor_min, height_outdoor_max, climate_preference,
                aroma_profile, effects, medical_uses, growth_notes, created_at
    `, [
      req.user.id, strainName, breeder, geneticLineage,
      percentages?.indica, percentages?.sativa, percentages?.ruderalis,
      cannabinoids?.thc, cannabinoids?.cbd,
      timing?.flowering, timing?.harvest, difficulty,
      yield?.indoor, yield?.outdoor,
      height?.indoor?.min, height?.indoor?.max,
      height?.outdoor?.min, height?.outdoor?.max,
      climatePreference, aromaProfile, effects, medicalUses, growthNotes
    ]);

    const genetic = result.rows[0];

    res.status(201).json({
      message: 'Genetic created successfully',
      genetic: {
        id: genetic.id,
        strainName: genetic.strain_name,
        breeder: genetic.breeder,
        geneticLineage: genetic.genetic_lineage,
        percentages: {
          indica: parseFloat(genetic.indica_percentage),
          sativa: parseFloat(genetic.sativa_percentage),
          ruderalis: parseFloat(genetic.ruderalis_percentage)
        },
        cannabinoids: {
          thc: genetic.thc_content ? parseFloat(genetic.thc_content) : null,
          cbd: genetic.cbd_content ? parseFloat(genetic.cbd_content) : null
        },
        timing: {
          flowering: genetic.flowering_time,
          harvest: genetic.harvest_time
        },
        difficulty: genetic.difficulty_level,
        yield: {
          indoor: genetic.yield_indoor ? parseFloat(genetic.yield_indoor) : null,
          outdoor: genetic.yield_outdoor ? parseFloat(genetic.yield_outdoor) : null
        },
        height: {
          indoor: {
            min: genetic.height_indoor_min ? parseFloat(genetic.height_indoor_min) : null,
            max: genetic.height_indoor_max ? parseFloat(genetic.height_indoor_max) : null
          },
          outdoor: {
            min: genetic.height_outdoor_min ? parseFloat(genetic.height_outdoor_min) : null,
            max: genetic.height_outdoor_max ? parseFloat(genetic.height_outdoor_max) : null
          }
        },
        climatePreference: genetic.climate_preference,
        aromaProfile: genetic.aroma_profile,
        effects: genetic.effects,
        medicalUses: genetic.medical_uses,
        growthNotes: genetic.growth_notes,
        createdAt: genetic.created_at
      }
    });

  } catch (error) {
    console.error('Create genetic error:', error);
    res.status(500).json({ error: 'Failed to create genetic' });
  }
});

// Update genetic
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const geneticId = parseInt(req.params.id);
    const {
      strainName, breeder, geneticLineage, percentages, cannabinoids,
      timing, difficulty, yield, height, climatePreference, aromaProfile,
      effects, medicalUses, growthNotes
    } = req.body;

    // Build dynamic update query - only update fields that are provided
    const updateFields = [];
    const updateParams = [];
    let paramCount = 1;

    if (strainName !== undefined) {
      updateFields.push(`strain_name = $${paramCount++}`);
      updateParams.push(strainName);
    }
    if (breeder !== undefined) {
      updateFields.push(`breeder = $${paramCount++}`);
      updateParams.push(breeder);
    }
    if (geneticLineage !== undefined) {
      updateFields.push(`genetic_lineage = $${paramCount++}`);
      updateParams.push(geneticLineage);
    }
    if (percentages !== undefined) {
      if (percentages.indica !== undefined) {
        updateFields.push(`indica_percentage = $${paramCount++}`);
        updateParams.push(percentages.indica);
      }
      if (percentages.sativa !== undefined) {
        updateFields.push(`sativa_percentage = $${paramCount++}`);
        updateParams.push(percentages.sativa);
      }
      if (percentages.ruderalis !== undefined) {
        updateFields.push(`ruderalis_percentage = $${paramCount++}`);
        updateParams.push(percentages.ruderalis);
      }
    }
    if (cannabinoids !== undefined) {
      if (cannabinoids.thc !== undefined) {
        updateFields.push(`thc_content = $${paramCount++}`);
        updateParams.push(cannabinoids.thc);
      }
      if (cannabinoids.cbd !== undefined) {
        updateFields.push(`cbd_content = $${paramCount++}`);
        updateParams.push(cannabinoids.cbd);
      }
    }
    if (timing !== undefined) {
      if (timing.flowering !== undefined) {
        updateFields.push(`flowering_time = $${paramCount++}`);
        updateParams.push(timing.flowering);
      }
      if (timing.harvest !== undefined) {
        updateFields.push(`harvest_time = $${paramCount++}`);
        updateParams.push(timing.harvest);
      }
    }
    if (difficulty !== undefined) {
      updateFields.push(`difficulty_level = $${paramCount++}`);
      updateParams.push(difficulty);
    }
    if (yield !== undefined) {
      if (yield.indoor !== undefined) {
        updateFields.push(`yield_indoor = $${paramCount++}`);
        updateParams.push(yield.indoor);
      }
      if (yield.outdoor !== undefined) {
        updateFields.push(`yield_outdoor = $${paramCount++}`);
        updateParams.push(yield.outdoor);
      }
    }
    if (height !== undefined) {
      if (height.indoor?.min !== undefined) {
        updateFields.push(`height_indoor_min = $${paramCount++}`);
        updateParams.push(height.indoor.min);
      }
      if (height.indoor?.max !== undefined) {
        updateFields.push(`height_indoor_max = $${paramCount++}`);
        updateParams.push(height.indoor.max);
      }
      if (height.outdoor?.min !== undefined) {
        updateFields.push(`height_outdoor_min = $${paramCount++}`);
        updateParams.push(height.outdoor.min);
      }
      if (height.outdoor?.max !== undefined) {
        updateFields.push(`height_outdoor_max = $${paramCount++}`);
        updateParams.push(height.outdoor.max);
      }
    }
    if (climatePreference !== undefined) {
      updateFields.push(`climate_preference = $${paramCount++}`);
      updateParams.push(climatePreference);
    }
    if (aromaProfile !== undefined) {
      updateFields.push(`aroma_profile = $${paramCount++}`);
      updateParams.push(aromaProfile);
    }
    if (effects !== undefined) {
      updateFields.push(`effects = $${paramCount++}`);
      updateParams.push(effects);
    }
    if (medicalUses !== undefined) {
      updateFields.push(`medical_uses = $${paramCount++}`);
      updateParams.push(medicalUses);
    }
    if (growthNotes !== undefined) {
      updateFields.push(`growth_notes = $${paramCount++}`);
      updateParams.push(growthNotes);
    }

    // Only proceed if there are fields to update
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateParams.push(geneticId, req.user.id);

    const result = await query(`
      UPDATE genetics 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount++} AND user_id = $${paramCount}
      RETURNING id, strain_name, breeder, genetic_lineage, indica_percentage,
                sativa_percentage, ruderalis_percentage, thc_content, cbd_content,
                flowering_time, harvest_time, difficulty_level, yield_indoor,
                yield_outdoor, height_indoor_min, height_indoor_max,
                height_outdoor_min, height_outdoor_max, climate_preference,
                aroma_profile, effects, medical_uses, growth_notes, updated_at
    `, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Genetic not found' });
    }

    const genetic = result.rows[0];

    res.json({
      message: 'Genetic updated successfully',
      genetic: {
        id: genetic.id,
        strainName: genetic.strain_name,
        breeder: genetic.breeder,
        geneticLineage: genetic.genetic_lineage,
        percentages: {
          indica: parseFloat(genetic.indica_percentage),
          sativa: parseFloat(genetic.sativa_percentage),
          ruderalis: parseFloat(genetic.ruderalis_percentage)
        },
        cannabinoids: {
          thc: genetic.thc_content ? parseFloat(genetic.thc_content) : null,
          cbd: genetic.cbd_content ? parseFloat(genetic.cbd_content) : null
        },
        timing: {
          flowering: genetic.flowering_time,
          harvest: genetic.harvest_time
        },
        difficulty: genetic.difficulty_level,
        yield: {
          indoor: genetic.yield_indoor ? parseFloat(genetic.yield_indoor) : null,
          outdoor: genetic.yield_outdoor ? parseFloat(genetic.yield_outdoor) : null
        },
        height: {
          indoor: {
            min: genetic.height_indoor_min ? parseFloat(genetic.height_indoor_min) : null,
            max: genetic.height_indoor_max ? parseFloat(genetic.height_indoor_max) : null
          },
          outdoor: {
            min: genetic.height_outdoor_min ? parseFloat(genetic.height_outdoor_min) : null,
            max: genetic.height_outdoor_max ? parseFloat(genetic.height_outdoor_max) : null
          }
        },
        climatePreference: genetic.climate_preference,
        aromaProfile: genetic.aroma_profile,
        effects: genetic.effects,
        medicalUses: genetic.medical_uses,
        growthNotes: genetic.growth_notes,
        updatedAt: genetic.updated_at
      }
    });

  } catch (error) {
    console.error('Update genetic error:', error);
    res.status(500).json({ error: 'Failed to update genetic' });
  }
});

// Delete genetic (soft delete)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const geneticId = parseInt(req.params.id);

    // Verify genetic exists and belongs to user
    const geneticCheck = await query(
      'SELECT id, strain_name FROM genetics WHERE id = $1 AND user_id = $2',
      [geneticId, req.user.id]
    );

    if (geneticCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Genetic not found' });
    }

    // Check if genetic is used in mother plants
    const mothersCheck = await query(
      'SELECT COUNT(*) as count FROM mothers WHERE genetic_id = $1 AND user_id = $2 AND is_active = true',
      [geneticId, req.user.id]
    );

    const motherCount = parseInt(mothersCheck.rows[0].count || 0);
    if (motherCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete genetic. It is currently used by ${motherCount} active mother plant(s). Please remove or deactivate the mother plants first.` 
      });
    }

    // Check if genetic is used in batches
    const batchesCheck = await query(
      'SELECT COUNT(*) as count FROM batches WHERE genetic_id = $1 AND user_id = $2 AND is_active = true',
      [geneticId, req.user.id]
    );

    const batchCount = parseInt(batchesCheck.rows[0].count || 0);
    if (batchCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete genetic. It is currently used by ${batchCount} active batch(es). Please remove or deactivate the batches first.` 
      });
    }

    // Check if genetic is used in plants
    const plantsCheck = await query(
      'SELECT COUNT(*) as count FROM plants WHERE genetic_id = $1 AND user_id = $2 AND is_active = true',
      [geneticId, req.user.id]
    );

    const plantCount = parseInt(plantsCheck.rows[0].count || 0);
    if (plantCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete genetic. It is currently used by ${plantCount} active plant(s). Please remove or deactivate the plants first.` 
      });
    }

    // Hard delete - permanently remove from database
    // Note: Related records will be handled by foreign key constraints:
    // - mothers, batches, plants: ON DELETE SET NULL (genetic_id will be set to NULL)
    const result = await query(`
      DELETE FROM genetics 
      WHERE id = $1 AND user_id = $2
      RETURNING id, strain_name
    `, [geneticId, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Genetic not found or already deleted' });
    }

    res.json({
      message: 'Genetic deleted successfully',
      genetic: result.rows[0]
    });

  } catch (error) {
    console.error('Delete genetic error:', error);
    res.status(500).json({ error: 'Failed to delete genetic' });
  }
});

// Get plants by genetic - cultivation endpoint
router.get('/:id/plants', authenticateToken, async (req, res) => {
  try {
    const geneticId = parseInt(req.params.id);

    // Verify genetic belongs to user
    const geneticCheck = await query(
      'SELECT id FROM genetics WHERE id = $1 AND user_id = $2',
      [geneticId, req.user.id]
    );

    if (geneticCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Genetic not found' });
    }

    const result = await query(`
      SELECT p.*, b.batch_name, r.name as room_name
      FROM plants p
      LEFT JOIN batches b ON p.batch_id = b.id
      LEFT JOIN rooms r ON p.room_id = r.id
      WHERE p.genetic_id = $1 AND p.user_id = $2 AND p.is_active = true
      ORDER BY p.growth_stage, p.plant_number ASC
    `, [geneticId, req.user.id]);

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
      room: plant.room_id ? {
        id: plant.room_id,
        name: plant.room_name
      } : null,
      plantingDate: plant.planting_date,
      height: plant.height,
      harvestDate: plant.harvest_date
    }));

    res.json(plants);
  } catch (error) {
    console.error('Get genetic plants error:', error);
    res.status(500).json({ error: 'Failed to fetch plants by genetic' });
  }
});

// Get batches by genetic - cultivation endpoint
router.get('/:id/batches', authenticateToken, async (req, res) => {
  try {
    const geneticId = parseInt(req.params.id);

    // Verify genetic belongs to user
    const geneticCheck = await query(
      'SELECT id FROM genetics WHERE id = $1 AND user_id = $2',
      [geneticId, req.user.id]
    );

    if (geneticCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Genetic not found' });
    }

    const result = await query(`
      SELECT b.*, m.mother_name, r.name as room_name
      FROM batches b
      LEFT JOIN mothers m ON b.mother_id = m.id
      LEFT JOIN rooms r ON b.room_id = r.id
      WHERE b.genetic_id = $1 AND b.user_id = $2 AND b.is_active = true
      ORDER BY b.created_at DESC
    `, [geneticId, req.user.id]);

    const batches = result.rows.map(batch => ({
      id: batch.id,
      batchName: batch.batch_name,
      batchType: batch.batch_type,
      mother: batch.mother_id ? {
        id: batch.mother_id,
        motherName: batch.mother_name
      } : null,
      room: batch.room_id ? {
        id: batch.room_id,
        name: batch.room_name
      } : null,
      totalSeeds: batch.total_seeds,
      totalClones: batch.total_clones,
      germinationRate: batch.germination_rate,
      successRate: batch.success_rate,
      sourceDate: batch.source_date,
      createdAt: batch.created_at
    }));

    res.json(batches);
  } catch (error) {
    console.error('Get genetic batches error:', error);
    res.status(500).json({ error: 'Failed to fetch batches by genetic' });
  }
});

// Get mothers by genetic - cultivation endpoint
router.get('/:id/mothers', authenticateToken, async (req, res) => {
  try {
    const geneticId = parseInt(req.params.id);

    // Verify genetic belongs to user
    const geneticCheck = await query(
      'SELECT id FROM genetics WHERE id = $1 AND user_id = $2',
      [geneticId, req.user.id]
    );

    if (geneticCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Genetic not found' });
    }

    const result = await query(`
      SELECT m.*, r.name as room_name
      FROM mothers m
      LEFT JOIN rooms r ON m.room_id = r.id
      WHERE m.genetic_id = $1 AND m.user_id = $2 AND m.is_active = true
      ORDER BY m.created_at DESC
    `, [geneticId, req.user.id]);

    const mothers = result.rows.map(mother => ({
      id: mother.id,
      motherName: mother.mother_name,
      room: mother.room_id ? {
        id: mother.room_id,
        name: mother.room_name
      } : null,
      cloneCount: mother.clone_count,
      ageDays: mother.age_days,
      healthStatus: mother.health_status,
      lastCloneDate: mother.last_clone_date,
      floweringCompatible: mother.flowering_compatible
    }));

    res.json(mothers);
  } catch (error) {
    console.error('Get genetic mothers error:', error);
    res.status(500).json({ error: 'Failed to fetch mothers by genetic' });
  }
});

// Get cultivation summary by genetic - cultivation endpoint
router.get('/:id/summary', authenticateToken, async (req, res) => {
  try {
    const geneticId = parseInt(req.params.id);

    // Verify genetic belongs to user
    const geneticCheck = await query(
      'SELECT id, strain_name, flowering_time, yield_indoor FROM genetics WHERE id = $1 AND user_id = $2',
      [geneticId, req.user.id]
    );

    if (geneticCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Genetic not found' });
    }

    const genetic = geneticCheck.rows[0];

    // Get plant statistics
    const plantsResult = await query(`
      SELECT
        COUNT(*) as total_plants,
        COUNT(CASE WHEN growth_stage = 'flowering' THEN 1 END) as flowering_plants,
        COUNT(CASE WHEN growth_stage = 'harvested' THEN 1 END) as harvested_plants,
        AVG(height) as avg_height,
        MAX(height) as max_height
      FROM plants
      WHERE genetic_id = $1 AND user_id = $2 AND is_active = true
    `, [geneticId, req.user.id]);

    const stats = plantsResult.rows[0];

    // Get batch statistics
    const batchesResult = await query(`
      SELECT
        COUNT(*) as total_batches,
        SUM(total_seeds) as total_seeds,
        SUM(total_clones) as total_clones,
        AVG(germination_rate) as avg_germination_rate
      FROM batches
      WHERE genetic_id = $1 AND user_id = $2 AND is_active = true
    `, [geneticId, req.user.id]);

    const batchStats = batchesResult.rows[0];

    res.json({
      genetic: {
        id: genetic.id,
        strainName: genetic.strain_name,
        floweringTime: genetic.flowering_time,
        yieldIndoor: genetic.yield_indoor
      },
      plants: {
        total: parseInt(stats.total_plants),
        flowering: parseInt(stats.flowering_plants),
        harvested: parseInt(stats.harvested_plants),
        avgHeight: stats.avg_height ? parseFloat(stats.avg_height) : null,
        maxHeight: stats.max_height ? parseFloat(stats.max_height) : null
      },
      batches: {
        total: parseInt(batchStats.total_batches),
        totalSeeds: parseInt(batchStats.total_seeds || 0),
        totalClones: parseInt(batchStats.total_clones || 0),
        avgGerminationRate: batchStats.avg_germination_rate ? parseFloat(batchStats.avg_germination_rate) : null
      }
    });
  } catch (error) {
    console.error('Get genetic summary error:', error);
    res.status(500).json({ error: 'Failed to fetch genetic summary' });
  }
});

module.exports = router;
