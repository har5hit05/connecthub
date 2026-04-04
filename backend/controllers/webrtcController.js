const turnService = require('../services/turnService');
const callService = require('../services/callService');
const AppError = require('../utils/AppError');

/**
 * WebRTC Controller
 * 
 * Thin orchestration layer for WebRTC-related HTTP endpoints:
 * - GET  /api/webrtc/turn          → ICE server configuration with TURN credentials
 * - POST /api/calls/:id/metrics    → Submit call quality telemetry
 * - GET  /api/calls/:id/metrics    → Retrieve call quality telemetry
 */

// ─────────────────────────────────────
// GET /api/webrtc/turn
// Returns ICE servers config with ephemeral TURN credentials
// ─────────────────────────────────────
const getTurnCredentials = (req, res, next) => {
    try {
        const iceConfig = turnService.getIceServers(req.user.id);
        res.status(200).json(iceConfig);
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────
// POST /api/calls/:id/metrics
// Submit call quality metrics after a call ends
// Body: { packetLoss, jitter, roundTripTime, bitrate }
// ─────────────────────────────────────
const submitCallMetrics = async (req, res, next) => {
    try {
        const callId = parseInt(req.params.id, 10);
        if (isNaN(callId) || callId <= 0) {
            throw new AppError('Invalid call ID', 400);
        }
        const userId = req.user.id;
        const metricsData = req.body;

        const saved = await callService.saveCallMetrics(callId, userId, metricsData);
        res.status(201).json({ message: 'Metrics saved', metrics: saved });
    } catch (error) {
        next(error);
    }
};

// ─────────────────────────────────────
// GET /api/calls/:id/metrics
// Retrieve call quality metrics for a specific call
// ─────────────────────────────────────
const getCallMetrics = async (req, res, next) => {
    try {
        const callId = parseInt(req.params.id, 10);
        if (isNaN(callId) || callId <= 0) {
            throw new AppError('Invalid call ID', 400);
        }
        const userId = req.user.id;

        const metrics = await callService.getCallMetrics(callId, userId);
        res.status(200).json({ metrics });
    } catch (error) {
        next(error);
    }
};

module.exports = { getTurnCredentials, submitCallMetrics, getCallMetrics };
