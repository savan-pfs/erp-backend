const { query } = require('../config/database');

async function fixSuperAdminRole() {
  try {
    console.log('Checking super admin user...');
    
    // Get super admin user
    const userResult = await query(`
      SELECT id, email, role, organization_id
      FROM users 
      WHERE email = 'superadmin@passionfarms.com'
    `);
    
    if (userResult.rows.length === 0) {
      console.log('Super admin user not found!');
      return;
    }
    
    const user = userResult.rows[0];
    console.log('Found user:', user);
    
    // Get Super Admin role
    const roleResult = await query(`
      SELECT id, name, display_name
      FROM roles 
      WHERE name = 'Super Admin' OR name = 'super_admin'
      ORDER BY name = 'Super Admin' DESC
      LIMIT 1
    `);
    
    if (roleResult.rows.length === 0) {
      console.log('Super Admin role not found in database!');
      return;
    }
    
    const role = roleResult.rows[0];
    console.log('Found role:', role);
    
    // Check if user already has this role
    const existingRoleResult = await query(`
      SELECT id, is_active
      FROM user_roles
      WHERE user_id = $1 AND role_id = $2
    `, [user.id, role.id]);
    
    if (existingRoleResult.rows.length > 0) {
      const existingRole = existingRoleResult.rows[0];
      if (existingRole.is_active) {
        console.log('Super Admin role already assigned and active!');
      } else {
        console.log('Super Admin role exists but is inactive. Activating...');
        await query(`
          UPDATE user_roles
          SET is_active = true
          WHERE user_id = $1 AND role_id = $2
        `, [user.id, role.id]);
        console.log('Role activated!');
      }
    } else {
      console.log('Assigning Super Admin role...');
      await query(`
        INSERT INTO user_roles (user_id, role_id, organization_id, is_active)
        VALUES ($1, $2, NULL, true)
        ON CONFLICT (user_id, role_id, organization_id, facility_id) 
        DO UPDATE SET is_active = true
      `, [user.id, role.id, null]);
      console.log('Role assigned!');
    }
    
    // Verify the assignment
    const verifyResult = await query(`
      SELECT r.name, r.display_name, ur.is_active
      FROM user_roles ur
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND ur.is_active = true
    `, [user.id]);
    
    console.log('\nUser roles after fix:');
    verifyResult.rows.forEach(row => {
      console.log(`  - ${row.display_name} (${row.name}) - Active: ${row.is_active}`);
    });
    
    console.log('\n✅ Super Admin role fixed successfully!');
    
  } catch (error) {
    console.error('Error fixing super admin role:', error);
  } finally {
    process.exit(0);
  }
}

fixSuperAdminRole();
