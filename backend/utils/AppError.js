class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
        this.isOperational = true; // Signals that this is a predictable, handled error (like invalid input)

        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = AppError;
