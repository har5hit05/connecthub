/**
 * auth.test.js
 * Tests for POST /api/auth/register and POST /api/auth/login
 *
 * Strategy: build a minimal Express app that mounts only authRoutes,
 * then mock the database, bcrypt, and jwt so no real I/O happens.
 */

const request = require('supertest');
const express = require('express');

// ── Mocks (must be declared before any require() of the modules) ──────────────
jest.mock('../config/database', () => ({ query: jest.fn() }));
jest.mock('bcryptjs', () => ({ hash: jest.fn(), compare: jest.fn() }));
jest.mock('jsonwebtoken', () => ({ sign: jest.fn(), verify: jest.fn() }));

const db     = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const authRoutes = require('../routes/authRoutes');
const errorHandler = require('../middleware/errorHandler');

// Minimal Express app — no rate limiter so tests aren't throttled
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
    const VALID_BODY = {
        username: 'alice_01',
        email: 'alice@example.com',
        password: 'Password1'
    };

    it('201 — creates user when email and username are available', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [] })   // email not taken
            .mockResolvedValueOnce({ rows: [] })   // username not taken
            .mockResolvedValueOnce({               // INSERT ... RETURNING
                rows: [{ id: 1, username: 'alice_01', email: 'alice@example.com', created_at: new Date() }]
            });
        bcrypt.hash.mockResolvedValue('hashed_pw');

        const res = await request(app).post('/api/auth/register').send(VALID_BODY);

        expect(res.status).toBe(201);
        expect(res.body.user).toMatchObject({ id: 1, username: 'alice_01', email: 'alice@example.com' });
    });

    it('400 — rejects duplicate email', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: 99 }] }); // email already taken

        const res = await request(app).post('/api/auth/register').send(VALID_BODY);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Email already registered');
    });

    it('400 — rejects duplicate username', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [] })          // email ok
            .mockResolvedValueOnce({ rows: [{ id: 99 }] }); // username taken

        const res = await request(app).post('/api/auth/register').send(VALID_BODY);

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Username already taken');
    });

    it('400 — rejects invalid email format', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID_BODY, email: 'not-an-email' });

        expect(res.status).toBe(400);
    });

    it('400 — rejects password with no uppercase letter', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID_BODY, password: 'password1' });

        expect(res.status).toBe(400);
    });

    it('400 — rejects password with no digit', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID_BODY, password: 'Password' });

        expect(res.status).toBe(400);
    });

    it('400 — rejects password shorter than 8 characters', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID_BODY, password: 'Pass1' });

        expect(res.status).toBe(400);
    });

    it('400 — rejects username shorter than 3 characters', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID_BODY, username: 'ab' });

        expect(res.status).toBe(400);
    });

    it('400 — rejects username with special characters', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ ...VALID_BODY, username: 'alice!' });

        expect(res.status).toBe(400);
    });

    it('400 — rejects request with missing fields', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ username: 'alice_01' }); // no email, no password

        expect(res.status).toBe(400);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
    const VALID_BODY = { email: 'alice@example.com', password: 'Password1' };
    const DB_USER    = { id: 1, username: 'alice_01', email: 'alice@example.com', password_hash: 'hashed_pw' };

    it('200 — sets httpOnly cookie and returns user (no token in body)', async () => {
        db.query.mockResolvedValueOnce({ rows: [DB_USER] });
        bcrypt.compare.mockResolvedValue(true);
        jwt.sign.mockReturnValue('signed_token');

        const res = await request(app).post('/api/auth/login').send(VALID_BODY);

        expect(res.status).toBe(200);
        // Token must NOT be in the response body (prevents XSS token theft)
        expect(res.body.token).toBeUndefined();
        // Token must be in the Set-Cookie header as an httpOnly cookie
        expect(res.headers['set-cookie']).toBeDefined();
        expect(res.headers['set-cookie'][0]).toMatch(/jwt=signed_token/);
        expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
        // User info is still returned
        expect(res.body.user).toMatchObject({ id: 1, username: 'alice_01' });
    });

    it('401 — rejects wrong password', async () => {
        db.query.mockResolvedValueOnce({ rows: [DB_USER] });
        bcrypt.compare.mockResolvedValue(false);

        const res = await request(app).post('/api/auth/login').send(VALID_BODY);

        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid email or password');
    });

    it('401 — rejects non-existent email', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'nobody@example.com', password: 'Password1' });

        expect(res.status).toBe(401);
    });

    it('400 — rejects request with no email', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ password: 'Password1' });

        expect(res.status).toBe(400);
    });

    it('400 — rejects request with invalid email format', async () => {
        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'bad', password: 'Password1' });

        expect(res.status).toBe(400);
    });

    it('400 — rejects empty request body', async () => {
        const res = await request(app).post('/api/auth/login').send({});

        expect(res.status).toBe(400);
    });
});
