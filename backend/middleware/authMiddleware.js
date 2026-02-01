const jwt = require('jsonwebtoken');

// This middleware runs BEFORE any protected route
// It checks if the user has a valid token
const verifyToken = (req, res, next) => {
    try {
        // Step 1: Get the token from the request header
        // Frontend sends it like: Authorization: Bearer <token>
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ message: 'No token provided' });
        }

        // Step 2: Extract token (remove "Bearer " prefix)
        const token = authHeader.split(' ')[1];

        // Step 3: Verify the token using our secret key
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Step 4: Attach user info to the request object
        // Now any route handler can use req.user
        req.user = decoded;

        // Step 5: Move to the next middleware or route handler
        next();
    } catch (error) {
        // Token is invalid or expired
        return res.status(401).json({ message: 'Invalid or expired token' });
    }
};

module.exports = { verifyToken };