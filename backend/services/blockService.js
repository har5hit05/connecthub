const blockRepository = require('../repositories/blockRepository');
const AppError = require('../utils/AppError');

class BlockService {
    async blockUser(blockerId, blockedId) {
        if (blockerId === blockedId) {
            throw new AppError('Cannot block yourself', 400);
        }

        const existingBlock = await blockRepository.findBlock(blockerId, blockedId);
        if (existingBlock) {
            throw new AppError('User is already blocked', 400);
        }

        await blockRepository.blockUserTransaction(blockerId, blockedId);
    }

    async unblockUser(blockerId, blockedId) {
        const result = await blockRepository.deleteBlock(blockerId, blockedId);
        if (!result) {
            throw new AppError('Block not found', 404);
        }
    }

    async getBlockedUsers(blockerId) {
        return await blockRepository.getBlockedUsers(blockerId);
    }

    async checkBlockStatus(myUserId, targetUserId) {
        const iBlockedThem = await blockRepository.findBlock(myUserId, targetUserId);
        const theyBlockedMe = await blockRepository.findBlock(targetUserId, myUserId);

        return {
            iBlockedThem: !!iBlockedThem,
            theyBlockedMe: !!theyBlockedMe
        };
    }
}

module.exports = new BlockService();
