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
const { validate } = require('../middleware/validate');
const { userIdParam, updateProfileSchema } = require('../validators/profileSchemas');

// All routes are protected
router.get('/me', verifyToken, getMyProfile);                                                    // GET  /api/profile/me
router.get('/:userId', verifyToken, validate(userIdParam), getUserProfile);                      // GET  /api/profile/123
router.put('/me', verifyToken, validate(updateProfileSchema), updateMyProfile);                  // PUT  /api/profile/me
router.post('/avatar', verifyToken, upload.single('avatar'), uploadAvatar);                      // POST /api/profile/avatar
router.delete('/avatar', verifyToken, deleteAvatar);                                             // DELETE /api/profile/avatar

module.exports = router;
