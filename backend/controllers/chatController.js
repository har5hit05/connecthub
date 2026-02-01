const db = require('../config/database');

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

        const result = await db.query(
            `SELECT id, username, email FROM users WHERE id != $1 ORDER BY username ASC`,
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

module.exports = { getChatHistory, getAllUsers, getCallHistory };