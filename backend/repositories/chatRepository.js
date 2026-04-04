const db = require('../config/database');

class ChatRepository {
    async getHistoryBefore(myUserId, otherUserId, beforeStr, limitStr) {
        const limit = parseInt(limitStr, 10) || 50;
        const before = parseInt(beforeStr, 10);

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
                ((m.sender_id = $1 AND m.receiver_id = $2)
                OR
                (m.sender_id = $2 AND m.receiver_id = $1))
                AND m.id < $3
            ORDER BY m.created_at DESC
            LIMIT $4`,
            [myUserId, otherUserId, before, limit]
        );
        return { messages: result.rows, limit };
    }

    async getHistoryLatest(myUserId, otherUserId, limitStr) {
        const limit = parseInt(limitStr, 10) || 50;

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
            ORDER BY m.created_at DESC
            LIMIT $3`,
            [myUserId, otherUserId, limit]
        );
        return { messages: result.rows, limit };
    }
}

module.exports = new ChatRepository();
