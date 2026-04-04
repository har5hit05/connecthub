const db = require('../config/database');
const redisService = require('../services/redisService');
const redisClient = require('../config/redis');
const logger = require('../utils/logger');

// Per-socket rate limiter: tracks event counts in sliding windows
function createRateLimiter() {
    const buckets = new Map();
    return function isRateLimited(event, maxPerWindow, windowMs = 10000) {
        const now = Date.now();
        if (!buckets.has(event)) buckets.set(event, []);
        const timestamps = buckets.get(event).filter(t => now - t < windowMs);
        if (timestamps.length >= maxPerWindow) return true;
        timestamps.push(now);
        buckets.set(event, timestamps);
        return false;
    };
}

const setupSocketHandlers = (io) => {
    io.on('connection', async (socket) => {
        const rateLimiter = createRateLimiter();
        const userId = socket.userId;
        logger.info({ socketId: socket.id, userId }, '🔌 Socket connected');

        // Register user in Redis
        await redisService.setUserOnline(userId, socket.id);

        // Tell ALL other users that this user came online
        socket.broadcast.emit('user_online', { userId });

        // Send this user the list of who is currently online
        const onlineUsers = await redisService.getOnlineUsers();
        socket.emit('online_users', { users: onlineUsers.map(id => parseInt(id, 10)) });

        socket.on('send_message', async (data) => {
            try {
                if (rateLimiter('send_message', 30)) {
                    socket.emit('message_error', { message: 'Too many messages. Slow down.' });
                    return;
                }
                const senderId = socket.userId;
                const { receiverId, message, fileUrl, fileType, fileName } = data;

                if (!receiverId || !Number.isInteger(Number(receiverId))) {
                    socket.emit('message_error', { message: 'Invalid receiver' });
                    return;
                }
                if (message && typeof message === 'string' && message.length > 5000) {
                    socket.emit('message_error', { message: 'Message too long (max 5000 chars)' });
                    return;
                }

                const blockCheck = await db.query(
                    `SELECT * FROM blocked_users
                    WHERE (blocker_id = $1 AND blocked_id = $2)
                    OR (blocker_id = $2 AND blocked_id = $1)`,
                    [senderId, receiverId]
                );

                if (blockCheck.rows.length > 0) {
                    socket.emit('message_blocked', { message: 'Cannot send message to this user' });
                    return;
                }

                const result = await db.query(
                    `INSERT INTO messages (sender_id, receiver_id, message, file_url, file_type, file_name)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id, sender_id, receiver_id, message, file_url, file_type, file_name, created_at`,
                    [senderId, receiverId, message || null, fileUrl || null, fileType || null, fileName || null]
                );

                const savedMessage = result.rows[0];
                const receiverSocketId = await redisService.getSocketByUserId(receiverId);

                const messagePayload = {
                    id: savedMessage.id,
                    senderId: savedMessage.sender_id,
                    receiverId: savedMessage.receiver_id,
                    message: savedMessage.message,
                    fileUrl: savedMessage.file_url,
                    fileType: savedMessage.file_type,
                    fileName: savedMessage.file_name,
                    createdAt: savedMessage.created_at
                };

                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('receive_message', messagePayload);
                }

                socket.emit('message_sent', messagePayload);
            } catch (error) {
                logger.error({ err: error, senderId }, 'Send message error');
                socket.emit('message_error', { message: 'Failed to send message' });
            }
        });

        socket.on('typing_start', async (data) => {
            if (rateLimiter('typing', 20)) return;
            const senderId = socket.userId;
            const receiverSocketId = await redisService.getSocketByUserId(data.receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('user_typing', { userId: senderId, isTyping: true });
            }
        });

        socket.on('typing_stop', async (data) => {
            if (rateLimiter('typing', 20)) return;
            const senderId = socket.userId;
            const receiverSocketId = await redisService.getSocketByUserId(data.receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('user_typing', { userId: senderId, isTyping: false });
            }
        });

        socket.on('call_request', async (data) => {
            try {
                if (rateLimiter('call_request', 5)) {
                    socket.emit('call_failed', { message: 'Too many call attempts. Slow down.' });
                    return;
                }
                const callerId = socket.userId;
                const { receiverId, callType } = data;

                if (!receiverId || !Number.isInteger(Number(receiverId))) {
                    socket.emit('call_failed', { message: 'Invalid receiver' });
                    return;
                }
                if (!['audio', 'video'].includes(callType)) {
                    socket.emit('call_failed', { message: 'Invalid call type' });
                    return;
                }

                const blockCheck = await db.query(
                    `SELECT * FROM blocked_users
                    WHERE (blocker_id = $1 AND blocked_id = $2)
                    OR (blocker_id = $2 AND blocked_id = $1)`,
                    [callerId, receiverId]
                );

                if (blockCheck.rows.length > 0) {
                    socket.emit('call_blocked', { message: 'Cannot call this user' });
                    return;
                }

                const receiverSocketId = await redisService.getSocketByUserId(receiverId);

                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('incoming_call', {
                        callerId: callerId,
                        callType: callType
                    });

                    // Store pending call in Redis with 60 sec expiry
                    const pendingKey = `pending_call:${callerId}-${receiverId}`;
                    await redisClient.set(pendingKey, JSON.stringify({ callType }), 'EX', 60);
                } else {
                    await db.query(
                        `INSERT INTO calls (caller_id, receiver_id, call_type, status, created_at)
                         VALUES ($1, $2, $3, 'missed', NOW())`,
                        [callerId, receiverId, callType]
                    );

                    socket.emit('call_failed', { message: 'User is not online' });
                }
            } catch (error) {
                logger.error({ err: error }, 'Call request error');
                socket.emit('call_failed', { message: 'Failed to initiate call' });
            }
        });

        socket.on('call_accepted', async (data) => {
            const receiverId = socket.userId;
            const { callerId } = data;
            const callerSocketId = await redisService.getSocketByUserId(callerId);

            if (callerSocketId) {
                io.to(callerSocketId).emit('call_accepted', { receiverId: receiverId });
            }

            const pendingKey = `pending_call:${callerId}-${receiverId}`;
            const pendingDataStr = await redisClient.get(pendingKey);
            const callType = pendingDataStr ? JSON.parse(pendingDataStr).callType : 'video';
            await redisClient.del(pendingKey);

            const callKey = `active_call:${callerId}-${receiverId}`;
            await redisClient.set(callKey, JSON.stringify({
                callerId,
                receiverId,
                startTime: Date.now(),
                callType
            }));
        });

        socket.on('call_rejected', async (data) => {
            const receiverId = socket.userId;
            const { callerId } = data;
            const callerSocketId = await redisService.getSocketByUserId(callerId);

            if (callerSocketId) {
                io.to(callerSocketId).emit('call_rejected', { receiverId: receiverId });
            }

            const pendingKey = `pending_call:${callerId}-${receiverId}`;
            const pendingDataStr = await redisClient.get(pendingKey);
            const callType = pendingDataStr ? JSON.parse(pendingDataStr).callType : 'video';
            await redisClient.del(pendingKey);

            await db.query(
                `INSERT INTO calls (caller_id, receiver_id, call_type, status, created_at)
                 VALUES ($1, $2, $3, 'rejected', NOW())`,
                [callerId, receiverId, callType]
            );
        });

        socket.on('webrtc_offer', async (data) => {
            const senderId = socket.userId;
            const { receiverId, offer } = data;
            const receiverSocketId = await redisService.getSocketByUserId(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('webrtc_offer', { senderId, offer });
            }
        });

        socket.on('webrtc_answer', async (data) => {
            const senderId = socket.userId;
            const { receiverId, answer } = data;
            const receiverSocketId = await redisService.getSocketByUserId(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('webrtc_answer', { senderId, answer });
            }
        });

        socket.on('webrtc_ice_candidate', async (data) => {
            const senderId = socket.userId;
            const { receiverId, candidate } = data;
            const receiverSocketId = await redisService.getSocketByUserId(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('webrtc_ice_candidate', { senderId, candidate });
            }
        });

        socket.on('call_ended', async (data) => {
            const senderId = socket.userId;
            const receiverId = data?.receiverId;

            if (!receiverId) return;

            const receiverSocketId = await redisService.getSocketByUserId(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('call_ended', { senderId });
            }

            let callKey = `active_call:${senderId}-${receiverId}`;
            let callDataStr = await redisClient.get(callKey);

            if (!callDataStr) {
                callKey = `active_call:${receiverId}-${senderId}`;
                callDataStr = await redisClient.get(callKey);
            }

            if (callDataStr) {
                const callData = JSON.parse(callDataStr);
                const duration = Math.round((Date.now() - callData.startTime) / 1000);

                try {
                    const result = await db.query(
                        `INSERT INTO calls (caller_id, receiver_id, call_type, status, duration, started_at, ended_at, created_at)
                         VALUES ($1, $2, $3, 'completed', $4, TO_TIMESTAMP($5 / 1000.0), NOW(), NOW())
                         RETURNING id`,
                        [callData.callerId, callData.receiverId, callData.callType, duration, callData.startTime]
                    );
                    const callId = result.rows[0].id;
                    socket.emit('call_recorded', { callId });
                    if (receiverSocketId) {
                        io.to(receiverSocketId).emit('call_recorded', { callId });
                    }
                } catch (err) {
                    logger.error({ err }, 'Failed to save completed call');
                }

                await redisClient.del(callKey);
            }
        });

        socket.on('disconnect', async () => {
            const userId = socket.userId;
            
            await redisService.removeUserSocket(socket.id);
            logger.info({ socketId: socket.id, userId }, '❌ Socket disconnected / User went offline');

            socket.broadcast.emit('user_offline', { userId });
            socket.broadcast.emit('call_ended', { senderId: userId });
        });
    });
};

module.exports = { setupSocketHandlers };
