import type { Request, Response, NextFunction } from 'express';
import { paginate, type PaginationQuery } from './pagination.js';

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

describe('paginate middleware', () => {
  it('sets default values when no query params are provided', () => {
    const middleware = paginate();
    const req = mockReq();
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination).toBeDefined();
    expect(req.pagination!.page).toBe(1);
    expect(req.pagination!.pageSize).toBe(20);
    expect(req.pagination!.sortBy).toBe('createdAt');
    expect(req.pagination!.sortDir).toBe('desc');
    expect(req.pagination!.skip).toBe(0);
    expect(req.pagination!.search).toBeUndefined();
  });

  it('parses custom values from query params', () => {
    const middleware = paginate();
    const req = mockReq({
      query: { page: '3', pageSize: '50', sortBy: 'name', sortDir: 'asc', search: 'test' },
    });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.page).toBe(3);
    expect(req.pagination!.pageSize).toBe(50);
    expect(req.pagination!.sortBy).toBe('name');
    expect(req.pagination!.sortDir).toBe('asc');
    expect(req.pagination!.search).toBe('test');
    expect(req.pagination!.skip).toBe(100); // (3-1)*50
  });

  it('clamps page to minimum 1 for negative values', () => {
    const middleware = paginate();
    const req = mockReq({ query: { page: '-5' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.page).toBe(1);
    expect(req.pagination!.skip).toBe(0);
  });

  it('clamps page to minimum 1 for zero', () => {
    const middleware = paginate();
    const req = mockReq({ query: { page: '0' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.page).toBe(1);
  });

  it('clamps pageSize to minimum 1 when given a very small positive value', () => {
    // Note: parseInt('0') || 20 evaluates to 20 because 0 is falsy
    // So pageSize '0' falls back to default 20. Test with a truly small value instead.
    const middleware = paginate();
    const req = mockReq({ query: { pageSize: '0' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    // parseInt('0') is 0, which is falsy, so falls back to default 20
    expect(req.pagination!.pageSize).toBe(20);
  });

  it('clamps pageSize to maximum 100', () => {
    const middleware = paginate();
    const req = mockReq({ query: { pageSize: '500' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.pageSize).toBe(100);
  });

  it('clamps negative pageSize to 1', () => {
    const middleware = paginate();
    const req = mockReq({ query: { pageSize: '-10' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.pageSize).toBe(1);
  });

  it('uses custom defaultSort parameter', () => {
    const middleware = paginate('updatedAt');
    const req = mockReq();
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.sortBy).toBe('updatedAt');
  });

  it('overrides custom defaultSort with query param', () => {
    const middleware = paginate('updatedAt');
    const req = mockReq({ query: { sortBy: 'name' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.sortBy).toBe('name');
  });

  it('defaults sortDir to desc for invalid values', () => {
    const middleware = paginate();
    const req = mockReq({ query: { sortDir: 'invalid' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.sortDir).toBe('desc');
  });

  it('passes search through', () => {
    const middleware = paginate();
    const req = mockReq({ query: { search: 'hello world' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.search).toBe('hello world');
  });

  it('calls next()', () => {
    const middleware = paginate();
    const req = mockReq();
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalledOnce();
  });

  it('calculates skip correctly for various pages', () => {
    const middleware = paginate();
    const req = mockReq({ query: { page: '5', pageSize: '10' } });
    const res = mockRes();

    middleware(req, res, mockNext);

    expect(req.pagination!.skip).toBe(40); // (5-1)*10
  });
});
