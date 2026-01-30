const { query } = require('../config/database');

/**
 * Middleware to check if user's organization has a valid license for an operation
 * Usage: checkLicense('CULTIVATION', 'CA')
 */
function checkLicense(licenseType, stateCodeSource = 'body') {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Super Admin bypasses license checks
      if (req.user.role === 'super_admin' || req.user.roleNames?.includes('super_admin')) {
        return next();
      }

      if (!req.user.organizationId) {
        return res.status(400).json({ error: 'User must belong to an organization' });
      }

      // Get state code from request (body, query, or params)
      let stateCode = null;
      if (stateCodeSource === 'body') {
        stateCode = req.body.stateCode || req.body.facility?.stateCode;
      } else if (stateCodeSource === 'query') {
        stateCode = req.query.stateCode;
      } else if (stateCodeSource === 'params') {
        stateCode = req.params.stateCode;
      } else if (stateCodeSource === 'facility') {
        // Get state code from facility
        const facilityId = req.body.facilityId || req.query.facilityId || req.params.facilityId;
        if (facilityId) {
          const facilityResult = await query(`
            SELECT state_code FROM facilities WHERE id = $1
          `, [facilityId]);
          if (facilityResult.rows.length > 0) {
            stateCode = facilityResult.rows[0].state_code;
          }
        }
      }

      if (!stateCode) {
        return res.status(400).json({ error: 'State code is required for license check' });
      }

      const facilityId = req.body.facilityId || req.query.facilityId || req.params.facilityId;

      // Check for valid active license
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
        SELECT l.id, l.license_number, l.status
        FROM licenses l
        ${whereClause}
        LIMIT 1
      `, queryParams);

      if (result.rows.length === 0) {
        return res.status(403).json({
          error: 'License required',
          message: `A valid ${licenseType} license is required for operations in ${stateCode}`,
          required: {
            licenseType,
            stateCode
          }
        });
      }

      // Attach license info to request for use in route handlers
      req.license = result.rows[0];

      next();
    } catch (error) {
      console.error('License check error:', error);
      return res.status(500).json({ error: 'License check failed' });
    }
  };
}

module.exports = {
  checkLicense
};
