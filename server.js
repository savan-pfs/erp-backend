const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const db = require('./config/database');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const organizationRoutes = require('./routes/organizations');
const facilityRoutes = require('./routes/facilities');
const farmRoutes = require('./routes/farms');
const cropRoutes = require('./routes/crops');
const geneticsRoutes = require('./routes/genetics');
const roomsRoutes = require('./routes/rooms');
const mothersRoutes = require('./routes/mothers');
const batchesRoutes = require('./routes/batches');
const plantsRoutes = require('./routes/plants');
const tasksRoutes = require('./routes/tasks');
const environmentalLogsRoutes = require('./routes/environmental-logs');
const feedingLogsRoutes = require('./routes/feeding-logs');
const ipmLogsRoutes = require('./routes/ipm-logs');
const harvestRoutes = require('./routes/harvest');
const inventoryRoutes = require('./routes/inventory');
const wasteManagementRoutes = require('./routes/waste-management');
const calendarRoutes = require('./routes/calendar');
const dashboardRoutes = require('./routes/dashboard');
const notificationsRoutes = require('./routes/notifications');
const documentRoutes = require('./routes/documents');
const licenseRoutes = require('./routes/licenses');
const batchLineageRoutes = require('./routes/batch-lineage');
const manufacturingRoutes = require('./routes/manufacturing');
const analyticsRoutes = require('./routes/analytics');
const locationRoutes = require('./routes/location');

const app = express();

// Trust proxy (needed for rate limiting behind nginx)
app.set('trust proxy', 1);

// Security middleware - Configured to allow cross-origin requests
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
    },
  },
}));

// Rate limiting: stricter in production, generous in development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// CORS: in production set FRONTEND_URL and restrict origins; in development allow all
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((u) => u.trim())
  : null;
app.use(cors({
  origin: function (origin, callback) {
    if (!allowedOrigins) {
      callback(null, true);
      return;
    }
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'x-organization-id', 'x-facility-id'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours - cache preflight requests
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/facilities', facilityRoutes);
app.use('/api/farms', farmRoutes);
app.use('/api/crops', cropRoutes);
app.use('/api/genetics', geneticsRoutes);
app.use('/api/rooms', roomsRoutes);
app.use('/api/mothers', mothersRoutes);
app.use('/api/batches', batchesRoutes);
app.use('/api/plants', plantsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/environmental-logs', environmentalLogsRoutes);
app.use('/api/feeding-logs', feedingLogsRoutes);
app.use('/api/ipm-logs', ipmLogsRoutes);
app.use('/api/harvest', harvestRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/waste-management', wasteManagementRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/licenses', licenseRoutes);
app.use('/api/batch-lineage', batchLineageRoutes);
app.use('/api/manufacturing', manufacturingRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/location', locationRoutes);
app.use('/api/roles', require('./routes/roles'));
app.use('/api/permissions', require('./routes/permissions'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/integrations', require('./routes/integrations'));
app.use('/api/system-settings', require('./routes/system-settings'));
app.use('/api/audit-logs', require('./routes/audit-logs'));
app.use('/api/database', require('./routes/database'));
app.use('/api/reports', require('./routes/reports'));

// Health check endpoint (includes DB connection test for pgAdmin/PostgreSQL)
app.get('/api/health', async (req, res) => {
  let dbStatus = 'unknown';
  try {
    await db.query('SELECT 1');
    dbStatus = 'connected';
  } catch (err) {
    dbStatus = 'error';
  }
  res.json({
    status: 'OK',
    message: 'Passion Farms ERP Backend is running',
    database: dbStatus,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3004;

// Start server and verify database connection (PostgreSQL/pgAdmin)
async function start() {
  try {
    await db.query('SELECT 1');
    console.log('✅ Database connected (PostgreSQL)');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('   Check .env: DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD');
  }
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌱 Passion Farms ERP Backend running on port ${PORT}`);
    console.log(`📊 Environment: ${process.env.NODE_ENV}`);
    console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
  });
}

start();

module.exports = app;
