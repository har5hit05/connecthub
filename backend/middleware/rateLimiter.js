const rateLimit = require('express-rate-limit');
const config = require('../config');

/**
 * Rate Limiting Middleware
 * 
 * WHY RATE LIMITING?
 * Without it, an attacker can:
 * - Brute-force passwords (trying thousands of passwords/second)
 * - Flood your file storage (uploading thousands of files)
 * - DDoS your API (making it unresponsive for real users)
 * 
 * We use 3 tiers with different strictness for different risk levels.
 * All limits are configurable via environment variables (see config/index.js).
 */

// Strict limiter for auth endpoints (login/register)
// Prevents brute-force password attacks
const authLimiter = rateLimit({
    windowMs: config.rateLimiting.windowMs,
    max: config.rateLimiting.authMax,
    message: { message: 'Too many attempts. Please try again after 15 minutes.' },
    standardHeaders: true,     // Return rate limit info in headers (RateLimit-*)
    legacyHeaders: false       // Disable X-RateLimit-* headers
});

// Moderate limiter for file uploads
// Prevents storage abuse
const uploadLimiter = rateLimit({
    windowMs: config.rateLimiting.windowMs,
    max: config.rateLimiting.uploadMax,
    message: { message: 'Too many uploads. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// General limiter for all API endpoints
// Prevents overall abuse without affecting normal usage
const generalLimiter = rateLimit({
    windowMs: config.rateLimiting.windowMs,
    max: config.rateLimiting.generalMax,
    message: { message: 'Too many requests. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = { authLimiter, uploadLimiter, generalLimiter };
