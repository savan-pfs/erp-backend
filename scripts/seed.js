const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data
    await query('DELETE FROM crops');
    await query('DELETE FROM farms');
    await query('DELETE FROM users');
    console.log('🧹 Cleared existing data');

    // Create default admin user
    const hashedPassword = await bcrypt.hash('savan1234', 12);
    const userResult = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['savan@google.com', hashedPassword, 'Savan', 'Patel', '+91 98765 43210', 'admin']);

    const userId = userResult.rows[0].id;
    console.log('👤 Created admin user: savan@google.com');

    // Create sample farms
    const farmResult = await query(`
      INSERT INTO farms (user_id, name, description, location_address, latitude, longitude, total_area, soil_type, water_source)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9),
        ($1, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id
    `, [
      userId, 'Green Valley Farm', 'Main agricultural land with mixed crops', 
      'Near Ahmedabad, Gujarat', '23.0225', '72.5714', 5.5, 'Clay Loam', 'Well Water',
      userId, 'Sunshine Fields', 'Secondary farm for cash crops', 
      'Near Gandhinagar, Gujarat', '23.2156', '72.6369', 3.2, 'Sandy Loam', 'Canal Water'
    ]);

    console.log('🏡 Created sample farms');

    // Create sample crops
    await query(`
      INSERT INTO crops (farm_id, crop_name, variety, planting_date, expected_harvest_date, area_planted, planting_method, irrigation_method, growth_stage, health_status)
      VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10),
        ($1, $11, $12, $13, $14, $15, $16, $17, $18, $19),
        ($2, $20, $21, $22, $23, $24, $25, $26, $27, $28)
    `, [
      farmResult.rows[0].id, 'Wheat', 'GW-322', '2024-11-01', '2025-02-15', 2.5, 'Drill', 'Drip', 'vegetative', 'healthy',
      farmResult.rows[0].id, 'Cotton', 'Bt Cotton', '2024-10-15', '2025-03-20', 3.0, 'Broadcast', 'Flood', 'flowering', 'healthy',
      farmResult.rows[1].id, 'Rice', 'GR-4', '2024-06-01', '2024-10-15', 3.2, 'Transplant', 'Flood', 'harvested', 'healthy'
    ]);

    console.log('🌾 Created sample crops');

    // Create additional sample users
    const sampleUsers = [
      ['ramesh@farm.com', 'Ramesh', 'Patel', '+91 98765 11111', 'farmer'],
      ['expert@agri.com', 'Dr. Amit', 'Shah', '+91 98765 22222', 'expert']
    ];

    for (const [email, firstName, lastName, phone, role] of sampleUsers) {
      const password = await bcrypt.hash('password123', 12);
      await query(`
        INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [email, password, firstName, lastName, phone, role]);
    }

    console.log('👥 Created sample users');
    console.log('🎉 Database seeding completed successfully!');
    
    console.log('\n📋 Login Credentials:');
    console.log('🔑 Admin: savan@google.com / savan1234');
    console.log('🔑 Farmer: ramesh@farm.com / password123');
    console.log('🔑 Expert: expert@agri.com / password123');

  } catch (error) {
    console.error('❌ Seeding error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
