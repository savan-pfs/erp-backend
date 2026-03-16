/**
 * Clear local database: drops all tables in public schema.
 * Use when you want a fresh schema. Run "npm run migrate" after this to recreate tables.
 * Requires .env with DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (e.g. pgAdmin/PostgreSQL).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../config/database');

async function clearDatabase() {
  const client = await pool.connect();
  try {
    console.log('🗑️  Clearing local database...');
    console.log(`   Database: ${process.env.DB_NAME || 'passionfarms_db'}`);

    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public');
    await client.query('GRANT ALL ON SCHEMA public TO postgres');
    await client.query('GRANT ALL ON SCHEMA public TO public');

    console.log('✅ Database cleared. Run: npm run migrate');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

clearDatabase();
