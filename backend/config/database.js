const { Pool } = require('pg');
const config = require('./index');
const logger = require('../utils/logger');

// Create PostgreSQL connection pool
// The connection string comes from our centralized config (which validates
// that DATABASE_URL exists at startup — fail-fast if it's missing).
const pool = new Pool({
    connectionString: config.databaseUrl,
});

// Test database connection
pool.on('connect', () => {
    logger.info('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
    logger.fatal({ err }, '💥 Unexpected error on idle client');
    process.exit(-1);
});

module.exports = pool;