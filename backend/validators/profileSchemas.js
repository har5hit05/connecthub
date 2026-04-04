const { z } = require('zod');

const userIdParam = {
    params: z.object({
        userId: z.string().regex(/^\d+$/, 'User ID must be a number').transform(Number)
    })
};

const updateProfileSchema = {
    body: z.object({
        displayName: z.string()
            .trim()
            .max(50, 'Display name must be at most 50 characters')
            .optional(),
        bio: z.string()
            .trim()
            .max(500, 'Bio must be at most 500 characters')
            .optional(),
        status: z.string()
            .trim()
            .max(100, 'Status must be at most 100 characters')
            .optional()
    }).refine(
        (data) => data.displayName !== undefined || data.bio !== undefined || data.status !== undefined,
        { message: 'At least one field (displayName, bio, or status) is required' }
    )
};

module.exports = { userIdParam, updateProfileSchema };
