const db = require('../config/database');

class CallRepository {
    async getCallHistory(userId, offset, limit) {
        // Get total count
        const countResult = await db.query(
            `SELECT COUNT(*) FROM calls WHERE caller_id = $1 OR receiver_id = $1`,
            [userId]
        );
        const total = parseInt(countResult.rows[0].count);

        // Get calls with limit and offset
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
            LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        return { calls: result.rows, total };
    }

    /**
     * Get a single call record by ID.
     * Used for ownership validation before saving metrics.
     */
    async getCallById(callId) {
        const result = await db.query(
            `SELECT id, caller_id, receiver_id, call_type, status, duration, started_at, ended_at
             FROM calls WHERE id = $1`,
            [callId]
        );
        return result.rows[0] || null;
    }

    /**
     * Save (or update) call quality metrics for a specific user on a call.
     * Uses INSERT ... ON CONFLICT UPDATE so re-submissions overwrite gracefully.
     */
    async saveCallMetrics(callId, userId, metrics) {
        const result = await db.query(
            `INSERT INTO call_metrics (call_id, user_id, packet_loss, jitter, round_trip_time, bitrate)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (call_id, user_id)
             DO UPDATE SET
                packet_loss = EXCLUDED.packet_loss,
                jitter = EXCLUDED.jitter,
                round_trip_time = EXCLUDED.round_trip_time,
                bitrate = EXCLUDED.bitrate
             RETURNING *`,
            [callId, userId, metrics.packetLoss, metrics.jitter, metrics.roundTripTime, metrics.bitrate]
        );
        return result.rows[0];
    }

    /**
     * Get all metrics rows for a specific call (up to 2 — one per participant).
     */
    async getCallMetrics(callId) {
        const result = await db.query(
            `SELECT cm.*, u.username
             FROM call_metrics cm
             JOIN users u ON u.id = cm.user_id
             WHERE cm.call_id = $1
             ORDER BY cm.created_at ASC`,
            [callId]
        );
        return result.rows;
    }
}

module.exports = new CallRepository();

