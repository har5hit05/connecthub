const { ZodError } = require('zod');

// Reusable validation middleware factory
// Takes a schema object with optional keys: body, params, query
// Returns an Express middleware that validates the request
const validate = (schemas) => (req, res, next) => {
    try {
        if (schemas.body) {
            req.body = schemas.body.parse(req.body);
        }
        if (schemas.params) {
            req.params = schemas.params.parse(req.params);
        }
        if (schemas.query) {
            req.query = schemas.query.parse(req.query);
        }
        next();
    } catch (error) {
        if (error instanceof ZodError) {
            const messages = error.issues.map((e) => e.message);
            return res.status(400).json({ message: messages[0], errors: messages });
        }
        next(error);
    }
};

module.exports = { validate };
