const express = require('express');
const router = express.Router();
const { getChatHistory, getAllUsers, getCallHistory, uploadChatFile, chatUpload } = require('../controllers/chatController');
const { verifyToken } = require('../middleware/authMiddleware');
const { validate } = require('../middleware/validate');
const { chatHistoryParam, chatHistoryQuery, callHistoryQuery } = require('../validators/chatSchemas');

// All chat routes are protected — user must be logged in
router.get('/users', verifyToken, getAllUsers);                                                                             // GET /api/chat/users
router.get('/history/:userId', verifyToken, validate(chatHistoryParam), validate(chatHistoryQuery), getChatHistory);       // GET /api/chat/history/123?limit=50&before=456
router.get('/calls', verifyToken, validate(callHistoryQuery), getCallHistory);                                             // GET /api/chat/calls?page=1&limit=20
router.post('/upload', verifyToken, chatUpload.single('file'), uploadChatFile);                                            // POST /api/chat/upload

module.exports = router;
