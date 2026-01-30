require('dotenv').config();
const { Pool } = require('pg');

// Lazy pool creation to ensure env vars are loaded
let pool = null;

function getPool() {
  if (!pool) {
    // Ensure password is a string (handle undefined/null)
    const dbPassword = String(process.env.DB_PASSWORD || '');
    
    if (!dbPassword) {
      console.error('❌ DB_PASSWORD is not set in environment variables');
      console.error('Please check your .env file');
    }

    pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || 'cultivation_compass',
      user: process.env.DB_USER || 'postgres',
      password: dbPassword,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Set up event handlers after pool is created
    pool.on('connect', () => {
      console.log('🗄️  Connected to PostgreSQL database');
    });

    pool.on('error', (err) => {
      console.error('❌ Database connection error:', err);
    });
  }
  return pool;
}

module.exports = {
  query: (text, params) => getPool().query(text, params),
  get pool() { return getPool(); }
};
