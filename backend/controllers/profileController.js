const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for avatar uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/avatars');

        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Create unique filename: userId_timestamp.extension
        const uniqueName = `${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
    }
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        cb(null, true);
    } else {
        cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// ─────────────────────────────────────────────
// GET MY PROFILE
// Returns current user's full profile
// ─────────────────────────────────────────────
const getMyProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const result = await db.query(
            `SELECT id, username, email, display_name, bio, status, avatar_url, 
              is_online, last_seen, created_at
       FROM users 
       WHERE id = $1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get my profile error:', error);
        res.status(500).json({ message: 'Failed to get profile' });
    }
};

// ─────────────────────────────────────────────
// GET USER PROFILE BY ID
// Returns another user's public profile
// ─────────────────────────────────────────────
const getUserProfile = async (req, res) => {
    try {
        const { userId } = req.params;
        const targetUserId = parseInt(userId);

        if (isNaN(targetUserId)) {
            return res.status(400).json({ message: 'Invalid user ID' });
        }

        const result = await db.query(
            `SELECT id, username, display_name, bio, status, avatar_url, 
              is_online, last_seen, created_at
       FROM users 
       WHERE id = $1`,
            [targetUserId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user: result.rows[0] });
    } catch (error) {
        console.error('Get user profile error:', error);
        res.status(500).json({ message: 'Failed to get user profile' });
    }
};

// ─────────────────────────────────────────────
// UPDATE MY PROFILE
// Updates display name, bio, and status
// ─────────────────────────────────────────────
const updateMyProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { displayName, bio, status } = req.body;

        console.log('Update profile request:', { userId, displayName, bio, status });

        // Build dynamic update query
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
            return res.status(400).json({ message: 'No fields to update' });
        }

        // Add userId as the last parameter
        values.push(userId);

        const query = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, username, email, display_name, bio, status, avatar_url, is_online
    `;

        const result = await db.query(query, values);

        console.log('Profile updated:', result.rows[0]);

        res.status(200).json({
            message: 'Profile updated successfully',
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
};

// ─────────────────────────────────────────────
// UPLOAD AVATAR
// Handles avatar image upload
// ─────────────────────────────────────────────
const uploadAvatar = async (req, res) => {
    try {
        const userId = req.user.id;

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Get old avatar to delete it
        const oldAvatarResult = await db.query(
            'SELECT avatar_url FROM users WHERE id = $1',
            [userId]
        );

        const oldAvatarUrl = oldAvatarResult.rows[0]?.avatar_url;

        // Delete old avatar file if it exists
        if (oldAvatarUrl) {
            const oldAvatarPath = path.join(__dirname, '..', oldAvatarUrl);
            if (fs.existsSync(oldAvatarPath)) {
                fs.unlinkSync(oldAvatarPath);
                console.log('Deleted old avatar:', oldAvatarPath);
            }
        }

        // Save new avatar URL to database
        const avatarUrl = `/uploads/avatars/${req.file.filename}`;

        const result = await db.query(
            `UPDATE users 
       SET avatar_url = $1 
       WHERE id = $2 
       RETURNING id, username, avatar_url`,
            [avatarUrl, userId]
        );

        console.log('Avatar uploaded:', avatarUrl);

        res.status(200).json({
            message: 'Avatar uploaded successfully',
            avatarUrl: avatarUrl,
            user: result.rows[0]
        });
    } catch (error) {
        console.error('Upload avatar error:', error);
        res.status(500).json({ message: 'Failed to upload avatar' });
    }
};

// ─────────────────────────────────────────────
// DELETE AVATAR
// Removes user's avatar
// ─────────────────────────────────────────────
const deleteAvatar = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get current avatar
        const result = await db.query(
            'SELECT avatar_url FROM users WHERE id = $1',
            [userId]
        );

        const avatarUrl = result.rows[0]?.avatar_url;

        if (avatarUrl) {
            // Delete file
            const avatarPath = path.join(__dirname, '..', avatarUrl);
            if (fs.existsSync(avatarPath)) {
                fs.unlinkSync(avatarPath);
                console.log('Deleted avatar file:', avatarPath);
            }

            // Remove from database
            await db.query(
                'UPDATE users SET avatar_url = NULL WHERE id = $1',
                [userId]
            );
        }

        res.status(200).json({ message: 'Avatar deleted successfully' });
    } catch (error) {
        console.error('Delete avatar error:', error);
        res.status(500).json({ message: 'Failed to delete avatar' });
    }
};

module.exports = {
    getMyProfile,
    getUserProfile,
    updateMyProfile,
    uploadAvatar,
    deleteAvatar,
    upload // Export multer middleware
};