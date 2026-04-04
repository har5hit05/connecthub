const config = require('../config');
const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Global Error Handler Middleware
 * 
 * Replaces scattered res.status(500).json(...) calls in every catch block.
 * When controllers throw errors (or pass them to next()), they land here.
 */
const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Default 500 server error
    if (!error.statusCode) {
        error.statusCode = 500;
        error.status = 'error';
    }

    // Database duplicate key error (PostgreSQL unique_violation code is 23505)
    if (error.code === '23505') {
        const message = 'Duplicate field value entered';
        error = new AppError(message, 400);
    }

    // For development, send full stack trace.
    // In production, hide the stack and only send operational (predictable) error messages.
    if (config.nodeEnv === 'development') {
        logger.error({ err }, `❌ Error [${error.statusCode}]: ${error.message}`);
        return res.status(error.statusCode).json({
            status: error.status,
            message: error.message,
            stack: err.stack,
            error: err
        });
    }

    // Production mode
    if (error.isOperational) {
        // Operational, trusted error: send message to client
        return res.status(error.statusCode).json({
            status: error.status,
            message: error.message
        });
    } else {
        // Programming or other unknown error: don't leak error details
        logger.fatal({ err }, '💥 UNHANDLED FATAL ERROR');
        return res.status(500).json({
            status: 'error',
            message: 'Something went very wrong!'
        });
    }
};

module.exports = errorHandler;
