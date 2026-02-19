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

// ─────────────────────────────────────
// UPLOAD CHAT FILE
// Uploads a file and returns the URL
// ─────────────────────────────────────
const uploadChatFile = async (req, res) => {
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
        console.error('Upload chat file error:', error);
        res.status(500).json({ message: 'Failed to upload file' });
    }
};

// ─────────────────────────────────────
// GET CHAT HISTORY
// Returns all messages between two users
// ─────────────────────────────────────
const getChatHistory = async (req, res) => {
    try {
        const myUserId = req.user.id;           // The logged-in user (from token)
        const otherUserId = req.params.userId; // The other user (from URL)

        // Fetch all messages where:
        // - I am the sender AND they are the receiver, OR
        // - They are the sender AND I am the receiver
        // ORDER BY created_at ASC = oldest messages first (top of chat)
        const result = await db.query(
            `SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.message,
        m.file_url,
        m.file_type,
        m.file_name,
        m.is_read,
        m.created_at,
        u.username AS sender_username
      FROM messages m
      JOIN users u ON u.id = m.sender_id
      WHERE
        (m.sender_id = $1 AND m.receiver_id = $2)
        OR
        (m.sender_id = $2 AND m.receiver_id = $1)
      ORDER BY m.created_at ASC`,
            [myUserId, otherUserId]
        );

        res.status(200).json({ messages: result.rows });
    } catch (error) {
        console.error('Get chat history error:', error);
        res.status(500).json({ message: 'Failed to fetch chat history' });
    }
};

// ─────────────────────────────────────
// GET ALL USERS
// Returns all users except the logged-in user
// (used to build the contact list)
// ─────────────────────────────────────
const getAllUsers = async (req, res) => {
    try {
        const myUserId = req.user.id;

        // Get friends, excluding blocked users
        const result = await db.query(
            `SELECT 
         CASE 
           WHEN f.user1_id = $1 THEN f.user2_id 
           ELSE f.user1_id 
         END as id,
         CASE 
           WHEN f.user1_id = $1 THEN u2.username 
           ELSE u1.username 
         END as username,
         CASE 
           WHEN f.user1_id = $1 THEN u2.email 
           ELSE u1.email 
         END as email,
         CASE 
           WHEN f.user1_id = $1 THEN u2.avatar_url 
           ELSE u1.avatar_url 
         END as avatar_url,
         CASE 
           WHEN f.user1_id = $1 THEN u2.is_online 
           ELSE u1.is_online 
         END as is_online
       FROM friendships f
       LEFT JOIN users u1 ON u1.id = f.user1_id
       LEFT JOIN users u2 ON u2.id = f.user2_id
       WHERE (f.user1_id = $1 OR f.user2_id = $1)
       AND NOT EXISTS (
         SELECT 1 FROM blocked_users bu
         WHERE (bu.blocker_id = $1 AND bu.blocked_id = CASE WHEN f.user1_id = $1 THEN f.user2_id ELSE f.user1_id END)
         OR (bu.blocker_id = CASE WHEN f.user1_id = $1 THEN f.user2_id ELSE f.user1_id END AND bu.blocked_id = $1)
       )`,
            [myUserId]
        );

        res.status(200).json({ users: result.rows });
    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({ message: 'Failed to fetch users' });
    }
};

// ─────────────────────────────────────
// GET CALL HISTORY
// Returns all calls the logged-in user was part of
// ─────────────────────────────────────
const getCallHistory = async (req, res) => {
    try {
        const myUserId = req.user.id;

        const result = await db.query(
            `SELECT
        c.id,
        c.caller_id,
        c.receiver_id,
        c.call_type,
        c.status,
        c.duration,
        c.started_at,
        c.ended_at,
        c.created_at,
        caller.username AS caller_username,
        receiver.username AS receiver_username
      FROM calls c
      JOIN users caller ON caller.id = c.caller_id
      JOIN users receiver ON receiver.id = c.receiver_id
      WHERE c.caller_id = $1 OR c.receiver_id = $1
      ORDER BY c.created_at DESC
      LIMIT 50`,
            [myUserId]
        );

        res.status(200).json({ calls: result.rows });
    } catch (error) {
        console.error('Get call history error:', error);
        res.status(500).json({ message: 'Failed to fetch call history' });
    }
};

module.exports = { getChatHistory, getAllUsers, getCallHistory, uploadChatFile, chatUpload };