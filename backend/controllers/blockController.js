const db = require('../config/database');

// ─────────────────────────────────────────────
// BLOCK A USER
// Blocks a user and removes friendship if exists
// ─────────────────────────────────────────────
const blockUser = async (req, res) => {
    try {
        const { blockedId } = req.body;
        const blockerId = req.user.id;

        console.log('Block user request:', { blockerId, blockedId });

        if (!blockedId) {
            return res.status(400).json({ message: 'Blocked user ID is required' });
        }

        const blockedIdInt = parseInt(blockedId);

        if (isNaN(blockedIdInt)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        if (blockerId === blockedIdInt) {
            return res.status(400).json({ message: 'Cannot block yourself' });
        }

        // Check if already blocked
        const existingBlock = await db.query(
            'SELECT * FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
            [blockerId, blockedIdInt]
        );

        if (existingBlock.rows.length > 0) {
            return res.status(400).json({ message: 'User is already blocked' });
        }

        await db.query('BEGIN');

        // Block the user
        await db.query(
            'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2)',
            [blockerId, blockedIdInt]
        );

        // Remove friendship if exists
        await db.query(
            `DELETE FROM friendships 
       WHERE (user1_id = LEAST($1::integer, $2::integer) AND user2_id = GREATEST($1::integer, $2::integer))`,
            [blockerId, blockedIdInt]
        );

        // Delete any pending friend requests (both directions)
        await db.query(
            `DELETE FROM friend_requests 
       WHERE (sender_id = $1 AND receiver_id = $2) 
       OR (sender_id = $2 AND receiver_id = $1)`,
            [blockerId, blockedIdInt]
        );

        await db.query('COMMIT');

        console.log('User blocked successfully:', blockedIdInt);

        res.status(200).json({ message: 'User blocked successfully' });
    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Block user error:', error);
        res.status(500).json({ message: 'Failed to block user' });
    }
};

// ─────────────────────────────────────────────
// UNBLOCK A USER
// Removes the block
// ─────────────────────────────────────────────
const unblockUser = async (req, res) => {
    try {
        const { blockedId } = req.params;
        const blockerId = req.user.id;

        const blockedIdInt = parseInt(blockedId);

        if (isNaN(blockedIdInt)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const result = await db.query(
            'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2 RETURNING *',
            [blockerId, blockedIdInt]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Block not found' });
        }

        console.log('User unblocked:', blockedIdInt);

        res.status(200).json({ message: 'User unblocked successfully' });
    } catch (error) {
        console.error('Unblock user error:', error);
        res.status(500).json({ message: 'Failed to unblock user' });
    }
};

// ─────────────────────────────────────────────
// GET MY BLOCKED USERS LIST
// Returns all users I have blocked
// ─────────────────────────────────────────────
const getBlockedUsers = async (req, res) => {
    try {
        const blockerId = req.user.id;

        const result = await db.query(
            `SELECT 
         bu.id as block_id,
         bu.blocked_id,
         bu.created_at as blocked_at,
         u.username,
         u.email,
         u.display_name,
         u.avatar_url
       FROM blocked_users bu
       JOIN users u ON u.id = bu.blocked_id
       WHERE bu.blocker_id = $1
       ORDER BY bu.created_at DESC`,
            [blockerId]
        );

        res.status(200).json({ blockedUsers: result.rows });
    } catch (error) {
        console.error('Get blocked users error:', error);
        res.status(500).json({ message: 'Failed to get blocked users' });
    }
};

// ─────────────────────────────────────────────
// CHECK IF USER IS BLOCKED
// Returns block status between two users
// ─────────────────────────────────────────────
const checkBlockStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const myUserId = req.user.id;

        const targetUserId = parseInt(userId);

        if (isNaN(targetUserId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        // Check if I blocked them
        const iBlockedThem = await db.query(
            'SELECT * FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
            [myUserId, targetUserId]
        );

        // Check if they blocked me
        const theyBlockedMe = await db.query(
            'SELECT * FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
            [targetUserId, myUserId]
        );

        res.status(200).json({
            iBlockedThem: iBlockedThem.rows.length > 0,
            theyBlockedMe: theyBlockedMe.rows.length > 0
        });
    } catch (error) {
        console.error('Check block status error:', error);
        res.status(500).json({ message: 'Failed to check block status' });
    }
};

module.exports = {
    blockUser,
    unblockUser,
    getBlockedUsers,
    checkBlockStatus
};