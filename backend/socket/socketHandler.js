const db = require('../config/database');

// This is a Map that stores: userId → socketId
// It lets us find which socket belongs to which user
// Example: { 1 → "abc123", 2 → "def456" }
const onlineUsers = new Map();
const activeCalls = new Map(); // Stores active calls: "callerId-receiverId" → { startTime, callType }

const setupSocketHandlers = (io) => {

    io.on('connection', (socket) => {
        console.log('🔌 Socket connected:', socket.id);

        // ─────────────────────────────────────
        // EVENT: authenticate
        // Called when a logged-in user connects
        // We save their userId ↔ socketId mapping
        // ─────────────────────────────────────
        socket.on('authenticate', (userId) => {
            // Save this user as online
            onlineUsers.set(userId, socket.id);
            console.log(`✅ User ${userId} is online (socket: ${socket.id})`);

            // Tell ALL other users that this user came online
            socket.broadcast.emit('user_online', { userId });

            // Send this user the list of who is currently online
            socket.emit('online_users', { users: Array.from(onlineUsers.keys()) });
        });

        // ─────────────────────────────────────
        // EVENT: send_message
        // Called when a user sends a chat message (text or file)
        // ─────────────────────────────────────
        socket.on('send_message', async (data) => {
            try {
                const { senderId, receiverId, message, fileUrl, fileType, fileName } = data;

                // Check if blocked
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

                // Save message to database (with optional file fields)
                const result = await db.query(
                    `INSERT INTO messages (sender_id, receiver_id, message, file_url, file_type, file_name)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     RETURNING id, sender_id, receiver_id, message, file_url, file_type, file_name, created_at`,
                    [senderId, receiverId, message || null, fileUrl || null, fileType || null, fileName || null]
                );

                const savedMessage = result.rows[0];
                const receiverSocketId = onlineUsers.get(receiverId);

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

                // Send to receiver if online
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('receive_message', messagePayload);
                }

                // Send confirmation back to sender
                socket.emit('message_sent', messagePayload);

            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('message_error', { message: 'Failed to send message' });
            }
        });

        // ─────────────────────────────────────
        // EVENT: typing_start
        // ─────────────────────────────────────
        socket.on('typing_start', (data) => {
            const { senderId, receiverId } = data;
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('user_typing', { userId: senderId, isTyping: true });
            }
        });

        // ─────────────────────────────────────
        // EVENT: typing_stop
        // ─────────────────────────────────────
        socket.on('typing_stop', (data) => {
            const { senderId, receiverId } = data;
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('user_typing', { userId: senderId, isTyping: false });
            }
        });

        // ─────────────────────────────────────
        // EVENT: call_request
        // User A wants to call User B
        // ─────────────────────────────────────
        socket.on('call_request', async (data) => {
            try {
                const { callerId, receiverId, callType } = data;

                // Check if blocked — must await the query
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

                const receiverSocketId = onlineUsers.get(receiverId);

                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('incoming_call', {
                        callerId: callerId,
                        callType: callType
                    });

                    // Store pending call so we have callType when it's accepted
                    const pendingKey = `pending-${callerId}-${receiverId}`;
                    activeCalls.set(pendingKey, { callType });
                } else {
                    // Receiver is offline — save as missed call
                    db.query(
                        `INSERT INTO calls (caller_id, receiver_id, call_type, status, created_at)
                         VALUES ($1, $2, $3, 'missed', NOW())`,
                        [callerId, receiverId, callType]
                    ).catch(err => console.error('Failed to save missed call:', err));

                    socket.emit('call_failed', { message: 'User is not online' });
                }
            } catch (error) {
                console.error('Call request error:', error);
                socket.emit('call_failed', { message: 'Failed to initiate call' });
            }
        });

        // ─────────────────────────────────────
        // EVENT: call_accepted
        // User B accepted the call
        // ─────────────────────────────────────
        socket.on('call_accepted', (data) => {
            const { callerId, receiverId } = data;
            const callerSocketId = onlineUsers.get(callerId);

            if (callerSocketId) {
                io.to(callerSocketId).emit('call_accepted', { receiverId: receiverId });
            }

            const pendingKey = `pending-${callerId}-${receiverId}`;
            const pendingCall = activeCalls.get(pendingKey);
            const callType = pendingCall ? pendingCall.callType : 'video';
            activeCalls.delete(pendingKey);

            const callKey = `${callerId}-${receiverId}`;
            activeCalls.set(callKey, {
                callerId,
                receiverId,
                startTime: new Date(),
                callType: callType
            });
        });

        // ─────────────────────────────────────
        // EVENT: call_rejected
        // User B rejected the call
        // ─────────────────────────────────────
        socket.on('call_rejected', (data) => {
            const { callerId, receiverId } = data;
            const callerSocketId = onlineUsers.get(callerId);

            if (callerSocketId) {
                io.to(callerSocketId).emit('call_rejected', { receiverId: receiverId });
            }

            const pendingKey = `pending-${callerId}-${receiverId}`;
            const pendingCall = activeCalls.get(pendingKey);
            const callType = pendingCall ? pendingCall.callType : 'video';
            activeCalls.delete(pendingKey);

            db.query(
                `INSERT INTO calls (caller_id, receiver_id, call_type, status, created_at)
                 VALUES ($1, $2, $3, 'rejected', NOW())`,
                [callerId, receiverId, callType]
            ).catch(err => console.error('Failed to save rejected call:', err));
        });

        // ─────────────────────────────────────
        // EVENT: webrtc_offer
        // ─────────────────────────────────────
        socket.on('webrtc_offer', (data) => {
            const { senderId, receiverId, offer } = data;
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('webrtc_offer', { senderId, offer });
            }
        });

        // ─────────────────────────────────────
        // EVENT: webrtc_answer
        // ─────────────────────────────────────
        socket.on('webrtc_answer', (data) => {
            const { senderId, receiverId, answer } = data;
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('webrtc_answer', { senderId, answer });
            }
        });

        // ─────────────────────────────────────
        // EVENT: webrtc_ice_candidate
        // ─────────────────────────────────────
        socket.on('webrtc_ice_candidate', (data) => {
            const { senderId, receiverId, candidate } = data;
            const receiverSocketId = onlineUsers.get(receiverId);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('webrtc_ice_candidate', { senderId, candidate });
            }
        });

        // ─────────────────────────────────────
        // EVENT: call_ended
        // Either user ended the call
        // ─────────────────────────────────────
        socket.on('call_ended', (data) => {
            if (!data) return;
            const { senderId, receiverId } = data;

            if (receiverId) {
                const receiverSocketId = onlineUsers.get(receiverId);
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('call_ended', { senderId });
                }
            }

            // Find the active call (could be either direction)
            let callKey = `${senderId}-${receiverId}`;
            let callData = activeCalls.get(callKey);

            if (!callData) {
                callKey = `${receiverId}-${senderId}`;
                callData = activeCalls.get(callKey);
            }

            if (callData) {
                const duration = Math.round((new Date() - callData.startTime) / 1000);

                db.query(
                    `INSERT INTO calls (caller_id, receiver_id, call_type, status, duration, started_at, ended_at, created_at)
                     VALUES ($1, $2, $3, 'completed', $4, $5, NOW(), NOW())`,
                    [callData.callerId, callData.receiverId, callData.callType, duration, callData.startTime]
                ).catch(err => console.error('Failed to save completed call:', err));

                activeCalls.delete(callKey);
            }
        });

        // ─────────────────────────────────────
        // EVENT: disconnect
        // ─────────────────────────────────────
        socket.on('disconnect', () => {
            console.log('❌ Socket disconnected:', socket.id);

            let disconnectedUserId = null;
            for (const [userId, socketId] of onlineUsers.entries()) {
                if (socketId === socket.id) {
                    disconnectedUserId = userId;
                    break;
                }
            }

            if (disconnectedUserId !== null) {
                onlineUsers.delete(disconnectedUserId);
                console.log(`🔴 User ${disconnectedUserId} went offline`);

                socket.broadcast.emit('user_offline', { userId: disconnectedUserId });

                // End any active calls for this user
                socket.broadcast.emit('call_ended', { senderId: disconnectedUserId });
            }
        });
    });
};

module.exports = { setupSocketHandlers };
