/**
 * Migration: Add call_metrics table
 * 
 * Stores per-participant call quality telemetry reported by the frontend
 * after each call ends. Each row is one user's perspective of quality
 * for a specific call — so a completed call may have 0, 1, or 2 rows.
 * 
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.up = (pgm) => {
    pgm.createTable('call_metrics', {
        id: 'id',
        call_id: {
            type: 'integer',
            notNull: true,
            references: '"calls"',
            onDelete: 'CASCADE'
        },
        user_id: {
            type: 'integer',
            notNull: true,
            references: '"users"',
            onDelete: 'CASCADE'
        },
        packet_loss: {
            type: 'real',        // percentage (0-100)
            notNull: true,
            default: 0
        },
        jitter: {
            type: 'real',        // milliseconds
            notNull: true,
            default: 0
        },
        round_trip_time: {
            type: 'real',        // milliseconds
            notNull: true,
            default: 0
        },
        bitrate: {
            type: 'real',        // kbps
            notNull: true,
            default: 0
        },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp')
        }
    });

    // One metrics row per user per call
    pgm.addConstraint('call_metrics', 'unique_call_user_metrics', {
        unique: ['call_id', 'user_id']
    });

    // Index for quick lookups by call_id
    pgm.createIndex('call_metrics', 'call_id');
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
exports.down = (pgm) => {
    pgm.dropTable('call_metrics');
};
