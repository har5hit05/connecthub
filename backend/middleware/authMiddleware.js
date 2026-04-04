const jwt = require('jsonwebtoken');
const config = require('../config');

// This middleware runs BEFORE any protected route.
// It reads the JWT from the httpOnly cookie (set on login).
// Using a cookie instead of a header prevents XSS from stealing the token.
const verifyToken = (req, res, next) => {
    try {
        // Check Authorization header first (works cross-origin when cookies are blocked)
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        } else {
            // Fall back to httpOnly cookie
            token = req.cookies.jwt;
        }

        if (!token) {
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, config.jwtSecret);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = { verifyToken };
