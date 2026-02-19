const express = require('express');
const router = express.Router();
const {
    searchUsers,
    sendFriendRequest,
    getReceivedRequests,
    getSentRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    getFriends,
    removeFriend,
    checkFriendshipStatus
} = require('../controllers/friendController');
const { verifyToken } = require('../middleware/authMiddleware');

// All routes are protected
router.get('/search', verifyToken, searchUsers);                          // GET  /api/friends/search?query=john
router.post('/request', verifyToken, sendFriendRequest);                  // POST /api/friends/request
router.get('/requests/received', verifyToken, getReceivedRequests);       // GET  /api/friends/requests/received
router.get('/requests/sent', verifyToken, getSentRequests);               // GET  /api/friends/requests/sent
router.post('/requests/:requestId/accept', verifyToken, acceptFriendRequest);   // POST /api/friends/requests/123/accept
router.delete('/requests/:requestId/reject', verifyToken, rejectFriendRequest); // DELETE /api/friends/requests/123/reject
router.delete('/requests/:requestId/cancel', verifyToken, cancelFriendRequest); // DELETE /api/friends/requests/123/cancel
router.get('/list', verifyToken, getFriends);                             // GET  /api/friends/list
router.delete('/:friendId', verifyToken, removeFriend);                   // DELETE /api/friends/456
router.get('/status/:userId', verifyToken, checkFriendshipStatus);        // GET  /api/friends/status/789

module.exports = router;