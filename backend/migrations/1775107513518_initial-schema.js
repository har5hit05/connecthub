/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
exports.shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.up = (pgm) => {
    // 1. Users Table
    pgm.createTable('users', {
        id: 'id',
        username: { type: 'varchar(50)', unique: true, notNull: true },
        email: { type: 'varchar(255)', unique: true, notNull: true },
        password_hash: { type: 'varchar(255)', notNull: true },
        avatar_url: { type: 'varchar(255)' },
        is_online: { type: 'boolean', default: false },
        last_seen: { type: 'timestamp' },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    // 2. Friend Requests
    pgm.createTable('friend_requests', {
        id: 'id',
        sender_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        receiver_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        status: { type: 'varchar(20)', notNull: true, default: 'pending' },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
    // Prevent duplicate requests
    pgm.addConstraint('friend_requests', 'unique_friend_request', {
        unique: ['sender_id', 'receiver_id']
    });

    // 3. Friendships
    pgm.createTable('friendships', {
        user1_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        user2_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
    // Ensure symmetric friendship pairs are unique (e.g., 1-2 is equivalent to 2-1 logically, we enforce user1 < user2 in app, but DB constraint just prevents exact dups)
    pgm.addConstraint('friendships', 'pk_friendships', {
        primaryKey: ['user1_id', 'user2_id']
    });

    // 4. Messages (with file support and NULL relaxation for text)
    pgm.createTable('messages', {
        id: 'id',
        sender_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        receiver_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        message: { type: 'text' },
        file_url: { type: 'text' },
        file_type: { type: 'varchar(100)' },
        file_name: { type: 'text' },
        is_read: { type: 'boolean', default: false },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
    // Index for quick cursor fetching
    pgm.createIndex('messages', ['sender_id', 'receiver_id', 'created_at']);

    // 5. Calls
    pgm.createTable('calls', {
        id: 'id',
        caller_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        receiver_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        call_type: { type: 'varchar(20)', notNull: true },
        status: { type: 'varchar(20)', notNull: true },
        duration: { type: 'integer' },
        started_at: { type: 'timestamp' },
        ended_at: { type: 'timestamp' },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });

    // 6. Blocked Users
    pgm.createTable('blocked_users', {
        blocker_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        blocked_id: { type: 'integer', notNull: true, references: '"users"', onDelete: 'CASCADE' },
        created_at: {
            type: 'timestamp',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
    pgm.addConstraint('blocked_users', 'pk_blocked_users', {
        primaryKey: ['blocker_id', 'blocked_id']
    });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 * @param run {() => void | undefined}
 * @returns {Promise<void> | void}
 */
exports.down = (pgm) => {
    pgm.dropTable('blocked_users');
    pgm.dropTable('calls');
    pgm.dropTable('messages');
    pgm.dropTable('friendships');
    pgm.dropTable('friend_requests');
    pgm.dropTable('users');
};
