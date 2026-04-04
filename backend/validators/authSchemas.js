const { z } = require('zod');

const registerSchema = {
    body: z.object({
        username: z.string()
            .trim()
            .min(3, 'Username must be at least 3 characters')
            .max(30, 'Username must be at most 30 characters')
            .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
        email: z.string()
            .trim()
            .email('Invalid email address')
            .max(255, 'Email must be at most 255 characters'),
        password: z.string()
            .min(8, 'Password must be at least 8 characters')
            .max(128, 'Password must be at most 128 characters')
            .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
            .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
            .regex(/[0-9]/, 'Password must contain at least one number')
    })
};

const loginSchema = {
    body: z.object({
        email: z.string()
            .trim()
            .email('Invalid email address'),
        password: z.string()
            .min(1, 'Password is required')
    })
};

module.exports = { registerSchema, loginSchema };
