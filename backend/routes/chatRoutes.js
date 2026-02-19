const express = require('express');
const router = express.Router();
const { getChatHistory, getAllUsers, getCallHistory, uploadChatFile, chatUpload } = require('../controllers/chatController');
const { verifyToken } = require('../middleware/authMiddleware');

// All chat routes are protected — user must be logged in
router.get('/users', verifyToken, getAllUsers);                              // GET /api/chat/users
router.get('/history/:userId', verifyToken, getChatHistory);                // GET /api/chat/history/123
router.get('/calls', verifyToken, getCallHistory);                          // GET /api/chat/calls
router.post('/upload', verifyToken, chatUpload.single('file'), uploadChatFile); // POST /api/chat/upload

module.exports = router;