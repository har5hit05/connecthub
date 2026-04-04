const redisClient = require('../config/redis');

class RedisService {
    /**
     * Map a user ID to a socket ID when they connect.
     * Stores in a Redis Hash mapping userId -> socketId.
     */
    async setUserOnline(userId, socketId) {
        // We use a Redis hash 'online_users'
        // Field = userId, Value = socketId
        await redisClient.hset('online_users', userId.toString(), socketId);
        
        // Also keep a reverse map for fast O(1) lookup on disconnect
        // Key = socket_user:{socketId}, Value = userId
        // Set expiry for 24h just in case there's a zombie socket
        await redisClient.set(`socket_user:${socketId}`, userId.toString(), 'EX', 86400);
    }

    /**
     * Get the user ID associated with a given socket ID
     */
    async getUserIdBySocket(socketId) {
        return await redisClient.get(`socket_user:${socketId}`);
    }

    /**
     * Get the socket ID associated with a user ID
     */
    async getSocketByUserId(userId) {
        return await redisClient.hget('online_users', userId.toString());
    }

    /**
     * Remove a user from the online list when they disconnect.
     * Uses a Lua script for atomic check-and-delete to prevent
     * a race condition where a reconnect overwrites the new socket.
     */
    async removeUserSocket(socketId) {
        const userId = await this.getUserIdBySocket(socketId);
        if (userId) {
            // Atomic: only delete from online_users if the stored socket still matches
            await redisClient.eval(
                `if redis.call('hget', KEYS[1], ARGV[1]) == ARGV[2] then
                    return redis.call('hdel', KEYS[1], ARGV[1])
                end
                return 0`,
                1,
                'online_users',
                userId,
                socketId
            );
            await redisClient.del(`socket_user:${socketId}`);
        }
        return userId;
    }

    /**
     * Get all currently online user IDs
     */
    async getOnlineUsers() {
        const keys = await redisClient.hkeys('online_users');
        // Convert string keys back to numbers if needed, but strings are fine
        return keys;
    }
}

module.exports = new RedisService();
