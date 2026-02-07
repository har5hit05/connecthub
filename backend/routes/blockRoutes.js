const express = require('express');
const router = express.Router();
const {
    blockUser,
    unblockUser,
    getBlockedUsers,
    checkBlockStatus
} = require('../controllers/blockController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes are protected
router.post('/block', verifyToken, blockUser);                    // POST   /api/block/block
router.delete('/unblock/:blockedId', verifyToken, unblockUser);   // DELETE /api/block/unblock/123
router.get('/list', verifyToken, getBlockedUsers);                // GET    /api/block/list
router.get('/status/:userId', verifyToken, checkBlockStatus);     // GET    /api/block/status/123

module.exports = router;