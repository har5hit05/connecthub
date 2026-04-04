const express = require('express');
const router = express.Router();
const {
    blockUser,
    unblockUser,
    getBlockedUsers,
    checkBlockStatus
} = require('../controllers/blockController');
const { verifyToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { blockUserSchema, blockedIdParam, userIdParam } = require('../validators/blockSchemas');

// All routes are protected
router.post('/block', verifyToken, validate(blockUserSchema), blockUser);                    // POST   /api/block/block
router.delete('/unblock/:blockedId', verifyToken, validate(blockedIdParam), unblockUser);    // DELETE /api/block/unblock/123
router.get('/list', verifyToken, getBlockedUsers);                                           // GET    /api/block/list
router.get('/status/:userId', verifyToken, validate(userIdParam), checkBlockStatus);         // GET    /api/block/status/123

module.exports = router;
