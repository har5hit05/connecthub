const express = require('express');
const router = express.Router();
const { register, login, getProfile } = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');

// Public routes (no login needed)
router.post('/register', register);   // POST /api/auth/register
router.post('/login', login);         // POST /api/auth/login

// Protected routes (login required)
router.get('/profile', verifyToken, getProfile);  // GET /api/auth/profile

module.exports = router;