const express = require('express');
const router = express.Router();
const {
  getMyProfile,
  getUserProfile,
  updateMyProfile,
  uploadAvatar,
  deleteAvatar,
  upload
} = require('../controllers/profileController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes are protected
router.get('/me', verifyToken, getMyProfile);                              // GET  /api/profile/me
router.get('/:userId', verifyToken, getUserProfile);                       // GET  /api/profile/123
router.put('/me', verifyToken, updateMyProfile);                           // PUT  /api/profile/me
router.post('/avatar', verifyToken, upload.single('avatar'), uploadAvatar); // POST /api/profile/avatar
router.delete('/avatar', verifyToken, deleteAvatar);                       // DELETE /api/profile/avatar

module.exports = router;