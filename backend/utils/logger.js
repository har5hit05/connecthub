const pino = require('pino');
const config = require('../config');

const isDev = config.nodeEnv !== 'production';

const logger = pino({
    level: isDev ? 'debug' : 'info',
    transport: isDev ? {
        target: 'pino-pretty',
        options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname'
        }
    } : undefined,
});

module.exports = logger;
