/**
 * Frontend Configuration
 * 
 * WHY THIS EXISTS:
 * Instead of hardcoding "http://localhost:5000" in every file that makes
 * API calls (currently 8+ files!), we define the URL ONCE here.
 * 
 * HOW IT WORKS:
 * Vite exposes environment variables to frontend code via `import.meta.env`.
 * Only variables prefixed with VITE_ are exposed (security measure — you
 * don't want DATABASE_URL leaking to the browser).
 * 
 * To configure:
 *   Development: Uses defaults below (localhost:5000)
 *   Production:  Set VITE_API_URL and VITE_SOCKET_URL in your .env file
 *                or in your hosting platform's env vars (e.g., Render, Vercel)
 * 
 * USAGE:
 *   import { API_URL, SOCKET_URL, BASE_URL } from '../config';
 *   axios.get(`${API_URL}/chat/users`);
 */

// The backend API base URL (for Axios HTTP requests)
// In production, this would be something like "https://connecthub-api.yoursite.com/api"
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// The Socket.io server URL (for WebSocket connections)
// Usually the same host as the API but without the /api path
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

// The base URL for serving static files (uploads, avatars)
// Used when constructing full URLs for images/files stored on the server
export const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5000';
