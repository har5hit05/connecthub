const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for chat file uploads
const chatStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/chat');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

const chatFileFilter = (req, file, cb) => {
    // Allow images, PDFs, documents, and common file types
    const allowedMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'video/mp4', 'video/webm',
        'audio/mpeg', 'audio/wav', 'audio/ogg'
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('File type not allowed'));
    }
};

const chatUpload = multer({
    storage: chatStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
    fileFilter: chatFileFilter
});

const chatService = require('../services/chatService');

// ─────────────────────────────────────
// UPLOAD CHAT FILE
// Uploads a file and returns the URL
// ─────────────────────────────────────
const uploadChatFile = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const fileUrl = `/uploads/chat/${req.file.filename}`;
        const fileType = req.file.mimetype;
        const originalName = req.file.originalname;

        res.status(200).json({
            fileUrl,
            fileType,
            originalName
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────
// GET CHAT HISTORY (cursor-based pagination)
// ─────────────────────────────────────
const getChatHistory = async (req, res, next) => {
    try {
        const myUserId = req.user.id;
        const otherUserId = req.params.userId;
        const limitStr = req.query.limit;
        const beforeStr = req.query.before;

        const result = await chatService.getChatHistory(myUserId, otherUserId, beforeStr, limitStr);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────
// GET ALL USERS (contact list)
// ─────────────────────────────────────
const getAllUsers = async (req, res, next) => {
    try {
        const users = await chatService.getAllUsers(req.user.id);
        res.status(200).json({ users });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────
// GET CALL HISTORY (offset-based pagination)
// ─────────────────────────────────────
const getCallHistory = async (req, res, next) => {
    try {
        const result = await chatService.getCallHistory(req.user.id, req.query.page, req.query.limit);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};

module.exports = { getChatHistory, getAllUsers, getCallHistory, uploadChatFile, chatUpload };