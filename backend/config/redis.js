const Redis = require('ioredis');
const logger = require('../utils/logger');

// Retrieve REDIS_URL from environment (set in docker-compose or .env)
const redisClient = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

redisClient.on('connect', () => {
    logger.info('✅ Connected to Redis cache');
    // Clear out stale zombie presence data from previous dev server crashes
    redisClient.del('online_users').catch(err => logger.error({ err }, 'Failed to clear zombie users'));
});

redisClient.on('error', (err) => {
    logger.error({ err }, '❌ Redis connection error');
});

module.exports = redisClient;
