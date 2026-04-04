const jwt = require('jsonwebtoken');
const config = require('../config');

// This middleware runs BEFORE any protected route.
// It reads the JWT from the httpOnly cookie (set on login).
// Using a cookie instead of a header prevents XSS from stealing the token.
const verifyToken = (req, res, next) => {
    try {
        const token = req.cookies.jwt;

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
