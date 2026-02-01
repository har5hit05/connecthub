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
        // Called when a user sends a chat message
        // ─────────────────────────────────────
        socket.on('send_message', async (data) => {
            try {
                const { senderId, receiverId, message } = data;

                // Step 1: Save message to database
                const result = await db.query(
                    `INSERT INTO messages (sender_id, receiver_id, message)
           VALUES ($1, $2, $3)
           RETURNING id, sender_id, receiver_id, message, created_at`,
                    [senderId, receiverId, message]
                );

                const savedMessage = result.rows[0];

                // Step 2: Find the receiver's socket
                const receiverSocketId = onlineUsers.get(receiverId);

                // Step 3: Send message to the receiver (if they are online)
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('receive_message', {
                        id: savedMessage.id,
                        senderId: savedMessage.sender_id,
                        receiverId: savedMessage.receiver_id,
                        message: savedMessage.message,
                        createdAt: savedMessage.created_at
                    });
                }

                // Step 4: Send confirmation back to sender
                // (so sender also sees the message in their chat)
                socket.emit('message_sent', {
                    id: savedMessage.id,
                    senderId: savedMessage.sender_id,
                    receiverId: savedMessage.receiver_id,
                    message: savedMessage.message,
                    createdAt: savedMessage.created_at
                });

            } catch (error) {
                console.error('Send message error:', error);
                socket.emit('message_error', { message: 'Failed to send message' });
            }
        });

        // ─────────────────────────────────────
        // EVENT: typing_start
        // Called when a user starts typing
        // ─────────────────────────────────────
        socket.on('typing_start', (data) => {
            const { senderId, receiverId } = data;
            const receiverSocketId = onlineUsers.get(receiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('user_typing', {
                    userId: senderId,
                    isTyping: true
                });
            }
        });

        // ─────────────────────────────────────
        // EVENT: typing_stop
        // Called when a user stops typing (pauses or sends)
        // ─────────────────────────────────────
        socket.on('typing_stop', (data) => {
            const { senderId, receiverId } = data;
            const receiverSocketId = onlineUsers.get(receiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('user_typing', {
                    userId: senderId,
                    isTyping: false
                });
            }
        });

        // ─────────────────────────────────────
        // EVENT: call_request
        // User A wants to call User B
        // ─────────────────────────────────────
        socket.on('call_request', (data) => {
            const { callerId, receiverId, callType } = data;
            const receiverSocketId = onlineUsers.get(receiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('incoming_call', {
                    callerId: callerId,
                    callType: callType
                });

                // Temporarily store callType so we can use it when call is accepted
                const pendingKey = `pending-${callerId}-${receiverId}`;
                activeCalls.set(pendingKey, { callType });
            } else {
                // Receiver is offline — save as a missed call
                db.query(
                    `INSERT INTO calls (caller_id, receiver_id, call_type, status, created_at)
           VALUES ($1, $2, $3, 'missed', NOW())`,
                    [callerId, receiverId, callType]
                ).catch(err => console.error('Failed to save missed call:', err));

                socket.emit('call_failed', { message: 'User is not online' });
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
                io.to(callerSocketId).emit('call_accepted', {
                    receiverId: receiverId
                });
            }

            // Save the call start time so we can calculate duration later
            // We store it with a key like "3-7" (callerId-receiverId)
            // Grab the callType from the pending call we saved in call_request
            const pendingKey = `pending-${callerId}-${receiverId}`;
            const pendingCall = activeCalls.get(pendingKey);
            const callType = pendingCall ? pendingCall.callType : 'video';
            activeCalls.delete(pendingKey); // Remove the pending entry

            // Save the active call with start time
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
                io.to(callerSocketId).emit('call_rejected', {
                    receiverId: receiverId
                });
            }

            // Save rejected call to database
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
        // User A sends the WebRTC Offer (SDP) to User B
        // ─────────────────────────────────────
        socket.on('webrtc_offer', (data) => {
            const { senderId, receiverId, offer } = data;
            const receiverSocketId = onlineUsers.get(receiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('webrtc_offer', {
                    senderId: senderId,
                    offer: offer
                });
            }
        });

        // ─────────────────────────────────────
        // EVENT: webrtc_answer
        // User B sends the WebRTC Answer (SDP) back to User A
        // ─────────────────────────────────────
        socket.on('webrtc_answer', (data) => {
            const { senderId, receiverId, answer } = data;
            const receiverSocketId = onlineUsers.get(receiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('webrtc_answer', {
                    senderId: senderId,
                    answer: answer
                });
            }
        });

        // ─────────────────────────────────────
        // EVENT: webrtc_ice_candidate
        // Exchange ICE candidates between users
        // (happens multiple times during connection setup)
        // ─────────────────────────────────────
        socket.on('webrtc_ice_candidate', (data) => {
            const { senderId, receiverId, candidate } = data;
            const receiverSocketId = onlineUsers.get(receiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('webrtc_ice_candidate', {
                    senderId: senderId,
                    candidate: candidate
                });
            }
        });

        // ─────────────────────────────────────
        // EVENT: call_ended
        // Either user ended the call
        // ─────────────────────────────────────
        socket.on('call_ended', (data) => {
            const { senderId, receiverId } = data;
            const receiverSocketId = onlineUsers.get(receiverId);

            if (receiverSocketId) {
                io.to(receiverSocketId).emit('call_ended', {
                    senderId: senderId
                });
            }

            // Find the active call (could be either direction)
            let callKey = `${senderId}-${receiverId}`;
            let callData = activeCalls.get(callKey);

            if (!callData) {
                // Try the other direction
                callKey = `${receiverId}-${senderId}`;
                callData = activeCalls.get(callKey);
            }

            if (callData) {
                // Calculate duration in seconds
                const duration = Math.round((new Date() - callData.startTime) / 1000);

                // Save completed call to database
                db.query(
                    `INSERT INTO calls (caller_id, receiver_id, call_type, status, duration, started_at, ended_at, created_at)
           VALUES ($1, $2, $3, 'completed', $4, $5, NOW(), NOW())`,
                    [callData.callerId, callData.receiverId, callData.callType, duration, callData.startTime]
                ).catch(err => console.error('Failed to save completed call:', err));

                // Remove from active calls
                activeCalls.delete(callKey);
            }
        });

        // ─────────────────────────────────────
        // EVENT: disconnect
        // Called when a user closes the tab or loses connection
        // ─────────────────────────────────────
        socket.on('disconnect', () => {
            console.log('❌ Socket disconnected:', socket.id);

            // Find which user this socket belonged to
            let disconnectedUserId = null;
            for (const [userId, socketId] of onlineUsers.entries()) {
                if (socketId === socket.id) {
                    disconnectedUserId = userId;
                    break;
                }
            }

            // Remove user from online list
            if (disconnectedUserId !== null) {
                onlineUsers.delete(disconnectedUserId);
                console.log(`🔴 User ${disconnectedUserId} went offline`);

                // Tell everyone this user went offline
                socket.broadcast.emit('user_offline', { userId: disconnectedUserId });

                // If this user was in a call, end the call for the other person
                socket.broadcast.emit('call_ended', { senderId: disconnectedUserId });
            }
        });
    });
};

module.exports = { setupSocketHandlers };