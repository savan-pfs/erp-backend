const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { authValidation, validate } = require('../middleware/validation');
const { createNotification, createNotificationsForUsers } = require('../utils/notifications');
const { getUserRoles, getUserPermissions, getPrimaryRole } = require('../middleware/rbac-helpers');

const router = express.Router();

// Register user (regular user - requires organization_id)
router.post('/register', validate(authValidation.register), async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'farmer', organizationId } = req.body;

    // Prevent org_admin creation via regular signup
    if (role === 'org_admin' || role === 'admin') {
      return res.status(400).json({ 
        error: 'Organization admin signup must use /auth/register-org-admin endpoint' 
      });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const result = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role, organization_id, approval_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'APPROVED')
      RETURNING id, email, first_name, last_name, role, organization_id, created_at
    `, [email, passwordHash, firstName, lastName, phone, role, organizationId || null]);

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        organizationId: user.organization_id,
        createdAt: user.created_at
      },
      token
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Register Admin/Grower with organization creation
router.post('/register-org-admin', async (req, res) => {
  try {
    const {
      email,
      password,
      firstName,
      lastName,
      phone,
      organizationName,
      legalName,
      taxId,
      locationStateCode,
      locationCountryCode = 'US',
      description
    } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !organizationName) {
      return res.status(400).json({ 
        error: 'Email, password, first name, last name, and organization name are required' 
      });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if organization name already exists
    const existingOrg = await query('SELECT id FROM organizations WHERE name = $1', [organizationName]);
    if (existingOrg.rows.length > 0) {
      return res.status(400).json({ error: 'Organization with this name already exists' });
    }

    // Start transaction
    await query('BEGIN');

    try {
      // Hash password
      const passwordHash = await bcrypt.hash(password, 12);

      // Create organization with PENDING_APPROVAL status
      const orgResult = await query(`
        INSERT INTO organizations (
          name, legal_name, tax_id, description, 
          approval_status, location_state_code, location_country_code
        )
        VALUES ($1, $2, $3, $4, 'PENDING_APPROVAL', $5, $6)
        RETURNING id, name, approval_status
      `, [organizationName, legalName || null, taxId || null, description || null, 
          locationStateCode || null, locationCountryCode]);

      const organization = orgResult.rows[0];

      // Create user with org_admin role
      const userResult = await query(`
        INSERT INTO users (
          email, password_hash, first_name, last_name, phone, 
          role, organization_id, approval_status
        )
        VALUES ($1, $2, $3, $4, $5, 'org_admin', $6, 'APPROVED')
        RETURNING id, email, first_name, last_name, role, organization_id, created_at
      `, [email, passwordHash, firstName, lastName, phone || null, organization.id]);

      const user = userResult.rows[0];

      // Get org_admin role ID
      const roleResult = await query('SELECT id FROM roles WHERE name = $1', ['org_admin']);
      if (roleResult.rows.length === 0) {
        throw new Error('org_admin role not found');
      }
      const orgAdminRoleId = roleResult.rows[0].id;

      // Assign org_admin role to user
      await query(`
        INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
        VALUES ($1, $2, $3, true)
      `, [user.id, orgAdminRoleId, organization.id]);

      // Create organization signup record
      await query(`
        INSERT INTO organization_signups (
          organization_id, user_id, signup_data, status
        )
        VALUES ($1, $2, $3, 'PENDING')
      `, [
        organization.id,
        user.id,
        JSON.stringify({
          organizationName,
          legalName,
          taxId,
          locationStateCode,
          locationCountryCode,
          description
        })
      ]);

      // Get all Super Admin users to notify
      const superAdminResult = await query(`
        SELECT u.id
        FROM users u
        INNER JOIN user_roles ur ON u.id = ur.user_id
        INNER JOIN roles r ON ur.role_id = r.id
        WHERE r.name = 'super_admin' AND ur.is_active = true
      `);

      const superAdminIds = superAdminResult.rows.map(row => row.id);

      // Create notifications for Super Admins
      if (superAdminIds.length > 0) {
        await createNotificationsForUsers(superAdminIds, {
          type: 'alert',
          title: 'New Organization Signup',
          message: `Organization "${organizationName}" has signed up and is pending approval.`,
          entityType: 'organization',
          entityId: organization.id,
          metadata: {
            organizationName,
            userEmail: email,
            locationStateCode
          }
        });
      }

      // Commit transaction
      await query('COMMIT');

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
      );

      res.status(201).json({
        message: 'Organization and admin account created successfully. Pending Super Admin approval.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role,
          organizationId: user.organization_id
        },
        organization: {
          id: organization.id,
          name: organization.name,
          approvalStatus: organization.approval_status
        },
        token
      });

    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }

  } catch (error) {
    console.error('Organization admin registration error:', error);
    res.status(500).json({ error: 'Registration failed: ' + error.message });
  }
});

// Login user
router.post('/login', validate(authValidation.login), async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const result = await query(`
      SELECT id, email, password_hash, first_name, last_name, role, is_active
      FROM users 
      WHERE email = $1
    `, [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(401).json({ error: 'Account is deactivated' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Load user roles and permissions from RBAC system
    const roles = await getUserRoles(user.id, user.organization_id);
    const permissions = await getUserPermissions(user.id, user.organization_id);
    const primaryRole = await getPrimaryRole(user.id) || user.role;

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: primaryRole },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        full_name: `${user.first_name} ${user.last_name}`,
        role: primaryRole,
        roleNames: roles.map(r => r.name),
        roles: roles,
        permissions: permissions,
        organizationId: user.organization_id || null
      },
      token
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token
router.get('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query(`
      SELECT id, email, first_name, last_name, role, is_active, organization_id
      FROM users 
      WHERE id = $1 AND is_active = true
    `, [decoded.userId]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = result.rows[0];

    // Load user roles and permissions from RBAC system
    const roles = await getUserRoles(user.id, user.organization_id);
    const permissions = await getUserPermissions(user.id, user.organization_id);
    const primaryRole = await getPrimaryRole(user.id) || user.role;

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        full_name: `${user.first_name} ${user.last_name}`,
        role: primaryRole,
        roleNames: roles.map(r => r.name),
        roles: roles,
        permissions: permissions,
        organizationId: user.organization_id || null
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
