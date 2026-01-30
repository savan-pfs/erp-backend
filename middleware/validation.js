const Joi = require('joi');

const authValidation = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]+$/).optional(),
    role: Joi.string().valid('admin', 'farmer', 'expert').default('farmer')
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
};

const farmValidation = {
  create: Joi.object({
    name: Joi.string().min(2).max(255).required(),
    description: Joi.string().max(500).optional(),
    locationAddress: Joi.string().max(500).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    totalArea: Joi.number().positive().required(),
    soilType: Joi.string().max(100).optional(),
    waterSource: Joi.string().max(100).optional(),
    ownershipType: Joi.string().valid('owned', 'rented', 'leased').default('owned')
  }),

  update: Joi.object({
    name: Joi.string().min(2).max(255).optional(),
    description: Joi.string().max(500).optional(),
    locationAddress: Joi.string().max(500).optional(),
    latitude: Joi.number().min(-90).max(90).optional(),
    longitude: Joi.number().min(-180).max(180).optional(),
    totalArea: Joi.number().positive().optional(),
    soilType: Joi.string().max(100).optional(),
    waterSource: Joi.string().max(100).optional(),
    ownershipType: Joi.string().valid('owned', 'rented', 'leased').optional()
  })
};

const cropValidation = {
  create: Joi.object({
    farmId: Joi.number().integer().positive().required(),
    cropName: Joi.string().min(2).max(100).required(),
    variety: Joi.string().max(100).optional(),
    plantingDate: Joi.date().optional(),
    expectedHarvestDate: Joi.date().optional(),
    actualHarvestDate: Joi.date().optional(),
    areaPlanted: Joi.number().positive().required(),
    plantingMethod: Joi.string().max(50).optional(),
    irrigationMethod: Joi.string().max(50).optional(),
    fertilizerUsed: Joi.string().max(500).optional(),
    pesticideUsed: Joi.string().max(500).optional(),
    growthStage: Joi.string().valid('planned', 'planted', 'germinated', 'vegetative', 'flowering', 'fruiting', 'harvested', 'failed').default('planned'),
    healthStatus: Joi.string().valid('healthy', 'stressed', 'diseased', 'pest_damage', 'drought_stress', 'nutrient_deficient').default('healthy'),
    notes: Joi.string().max(1000).optional()
  }),

  update: Joi.object({
    cropName: Joi.string().min(2).max(100).optional(),
    variety: Joi.string().max(100).optional(),
    plantingDate: Joi.date().optional(),
    expectedHarvestDate: Joi.date().optional(),
    actualHarvestDate: Joi.date().optional(),
    areaPlanted: Joi.number().positive().optional(),
    plantingMethod: Joi.string().max(50).optional(),
    irrigationMethod: Joi.string().max(50).optional(),
    fertilizerUsed: Joi.string().max(500).optional(),
    pesticideUsed: Joi.string().max(500).optional(),
    growthStage: Joi.string().valid('planned', 'planted', 'germinated', 'vegetative', 'flowering', 'fruiting', 'harvested', 'failed').optional(),
    healthStatus: Joi.string().valid('healthy', 'stressed', 'diseased', 'pest_damage', 'drought_stress', 'nutrient_deficient').optional(),
    notes: Joi.string().max(1000).optional()
  })
};

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    next();
  };
};

module.exports = {
  authValidation,
  farmValidation,
  cropValidation,
  validate
};
