require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function seedDatabase() {
  try {
    console.log('🌱 Starting comprehensive database seeding...');

    // Clear existing data in correct order (respecting foreign keys)
    await query('DELETE FROM calendar_events');
    await query('DELETE FROM waste_logs');
    await query('DELETE FROM inventory');
    await query('DELETE FROM harvest_batches');
    await query('DELETE FROM ipm_logs');
    await query('DELETE FROM feeding_logs');
    await query('DELETE FROM environmental_logs');
    await query('DELETE FROM tasks');
    await query('DELETE FROM plants');
    await query('DELETE FROM batches');
    await query('DELETE FROM mothers');
    await query('DELETE FROM genetics');
    await query('DELETE FROM rooms');
    await query('DELETE FROM crops');
    await query('DELETE FROM farms');
    await query('DELETE FROM users');
    console.log('🧹 Cleared existing data');

    // Create users
    const hashedPassword = await bcrypt.hash('password123', 12);
    const userResult = await query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `, ['admin@passionfarms.com', hashedPassword, 'Admin', 'User', '+1 555-0100', 'admin']);

    const userId = userResult.rows[0].id;
    console.log('👤 Created admin user: admin@passionfarms.com / password123');

    // Create genetics
    const geneticsResult = await query(`
      INSERT INTO genetics (user_id, strain_name, breeder, genetic_lineage, indica_percentage, sativa_percentage, thc_content, cbd_content, flowering_time, yield_indoor, yield_outdoor)
      VALUES 
        ($1, 'Blue Dream', 'Unknown', 'Blueberry x Haze', 20, 80, 18.5, 0.2, 60, 500, 700),
        ($1, 'OG Kush', 'Unknown', 'Chemdawg x Hindu Kush', 75, 25, 20.0, 0.3, 55, 450, 600),
        ($1, 'Gelato', 'Cookie Fam', 'Sunset Sherbet x Thin Mint GSC', 55, 45, 22.0, 0.1, 58, 480, 650),
        ($1, 'Sour Diesel', 'Unknown', 'Chemdawg 91 x Super Skunk', 10, 90, 19.0, 0.2, 70, 500, 700)
      RETURNING id
    `, [userId]);

    const geneticIds = geneticsResult.rows.map(r => r.id);
    console.log('🧬 Created genetics strains');

    // Create rooms (room_type must match constraint: PROPAGATION, VEGETATIVE, FLOWERING, DRYING, CURING, etc.)
    const roomsResult = await query(`
      INSERT INTO rooms (user_id, name, description, room_type, capacity, current_plants, dimensions_length, dimensions_width, dimensions_height, temperature_min, temperature_max, humidity_min, humidity_max, lighting_type, ventilation_system, co2_system)
      VALUES 
        ($1, 'Flower Room A', 'Main flowering room', 'FLOWERING', 300, 280, 10.0, 8.0, 3.5, 20.0, 26.0, 40.0, 50.0, 'LED 1000W', true, true),
        ($1, 'Flower Room B', 'Secondary flowering', 'FLOWERING', 300, 250, 10.0, 8.0, 3.5, 20.0, 26.0, 40.0, 50.0, 'HPS 1000W', true, true),
        ($1, 'Veg Room 1', 'Vegetative growth', 'VEGETATIVE', 500, 420, 12.0, 10.0, 3.5, 22.0, 28.0, 50.0, 65.0, 'LED 600W', true, false),
        ($1, 'Veg Room 2', 'Additional veg space', 'VEGETATIVE', 400, 350, 10.0, 10.0, 3.5, 22.0, 28.0, 50.0, 65.0, 'LED 600W', true, false),
        ($1, 'Clone Room', 'Propagation area', 'PROPAGATION', 300, 250, 8.0, 6.0, 3.0, 24.0, 26.0, 70.0, 80.0, 'T5 Fluorescent', true, false),
        ($1, 'Drying Room', 'Post-harvest drying', 'DRYING', 0, 0, 6.0, 5.0, 3.0, 18.0, 20.0, 55.0, 60.0, 'None', true, false)
      RETURNING id
    `, [userId]);

    const roomIds = roomsResult.rows.map(r => r.id);
    console.log('🏢 Created rooms');

    // Create mother plants
    const mothersResult = await query(`
      INSERT INTO mothers (user_id, genetic_id, room_id, mother_name, age_days, last_clone_date, clone_count, health_status, notes)
      VALUES 
        ($1, $2, $3, 'Blue Dream Mother #1', 180, CURRENT_DATE - INTERVAL '7 days', 45, 'healthy', 'Strong and vigorous'),
        ($1, $4, $3, 'OG Kush Mother #1', 210, CURRENT_DATE - INTERVAL '5 days', 52, 'healthy', 'Excellent genetics'),
        ($1, $5, $3, 'Gelato Mother #1', 150, CURRENT_DATE - INTERVAL '10 days', 38, 'healthy', 'Beautiful structure')
      RETURNING id
    `, [userId, geneticIds[0], roomIds[4], geneticIds[1], geneticIds[2]]);

    const motherIds = mothersResult.rows.map(r => r.id);
    console.log('🌿 Created mother plants');

    // Create batches
    const batchesResult = await query(`
      INSERT INTO batches (user_id, batch_name, batch_type, genetic_id, mother_id, room_id, batch_number, current_stage, initial_count, current_count, start_date, expected_harvest_date, source_date, total_clones, germination_rate, success_rate, storage_location, notes, status)
      VALUES 
        ($1, 'Blue Dream Batch 001', 'clone', $2, $3, $4, 'B-2024-001', 'flowering', 160, 150, '2024-10-01', '2024-12-15', '2024-09-25', 160, 100, 93.75, 'Flower Room A', 'Day 45 of flower', 'active'),
        ($1, 'OG Kush Batch 002', 'clone', $5, $6, $7, 'B-2024-002', 'vegetative', 210, 200, '2024-10-15', '2025-01-10', '2024-10-10', 210, 100, 95.24, 'Veg Room 1', 'Day 28 of veg', 'active'),
        ($1, 'Gelato Batch 003', 'clone', $8, $9, $10, 'B-2024-003', 'clone', 105, 100, '2024-11-01', '2025-02-01', '2024-10-28', 105, 100, 95.24, 'Clone Room', 'Day 14 of clone', 'active'),
        ($1, 'Sour Diesel Batch 004', 'seed', $11, NULL, $12, 'B-2024-004', 'flowering', 140, 130, '2024-09-20', '2024-12-05', '2024-09-15', 0, 92.86, 92.86, 'Flower Room B', 'Day 56 of flower', 'active')
      RETURNING id
    `, [userId, geneticIds[0], motherIds[0], roomIds[0], geneticIds[1], motherIds[1], roomIds[2], geneticIds[2], motherIds[2], roomIds[4], geneticIds[3], roomIds[1]]);

    const batchIds = batchesResult.rows.map(r => r.id);
    console.log('📦 Created batches');

    // Create plants
    console.log('🌱 Creating plants...');
    const batchConfigs = [
      { batchId: batchIds[0], geneticId: geneticIds[0], roomId: roomIds[0], count: 10, stage: 'flowering', daysAgo: 30 },
      { batchId: batchIds[1], geneticId: geneticIds[1], roomId: roomIds[2], count: 10, stage: 'vegetative', daysAgo: 45 },
      { batchId: batchIds[2], geneticId: geneticIds[2], roomId: roomIds[4], count: 10, stage: 'seedling', daysAgo: 60 },
      { batchId: batchIds[3], geneticId: geneticIds[3], roomId: roomIds[1], count: 10, stage: 'flowering', daysAgo: 75 }
    ];

    for (const config of batchConfigs) {
      for (let j = 1; j <= config.count; j++) {
        await query(`
          INSERT INTO plants (user_id, batch_id, genetic_id, room_id, plant_number, growth_stage, health_status, planting_date, germination_date)
          VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE - INTERVAL '${config.daysAgo} days', CURRENT_DATE - INTERVAL '${config.daysAgo - 5} days')
        `, [userId, config.batchId, config.geneticId, config.roomId, j, config.stage, 'healthy']);
      }
    }
    console.log('🌱 Created sample plants');

    // Create tasks
    await query(`
      INSERT INTO tasks (user_id, title, description, task_type, priority, status, room_id, batch_id, due_date)
      VALUES 
        ($1, 'Water Flower Room A', 'Check and water plants in Flower Room A', 'watering', 'high', 'pending', $2, $3, CURRENT_DATE),
        ($1, 'Feed Veg Room 1', 'Apply nutrient solution EC 1.8', 'feeding', 'high', 'pending', $4, $5, CURRENT_DATE),
        ($1, 'Inspect for pests', 'Weekly IPM inspection', 'inspection', 'medium', 'pending', $2, NULL, CURRENT_DATE + INTERVAL '2 days'),
        ($1, 'Harvest Batch 004', 'Prepare for harvest - check trichomes', 'harvest', 'urgent', 'pending', $6, $7, CURRENT_DATE + INTERVAL '5 days'),
        ($1, 'Clone taking', 'Take 50 clones from mothers', 'general', 'medium', 'pending', $8, NULL, CURRENT_DATE + INTERVAL '3 days'),
        ($1, 'Clean drying room', 'Sanitize after previous batch', 'cleaning', 'low', 'completed', $9, NULL, CURRENT_DATE - INTERVAL '1 day')
    `, [userId, roomIds[0], batchIds[0], roomIds[2], batchIds[1], roomIds[1], batchIds[3], roomIds[4], roomIds[5]]);

    console.log('✅ Created tasks');

    // Create environmental logs
    const envLogInserts = [];
    for (let i = 0; i < roomIds.length - 1; i++) {  // Skip drying room
      for (let day = 0; day < 7; day++) {
        const temp = 22 + Math.random() * 4;
        const humidity = 45 + Math.random() * 20;
        envLogInserts.push(`($1, $${2 + i}, ${temp.toFixed(1)}, ${humidity.toFixed(1)}, ${(temp * 0.1 - humidity * 0.01).toFixed(2)}, ${Math.floor(800 + Math.random() * 600)}, ${Math.floor(600 + Math.random() * 400)}, 'Good', CURRENT_TIMESTAMP - INTERVAL '${day} days' - INTERVAL '${Math.floor(Math.random() * 24)} hours')`);
      }
    }

    if (envLogInserts.length > 0) {
      await query(`
        INSERT INTO environmental_logs (user_id, room_id, temperature, humidity, vpd, co2_level, light_intensity, air_circulation, recorded_at)
        VALUES ${envLogInserts.join(', ')}
      `, [userId, ...roomIds.slice(0, -1)]);
    }
    console.log('🌡️ Created environmental logs');

    // Create feeding logs
    await query(`
      INSERT INTO feeding_logs (user_id, room_id, batch_id, feeding_type, nutrient_name, nutrient_brand, ec_level, ph_level, ppm, volume, volume_unit, notes, fed_at)
      VALUES 
        ($1, $2, $3, 'nutrients', 'Bloom A+B', 'Advanced Nutrients', 2.2, 6.0, 1100, 200, 'L', 'Week 6 flowering feed', CURRENT_DATE - INTERVAL '1 day'),
        ($1, $4, $5, 'nutrients', 'Grow A+B', 'Advanced Nutrients', 1.8, 5.8, 900, 300, 'L', 'Veg growth formula', CURRENT_DATE - INTERVAL '2 days'),
        ($1, $2, $3, 'water', 'RO Water', NULL, 0.0, 6.5, 0, 150, 'L', 'Flush before harvest', CURRENT_DATE - INTERVAL '3 days')
    `, [userId, roomIds[0], batchIds[0], roomIds[2], batchIds[1]]);

    console.log('💧 Created feeding logs');

    // Create IPM logs
    await query(`
      INSERT INTO ipm_logs (user_id, room_id, batch_id, issue_type, pest_name, severity, treatment_method, product_used, application_method, notes, detected_at, treated_at)
      VALUES 
        ($1, $2, $3, 'pest', 'Spider Mites', 'low', 'Biological', 'Predatory Mites', 'Release', 'Preventive treatment', CURRENT_DATE - INTERVAL '10 days', CURRENT_DATE - INTERVAL '10 days'),
        ($1, $4, $5, 'deficiency', 'Nitrogen Deficiency', 'medium', 'Nutrient Adjustment', 'Increased N', 'Foliar', 'Yellowing lower leaves', CURRENT_DATE - INTERVAL '5 days', CURRENT_DATE - INTERVAL '4 days')
    `, [userId, roomIds[0], batchIds[0], roomIds[2], batchIds[1]]);

    console.log('🐛 Created IPM logs');

    // Create harvest batches
    await query(`
      INSERT INTO harvest_batches (user_id, batch_id, room_id, harvest_name, harvest_date, plant_count, wet_weight, dry_weight, weight_unit, drying_method, drying_start_date, storage_location, quality_grade, status, notes)
      VALUES 
        ($1, $2, $3, 'Blue Dream Harvest Oct 2024', '2024-10-20', 150, 45000, 11250, 'g', 'Hang Dry', '2024-10-20', 'Drying Room', 'A', 'curing', 'Excellent quality')
    `, [userId, batchIds[0], roomIds[5]]);

    console.log('🌾 Created harvest batches');

    // Create inventory
    await query(`
      INSERT INTO inventory (user_id, genetic_id, lot_number, item_type, item_name, quantity, unit, location, package_date, status, notes)
      VALUES 
        ($1, $2, 'LOT-2024-001', 'flower', 'Blue Dream Premium Flower', 10000, 'g', 'Vault A1', '2024-11-01', 'available', 'Cured 2 weeks'),
        ($1, $2, 'LOT-2024-002', 'trim', 'Blue Dream Trim', 2500, 'g', 'Vault A2', '2024-11-01', 'available', 'For extraction'),
        ($1, $3, 'LOT-2024-003', 'seeds', 'OG Kush Seeds', 500, 'units', 'Seed Storage', '2024-10-01', 'available', 'F1 generation')
    `, [userId, geneticIds[0], geneticIds[1]]);

    console.log('📦 Created inventory items');

    // Create waste logs
    await query(`
      INSERT INTO waste_logs (user_id, room_id, batch_id, waste_type, reason, quantity, unit, disposal_method, disposed_by, compliance_notes, disposed_at)
      VALUES 
        ($1, $2, $3, 'trim', 'Post-harvest trim waste', 3500, 'g', 'Compost', $1, 'Documented and witnessed', CURRENT_DATE - INTERVAL '5 days'),
        ($1, $4, $5, 'plant_material', 'Dead/diseased plants removed', 1200, 'g', 'Biohazard disposal', $1, 'Quarantined material', CURRENT_DATE - INTERVAL '8 days')
    `, [userId, roomIds[0], batchIds[0], roomIds[2], batchIds[1]]);

    console.log('🗑️ Created waste logs');

    // Create calendar events
    await query(`
      INSERT INTO calendar_events (user_id, title, description, event_type, room_id, batch_id, start_date, end_date, all_day, priority, status)
      VALUES 
        ($1, 'Harvest Batch 004', 'Final harvest window', 'harvest', $2, $3, CURRENT_DATE + INTERVAL '5 days', CURRENT_DATE + INTERVAL '5 days', true, 'high', 'scheduled'),
        ($1, 'Weekly Team Meeting', 'Discuss cultivation progress', 'meeting', NULL, NULL, CURRENT_DATE + INTERVAL '2 days 10:00', CURRENT_DATE + INTERVAL '2 days 11:00', false, 'medium', 'scheduled'),
        ($1, 'Nutrient Change - Flower Rooms', 'Switch to ripening formula', 'feeding', $2, $3, CURRENT_DATE + INTERVAL '7 days', CURRENT_DATE + INTERVAL '7 days', true, 'high', 'scheduled')
    `, [userId, roomIds[0], batchIds[0]]);

    console.log('📅 Created calendar events');

    console.log('\n🎉 Comprehensive database seeding completed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('🔑 Email: admin@passionfarms.com');
    console.log('🔑 Password: password123');
    console.log('\n📊 Summary:');
    console.log(`   - Genetics: ${geneticIds.length}`);
    console.log(`   - Rooms: ${roomIds.length}`);
    console.log(`   - Mother Plants: ${motherIds.length}`);
    console.log(`   - Batches: ${batchIds.length}`);
    console.log(`   - Plants: 200+ sample plants`);
    console.log(`   - Tasks: 6 tasks`);
    console.log(`   - Environmental logs: 35+ readings`);
    console.log(`   - And much more data across all tables!`);

  } catch (error) {
    console.error('❌ Seeding error:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase().then(() => {
    console.log('\n✨ Seeding process finished!');
    process.exit(0);
  });
}

module.exports = { seedDatabase };
