const { z } = require('zod');

const blockUserSchema = {
    body: z.object({
        blockedId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/).transform(Number)])
            .pipe(z.number().int().positive('Blocked user ID must be a positive number'))
    })
};

const blockedIdParam = {
    params: z.object({
        blockedId: z.string().regex(/^\d+$/, 'Blocked user ID must be a number').transform(Number)
    })
};

const userIdParam = {
    params: z.object({
        userId: z.string().regex(/^\d+$/, 'User ID must be a number').transform(Number)
    })
};

module.exports = { blockUserSchema, blockedIdParam, userIdParam };
