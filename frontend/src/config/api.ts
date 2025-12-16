/**
 * Dynamic API Configuration
 * Automatically determines API URL based on current hostname
 * Works on localhost, LAN IPs, and production domains
 */

/**
 * Get the API base URL dynamically
 * - On localhost → http://localhost:5000
 * - On network IP (192.168.0.101) → http://192.168.0.101:5000
 * - Can be overridden by REACT_APP_API_URL environment variable
 * 
 * Note: REACT_APP_API_URL should include /api if you want the full API path
 * Example: REACT_APP_API_URL=http://192.168.1.101:5000/api
 */
const getApiBaseUrl = (): string => {
  // Priority 1: Environment variable override (should be full URL without /api)
  if (process.env.REACT_APP_API_BASE_URL) {
    return process.env.REACT_APP_API_BASE_URL;
  }

  // Priority 2: Check if REACT_APP_API_URL is set (might include /api)
  if (process.env.REACT_APP_API_URL) {
    // Remove /api if present, we'll add it later
    return process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '');
  }

  // Priority 3: Dynamic detection based on current hostname
  const hostname = window.location.hostname;
  const protocol = window.location.protocol; // http: or https:
  const backendPort = process.env.REACT_APP_API_PORT || '5000';

  // Build API URL using the same hostname as the frontend
  return `${protocol}//${hostname}:${backendPort}`;
};

/**
 * Get the Socket.IO URL (same as API URL)
 */
const getSocketUrl = (): string => {
  // Priority 1: Environment variable override
  if (process.env.REACT_APP_SOCKET_URL) {
    return process.env.REACT_APP_SOCKET_URL;
  }

  // Priority 2: Use the same as API base URL
  return getApiBaseUrl();
};

/**
 * Get base URL for static files (uploads)
 * This is the same as API base URL without /api
 */
export const getBaseUrl = (): string => {
  return getApiBaseUrl();
};

// Export the computed values
export const API_BASE_URL = `${getApiBaseUrl()}/api`;
export const SOCKET_URL = getSocketUrl();

// Log configuration in development mode
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 API Configuration:', {
    API_BASE_URL,
    SOCKET_URL,
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    origin: window.location.origin
  });
}