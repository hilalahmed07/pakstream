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

  // Priority 3: Same-origin (recommended for production behind Nginx).
  // Returning an empty string makes API_BASE_URL = "/api" and SOCKET_URL =
  // "" — both relative to whatever host/port serves the React bundle. This
  // is the airgapped-friendly default: any LAN client can reach the
  // backend through the same Nginx that served the page, no baked-in IP,
  // no firewall hole for :5000.
  //
  // Explicit port (legacy dev flow) still works via REACT_APP_API_URL.
  if (typeof window !== 'undefined' && window.location && window.location.port === '3000') {
    // Dev server on :3000 — talk directly to the backend on :5000 so the
    // CRA dev server doesn't need a proxy config. Production builds served
    // by Nginx (any other port) fall through to same-origin.
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const backendPort = process.env.REACT_APP_API_PORT || '5000';
    return `${protocol}//${hostname}:${backendPort}`;
  }

  return '';
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