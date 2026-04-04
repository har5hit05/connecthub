const fs = require('fs');
const path = require('path');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

class ProfileService {
    async getProfile(userId) {
        const user = await userRepository.getProfile(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }
        return user;
    }

    async updateProfile(userId, displayName, bio, status) {
        // Build dynamic update array
        const updates = [];
        const values = [];
        let paramCount = 1;

        if (displayName !== undefined) {
            updates.push(`display_name = $${paramCount}`);
            values.push(displayName);
            paramCount++;
        }

        if (bio !== undefined) {
            updates.push(`bio = $${paramCount}`);
            values.push(bio);
            paramCount++;
        }

        if (status !== undefined) {
            updates.push(`status = $${paramCount}`);
            values.push(status);
            paramCount++;
        }

        if (updates.length === 0) {
            throw new AppError('No fields to update', 400);
        }

        // Add userId as the last parameter
        values.push(userId);

        const updatedUser = await userRepository.updateProfile(userId, updates, values);
        return updatedUser;
    }

    async uploadAvatar(userId, file) {
        if (!file) {
            throw new AppError('No file uploaded', 400);
        }

        // Get old avatar path before updating
        const oldAvatarUrl = await userRepository.getAvatar(userId);

        // Update DB first — if this fails, the old avatar is still intact
        const avatarUrl = `/uploads/avatars/${file.filename}`;
        const updatedUser = await userRepository.updateAvatar(userId, avatarUrl);

        // Only delete old file after DB update succeeds
        if (oldAvatarUrl) {
            const uploadsDir = path.resolve(__dirname, '../uploads/avatars');
            const oldAvatarPath = path.resolve(__dirname, '..', oldAvatarUrl.replace(/^\//, ''));

            if (oldAvatarPath.startsWith(uploadsDir) && fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
            }
        }

        return { avatarUrl, user: updatedUser };
    }

    async deleteAvatar(userId) {
        const avatarUrl = await userRepository.getAvatar(userId);

        if (avatarUrl) {
            const uploadsDir = path.resolve(__dirname, '../uploads/avatars');
            const avatarPath = path.resolve(__dirname, '..', avatarUrl.replace(/^\//, ''));
            
            if (avatarPath.startsWith(uploadsDir) && fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
            }

            await userRepository.updateAvatar(userId, null);
        }
    }
}

module.exports = new ProfileService();
