const express = require('express');
const router = express.Router();
const { query } = require('../config/database');
const { authenticateToken, authorizeRole } = require('../middleware/auth');

// Get all roles (Global + Org specific)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { organizationId } = req.user;

        let sql = `
            SELECT r.*, 
                   COUNT(ur.user_id) as member_count,
                   (
                       SELECT COALESCE(json_agg(p.name), '[]')
                       FROM role_permissions rp
                       JOIN permissions p ON rp.permission_id = p.id
                       WHERE rp.role_id = r.id
                   ) as permissions
            FROM roles r
            LEFT JOIN user_roles ur ON r.id = ur.role_id AND (ur.organization_id = $1 OR ur.organization_id IS NULL)
            WHERE (r.organization_id = $1 OR r.organization_id IS NULL)
            AND r.is_active = true
        `;

        const params = [organizationId];

        // Search filter
        if (req.query.search) {
            sql += ` AND (r.name ILIKE $2 OR r.display_name ILIKE $2)`;
            params.push(`%${req.query.search}%`);
        }

        sql += ` GROUP BY r.id ORDER BY r.organization_id ASC, r.name ASC`; // System roles first (usually Null ID comes last or first depending on DB default, likely last if ASC, wait. NULLs sort depends. We want Global first?)

        const result = await query(sql, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ error: 'Failed to fetch roles' });
    }
});

// Get single role details
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const result = await query(`
            SELECT r.*, 
                   (
                       SELECT COALESCE(json_agg(json_build_object(
                           'id', p.id,
                           'name', p.name,
                           'resource_type', p.resource_type,
                           'action', p.action
                       )), '[]')
                       FROM role_permissions rp
                       JOIN permissions p ON rp.permission_id = p.id
                       WHERE rp.role_id = r.id
                   ) as permissions
            FROM roles r
            WHERE r.id = $1 AND (r.organization_id = $2 OR r.organization_id IS NULL)
        `, [id, organizationId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Role not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching role:', error);
        res.status(500).json({ error: 'Failed to fetch role details' });
    }
});

// Create new role
router.post('/', authenticateToken, authorizeRole(['Super Admin', 'Org Admin', 'super_admin', 'org_admin']), async (req, res) => {
    try {
        const { name, display_name, description, permissions } = req.body;
        const { organizationId } = req.user;

        if (!name || !display_name) {
            return res.status(400).json({ error: 'Name and Display Name are required' });
        }

        // Validate uniqueness within org
        // This is handled by DB constraint, but friendly check:
        const check = await query(`
            SELECT id FROM roles 
            WHERE name = $1 AND organization_id = $2
        `, [name, organizationId]);

        if (check.rows.length > 0) {
            return res.status(400).json({ error: 'Role with this name already exists in your organization' });
        }

        // Start transaction
        await query('BEGIN');

        const roleResult = await query(`
            INSERT INTO roles (name, display_name, description, organization_id, is_system_role)
            VALUES ($1, $2, $3, $4, false)
            RETURNING id, name, display_name, description, organization_id
        `, [name, display_name, description, organizationId]);

        const newRole = roleResult.rows[0];

        // Assign permissions
        if (permissions && Array.isArray(permissions) && permissions.length > 0) {
            // Check if permissions exist in permissions table by Name or ID? Usually ID is safer.
            // Assuming permissions array contains IDs or Names. Let's assume Names for easier UI, or IDs.
            // Let's assume IDs based on standard.

            for (const permId of permissions) {
                await query(`
                    INSERT INTO role_permissions (role_id, permission_id)
                    VALUES ($1, $2)
                    ON CONFLICT DO NOTHING
                `, [newRole.id, permId]);
            }
        }

        await query('COMMIT');
        res.status(201).json(newRole);

    } catch (error) {
        await query('ROLLBACK');
        console.error('Error creating role:', error);
        res.status(500).json({ error: 'Failed to create role' });
    }
});

// Update role
router.put('/:id', authenticateToken, authorizeRole(['Super Admin', 'Org Admin', 'super_admin', 'org_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { display_name, description, permissions } = req.body;
        const { organizationId } = req.user;

        // Verify role belongs to org (cannot edit Global roles unless Super Admin?)
        // Assuming Super Admin can edit Global, Org Admin can only edit their own.

        const roleCheck = await query('SELECT * FROM roles WHERE id = $1', [id]);
        if (roleCheck.rows.length === 0) return res.status(404).json({ error: 'Role not found' });

        const role = roleCheck.rows[0];

        if (role.is_system_role) {
            // System roles might be editable by Super Admin? Or forbidden?
            // Usually forbidden to change core system roles structure, maybe only permissions?
            // For now, allow Super Admin, deny Org Admin on System Roles.
            // Actually, if Org Admin tries to edit a System Role, they should probably CLONE it?
            // Let's block editing system roles for now.
            return res.status(403).json({ error: 'System roles cannot be modified' });
        }

        if (role.organization_id !== organizationId && role.organization_id !== null) {
            return res.status(403).json({ error: 'Cannot modify roles from another organization' });
        }

        // Check if user is Super Admin (support both formats)
        const isSuperAdmin = req.user.role === 'Super Admin' || 
                            req.user.role === 'super_admin' ||
                            req.user.roleNames?.includes('Super Admin') ||
                            req.user.roleNames?.includes('super_admin');
        
        if (role.organization_id === null && !isSuperAdmin) {
            return res.status(403).json({ error: 'Only Super Admin can modify global roles' });
        }

        await query('BEGIN');

        await query(`
            UPDATE roles 
            SET display_name = COALESCE($1, display_name), 
                description = COALESCE($2, description)
            WHERE id = $3
        `, [display_name, description, id]);

        if (permissions) {
            // Replace all permissions
            await query('DELETE FROM role_permissions WHERE role_id = $1', [id]);

            if (Array.isArray(permissions) && permissions.length > 0) {
                for (const permId of permissions) {
                    await query(`
                        INSERT INTO role_permissions (role_id, permission_id)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [id, permId]);
                }
            }
        }

        await query('COMMIT');
        res.json({ message: 'Role updated successfully' });

    } catch (error) {
        await query('ROLLBACK');
        console.error('Error updating role:', error);
        res.status(500).json({ error: 'Failed to update role' });
    }
});

// Delete role
router.delete('/:id', authenticateToken, authorizeRole(['Super Admin', 'Org Admin', 'super_admin', 'org_admin']), async (req, res) => {
    try {
        const { id } = req.params;
        const { organizationId } = req.user;

        const roleCheck = await query('SELECT * FROM roles WHERE id = $1', [id]);
        if (roleCheck.rows.length === 0) return res.status(404).json({ error: 'Role not found' });

        const role = roleCheck.rows[0];

        if (role.is_system_role) {
            return res.status(403).json({ error: 'Cannot delete system roles' });
        }

        // Check if user is Super Admin (support both formats)
        const isSuperAdmin = req.user.role === 'Super Admin' || 
                            req.user.role === 'super_admin' ||
                            req.user.roleNames?.includes('Super Admin') ||
                            req.user.roleNames?.includes('super_admin');
        
        if (role.organization_id !== organizationId && !isSuperAdmin) {
            return res.status(403).json({ error: 'Insufficient permissions to delete this role' });
        }

        // Check if assigned to users?
        // Constraint ON DELETE CASCADE in `user_roles` handle this? 
        // user_roles has REFERENCES roles(id) ON DELETE CASCADE. So it will remove user assignments.

        await query('DELETE FROM roles WHERE id = $1', [id]);

        res.json({ message: 'Role deleted successfully' });

    } catch (error) {
        console.error('Error deleting role:', error);
        res.status(500).json({ error: 'Failed to delete role' });
    }
});

module.exports = router;
