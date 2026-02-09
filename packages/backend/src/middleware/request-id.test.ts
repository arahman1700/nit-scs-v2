import type { Request, Response, NextFunction } from 'express';
import { requestId } from './request-id.js';

const mockReq = (overrides = {}) => ({ headers: {}, query: {}, body: {}, ...overrides }) as unknown as Request;

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

describe('requestId middleware', () => {
  it('uses existing X-Request-ID header if present', () => {
    const existingId = 'my-custom-request-id-123';
    const req = mockReq({ headers: { 'x-request-id': existingId } });
    const res = mockRes();

    requestId(req, res, mockNext);

    expect(req.headers['x-request-id']).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', existingId);
  });

  it('generates a new UUID if no X-Request-ID header is present', () => {
    const req = mockReq();
    const res = mockRes();

    requestId(req, res, mockNext);

    const id = req.headers['x-request-id'] as string;
    expect(id).toBeDefined();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('sets the X-Request-ID header on the response', () => {
    const req = mockReq();
    const res = mockRes();

    requestId(req, res, mockNext);

    const id = req.headers['x-request-id'];
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-ID', id);
  });

  it('calls next()', () => {
    const req = mockReq();
    const res = mockRes();

    requestId(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('generates different UUIDs for different requests', () => {
    const req1 = mockReq();
    const res1 = mockRes();
    const req2 = mockReq();
    const res2 = mockRes();

    requestId(req1, res1, mockNext);
    requestId(req2, res2, mockNext);

    expect(req1.headers['x-request-id']).not.toBe(req2.headers['x-request-id']);
  });
});
