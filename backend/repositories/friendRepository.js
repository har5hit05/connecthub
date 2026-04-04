const db = require('../config/database');

class FriendRepository {
    async getContacts(myUserId) {
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
        return result.rows;
    }

    async checkFriendship(user1Id, user2Id) {
        const result = await db.query(
            `SELECT * FROM friendships
             WHERE (user1_id = LEAST($1::integer, $2::integer) AND user2_id = GREATEST($1::integer, $2::integer))`,
            [user1Id, user2Id]
        );
        return result.rows[0];
    }

    async getFriendRequest(senderId, receiverId) {
        const result = await db.query(
            `SELECT * FROM friend_requests
             WHERE sender_id = $1 AND receiver_id = $2 AND status = 'pending'`,
            [senderId, receiverId]
        );
        return result.rows[0];
    }

    async getFriendRequestById(requestId, receiverId) {
        const result = await db.query(
            `SELECT * FROM friend_requests
             WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
            [requestId, receiverId]
        );
        return result.rows[0];
    }

    async autoAcceptRequest(senderId, receiverId) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            
            await client.query(
                `INSERT INTO friendships (user1_id, user2_id)
                 VALUES (LEAST($1::integer, $2::integer), GREATEST($1::integer, $2::integer))`,
                [senderId, receiverId]
            );

            await client.query(
                `DELETE FROM friend_requests
                 WHERE (sender_id = $1 AND receiver_id = $2) OR (sender_id = $2 AND receiver_id = $1)`,
                [senderId, receiverId]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async createFriendRequest(senderId, receiverId) {
        const result = await db.query(
            `INSERT INTO friend_requests (sender_id, receiver_id, status)
             VALUES ($1, $2, 'pending')
             RETURNING *`,
            [senderId, receiverId]
        );
        return result.rows[0];
    }

    async getReceivedRequests(userId) {
        const result = await db.query(
            `SELECT fr.id, fr.sender_id, fr.status, fr.created_at,
                    u.username, u.email, u.avatar_url, u.is_online
             FROM friend_requests fr
             JOIN users u ON u.id = fr.sender_id
             WHERE fr.receiver_id = $1 AND fr.status = 'pending'
             ORDER BY fr.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async getSentRequests(userId) {
        const result = await db.query(
            `SELECT fr.id, fr.receiver_id, fr.status, fr.created_at,
                    u.username, u.email, u.avatar_url, u.is_online
             FROM friend_requests fr
             JOIN users u ON u.id = fr.receiver_id
             WHERE fr.sender_id = $1 AND fr.status = 'pending'
             ORDER BY fr.created_at DESC`,
            [userId]
        );
        return result.rows;
    }

    async acceptRequest(requestId, myUserId, senderId) {
        const client = await db.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                `INSERT INTO friendships (user1_id, user2_id)
                 VALUES (LEAST($1::integer, $2::integer), GREATEST($1::integer, $2::integer))`,
                [myUserId, senderId]
            );

            await client.query(
                `DELETE FROM friend_requests WHERE id = $1`,
                [requestId]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteFriendRequest(requestId, role, userId) {
        const column = role === 'receiver' ? 'receiver_id' : 'sender_id';
        const result = await db.query(
            `DELETE FROM friend_requests
             WHERE id = $1 AND ${column} = $2 AND status = 'pending'
             RETURNING *`,
            [requestId, userId]
        );
        return result.rows[0];
    }

    async getFriends(userId) {
        const result = await db.query(
            `SELECT
               CASE WHEN f.user1_id = $1 THEN f.user2_id ELSE f.user1_id END as friend_id,
               CASE WHEN f.user1_id = $1 THEN u2.username ELSE u1.username END as username,
               CASE WHEN f.user1_id = $1 THEN u2.email ELSE u1.email END as email,
               CASE WHEN f.user1_id = $1 THEN u2.avatar_url ELSE u1.avatar_url END as avatar_url,
               CASE WHEN f.user1_id = $1 THEN u2.is_online ELSE u1.is_online END as is_online,
               f.created_at as friends_since
             FROM friendships f
             LEFT JOIN users u1 ON u1.id = f.user1_id
             LEFT JOIN users u2 ON u2.id = f.user2_id
             WHERE f.user1_id = $1 OR f.user2_id = $1
             ORDER BY friends_since DESC`,
            [userId]
        );
        return result.rows;
    }

    async removeFriend(userId1, userId2) {
        const result = await db.query(
            `DELETE FROM friendships
             WHERE (user1_id = LEAST($1::integer, $2::integer) AND user2_id = GREATEST($1::integer, $2::integer))
             RETURNING *`,
            [userId1, userId2]
        );
        return result.rows[0];
    }
}

module.exports = new FriendRepository();
