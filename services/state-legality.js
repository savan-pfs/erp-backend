const { query } = require('../config/database');

/**
 * State Legality Service
 * Validates cannabis operations against state legality rules
 */

/**
 * Check if cannabis is legal in a state
 */
async function isCannabisLegal(stateCode, countryCode = 'US') {
  try {
    const result = await query(`
      SELECT cannabis_legal, medical_legal, recreational_legal
      FROM state_legality_rules
      WHERE state_code = $1
        AND country_code = $2
        AND is_active = true
        AND (expires_date IS NULL OR expires_date > CURRENT_DATE)
        AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
      ORDER BY effective_date DESC
      LIMIT 1
    `, [stateCode, countryCode]);

    if (result.rows.length === 0) {
      return {
        legal: false,
        reason: 'State legality rules not found'
      };
    }

    const rules = result.rows[0];
    return {
      legal: rules.cannabis_legal,
      medical: rules.medical_legal,
      recreational: rules.recreational_legal,
      rules
    };
  } catch (error) {
    console.error('Error checking cannabis legality:', error);
    return {
      legal: false,
      reason: 'Error checking legality'
    };
  }
}

/**
 * Check if an activity is allowed in a state
 */
async function isActivityAllowed(stateCode, activity, countryCode = 'US') {
  try {
    const result = await query(`
      SELECT cultivation_allowed, manufacturing_allowed, retail_allowed
      FROM state_legality_rules
      WHERE state_code = $1
        AND country_code = $2
        AND is_active = true
        AND (expires_date IS NULL OR expires_date > CURRENT_DATE)
        AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
      ORDER BY effective_date DESC
      LIMIT 1
    `, [stateCode, countryCode]);

    if (result.rows.length === 0) {
      return {
        allowed: false,
        reason: 'State legality rules not found'
      };
    }

    const rules = result.rows[0];
    let allowed = false;

    switch (activity.toUpperCase()) {
      case 'CULTIVATION':
        allowed = rules.cultivation_allowed;
        break;
      case 'MANUFACTURING':
        allowed = rules.manufacturing_allowed;
        break;
      case 'RETAIL':
        allowed = rules.retail_allowed;
        break;
      default:
        return {
          allowed: false,
          reason: `Unknown activity: ${activity}`
        };
    }

    return {
      allowed,
      reason: allowed ? null : `${activity} is not allowed in ${stateCode}`
    };
  } catch (error) {
    console.error('Error checking activity legality:', error);
    return {
      allowed: false,
      reason: 'Error checking activity legality'
    };
  }
}

/**
 * Check if license is required for an activity
 */
async function isLicenseRequired(stateCode, activity, countryCode = 'US') {
  try {
    const result = await query(`
      SELECT license_required
      FROM state_legality_rules
      WHERE state_code = $1
        AND country_code = $2
        AND is_active = true
        AND (expires_date IS NULL OR expires_date > CURRENT_DATE)
        AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
      ORDER BY effective_date DESC
      LIMIT 1
    `, [stateCode, countryCode]);

    if (result.rows.length === 0) {
      return {
        required: true, // Default to required if rules not found
        reason: 'State legality rules not found - assuming license required'
      };
    }

    return {
      required: result.rows[0].license_required,
      reason: result.rows[0].license_required ? null : 'License not required for this activity'
    };
  } catch (error) {
    console.error('Error checking license requirement:', error);
    return {
      required: true, // Default to required on error
      reason: 'Error checking license requirement'
    };
  }
}

/**
 * Validate operation against state legality rules
 * This is the main validation function that checks all requirements
 */
async function validateOperation({
  stateCode,
  countryCode = 'US',
  activity,
  organizationId,
  facilityId = null,
  licenseType = null
}) {
  const errors = [];
  const warnings = [];

  // 1. Check if cannabis is legal in state
  const legalityCheck = await isCannabisLegal(stateCode, countryCode);
  if (!legalityCheck.legal) {
    errors.push({
      check: 'cannabis_legal',
      message: `Cannabis is not legal in ${stateCode}`,
      reason: legalityCheck.reason
    });
    return { valid: false, errors, warnings };
  }

  // 2. Check if activity is allowed
  if (activity) {
    const activityCheck = await isActivityAllowed(stateCode, activity, countryCode);
    if (!activityCheck.allowed) {
      errors.push({
        check: 'activity_allowed',
        message: activityCheck.reason,
        activity
      });
      return { valid: false, errors, warnings };
    }
  }

  // 3. Check if license is required and valid
  if (licenseType || activity) {
    const licenseCheck = await isLicenseRequired(stateCode, licenseType || activity, countryCode);
    if (licenseCheck.required && organizationId) {
      // Check if organization has valid license
      let licenseQuery = `
        SELECT l.id, l.status, l.effective_date, l.expires_date
        FROM licenses l
        WHERE l.organization_id = $1
          AND l.state_code = $2
          AND l.license_type = $3
          AND l.status = 'ACTIVE'
          AND l.is_active = true
          AND l.effective_date <= CURRENT_DATE
          AND (l.expires_date IS NULL OR l.expires_date > CURRENT_DATE)
      `;
      let licenseParams = [organizationId, stateCode, licenseType || activity];
      let paramCount = 4;

      if (facilityId) {
        licenseQuery += ` AND (l.facility_id = $${paramCount} OR l.facility_id IS NULL)`;
        licenseParams.push(facilityId);
      } else {
        licenseQuery += ` AND l.facility_id IS NULL`;
      }

      licenseQuery += ` ORDER BY l.facility_id NULLS LAST LIMIT 1`;

      const licenseResult = await query(licenseQuery, licenseParams);

      if (licenseResult.rows.length === 0) {
        errors.push({
          check: 'license_valid',
          message: `Valid ${licenseType || activity} license required for operations in ${stateCode}`,
          required: true
        });
        return { valid: false, errors, warnings };
      }
    }
  }

  return {
    valid: true,
    errors: [],
    warnings,
    legality: legalityCheck
  };
}

module.exports = {
  isCannabisLegal,
  isActivityAllowed,
  isLicenseRequired,
  validateOperation
};
