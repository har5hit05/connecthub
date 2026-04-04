const { z } = require('zod');

const chatHistoryParam = {
    params: z.object({
        userId: z.string().regex(/^\d+$/, 'User ID must be a number').transform(Number)
    })
};

// Validates optional query params for paginated chat history
// ?limit=50&before=123 (before = cursor: oldest message ID currently loaded)
const chatHistoryQuery = {
    query: z.object({
        limit: z.string()
            .regex(/^\d+$/, 'Limit must be a number')
            .transform(Number)
            .pipe(z.number().int().min(1).max(100))
            .optional(),
        before: z.string()
            .regex(/^\d+$/, 'Before must be a number')
            .transform(Number)
            .pipe(z.number().int().positive())
            .optional()
    })
};

// Validates optional query params for paginated call history
// ?page=1&limit=20
const callHistoryQuery = {
    query: z.object({
        page: z.string()
            .regex(/^\d+$/, 'Page must be a number')
            .transform(Number)
            .pipe(z.number().int().min(1))
            .optional(),
        limit: z.string()
            .regex(/^\d+$/, 'Limit must be a number')
            .transform(Number)
            .pipe(z.number().int().min(1).max(50))
            .optional()
    })
};

module.exports = { chatHistoryParam, chatHistoryQuery, callHistoryQuery };
