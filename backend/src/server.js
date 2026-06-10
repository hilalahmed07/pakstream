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
// Trust one hop of reverse proxy (Nginx) so express-rate-limit sees the real
// client IP from X-Forwarded-For instead of throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR.
app.set('trust proxy', 1);
const server = http.createServer(app);
const socketHandler = new SocketHandler(server);

// Expose the Socket.IO instance on `app` so REST controllers can emit events
// (e.g. broadcasting 'premiere-deleted' to connected admin sessions).
app.set('io', socketHandler.io);
// Also expose the SocketHandler itself so controllers can trigger higher-level
// flows like single-session eviction on login.
app.set('socketHandler', socketHandler);

// Initialize video queue with socket.io
const videoQueue = require('./services/videoQueue');
videoQueue.setSocketIO(socketHandler.io);

// Middleware - CORS configuration from appConfig
app.use(cors(appConfig.cors));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameAncestors: ["'self'"],
      },
    },
    frameguard: { action: 'sameorigin' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Enforce XSS protection (helmet disables it by default; security policy requires block mode)
app.use((req, res, next) => {
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

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
  console.error('MongoDB initial connection error:', err);
  process.exit(1);
});

// Mongoose connection-loss handlers. Without these, a transient mongod
// hiccup emits an unhandled `error` event which (combined with Node 20's
// default unhandled-rejection=throw) brings the whole process down. Log it
// instead and let the driver auto-reconnect.
mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err && err.message ? err.message : err);
});
mongoose.connection.on('disconnected', () => {
  console.warn('Mongoose disconnected from MongoDB — driver will attempt to reconnect');
});
mongoose.connection.on('reconnected', () => {
  console.log('Mongoose reconnected to MongoDB');
});

// Process-level safety nets. On Node 20 an unhandled promise rejection
// terminates the process by default, which on this airgapped deployment
// manifests as "backend stops abruptly" mid-session. Log loudly and stay
// alive — systemd's Restart=always was masking the noise. Keep behavior for
// uncaughtException strict (we log and exit so systemd can restart cleanly
// instead of running in a corrupt state).
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled promise rejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (process will exit for systemd restart):', err);
  // Give logs a tick to flush, then exit so the supervisor restarts us in a
  // known-good state.
  setTimeout(() => process.exit(1), 100).unref();
});
process.on('SIGTERM', () => {
  console.log('SIGTERM received — shutting down');
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 10000).unref();
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
  res.status(404).json({ success: false, message: 'Not found' });
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
