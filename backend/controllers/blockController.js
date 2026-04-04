const blockService = require('../services/blockService');

// ─────────────────────────────────────────────
// BLOCK A USER
// Blocks a user and removes friendship if exists
// ─────────────────────────────────────────────
const blockUser = async (req, res, next) => {
    try {
        const { blockedId } = req.body;
        await blockService.blockUser(req.user.id, blockedId);
        res.status(200).json({ message: 'User blocked successfully' });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// UNBLOCK A USER
// Removes the block
// ─────────────────────────────────────────────
const unblockUser = async (req, res, next) => {
    try {
        await blockService.unblockUser(req.user.id, req.params.blockedId);
        res.status(200).json({ message: 'User unblocked successfully' });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// GET MY BLOCKED USERS LIST
// Returns all users I have blocked
// ─────────────────────────────────────────────
const getBlockedUsers = async (req, res, next) => {
    try {
        const blockedUsers = await blockService.getBlockedUsers(req.user.id);
        res.status(200).json({ blockedUsers });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────────────
// CHECK IF USER IS BLOCKED
// Returns block status between two users
// ─────────────────────────────────────────────
const checkBlockStatus = async (req, res, next) => {
    try {
        const status = await blockService.checkBlockStatus(req.user.id, req.params.userId);
        res.status(200).json(status);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    blockUser,
    unblockUser,
    getBlockedUsers,
    checkBlockStatus
};