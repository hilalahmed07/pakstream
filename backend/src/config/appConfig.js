// Application Configuration for Deployment
// Update CORS_ORIGIN here for deployment environments

require('dotenv').config();

/**
 * Get CORS allowed origins
 * Priority: 
 * 1. CORS_ORIGIN environment variable (comma-separated or '*' for all origins)
 * 2. Environment-specific defaults
 * 
 * For Docker/network deployments, set CORS_ORIGIN=* to allow all origins
 * or set specific origins: CORS_ORIGIN=http://192.168.1.100:3000,http://localhost:3000
 */
function getCorsOrigins() {
  // Check if CORS_ORIGIN is explicitly set in environment
  if (process.env.CORS_ORIGIN) {
    const origins = process.env.CORS_ORIGIN.trim();
    
    // Allow all origins if set to '*'
    if (origins === '*') {
      return '*';
    }
    
    // Parse comma-separated origins
    return origins.split(',').map(origin => origin.trim()).filter(origin => origin.length > 0);
  }

  // Environment-specific defaults
  if (process.env.NODE_ENV === 'production') {
    // Production: restrict to the server's own origin — set ALLOWED_ORIGIN to override
    return [process.env.ALLOWED_ORIGIN || 'http://10.33.100.70'];
  }

  // Development: allow all origins for local network access
  return '*';
}

/**
 * Application Configuration
 */
const appConfig = {
  // CORS Configuration
  cors: {
    origin: getCorsOrigins(),
    //credentials: true
    credentials: false
  },

  // Socket.IO CORS Configuration
  socketCors: {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST'],
    credentials: true
  },

  // Server Configuration
  server: {
    port: process.env.PORT || 5000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },

  // Database Configuration
  database: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/pakstream'
  },

  // Security Configuration
  security: {
    jwtSecret: process.env.JWT_SECRET
  }
};

module.exports = {
  appConfig,
  getCorsOrigins
};

