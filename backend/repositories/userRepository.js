const db = require('../config/database');

/**
 * User Repository
 * 
 * WHY A REPOSITORY LAYER?
 * This isolates all database SQL queries away from business logic.
 * If we ever switch from PostgreSQL to MongoDB or an ORM like Prisma,
 * we only rewrite this file. The Services and Controllers remain untouched.
 */
class UserRepository {
    async findByEmail(email) {
        const result = await db.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        );
        return result.rows[0];
    }

    async findByUsername(username) {
        const result = await db.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        return result.rows[0];
    }

    async findById(id) {
        const result = await db.query(
            'SELECT id, username, email, display_name, avatar_url, created_at FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0];
    }

    async create(userData) {
        const { username, email, passwordHash } = userData;
        const result = await db.query(
            `INSERT INTO users (username, email, password_hash)
             VALUES ($1, $2, $3)
             RETURNING id, username, email, created_at`,
            [username, email, passwordHash]
        );
        return result.rows[0];
    }

    async searchUsers(query, limit = 20) {
        const result = await db.query(
            `SELECT id, username, display_name, avatar_url 
             FROM users 
             WHERE username ILIKE $1 OR display_name ILIKE $1 
             LIMIT $2`,
            [`%${query}%`, limit]
        );
        return result.rows;
    }

    async getProfile(id) {
        const result = await db.query(
            `SELECT id, username, email, display_name, bio, status, avatar_url, 
                    is_online, last_seen, created_at
             FROM users 
             WHERE id = $1`,
            [id]
        );
        return result.rows[0];
    }

    async updateProfile(id, updates, values) {
        const query = `
            UPDATE users 
            SET ${updates.join(', ')}
            WHERE id = $${values.length}
            RETURNING id, username, email, display_name, bio, status, avatar_url, is_online
        `;
        const result = await db.query(query, values);
        return result.rows[0];
    }

    async getAvatar(id) {
        const result = await db.query(
            'SELECT avatar_url FROM users WHERE id = $1',
            [id]
        );
        return result.rows[0]?.avatar_url;
    }

    async updateAvatar(id, avatarUrl) {
        const result = await db.query(
            `UPDATE users
             SET avatar_url = $1
             WHERE id = $2
             RETURNING id, username, avatar_url`,
            [avatarUrl, id]
        );
        return result.rows[0];
    }
}

module.exports = new UserRepository();
