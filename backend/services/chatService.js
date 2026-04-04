const chatRepository = require('../repositories/chatRepository');
const friendRepository = require('../repositories/friendRepository');
const callRepository = require('../repositories/callRepository');
const AppError = require('../utils/AppError');

class ChatService {
    async getChatHistory(myUserId, otherUserId, beforeStr, limitStr) {
        let result;

        if (beforeStr) {
            result = await chatRepository.getHistoryBefore(myUserId, otherUserId, beforeStr, limitStr);
        } else {
            result = await chatRepository.getHistoryLatest(myUserId, otherUserId, limitStr);
        }

        // Results came back in DESC order (newest first) — reverse to ASC for display
        const messages = result.messages.reverse();
        
        // hasMore = true if we got a full page
        const hasMore = result.messages.length === result.limit;
        
        // nextCursor = ID of the oldest message in this batch
        const nextCursor = messages.length > 0 ? messages[0].id : null;

        return { messages, hasMore, nextCursor };
    }

    async getAllUsers(myUserId) {
        const redisService = require('./redisService');
        const users = await friendRepository.getContacts(myUserId);
        const onlineUsers = await redisService.getOnlineUsers();
        
        return users.map(user => ({
            ...user,
            is_online: onlineUsers.includes(user.id.toString())
        }));
    }

    async getCallHistory(userId, pageStr, limitStr) {
        const page = parseInt(pageStr, 10) || 1;
        const limit = parseInt(limitStr, 10) || 20;
        const offset = (page - 1) * limit;

        const { calls, total } = await callRepository.getCallHistory(userId, offset, limit);
        const totalPages = Math.ceil(total / limit);

        return {
            calls,
            pagination: {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages
            }
        };
    }
}

module.exports = new ChatService();
