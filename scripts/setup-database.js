require('dotenv').config();
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const { query, pool } = require('../config/database');

async function createDatabase() {
  try {
    console.log('📦 Creating database if it does not exist...');
    
    // Connect to postgres database to create the target database
    const createDbPool = new (require('pg').Pool)({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: 'postgres', // Connect to default postgres database
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
    });

    const dbName = process.env.DB_NAME || 'passionfarms_db';
    
    // Check if database exists
    const checkDbQuery = `
      SELECT 1 FROM pg_database WHERE datname = $1
    `;
    
    const result = await createDbPool.query(checkDbQuery, [dbName]);
    
    if (result.rows.length === 0) {
      // Database doesn't exist, create it
      console.log(`   Creating database: ${dbName}`);
      await createDbPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database '${dbName}' created successfully!`);
    } else {
      console.log(`✅ Database '${dbName}' already exists.`);
    }
    
    await createDbPool.end();
    return true;
  } catch (error) {
    console.error('❌ Error creating database:', error.message);
    throw error;
  }
}

async function testConnection() {
  try {
    console.log('\n🔌 Testing database connection...');
    
    const dbName = process.env.DB_NAME || 'passionfarms_db';
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || 5432;
    const dbUser = process.env.DB_USER || 'postgres';
    
    console.log(`   Host: ${dbHost}`);
    console.log(`   Port: ${dbPort}`);
    console.log(`   Database: ${dbName}`);
    console.log(`   User: ${dbUser}`);
    
    // Test connection by running a simple query
    const result = await query('SELECT NOW() as current_time, version() as pg_version');
    
    if (result.rows && result.rows.length > 0) {
      console.log('✅ Database connection successful!');
      console.log(`   PostgreSQL Version: ${result.rows[0].pg_version.split(',')[0]}`);
      console.log(`   Current Time: ${result.rows[0].current_time}`);
      return true;
    } else {
      throw new Error('Connection test returned no results');
    }
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🚀 Starting database setup process...\n');
    
    // Step 1: Create database
    await createDatabase();
    
    // Step 2: Test connection
    await testConnection();
    
    console.log('\n✅ Database setup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run migrations: npm run migrate');
    console.log('   2. Run seeding: npm run seed:full');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { createDatabase, testConnection };
