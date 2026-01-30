const { validateOperation } = require('../services/state-legality');

/**
 * Middleware to validate state legality before operations
 * Usage: checkLegality({ activity: 'CULTIVATION', licenseType: 'CULTIVATION' })
 */
function checkLegality(options = {}) {
  return async (req, res, next) => {
    try {
      // Super Admin bypasses legality checks
      if (req.user?.role === 'super_admin' || req.user?.roleNames?.includes('super_admin')) {
        return next();
      }

      // Get state code from request
      let stateCode = options.stateCode;
      if (!stateCode) {
        // Try to get from facility
        const facilityId = req.body?.facilityId || req.query?.facilityId || req.params?.facilityId;
        if (facilityId) {
          const facilityResult = await require('../config/database').query(`
            SELECT state_code FROM facilities WHERE id = $1
          `, [facilityId]);
          if (facilityResult.rows.length > 0) {
            stateCode = facilityResult.rows[0].state_code;
          }
        }
      }

      // Try to get from body/query/params
      if (!stateCode) {
        stateCode = req.body?.stateCode || req.query?.stateCode || req.params?.stateCode;
      }

      if (!stateCode) {
        return res.status(400).json({
          error: 'State code is required for legality validation'
        });
      }

      const activity = options.activity || req.body?.activity;
      const licenseType = options.licenseType || req.body?.licenseType;

      // Validate operation
      const validation = await validateOperation({
        stateCode,
        countryCode: options.countryCode || 'US',
        activity,
        organizationId: req.user?.organizationId,
        facilityId: req.body?.facilityId || req.query?.facilityId,
        licenseType
      });

      if (!validation.valid) {
        return res.status(403).json({
          error: 'Operation not allowed',
          details: validation.errors
        });
      }

      // Attach validation result to request
      req.legalityValidation = validation;

      next();
    } catch (error) {
      console.error('Legality check error:', error);
      return res.status(500).json({ error: 'Legality validation failed' });
    }
  };
}

module.exports = {
  checkLegality
};
