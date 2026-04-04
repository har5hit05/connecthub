const db = require('../config/database');

class BlockRepository {
    async findBlock(blockerId, blockedId) {
        const result = await db.query(
            'SELECT * FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2',
            [blockerId, blockedId]
        );
        return result.rows[0];
    }

    async blockUserTransaction(blockerId, blockedId) {
        // We use a transaction to ensure all these operations succeed or fail together
        const client = await db.connect();
        
        try {
            await client.query('BEGIN');

            // 1. Block the user
            await client.query(
                'INSERT INTO blocked_users (blocker_id, blocked_id) VALUES ($1, $2)',
                [blockerId, blockedId]
            );

            // 2. Remove friendship if exists
            await client.query(
                `DELETE FROM friendships 
                 WHERE (user1_id = LEAST($1::integer, $2::integer) AND user2_id = GREATEST($1::integer, $2::integer))`,
                [blockerId, blockedId]
            );

            // 3. Delete any pending friend requests (both directions)
            await client.query(
                `DELETE FROM friend_requests 
                 WHERE (sender_id = $1 AND receiver_id = $2) 
                 OR (sender_id = $2 AND receiver_id = $1)`,
                [blockerId, blockedId]
            );

            await client.query('COMMIT');
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async deleteBlock(blockerId, blockedId) {
        const result = await db.query(
            'DELETE FROM blocked_users WHERE blocker_id = $1 AND blocked_id = $2 RETURNING *',
            [blockerId, blockedId]
        );
        return result.rows[0];
    }

    async getBlockedUsers(blockerId) {
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
        return result.rows;
    }
}

module.exports = new BlockRepository();
