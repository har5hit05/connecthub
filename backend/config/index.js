/**
 * Centralized Configuration Module
 * 
 * WHY THIS EXISTS:
 * Instead of scattering `process.env.XXX` across 15+ files, we load and
 * validate ALL environment variables here in one place. This gives us:
 * 
 * 1. Fail-fast: If a required variable is missing, the server crashes
 *    immediately with a clear error — not 30 minutes later when someone
 *    tries to login and JWT_SECRET is undefined.
 * 
 * 2. Single source of truth: When you add a new env var, update ONE file.
 * 
 * 3. Type coercion: PORT comes as a string from .env — we parse it to
 *    a number here so every consumer gets the right type.
 * 
 * 4. Defaults: Development-friendly defaults so the app works out of the
 *    box without configuring everything.
 */

require('dotenv').config();

// ── Helper: Require an env var or crash ───────────────────────────────────
const requireEnv = (key) => {
    const value = process.env[key];
    if (!value) {
        console.error(`❌ Missing required environment variable: ${key}`);
        console.error(`   Add it to your .env file or set it in your environment.`);
        process.exit(1);
    }
    return value;
};

// ── Build the config object ───────────────────────────────────────────────
const config = {
    // Server
    port: parseInt(process.env.PORT, 10) || 5000,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',

    // Database
    databaseUrl: requireEnv('DATABASE_URL'),

    // Authentication
    jwtSecret: requireEnv('JWT_SECRET'),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

    // Cookie settings (derived from environment)
    cookie: {
        httpOnly: true,                                            // JS can't read (XSS protection)
        secure: process.env.NODE_ENV === 'production',             // HTTPS only in prod
        sameSite: 'lax',                                           // CSRF protection
        maxAge: parseInt(process.env.COOKIE_MAX_AGE, 10) || 7 * 24 * 60 * 60 * 1000  // 7 days
    },

    // CORS
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

    // File uploads
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 20 * 1024 * 1024,       // 20MB
    maxAvatarSize: parseInt(process.env.MAX_AVATAR_SIZE, 10) || 5 * 1024 * 1024,     // 5MB

    // Rate limiting
    rateLimiting: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,  // 15 minutes
        authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 20,
        uploadMax: parseInt(process.env.RATE_LIMIT_UPLOAD_MAX, 10) || 20,
        generalMax: parseInt(process.env.RATE_LIMIT_GENERAL_MAX, 10) || 100
    },

    // Redis (for Milestone 3 — won't break anything if not set yet)
    redisUrl: process.env.REDIS_URL || null,

    // TURN server (for Milestone 4 — won't break anything if not set yet)
    turn: {
        url: process.env.TURN_URL || null,
        secret: process.env.TURN_SECRET || null
    }
};

module.exports = config;
