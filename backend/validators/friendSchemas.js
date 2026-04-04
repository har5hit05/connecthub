const { z } = require('zod');

const searchQuerySchema = {
    query: z.object({
        query: z.string()
            .trim()
            .min(2, 'Search query must be at least 2 characters')
            .max(50, 'Search query must be at most 50 characters')
    })
};

const sendRequestSchema = {
    body: z.object({
        receiverId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)])
            .pipe(z.number().int().positive('Receiver ID must be a positive number'))
    })
};

const requestIdParam = {
    params: z.object({
        requestId: z.string().regex(/^\d+$/, 'Request ID must be a number').transform(Number)
    })
};

const friendIdParam = {
    params: z.object({
        friendId: z.string().regex(/^\d+$/, 'Friend ID must be a number').transform(Number)
    })
};

const userIdParam = {
    params: z.object({
        userId: z.string().regex(/^\d+$/, 'User ID must be a number').transform(Number)
    })
};

module.exports = { searchQuerySchema, sendRequestSchema, requestIdParam, friendIdParam, userIdParam };
