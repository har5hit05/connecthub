const express = require('express');
const router = express.Router();
const { register, login, logout, getProfile } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/authSchemas');

const { authLimiter } = require('../middleware/rateLimiter');

// Public routes (no login needed)
router.post('/register', authLimiter, validate(registerSchema), register);   // POST /api/auth/register
router.post('/login', authLimiter, validate(loginSchema), login);             // POST /api/auth/login

// Protected routes (login required)
router.get('/profile', verifyToken, getProfile);  // GET /api/auth/profile
router.post('/logout', verifyToken, logout);       // POST /api/auth/logout

module.exports = router;
