const callRepository = require('../repositories/callRepository');
const AppError = require('../utils/AppError');

/**
 * Call Service
 * 
 * Handles business logic for call-related operations:
 * - Call history retrieval (delegated from chatService for cleaner separation)
 * - Call quality metrics storage and retrieval
 */
class CallService {
    /**
     * Save call quality metrics reported by a client after a call ends.
     * Both participants independently report their own perspective of quality.
     * 
     * @param {number} callId - The call record ID from the `calls` table
     * @param {number} userId - The user reporting the metrics
     * @param {Object} metricsData - { packetLoss, jitter, roundTripTime, bitrate }
     */
    async saveCallMetrics(callId, userId, metricsData) {
        // Validate the call exists and this user was a participant
        const call = await callRepository.getCallById(callId);
        if (!call) {
            throw new AppError('Call not found', 404);
        }

        if (call.caller_id !== userId && call.receiver_id !== userId) {
            throw new AppError('You are not a participant of this call', 403);
        }

        // Sanitize numeric values — clamp to reasonable ranges
        const metrics = {
            packetLoss: Math.max(0, Math.min(100, parseFloat(metricsData.packetLoss) || 0)),
            jitter: Math.max(0, parseFloat(metricsData.jitter) || 0),
            roundTripTime: Math.max(0, parseFloat(metricsData.roundTripTime) || 0),
            bitrate: Math.max(0, parseFloat(metricsData.bitrate) || 0)
        };

        return await callRepository.saveCallMetrics(callId, userId, metrics);
    }

    /**
     * Get metrics for a specific call (both participants' reports).
     * 
     * @param {number} callId - The call record ID
     * @param {number} userId - Requesting user (must be a participant)
     */
    async getCallMetrics(callId, userId) {
        const call = await callRepository.getCallById(callId);
        if (!call) {
            throw new AppError('Call not found', 404);
        }

        if (call.caller_id !== userId && call.receiver_id !== userId) {
            throw new AppError('You are not a participant of this call', 403);
        }

        return await callRepository.getCallMetrics(callId);
    }
}

module.exports = new CallService();
