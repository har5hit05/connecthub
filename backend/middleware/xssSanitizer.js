const xss = require('xss');

const sanitizePayload = (payload) => {
    if (typeof payload === 'string') {
        return xss(payload);
    }
    if (Array.isArray(payload)) {
        return payload.map(sanitizePayload);
    }
    if (typeof payload === 'object' && payload !== null) {
        const sanitizedData = {};
        for (const [key, value] of Object.entries(payload)) {
            // Do not sanitize passwords, as XSS could theoretically corrupt intended passwords
            if (key.toLowerCase().includes('password')) {
                sanitizedData[key] = value;
            } else {
                sanitizedData[key] = sanitizePayload(value);
            }
        }
        return sanitizedData;
    }
    return payload;
};

const xssSanitizer = () => {
    return (req, res, next) => {
        if (req.body) req.body = sanitizePayload(req.body);
        if (req.query) req.query = sanitizePayload(req.query);
        if (req.params) req.params = sanitizePayload(req.params);
        next();
    };
};

module.exports = xssSanitizer;
