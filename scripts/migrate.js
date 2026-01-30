const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');

const { query } = require('../config/database');

const migrationsDir = path.join(__dirname, '../migrations');

async function runMigrations() {
  try {
    console.log('Using migrations directory:', migrationsDir);
    console.log('🔄 Starting database migrations...');

    // Validate environment variables
    console.log('📋 Database Configuration:');
    console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`   Port: ${process.env.DB_PORT || 5432}`);
    console.log(`   Database: ${process.env.DB_NAME || 'cultivation_compass'}`);
    console.log(`   User: ${process.env.DB_USER || 'postgres'}`);
    console.log(`   Password: ${process.env.DB_PASSWORD ? '***set***' : '❌ NOT SET'}`);

    if (!process.env.DB_PASSWORD) {
      throw new Error('DB_PASSWORD is not set in .env file');
    }

    // Create migrations table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get executed migrations
    const executedResult = await query('SELECT filename FROM migrations ORDER BY filename');
    const executedMigrations = executedResult.rows.map(row => row.filename);

    // Get all migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedMigrations.includes(file)) {
        console.log(`📝 Running migration: ${file}`);

        const migrationSQL = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        await query(migrationSQL);

        // Record migration
        await query('INSERT INTO migrations (filename) VALUES ($1)', [file]);

        console.log(`✅ Migration completed: ${file}`);
      }
    }

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };
