const friendRepository = require('../repositories/friendRepository');
const userRepository = require('../repositories/userRepository');
const AppError = require('../utils/AppError');

class FriendService {
    async searchUsers(query, myUserId) {
        if (!query || query.trim().length === 0) {
            return [];
        }
        // Utilizing userRepository since search is a user domain concern visually
        const users = await userRepository.searchUsers(query.trim(), 20);
        // Exclude the current user
        return users.filter(user => user.id !== myUserId);
    }

    async sendFriendRequest(senderId, receiverId) {
        if (senderId === parseInt(receiverId, 10)) {
            throw new AppError('Cannot send friend request to yourself', 400);
        }

        // Check if already friends
        const friendship = await friendRepository.checkFriendship(senderId, receiverId);
        if (friendship) {
            throw new AppError('Already friends', 400);
        }

        // Check if request already sent
        const existingRequest = await friendRepository.getFriendRequest(senderId, receiverId);
        if (existingRequest) {
            throw new AppError('Friend request already sent', 400);
        }

        // Check if they sent a request to me - auto accept if they did
        const reverseRequest = await friendRepository.getFriendRequest(receiverId, senderId);
        if (reverseRequest) {
            await friendRepository.autoAcceptRequest(senderId, receiverId);
            return { message: 'Friend request auto-accepted', friendship: true };
        }

        // Create new request
        const request = await friendRepository.createFriendRequest(senderId, receiverId);
        return { message: 'Friend request sent', request };
    }

    async getReceivedRequests(userId) {
        return await friendRepository.getReceivedRequests(userId);
    }

    async getSentRequests(userId) {
        return await friendRepository.getSentRequests(userId);
    }

    async acceptFriendRequest(requestId, myUserId) {
        // Validate request exists and is sent to me
        const request = await friendRepository.getFriendRequestById(requestId, myUserId);
        if (!request) {
            throw new AppError('Friend request not found', 404);
        }

        await friendRepository.acceptRequest(requestId, myUserId, request.sender_id);
    }

    async rejectFriendRequest(requestId, myUserId) {
        const result = await friendRepository.deleteFriendRequest(requestId, 'receiver', myUserId);
        if (!result) {
            throw new AppError('Friend request not found', 404);
        }
    }

    async cancelFriendRequest(requestId, myUserId) {
        const result = await friendRepository.deleteFriendRequest(requestId, 'sender', myUserId);
        if (!result) {
            throw new AppError('Friend request not found', 404);
        }
    }

    async getFriends(userId) {
        const redisService = require('./redisService');
        const friends = await friendRepository.getFriends(userId);
        const onlineUsers = await redisService.getOnlineUsers();
        
        return friends.map(friend => ({
            ...friend,
            is_online: onlineUsers.includes(friend.friend_id.toString())
        }));
    }

    async removeFriend(myUserId, friendId) {
        const result = await friendRepository.removeFriend(myUserId, friendId);
        if (!result) {
            throw new AppError('Friendship not found', 404);
        }
    }

    async checkFriendshipStatus(myUserId, targetUserId) {
        if (myUserId === parseInt(targetUserId, 10)) {
            return { status: 'self' };
        }

        const friendship = await friendRepository.checkFriendship(myUserId, targetUserId);
        if (friendship) {
            return { status: 'friends' };
        }

        const sentRequest = await friendRepository.getFriendRequest(myUserId, targetUserId);
        if (sentRequest) {
            return { status: 'request_sent', requestId: sentRequest.id };
        }

        const receivedRequest = await friendRepository.getFriendRequest(targetUserId, myUserId);
        if (receivedRequest) {
            return { status: 'request_received', requestId: receivedRequest.id };
        }

        return { status: 'none' };
    }
}

module.exports = new FriendService();
