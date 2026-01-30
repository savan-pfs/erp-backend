const express = require('express');
const bcrypt = require('bcryptjs');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permissions');
const { query } = require('../config/database');
const { createNotification } = require('../utils/notifications');
const { getUserRoles, getUserPermissions } = require('../middleware/rbac-helpers');

const router = express.Router();

// Get user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await query(`
      SELECT id, email, first_name, last_name, phone, role, is_active, created_at, updated_at
      FROM users 
      WHERE id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      isActive: user.is_active,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const result = await query(`
      UPDATE users 
      SET first_name = $1, last_name = $2, phone = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING id, email, first_name, last_name, phone, role, updated_at
    `, [firstName, lastName, phone, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone,
        role: user.role,
        updatedAt: user.updated_at
      }
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get all users (filtered by organization for Admin/Grower, all for Super Admin)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.role === 'Super Admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    let result;
    if (isSuperAdmin) {
      // Super Admin can see all users, optionally filtered by organization
      const { organizationId } = req.query;

      let queryText = `
        SELECT 
          u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
          u.is_active, u.approval_status, u.organization_id, u.created_at,
          o.name as organization_name,
          array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as role_names,
          array_agg(DISTINCT r.id) FILTER (WHERE r.id IS NOT NULL) as role_ids
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
      `;

      const queryParams = [];
      if (organizationId) {
        queryText += ` WHERE u.organization_id = $1 `;
        queryParams.push(organizationId);
      }

      queryText += `
        GROUP BY u.id, u.email, u.first_name, u.last_name, u.phone, u.role, 
                 u.is_active, u.approval_status, u.organization_id, u.created_at, o.name
        ORDER BY u.created_at DESC
      `;

      result = await query(queryText, queryParams);
    } else if (req.user.organizationId) {
      // Admin/Grower can only see users in their organization
      result = await query(`
        SELECT 
          u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
          u.is_active, u.approval_status, u.organization_id, u.created_at,
          array_agg(DISTINCT r.name) FILTER (WHERE r.name IS NOT NULL) as role_names,
          array_agg(DISTINCT r.id) FILTER (WHERE r.id IS NOT NULL) as role_ids
        FROM users u
        LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
        LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
        WHERE u.organization_id = $1
        GROUP BY u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
                 u.is_active, u.approval_status, u.organization_id, u.created_at
        ORDER BY u.created_at DESC
      `, [req.user.organizationId]);
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }

    const users = result.rows.map(user => ({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      roleNames: user.role_names || [],
      roleIds: user.role_ids || [],
      isActive: user.is_active,
      approvalStatus: user.approval_status,
      organizationId: user.organization_id,
      organizationName: user.organization_name,
      createdAt: user.created_at
    }));

    res.json(users);

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    // Check access
    if (!isSuperAdmin && userId !== req.user.id) {
      // Check if user is in same organization
      const userCheck = await query(`
        SELECT organization_id FROM users WHERE id = $1
      `, [userId]);

      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (userCheck.rows[0].organization_id !== req.user.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
        u.is_active, u.approval_status, u.organization_id, u.created_at,
        o.name as organization_name
      FROM users u
      LEFT JOIN organizations o ON u.organization_id = o.id
      WHERE u.id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];
    const roles = await getUserRoles(userId, user.organization_id);
    const permissions = await getUserPermissions(userId, user.organization_id);

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
      role: user.role,
      roles: roles,
      roleIds: roles.map(r => r.id),
      roleNames: roles.map(r => r.name),
      permissions: permissions,
      isActive: user.is_active,
      approvalStatus: user.approval_status,
      organizationId: user.organization_id,
      organizationName: user.organization_name,
      createdAt: user.created_at
    });

  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create user (Admin/Grower or Super Admin)
router.post('/', authenticateToken, requirePermission('user:create'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role, roleIds } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'Email, password, first name, and last name are required' });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Determine organization_id
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');
    const organizationId = req.body.organizationId || req.user.organizationId;

    if (!organizationId && !isSuperAdmin) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Check access - Admin/Grower can only create users in their organization
    if (!isSuperAdmin && organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const userResult = await query(`
      INSERT INTO users (
        email, password_hash, first_name, last_name, phone, 
        role, organization_id, approval_status, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'APPROVED', $8)
      RETURNING id, email, first_name, last_name, role, organization_id, created_at
    `, [email, passwordHash, firstName, lastName, phone || null, role || 'farmer', organizationId, req.user.id]);

    const user = userResult.rows[0];

    // Assign roles if provided
    if (roleIds && Array.isArray(roleIds) && roleIds.length > 0) {
      for (const roleId of roleIds) {
        await query(`
          INSERT INTO user_roles (user_id, role_id, organization_id, granted_by, is_active)
          VALUES ($1, $2, $3, $4, true)
          ON CONFLICT (user_id, role_id, organization_id) DO NOTHING
        `, [user.id, roleId, organizationId, req.user.id]);
      }
    }

    // Send welcome notification
    await createNotification({
      userId: user.id,
      type: 'success',
      title: 'Welcome!',
      message: `Your account has been created. You can now log in with your email and password.`,
      entityType: 'user',
      entityId: user.id
    });

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        organizationId: user.organization_id
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/:id', authenticateToken, requirePermission('user:update'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { firstName, lastName, phone, role, roleIds, isActive } = req.body;

    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    // Check access
    if (!isSuperAdmin && userId !== req.user.id) {
      const userCheck = await query('SELECT organization_id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (userCheck.rows[0].organization_id !== req.user.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (firstName !== undefined) {
      updates.push(`first_name = $${paramCount++}`);
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push(`last_name = $${paramCount++}`);
      values.push(lastName);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (role !== undefined) {
      updates.push(`role = $${paramCount++}`);
      values.push(role);
    }
    if (isActive !== undefined && isSuperAdmin) {
      updates.push(`is_active = $${paramCount++}`);
      values.push(isActive);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const result = await query(`
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, first_name, last_name, phone, role, is_active, organization_id
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update roles if provided
    if (roleIds && Array.isArray(roleIds)) {
      // Get organization_id for role assignment
      const orgResult = await query('SELECT organization_id FROM users WHERE id = $1', [userId]);
      const orgId = orgResult.rows[0]?.organization_id;

      // Remove existing roles (except super_admin)
      await query(`
        UPDATE user_roles
        SET is_active = false
        WHERE user_id = $1 AND organization_id = $2
      `, [userId, orgId]);

      // Add new roles
      for (const roleId of roleIds) {
        await query(`
          INSERT INTO user_roles (user_id, role_id, organization_id, granted_by, is_active)
          VALUES ($1, $2, $3, $4, true)
          ON CONFLICT (user_id, role_id, organization_id) 
          DO UPDATE SET is_active = true, granted_by = $4
        `, [userId, roleId, orgId, req.user.id]);
      }
    }

    res.json({
      message: 'User updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Deactivate user
router.delete('/:id', authenticateToken, requirePermission('user:delete'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    // Check access
    if (!isSuperAdmin) {
      const userCheck = await query('SELECT organization_id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (userCheck.rows[0].organization_id !== req.user.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const result = await query(`
      UPDATE users 
      SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, email, first_name, last_name
    `, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User deactivated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    console.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Reset user password
router.post('/:id/reset-password', authenticateToken, requirePermission('user:update'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    // Check access
    if (!isSuperAdmin && userId !== req.user.id) {
      const userCheck = await query('SELECT organization_id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (userCheck.rows[0].organization_id !== req.user.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    const result = await query(`
      UPDATE users 
      SET password_hash = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email
    `, [passwordHash, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Notify user
    await createNotification({
      userId: userId,
      type: 'info',
      title: 'Password Reset',
      message: 'Your password has been reset by an administrator.',
      entityType: 'user',
      entityId: userId
    });

    res.json({
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Get user permissions
router.get('/:id/permissions', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const isSuperAdmin = req.user.role === 'super_admin' ||
      req.user.roleNames?.includes('super_admin') ||
      req.user.roleNames?.includes('Super Admin');

    // Check access
    if (!isSuperAdmin && userId !== req.user.id) {
      const userCheck = await query('SELECT organization_id FROM users WHERE id = $1', [userId]);
      if (userCheck.rows.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      if (userCheck.rows[0].organization_id !== req.user.organizationId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const roles = await getUserRoles(userId);
    const permissions = await getUserPermissions(userId);

    res.json({
      userId,
      roles,
      permissions
    });

  } catch (error) {
    console.error('Get user permissions error:', error);
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

module.exports = router;
