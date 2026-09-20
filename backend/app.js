require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const { initDB, getDB } = require('./config/db');
const { ensureDirs } = require('./services/storageService');
const { authLimiter, apiLimiter } = require('./middleware/rateLimitMiddleware');

const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');
const toolRoutes = require('./routes/toolRoutes');
const pdfRoutes = require('./routes/pdfRoutes');
const editorRoutes = require('./routes/editorRoutes');
const optimizeRoutes = require('./routes/optimizeRoutes');
const convertRoutes = require('./routes/convertRoutes');
const advancedRoutes = require('./routes/advancedRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const securityRoutes = require('./routes/securityRoutes');
const optimizeController = require('./controllers/optimizeController');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload directories exist
ensureDirs();

// Configurable CORS Origin (configured before routes & with full methods)
const allowedOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: allowedOrigin === '*' ? true : allowedOrigin.split(',').map(o => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  })
);

// Security HTTP Headers with cross-origin support
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", "*"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "blob:"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "*"],
        connectSrc: ["*"],
        workerSrc: ["'self'", "blob:"],
        objectSrc: ["'self'", "blob:"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// Body Parsers with limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Apply Rate Limiters
app.use('/api/', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Serve static frontend assets (supports local monorepo and custom FRONTEND_DIR)
const FRONTEND_DIR = process.env.FRONTEND_DIR || path.join(__dirname, '../frontend');
if (fs.existsSync(FRONTEND_DIR)) {
  app.use(express.static(FRONTEND_DIR));
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/pdf', pdfRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/optimize', optimizeRoutes);
app.use('/api/convert', convertRoutes);
app.use('/api/advanced', advancedRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/security', securityRoutes);
app.get('/api/jobs/:jobId', optimizeController.getJobStatus);

// Comprehensive Health & Telemetry Endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'connected';
  let dbLatencyMs = 0;

  try {
    const start = Date.now();
    const pool = getDB();
    if (pool && typeof pool.query === 'function') {
      await pool.query('SELECT 1');
      dbLatencyMs = Date.now() - start;
    } else {
      dbStatus = 'in_memory_active';
    }
  } catch (err) {
    dbStatus = 'degraded_in_memory';
  }

  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    app: 'PDFForge',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs
    },
    system: {
      memory: {
        rssMb: (mem.rss / (1024 * 1024)).toFixed(2),
        heapUsedMb: (mem.heapUsed / (1024 * 1024)).toFixed(2),
        heapTotalMb: (mem.heapTotal / (1024 * 1024)).toFixed(2)
      },
      nodeVersion: process.version,
      platform: process.platform
    }
  });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[App Error]', err.stack || err.message || err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'An unexpected server error occurred.'
  });
});

// Start Server & Connect Database
async function startServer() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  🚀 PDFForge Server running at http://localhost:${PORT}`);
    console.log(`  📁 PDF Workspace: http://localhost:${PORT}/workspace.html`);
    console.log(`  🔐 Auth Portal:  http://localhost:${PORT}/auth.html`);
    console.log(`====================================================`);
  });
}

// Global Process Error Safeguards
process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection Safeguard]', reason ? (reason.stack || reason) : 'Unknown reason');
});

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception Safeguard]', err.stack || err);
});

if (require.main === module) {
  startServer();
}

module.exports = app;
