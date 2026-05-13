// Load environment variables first
require('dotenv').config();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const SocketHandler = require('./socket/socketHandler');
const { appConfig } = require('./config/appConfig');
const { startPremiereScheduler } = require('./services/premiereScheduler');

const app = express();
const server = http.createServer(app);
const socketHandler = new SocketHandler(server);

// Expose the Socket.IO instance on `app` so REST controllers can emit events
// (e.g. broadcasting 'premiere-deleted' to connected admin sessions).
app.set('io', socketHandler.io);

// Initialize video queue with socket.io
const videoQueue = require('./services/videoQueue');
videoQueue.setSocketIO(socketHandler.io);

// Middleware - CORS configuration from appConfig
app.use(cors(appConfig.cors));

// Build frame-ancestors for CSP so frontend (e.g. localhost:3000) can embed backend URLs in iframes (e.g. document viewer)
const corsOrigin = appConfig.cors.origin;
const frameAncestors =
  corsOrigin === '*'
    ? ["*"]
    : Array.isArray(corsOrigin)
      ? ["'self'", ...corsOrigin.filter((o) => typeof o === 'string')]
      : ["'self'", "http://localhost:3000", "http://127.0.0.1:3000"];

app.use(
  helmet({
    // Disable CSP for most directives to avoid breaking frontend scripts
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors,
      },
    },
    // Do not set X-Frame-Options; use CSP frame-ancestors above so frontend (e.g. :3000) can embed doc viewer (e.g. :5000)
    frameguard: false,
    // Allow static assets (images, HLS, slides) to be embedded from other origins
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));


// Health check - no auth, no rate limit (for load balancers / k8s probes)
app.get('/api/health', (req, res) => {
  const dbState = mongoose.connection.readyState;
  // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  const dbOk = dbState === 1;
  const ok = dbOk;

  res.status(ok ? 200 : 503).json({
    ok,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      status: dbOk ? 'connected' : 'disconnected',
      readyState: dbState,
    },
  });
});
// General API rate limit: max requests per IP per window (reduces abuse/DoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Database connection
mongoose.connect(appConfig.database.uri).then(() => {
  console.log('Connected to MongoDB');
  // Keep premiere lifecycle automatic: scheduled -> live -> ended.
  startPremiereScheduler(socketHandler.io);
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Helper function to check if origin matches allowed origins (including '*' for all origins)
function isOriginAllowed(origin, allowedOrigins) {
  if (!origin) return false;
  
  // Allow all origins if configured as '*'
  if (allowedOrigins === '*') {
    return true;
  }
  
  // Handle array of origins
  if (Array.isArray(allowedOrigins)) {
    for (const allowed of allowedOrigins) {
      if (typeof allowed === 'string') {
        if (allowed === origin) return true;
      } else if (allowed instanceof RegExp) {
        if (allowed.test(origin)) return true;
      }
    }
  }
  
  return false;
}

// Serve static files with proper headers for HLS
app.use('/uploads/videos', (req, res, next) => {
  // Set CORS headers for video files using configured origins
  const origin = req.headers.origin;
  const corsOrigin = appConfig.cors.origin;
  
  if (corsOrigin === '*') {
    // Allow all origins
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (origin && isOriginAllowed(origin, corsOrigin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (Array.isArray(corsOrigin) && corsOrigin.length > 0) {
    // Find first string origin (not regex) as fallback
    const stringOrigin = corsOrigin.find(o => typeof o === 'string');
    if (stringOrigin) {
      res.header('Access-Control-Allow-Origin', stringOrigin);
    }
  }
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Set proper content type for HLS files
  if (req.path.endsWith('.m3u8')) {
    res.header('Content-Type', 'application/vnd.apple.mpegurl');
  } else if (req.path.endsWith('.ts')) {
    res.header('Content-Type', 'video/mp2t');
  }
  
  next();
}, express.static(path.join(__dirname, '../uploads/videos')));

app.use('/uploads/presentations', (req, res, next) => {
  // Set CORS headers for presentation files using configured origins
  const origin = req.headers.origin;
  const corsOrigin = appConfig.cors.origin;
  
  if (corsOrigin === '*') {
    // Allow all origins
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (origin && isOriginAllowed(origin, corsOrigin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (Array.isArray(corsOrigin) && corsOrigin.length > 0) {
    // Find first string origin (not regex) as fallback
    const stringOrigin = corsOrigin.find(o => typeof o === 'string');
    if (stringOrigin) {
      res.header('Access-Control-Allow-Origin', stringOrigin);
    }
  }
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
}, express.static(path.join(__dirname, '../uploads/presentations')));

app.use('/uploads/documents', (req, res, next) => {
  // Set CORS headers for document files using configured origins
  const origin = req.headers.origin;
  const corsOrigin = appConfig.cors.origin;
  
  if (corsOrigin === '*') {
    // Allow all origins
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    } else {
      res.header('Access-Control-Allow-Origin', '*');
    }
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (origin && isOriginAllowed(origin, corsOrigin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  } else if (Array.isArray(corsOrigin) && corsOrigin.length > 0) {
    // Find first string origin (not regex) as fallback
    const stringOrigin = corsOrigin.find(o => typeof o === 'string');
    if (stringOrigin) {
      res.header('Access-Control-Allow-Origin', stringOrigin);
    }
  }
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
}, express.static(path.join(__dirname, '../uploads/documents')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/users', require('./routes/user'));
app.use('/api/videos', require('./routes/video'));
app.use('/api/premieres', require('./routes/premiere'));
app.use('/api/presentations', require('./routes/presentation'));
app.use('/api/documents', require('./routes/document'));
app.use('/api/patches', require('./routes/patch'));
app.use('/api/downloads', require('./routes/download'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

const PORT = appConfig.server.port;

// Listen on all interfaces (0.0.0.0) to allow network access
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO server is running on port ${PORT}`);
  console.log(`Environment: ${appConfig.server.nodeEnv}`);
  const corsOriginsStr = appConfig.cors.origin === '*' 
    ? '*' 
    : Array.isArray(appConfig.cors.origin) 
      ? appConfig.cors.origin.map(o => typeof o === 'string' ? o : o.toString()).join(', ')
      : String(appConfig.cors.origin);
  console.log(`CORS Origins: ${corsOriginsStr}`);
  console.log(`JWT Secret: ${appConfig.security.jwtSecret ? 'Set' : 'Not Set'}`);
  console.log(`Access locally: http://localhost:${PORT}`);
  console.log(`Access from network: http://0.0.0.0:${PORT} (all interfaces)`);
  console.log(`Video uploads: http://localhost:${PORT}/uploads/videos/`);
  console.log(`Original videos: http://localhost:${PORT}/api/videos/:id/original`);
  console.log(`Presentations: http://localhost:${PORT}/api/presentations`);
});

// Export socket handler for use in other modules
module.exports = { app, server, socketHandler };
