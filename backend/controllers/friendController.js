const friendService = require('../services/friendService');

const searchUsers = async (req, res, next) => {
    try {
        const users = await friendService.searchUsers(req.query.query, req.user.id);
        res.status(200).json({ users });
    } catch (error) {
        next(error);
    }
};

const sendFriendRequest = async (req, res, next) => {
    try {
        const result = await friendService.sendFriendRequest(req.user.id, req.body.receiverId);
        // It might be an auto-accept or standard request
        const status = result.friendship ? 200 : 201;
        res.status(status).json(result);
    } catch (error) {
        next(error);
    }
};

const getReceivedRequests = async (req, res, next) => {
    try {
        const requests = await friendService.getReceivedRequests(req.user.id);
        res.status(200).json({ requests });
    } catch (error) {
        next(error);
    }
};

const getSentRequests = async (req, res, next) => {
    try {
        const requests = await friendService.getSentRequests(req.user.id);
        res.status(200).json({ requests });
    } catch (error) {
        next(error);
    }
};

const acceptFriendRequest = async (req, res, next) => {
    try {
        await friendService.acceptFriendRequest(req.params.requestId, req.user.id);
        res.status(200).json({ message: 'Friend request accepted' });
    } catch (error) {
        next(error);
    }
};

const rejectFriendRequest = async (req, res, next) => {
    try {
        await friendService.rejectFriendRequest(req.params.requestId, req.user.id);
        res.status(200).json({ message: 'Friend request rejected' });
    } catch (error) {
        next(error);
    }
};

const cancelFriendRequest = async (req, res, next) => {
    try {
        await friendService.cancelFriendRequest(req.params.requestId, req.user.id);
        res.status(200).json({ message: 'Friend request cancelled' });
    } catch (error) {
        next(error);
    }
};

const getFriends = async (req, res, next) => {
    try {
        const friends = await friendService.getFriends(req.user.id);
        res.status(200).json({ friends });
    } catch (error) {
        next(error);
    }
};

const removeFriend = async (req, res, next) => {
    try {
        await friendService.removeFriend(req.user.id, req.params.friendId);
        res.status(200).json({ message: 'Friend removed' });
    } catch (error) {
        next(error);
    }
};

const checkFriendshipStatus = async (req, res, next) => {
    try {
        const status = await friendService.checkFriendshipStatus(req.user.id, req.params.userId);
        res.status(200).json(status);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    searchUsers,
    sendFriendRequest,
    getReceivedRequests,
    getSentRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    getFriends,
    removeFriend,
    checkFriendshipStatus
};
