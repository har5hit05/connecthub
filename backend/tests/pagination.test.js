/**
 * pagination.test.js
 * Unit tests for getChatHistory (cursor-based) and getCallHistory (offset-based)
 * in chatController.js.
 *
 * Strategy: call the controller functions directly with mocked req/res objects
 * and a mocked database, verifying the SQL queries and response shapes.
 *
 * NOTE on ordering: the real DB returns rows in DESC order (newest first).
 *   The controller does result.rows.reverse() to flip to ASC for display.
 *   Because .reverse() mutates in place, mock data must be in DESC order
 *   so assertions on the response match the final ASC-ordered messages array.
 */

jest.mock('../config/database', () => ({ query: jest.fn() }));

// multer is configured at module load time — mock it so no filesystem ops run.
jest.mock('multer', () => {
    const m = jest.fn(() => ({ single: jest.fn(() => (req, res, next) => next()) }));
    m.diskStorage = jest.fn(() => ({}));
    return m;
});

const db = require('../config/database');
const { getChatHistory, getCallHistory } = require('../controllers/chatController');

// ── Helpers ───────────────────────────────────────────────────────────────────
const makeReq = (overrides = {}) => ({
    user:   { id: 1 },
    params: { userId: '2' },
    query:  {},
    ...overrides
});

const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
};

/**
 * makeMessages(count, startId)
 * Returns `count` messages in DESC order (newest-id first) — the same order
 * the real DB would return with ORDER BY created_at DESC.
 * The controller reverses this to ASC before sending the response.
 */
const makeMessages = (count, startId = 1) => {
    const maxId = startId + count - 1;
    return Array.from({ length: count }, (_, i) => ({
        id:              maxId - i,          // DESC: maxId, maxId-1, …, startId
        sender_id:       1,
        receiver_id:     2,
        message:         `msg ${maxId - i}`,
        created_at:      new Date(2024, 0, 1, 12, i).toISOString(),
        sender_username: 'alice'
    }));
};

// ─────────────────────────────────────────────────────────────────────────────
describe('getChatHistory — cursor-based pagination', () => {

    it('initial load: fetches messages without a cursor clause', async () => {
        const rows = makeMessages(50); // ids 50..1 in DESC order
        db.query.mockResolvedValueOnce({ rows: [...rows] }); // spread to avoid mutation side-effects

        const req = makeReq({ query: {} });
        const res = makeRes();

        await getChatHistory(req, res);

        const [sql] = db.query.mock.calls[0];

        // No cursor filter on initial load
        expect(sql).not.toMatch(/m\.id < /);
        // Must have DESC ordering + LIMIT
        expect(sql).toMatch(/ORDER BY m\.created_at DESC/);

        const body = res.json.mock.calls[0][0];
        // After reverse, 50 messages returned, now in ASC order
        expect(body.messages).toHaveLength(50);
        // messages[0] is the oldest (smallest id = startId = 1)
        expect(body.messages[0].id).toBe(1);
        // messages[last] is the newest (largest id = 50)
        expect(body.messages[49].id).toBe(50);
        // A full page → there may be more
        expect(body.hasMore).toBe(true);
        // nextCursor = id of the oldest message in this batch
        expect(body.nextCursor).toBe(1);
    });

    it('load-more: uses cursor (before param) to fetch older messages', async () => {
        const rows = makeMessages(30, 1); // ids 30..1 in DESC order
        db.query.mockResolvedValueOnce({ rows: [...rows] });

        const req = makeReq({ query: { before: 31, limit: 50 } });
        const res = makeRes();

        await getChatHistory(req, res);

        const [sql, params] = db.query.mock.calls[0];

        // Must include the cursor filter
        expect(sql).toMatch(/m\.id < \$3/);
        // $3 should be the before-cursor value
        expect(params[2]).toBe(31);

        const body = res.json.mock.calls[0][0];
        // 30 < 50 limit → no more pages
        expect(body.hasMore).toBe(false);
        expect(body.messages).toHaveLength(30);
    });

    it('hasMore is false when fewer messages than limit are returned', async () => {
        const rows = makeMessages(10); // only 10, fewer than default limit of 50
        db.query.mockResolvedValueOnce({ rows: [...rows] });

        const req = makeReq({ query: {} });
        const res = makeRes();

        await getChatHistory(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.hasMore).toBe(false);
    });

    it('hasMore is true when exactly limit messages are returned', async () => {
        const rows = makeMessages(50);
        db.query.mockResolvedValueOnce({ rows: [...rows] });

        const req = makeReq({ query: {} });
        const res = makeRes();

        await getChatHistory(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.hasMore).toBe(true);
    });

    it('nextCursor is null when there are no messages', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });

        const req = makeReq({ query: {} });
        const res = makeRes();

        await getChatHistory(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.nextCursor).toBeNull();
        expect(body.messages).toHaveLength(0);
        expect(body.hasMore).toBe(false);
    });

    it('nextCursor equals the id of the oldest (first) message after reversal', async () => {
        // makeMessages(3, 10): DB returns ids 12, 11, 10 (DESC)
        // controller reverses to ASC: [10, 11, 12]
        // messages[0] = {id:10} → nextCursor = 10
        const rows = makeMessages(3, 10);
        db.query.mockResolvedValueOnce({ rows: [...rows] });

        const req = makeReq({ query: {} });
        const res = makeRes();

        await getChatHistory(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.nextCursor).toBe(body.messages[0].id);
        expect(body.messages[0].id).toBe(10); // oldest in this batch
        expect(body.messages[2].id).toBe(12); // newest in this batch
    });

    it('forwards error to next middleware when database throws', async () => {
        const error = new Error('DB down');
        db.query.mockRejectedValueOnce(error);

        const req = makeReq({ query: {} });
        const res = makeRes();
        const next = jest.fn();

        await getChatHistory(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('getCallHistory — offset-based pagination', () => {

    const makeCalls = (count) =>
        Array.from({ length: count }, (_, i) => ({
            id:               i + 1,
            caller_id:        1,
            receiver_id:      2,
            call_type:        'video',
            status:           'ended',
            duration:         60 + i,
            created_at:       new Date(2024, 0, i + 1).toISOString(),
            caller_username:  'alice',
            receiver_username:'bob'
        }));

    it('page 1: returns first page with correct pagination metadata', async () => {
        const total = 45;
        db.query
            .mockResolvedValueOnce({ rows: [{ count: String(total) }] })  // COUNT
            .mockResolvedValueOnce({ rows: makeCalls(20) });              // data

        const req = makeReq({ query: { page: 1, limit: 20 } });
        const res = makeRes();

        await getCallHistory(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.calls).toHaveLength(20);
        expect(body.pagination).toMatchObject({
            page:       1,
            limit:      20,
            total:      45,
            totalPages: 3,    // Math.ceil(45/20) = 3
            hasMore:    true  // page 1 < totalPages 3
        });
    });

    it('last page: hasMore is false', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ count: '45' }] })
            .mockResolvedValueOnce({ rows: makeCalls(5) }); // only 5 remaining on page 3

        const req = makeReq({ query: { page: 3, limit: 20 } });
        const res = makeRes();

        await getCallHistory(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.pagination.hasMore).toBe(false);
        expect(body.calls).toHaveLength(5);
    });

    it('empty call history: returns empty array and correct pagination', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ count: '0' }] })
            .mockResolvedValueOnce({ rows: [] });

        const req = makeReq({ query: {} });
        const res = makeRes();

        await getCallHistory(req, res);

        const body = res.json.mock.calls[0][0];
        expect(body.calls).toHaveLength(0);
        expect(body.pagination.total).toBe(0);
        expect(body.pagination.totalPages).toBe(0);
    });

    it('uses correct OFFSET for page 2 (offset = (page-1) * limit)', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ count: '50' }] })
            .mockResolvedValueOnce({ rows: makeCalls(20) });

        const req = makeReq({ query: { page: 2, limit: 20 } });
        const res = makeRes();

        await getCallHistory(req, res);

        // Second db.query call = data fetch: [userId, limit, offset]
        // offset = (2-1)*20 = 20 → $3 (index 2 in params array)
        const [, dataParams] = db.query.mock.calls[1];
        expect(dataParams[2]).toBe(20);
    });

    it('forwards error to next middleware when database throws', async () => {
        const error = new Error('DB down');
        db.query.mockRejectedValueOnce(error);

        const req = makeReq({ query: {} });
        const res = makeRes();
        const next = jest.fn();

        await getCallHistory(req, res, next);

        expect(next).toHaveBeenCalledWith(error);
    });
});
