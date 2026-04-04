const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

/**
 * Auth Service
 * 
 * WHY A SERVICE LAYER?
 * This layer contains pure business logic. It has ZERO knowledge of HTTP
 * (req, res, headers, cookies). Because of this, we can easily unit test
 * these functions without spinning up an Express server!
 */
class AuthService {
    async register(username, email, password) {
        // Check uniqueness with a generic message to prevent user enumeration
        const existingEmail = await userRepository.findByEmail(email);
        const existingUsername = await userRepository.findByUsername(username);
        if (existingEmail || existingUsername) {
            throw new AppError('Username or email is already in use', 400);
        }

        // Business logic: hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Interact with database via repository
        const newUser = await userRepository.create({
            username,
            email,
            passwordHash
        });

        return {
            id: newUser.id,
            username: newUser.username,
            email: newUser.email
        };
    }

    async login(email, password) {
        // Business logic: find user by email
        const user = await userRepository.findByEmail(email);
        if (!user) {
            // Using a generic 401 error message for security (don't reveal if email exists)
            throw new AppError('Invalid email or password', 401);
        }

        // Business logic: verify password
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            throw new AppError('Invalid email or password', 401);
        }

        // Business logic: generate signed JWT
        const token = jwt.sign(
            { id: user.id, username: user.username, email: user.email },
            config.jwtSecret,
            { expiresIn: config.jwtExpiresIn }
        );

        return {
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email
            }
        };
    }

    async getProfile(userId) {
        const user = await userRepository.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }
        return user;
    }
}

module.exports = new AuthService();
