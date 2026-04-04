const request = require('supertest');
const express = require('express');

// Create a mock app for testing the health check endpoint
const app = express();
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

describe('System Health Monitoring Endpoints', () => {
    it('GET /health should return 200 OK and status ok', async () => {
        const response = await request(app).get('/health');
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('status', 'ok');
        expect(response.body).toHaveProperty('uptime');
        expect(typeof response.body.uptime).toBe('number');
    });
});
