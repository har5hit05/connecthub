const express = require('express');
const router = express.Router();
const { getTurnCredentials, submitCallMetrics, getCallMetrics } = require('../controllers/webrtcController');
const { verifyToken } = require('../middleware/authMiddleware');

// All WebRTC/call routes require authentication

// GET /api/webrtc/turn — Fetch ICE server config with ephemeral TURN credentials
router.get('/turn', verifyToken, getTurnCredentials);

// POST /api/calls/:id/metrics — Submit call quality telemetry
router.post('/:id/metrics', verifyToken, submitCallMetrics);

// GET /api/calls/:id/metrics — Retrieve call quality telemetry
router.get('/:id/metrics', verifyToken, getCallMetrics);

module.exports = router;
