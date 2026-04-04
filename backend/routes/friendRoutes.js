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
const { validate } = require('../middleware/validate');
const { searchQuerySchema, sendRequestSchema, requestIdParam, friendIdParam, userIdParam } = require('../validators/friendSchemas');

// All routes are protected
router.get('/search', verifyToken, validate(searchQuerySchema), searchUsers);                           // GET  /api/friends/search?query=john
router.post('/request', verifyToken, validate(sendRequestSchema), sendFriendRequest);                   // POST /api/friends/request
router.get('/requests/received', verifyToken, getReceivedRequests);                                     // GET  /api/friends/requests/received
router.get('/requests/sent', verifyToken, getSentRequests);                                             // GET  /api/friends/requests/sent
router.post('/requests/:requestId/accept', verifyToken, validate(requestIdParam), acceptFriendRequest); // POST /api/friends/requests/123/accept
router.delete('/requests/:requestId/reject', verifyToken, validate(requestIdParam), rejectFriendRequest); // DELETE /api/friends/requests/123/reject
router.delete('/requests/:requestId/cancel', verifyToken, validate(requestIdParam), cancelFriendRequest); // DELETE /api/friends/requests/123/cancel
router.get('/list', verifyToken, getFriends);                                                           // GET  /api/friends/list
router.delete('/:friendId', verifyToken, validate(friendIdParam), removeFriend);                        // DELETE /api/friends/456
router.get('/status/:userId', verifyToken, validate(userIdParam), checkFriendshipStatus);               // GET  /api/friends/status/789

module.exports = router;
