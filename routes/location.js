const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { query } = require('../config/database');
const axios = require('axios');

const router = express.Router();

// Detect user location (IP-based with browser fallback support)
// Public endpoint - no auth required (used during signup)
router.get('/detect', async (req, res) => {
  try {
    const { latitude, longitude } = req.query; // Browser geolocation coordinates

    // If browser coordinates provided, use them
    if (latitude && longitude) {
      // Reverse geocode to get state (using a free service)
      try {
        const geoResponse = await axios.get(`https://api.bigdatacloud.net/data/reverse-geocode-client`, {
          params: { latitude, longitude },
          timeout: 5000
        });

        const stateCode = geoResponse.data?.principalSubdivisionCode?.split('-')[1] || null;
        const countryCode = geoResponse.data?.countryCode || 'US';

        if (stateCode) {
          // Check legality
          const legalityResult = await query(`
            SELECT * FROM state_legality_rules
            WHERE state_code = $1 AND country_code = $2 AND is_active = true
            AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
            AND (expires_date IS NULL OR expires_date >= CURRENT_DATE)
          `, [stateCode, countryCode]);

          return res.json({
            source: 'browser_geolocation',
            stateCode,
            countryCode,
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            legality: legalityResult.rows[0] || null
          });
        }
      } catch (geoError) {
        console.error('Reverse geocoding error:', geoError);
        // Fall through to IP geolocation
      }
    }

    // Fallback to IP-based geolocation
    const clientIp = req.headers['x-forwarded-for']?.split(',')[0] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress ||
                     req.ip;

    try {
      // Use ip-api.com (free, no API key required)
      const ipResponse = await axios.get(`http://ip-api.com/json/${clientIp}`, {
        timeout: 5000
      });

      if (ipResponse.data.status === 'success') {
        const stateCode = ipResponse.data.regionCode || null;
        const countryCode = ipResponse.data.countryCode || 'US';

        if (stateCode) {
          // Check legality
          const legalityResult = await query(`
            SELECT * FROM state_legality_rules
            WHERE state_code = $1 AND country_code = $2 AND is_active = true
            AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
            AND (expires_date IS NULL OR expires_date >= CURRENT_DATE)
          `, [stateCode, countryCode]);

          return res.json({
            source: 'ip_geolocation',
            stateCode,
            countryCode,
            city: ipResponse.data.city,
            region: ipResponse.data.region,
            legality: legalityResult.rows[0] || null
          });
        }
      }
    } catch (ipError) {
      console.error('IP geolocation error:', ipError);
    }

    // If all methods fail, return error
    res.status(500).json({ 
      error: 'Unable to detect location',
      message: 'Please manually select your location'
    });

  } catch (error) {
    console.error('Location detection error:', error);
    res.status(500).json({ error: 'Failed to detect location' });
  }
});

// Check cannabis legality for a state
router.get('/legality/:stateCode', authenticateToken, async (req, res) => {
  try {
    const { stateCode } = req.params;
    const { countryCode = 'US' } = req.query;

    if (!stateCode || stateCode.length !== 2) {
      return res.status(400).json({ error: 'Invalid state code' });
    }

    const result = await query(`
      SELECT * FROM state_legality_rules
      WHERE state_code = $1 AND country_code = $2 AND is_active = true
      AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
      AND (expires_date IS NULL OR expires_date >= CURRENT_DATE)
      ORDER BY effective_date DESC NULLS LAST
      LIMIT 1
    `, [stateCode.toUpperCase(), countryCode.toUpperCase()]);

    if (result.rows.length === 0) {
      return res.json({
        stateCode: stateCode.toUpperCase(),
        countryCode: countryCode.toUpperCase(),
        cannabisLegal: false,
        cultivationAllowed: false,
        message: 'No legality information found for this state'
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Legality check error:', error);
    res.status(500).json({ error: 'Failed to check legality' });
  }
});

// Get all US states with legality status
// Public endpoint - no auth required (used during signup)
router.get('/states', async (req, res) => {
  try {
    const { countryCode = 'US' } = req.query;

    const result = await query(`
      SELECT 
        state_code,
        country_code,
        cannabis_legal,
        medical_legal,
        recreational_legal,
        cultivation_allowed,
        manufacturing_allowed,
        retail_allowed,
        home_grow_allowed,
        max_plants_per_household,
        license_required,
        notes,
        effective_date,
        expires_date
      FROM state_legality_rules
      WHERE country_code = $1 AND is_active = true
      AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
      AND (expires_date IS NULL OR expires_date >= CURRENT_DATE)
      ORDER BY state_code
    `, [countryCode.toUpperCase()]);

    res.json(result.rows);

  } catch (error) {
    console.error('Get states error:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
});

module.exports = router;
