import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate } from './validate.js';

const mockReq = (overrides = {}) =>
  ({ headers: {}, query: {}, body: {}, params: {}, ...overrides }) as unknown as Request;

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    locals: {},
  } as unknown as Response;
  return res;
};

const mockNext = vi.fn() as unknown as NextFunction;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validate middleware', () => {
  const bodySchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
  });

  describe('body validation (default source)', () => {
    it('parses valid body and assigns to req.body, then calls next', () => {
      const middleware = validate(bodySchema);
      const req = mockReq({ body: { name: 'John', email: 'john@example.com' } });
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(req.body).toEqual({ name: 'John', email: 'john@example.com' });
      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('sends 400 with validation errors on invalid body and does NOT call next', () => {
      const middleware = validate(bodySchema);
      const req = mockReq({ body: { name: '', email: 'not-an-email' } });
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: 'Validation failed',
          errors: expect.arrayContaining([
            expect.objectContaining({ field: expect.any(String), message: expect.any(String) }),
          ]),
        }),
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('strips unknown fields via schema parsing', () => {
      const strictSchema = z.object({ name: z.string() });
      const middleware = validate(strictSchema);
      const req = mockReq({ body: { name: 'John', extra: 'field' } });
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(req.body).toEqual({ name: 'John' });
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('query validation', () => {
    it('stores validated query in res.locals.validatedQuery', () => {
      const querySchema = z.object({
        status: z.string(),
      });
      const middleware = validate(querySchema, 'query');
      const req = mockReq({ query: { status: 'active' } });
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(res.locals.validatedQuery).toEqual({ status: 'active' });
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('params validation', () => {
    it('stores validated params in res.locals.validatedParams', () => {
      const paramsSchema = z.object({
        id: z.string().uuid(),
      });
      const middleware = validate(paramsSchema, 'params');
      const id = '550e8400-e29b-41d4-a716-446655440000';
      const req = mockReq({ params: { id } });
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(res.locals.validatedParams).toEqual({ id });
      expect(mockNext).toHaveBeenCalledOnce();
    });
  });

  describe('non-Zod errors', () => {
    it('calls next(err) for non-Zod errors', () => {
      const throwingSchema = {
        parse: () => {
          throw new Error('Something unexpected');
        },
      } as unknown as z.ZodSchema;
      const middleware = validate(throwingSchema);
      const req = mockReq({ body: {} });
      const res = mockRes();

      middleware(req, res, mockNext);

      expect(mockNext).toHaveBeenCalledOnce();
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect((mockNext as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0].message).toBe('Something unexpected');
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
