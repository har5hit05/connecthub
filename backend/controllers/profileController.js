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

const profileService = require('../services/profileService');

// ─────────────────────────────────────────────
// GET MY PROFILE
// Returns current user's full profile
// ─────────────────────────────────────────────
const getMyProfile = async (req, res, next) => {
    try {
        const user = await profileService.getProfile(req.user.id);
        res.status(200).json({ user });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// GET USER PROFILE BY ID
// Returns another user's public profile
// ─────────────────────────────────────────────
const getUserProfile = async (req, res, next) => {
    try {
        const user = await profileService.getProfile(req.params.userId);
        res.status(200).json({ user });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// UPDATE MY PROFILE
// Updates display name, bio, and status
// ─────────────────────────────────────────────
const updateMyProfile = async (req, res, next) => {
    try {
        const { displayName, bio, status } = req.body;
        const user = await profileService.updateProfile(req.user.id, displayName, bio, status);
        
        res.status(200).json({
            message: 'Profile updated successfully',
            user
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// UPLOAD AVATAR
// Handles avatar image upload
// ─────────────────────────────────────────────
const uploadAvatar = async (req, res, next) => {
    try {
        const { avatarUrl, user } = await profileService.uploadAvatar(req.user.id, req.file);
        
        res.status(200).json({
            message: 'Avatar uploaded successfully',
            avatarUrl,
            user
        });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// DELETE AVATAR
// Removes user's avatar
// ─────────────────────────────────────────────
const deleteAvatar = async (req, res, next) => {
    try {
        await profileService.deleteAvatar(req.user.id);
        res.status(200).json({ message: 'Avatar deleted successfully' });
    } catch (error) {
        next(error);
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