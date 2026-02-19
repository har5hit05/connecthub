const db = require('../config/database');

// ─────────────────────────────────────────────
// SEARCH USERS BY USERNAME
// Returns users matching the search query (excluding self)
// ─────────────────────────────────────────────
const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        const myUserId = req.user.id;

        if (!query || query.trim().length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters' });
        }

        const result = await db.query(
            `SELECT id, username, email, avatar_url, is_online
       FROM users
       WHERE LOWER(username) LIKE LOWER($1)
       AND id != $2
       LIMIT 20`,
            [`%${query.trim()}%`, myUserId]
        );

        res.status(200).json({ users: result.rows });
    } catch (error) {
        console.error('Search users error:', error);
        res.status(500).json({ message: 'Failed to search users' });
    }
};

// ─────────────────────────────────────────────
// SEND FRIEND REQUEST
// Creates a pending friend request
// ─────────────────────────────────────────────
const sendFriendRequest = async (req, res) => {
    let transactionStarted = false;
    try {
        const { receiverId } = req.body;
        const senderId = req.user.id;

        if (!receiverId) {
            return res.status(400).json({ message: 'Receiver ID is required' });
        }

        const receiverIdInt = parseInt(receiverId);

        if (isNaN(receiverIdInt)) {
            return res.status(400).json({ message: 'Invalid receiver ID' });
        }

        if (senderId === receiverIdInt) {
            return res.status(400).json({ message: 'Cannot send friend request to yourself' });
        }

        // Check if they're already friends
        const friendshipCheck = await db.query(
            `SELECT * FROM friendships
       WHERE (user1_id = LEAST($1::integer, $2::integer) AND user2_id = GREATEST($1::integer, $2::integer))`,
            [senderId, receiverIdInt]
        );

        if (friendshipCheck.rows.length > 0) {
            return res.status(400).json({ message: 'Already friends' });
        }

        // Check if request already exists
        const existingRequest = await db.query(
            `SELECT * FROM friend_requests
       WHERE sender_id = $1 AND receiver_id = $2`,
            [senderId, receiverIdInt]
        );

        if (existingRequest.rows.length > 0) {
            return res.status(400).json({ message: 'Friend request already sent' });
        }

        // Check if receiver has sent you a request (auto-accept)
        const reverseRequest = await db.query(
            `SELECT * FROM friend_requests
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
            [receiverIdInt, senderId]
        );

        if (reverseRequest.rows.length > 0) {
            // Auto-accept: create friendship and delete both requests
            transactionStarted = true;
            await db.query('BEGIN');

            await db.query(
                `INSERT INTO friendships (user1_id, user2_id)
         VALUES (LEAST($1::integer, $2::integer), GREATEST($1::integer, $2::integer))`,
                [senderId, receiverIdInt]
            );

            await db.query(
                `DELETE FROM friend_requests
         WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
                [senderId, receiverIdInt]
            );

            await db.query('COMMIT');
            transactionStarted = false;

            return res.status(200).json({
                message: 'Friend request auto-accepted',
                friendship: true
            });
        }

        // Create new friend request
        const result = await db.query(
            `INSERT INTO friend_requests (sender_id, receiver_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
            [senderId, receiverIdInt]
        );

        res.status(201).json({
            message: 'Friend request sent',
            request: result.rows[0]
        });
    } catch (error) {
        if (transactionStarted) {
            await db.query('ROLLBACK').catch(() => {});
        }
        console.error('Send friend request error:', error);
        res.status(500).json({ message: 'Failed to send friend request' });
    }
};

// ─────────────────────────────────────────────
// GET MY FRIEND REQUESTS (RECEIVED)
// Returns pending requests sent TO me
// ─────────────────────────────────────────────
const getReceivedRequests = async (req, res) => {
    try {
        const myUserId = req.user.id;

        const result = await db.query(
            `SELECT fr.id, fr.sender_id, fr.status, fr.created_at,
              u.username, u.email, u.avatar_url, u.is_online
       FROM friend_requests fr
       JOIN users u ON u.id = fr.sender_id
       WHERE fr.receiver_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
            [myUserId]
        );

        res.status(200).json({ requests: result.rows });
    } catch (error) {
        console.error('Get received requests error:', error);
        res.status(500).json({ message: 'Failed to get friend requests' });
    }
};

// ─────────────────────────────────────────────
// GET MY SENT REQUESTS
// Returns requests I sent that are still pending
// ─────────────────────────────────────────────
const getSentRequests = async (req, res) => {
    try {
        const myUserId = req.user.id;

        const result = await db.query(
            `SELECT fr.id, fr.receiver_id, fr.status, fr.created_at,
              u.username, u.email, u.avatar_url, u.is_online
       FROM friend_requests fr
       JOIN users u ON u.id = fr.receiver_id
       WHERE fr.sender_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
            [myUserId]
        );

        res.status(200).json({ requests: result.rows });
    } catch (error) {
        console.error('Get sent requests error:', error);
        res.status(500).json({ message: 'Failed to get sent requests' });
    }
};

// ─────────────────────────────────────────────
// ACCEPT FRIEND REQUEST
// Creates friendship and deletes the request
// ─────────────────────────────────────────────
const acceptFriendRequest = async (req, res) => {
    let transactionStarted = false;
    try {
        const requestId = parseInt(req.params.requestId);
        const myUserId = req.user.id;

        if (isNaN(requestId)) {
            return res.status(400).json({ message: 'Invalid request ID' });
        }

        // Get the request
        const requestResult = await db.query(
            `SELECT * FROM friend_requests
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
            [requestId, myUserId]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        const request = requestResult.rows[0];
        const senderId = request.sender_id;

        transactionStarted = true;
        await db.query('BEGIN');

        // Create friendship
        await db.query(
            `INSERT INTO friendships (user1_id, user2_id)
       VALUES (LEAST($1::integer, $2::integer), GREATEST($1::integer, $2::integer))`,
            [myUserId, senderId]
        );

        // Delete the request
        await db.query(
            `DELETE FROM friend_requests WHERE id = $1`,
            [requestId]
        );

        await db.query('COMMIT');
        transactionStarted = false;

        res.status(200).json({ message: 'Friend request accepted' });
    } catch (error) {
        if (transactionStarted) {
            await db.query('ROLLBACK').catch(() => {});
        }
        console.error('Accept friend request error:', error);
        res.status(500).json({ message: 'Failed to accept friend request' });
    }
};

// ─────────────────────────────────────────────
// REJECT FRIEND REQUEST
// Deletes the request
// ─────────────────────────────────────────────
const rejectFriendRequest = async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const myUserId = req.user.id;

        if (isNaN(requestId)) {
            return res.status(400).json({ message: 'Invalid request ID' });
        }

        const result = await db.query(
            `DELETE FROM friend_requests
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       RETURNING *`,
            [requestId, myUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        res.status(200).json({ message: 'Friend request rejected' });
    } catch (error) {
        console.error('Reject friend request error:', error);
        res.status(500).json({ message: 'Failed to reject friend request' });
    }
};

// ─────────────────────────────────────────────
// CANCEL FRIEND REQUEST (sent by me)
// Deletes the request I sent
// ─────────────────────────────────────────────
const cancelFriendRequest = async (req, res) => {
    try {
        const requestId = parseInt(req.params.requestId);
        const myUserId = req.user.id;

        if (isNaN(requestId)) {
            return res.status(400).json({ message: 'Invalid request ID' });
        }

        const result = await db.query(
            `DELETE FROM friend_requests
       WHERE id = $1 AND sender_id = $2 AND status = 'pending'
       RETURNING *`,
            [requestId, myUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Friend request not found' });
        }

        res.status(200).json({ message: 'Friend request cancelled' });
    } catch (error) {
        console.error('Cancel friend request error:', error);
        res.status(500).json({ message: 'Failed to cancel friend request' });
    }
};

// ─────────────────────────────────────────────
// GET MY FRIENDS LIST
// Returns all accepted friendships
// ─────────────────────────────────────────────
const getFriends = async (req, res) => {
    try {
        const myUserId = req.user.id;

        const result = await db.query(
            `SELECT
         CASE
           WHEN f.user1_id = $1 THEN f.user2_id
           ELSE f.user1_id
         END as friend_id,
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
         END as is_online,
         f.created_at as friends_since
       FROM friendships f
       LEFT JOIN users u1 ON u1.id = f.user1_id
       LEFT JOIN users u2 ON u2.id = f.user2_id
       WHERE f.user1_id = $1 OR f.user2_id = $1
       ORDER BY friends_since DESC`,
            [myUserId]
        );

        res.status(200).json({ friends: result.rows });
    } catch (error) {
        console.error('Get friends error:', error);
        res.status(500).json({ message: 'Failed to get friends' });
    }
};

// ─────────────────────────────────────────────
// REMOVE FRIEND (UNFRIEND)
// Deletes the friendship
// ─────────────────────────────────────────────
const removeFriend = async (req, res) => {
    try {
        const friendId = parseInt(req.params.friendId);
        const myUserId = req.user.id;

        if (isNaN(friendId)) {
            return res.status(400).json({ message: 'Invalid friend ID' });
        }

        const result = await db.query(
            `DELETE FROM friendships
       WHERE (user1_id = LEAST($1, $2) AND user2_id = GREATEST($1, $2))
       RETURNING *`,
            [myUserId, friendId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Friendship not found' });
        }

        res.status(200).json({ message: 'Friend removed' });
    } catch (error) {
        console.error('Remove friend error:', error);
        res.status(500).json({ message: 'Failed to remove friend' });
    }
};

// ─────────────────────────────────────────────
// CHECK FRIENDSHIP STATUS
// Returns relationship status with another user
// ─────────────────────────────────────────────
const checkFriendshipStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        const myUserId = Number(req.user.id);

        const targetUserId = parseInt(userId);

        if (isNaN(targetUserId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        if (targetUserId === myUserId) {
            return res.status(200).json({ status: 'self' });
        }

        // Check if friends
        const friendshipResult = await db.query(
            `SELECT * FROM friendships
       WHERE (user1_id = LEAST($1::integer, $2::integer) AND user2_id = GREATEST($1::integer, $2::integer))`,
            [myUserId, targetUserId]
        );

        if (friendshipResult.rows.length > 0) {
            return res.status(200).json({ status: 'friends' });
        }

        // Check if I sent a request
        const sentRequest = await db.query(
            `SELECT * FROM friend_requests
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
            [myUserId, targetUserId]
        );

        if (sentRequest.rows.length > 0) {
            return res.status(200).json({
                status: 'request_sent',
                requestId: sentRequest.rows[0].id
            });
        }

        // Check if they sent me a request
        const receivedRequest = await db.query(
            `SELECT * FROM friend_requests
       WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
            [targetUserId, myUserId]
        );

        if (receivedRequest.rows.length > 0) {
            return res.status(200).json({
                status: 'request_received',
                requestId: receivedRequest.rows[0].id
            });
        }

        res.status(200).json({ status: 'none' });
    } catch (error) {
        console.error('Check friendship status error:', error);
        res.status(500).json({ message: 'Failed to check friendship status' });
    }
};

module.exports = {
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
};
