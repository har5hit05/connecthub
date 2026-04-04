/**
 * validate.test.js
 * Pure unit tests for the validate() middleware factory.
 *
 * No HTTP, no database — just Express req/res/next mocks and Zod schemas.
 */

const { z } = require('zod');
const { validate } = require('../middleware/validate');

// ── Helpers ───────────────────────────────────────────────────────────────────
const mockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json   = jest.fn().mockReturnValue(res);
    return res;
};

// ─────────────────────────────────────────────────────────────────────────────
describe('validate middleware', () => {

    describe('body validation', () => {
        const middleware = validate({
            body: z.object({
                name:  z.string().min(1, 'Name is required'),
                email: z.string().email('Invalid email')
            })
        });

        it('calls next() with no error when body is valid', () => {
            const req  = { body: { name: 'Alice', email: 'alice@example.com' } };
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalledWith(); // no args = success
            expect(res.status).not.toHaveBeenCalled();
        });

        it('responds 400 when a required field is missing', () => {
            const req  = { body: { name: 'Alice' } }; // no email
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                message: expect.any(String),
                errors:  expect.any(Array)
            }));
            expect(next).not.toHaveBeenCalled();
        });

        it('responds 400 when a field fails its constraint', () => {
            const req  = { body: { name: '', email: 'alice@example.com' } };
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('mutates req.body with the parsed (coerced) value', () => {
            const m = validate({ body: z.object({ name: z.string().trim() }) });
            const req  = { body: { name: '  Alice  ' } };
            const res  = mockRes();
            const next = jest.fn();

            m(req, res, next);

            expect(next).toHaveBeenCalledWith();
            expect(req.body.name).toBe('Alice'); // whitespace stripped by .trim()
        });

        it('includes all field errors in the errors array', () => {
            const req  = { body: {} }; // both fields missing
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            const payload = res.json.mock.calls[0][0];
            expect(payload.errors.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('params validation', () => {
        const middleware = validate({
            params: z.object({
                id: z.string().regex(/^\d+$/, 'ID must be numeric').transform(Number)
            })
        });

        it('calls next() and transforms the param to a number', () => {
            const req  = { params: { id: '42' } };
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalledWith();
            expect(req.params.id).toBe(42); // string → number
        });

        it('responds 400 for a non-numeric param', () => {
            const req  = { params: { id: 'abc' } };
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('query validation', () => {
        const middleware = validate({
            query: z.object({
                page:  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1)).optional(),
                limit: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(50)).optional()
            })
        });

        it('calls next() when query params are valid', () => {
            const req  = { query: { page: '2', limit: '20' } };
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalledWith();
            expect(req.query.page).toBe(2);
            expect(req.query.limit).toBe(20);
        });

        it('calls next() when optional query params are absent', () => {
            const req  = { query: {} };
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalledWith();
        });

        it('responds 400 when limit exceeds maximum', () => {
            const req  = { query: { limit: '9999' } };
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('combined body + params + query', () => {
        const middleware = validate({
            body:   z.object({ message: z.string().min(1) }),
            params: z.object({ userId: z.string().regex(/^\d+$/).transform(Number) }),
            query:  z.object({ draft: z.enum(['true', 'false']).optional() })
        });

        it('validates all three parts and calls next()', () => {
            const req  = { body: { message: 'hi' }, params: { userId: '5' }, query: {} };
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(next).toHaveBeenCalledWith();
            expect(req.params.userId).toBe(5);
        });

        it('returns 400 if only one part is invalid', () => {
            const req  = { body: { message: '' }, params: { userId: '5' }, query: {} };
            const res  = mockRes();
            const next = jest.fn();

            middleware(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });
});
