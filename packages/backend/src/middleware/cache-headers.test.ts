import type { Request, Response, NextFunction } from 'express';
import { conditionalCache } from './cache-headers.js';

const mockReq = (overrides = {}) => ({ method: 'GET', headers: {}, ...overrides }) as unknown as Request;

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn(),
    setHeader: vi.fn(),
    locals: {},
  } as unknown as Response;
  return res;
};

describe('cache-headers middleware (conditionalCache)', () => {
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn();
    vi.clearAllMocks();
  });

  it('should call next() immediately for non-GET requests', () => {
    const middleware = conditionalCache();
    const req = mockReq({ method: 'POST' });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
    // json should not have been overridden
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  it('should set ETag header when res.json is called', () => {
    const middleware = conditionalCache();
    const req = mockReq();
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);
    expect(nextFn).toHaveBeenCalledOnce();

    // Simulate response
    res.json({ data: 'test' });

    expect(res.setHeader).toHaveBeenCalledWith('ETag', expect.stringMatching(/^"[a-f0-9]{32}"$/));
  });

  it('should set Cache-Control header with default max-age of 60', () => {
    const middleware = conditionalCache();
    const req = mockReq();
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);
    res.json({ data: 'test' });

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=60, must-revalidate');
  });

  it('should set Cache-Control header with custom max-age', () => {
    const middleware = conditionalCache(300);
    const req = mockReq();
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);
    res.json({ data: 'test' });

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=300, must-revalidate');
  });

  it('should return 304 when If-None-Match matches the ETag', () => {
    const middleware = conditionalCache();
    const body = { data: 'test' };

    // First call to compute the ETag
    const req1 = mockReq();
    const res1 = mockRes();
    middleware(req1, res1, nextFn as unknown as NextFunction);
    res1.json(body);

    // Get the ETag value
    const etagCall = res1.setHeader.mock.calls.find((c: [string, string]) => c[0] === 'ETag');
    const etag = etagCall?.[1] as string;

    // Second call with If-None-Match
    const req2 = mockReq({ headers: { 'if-none-match': etag } });
    const res2 = mockRes();

    middleware(req2, res2, nextFn as unknown as NextFunction);
    res2.json(body);

    expect(res2.status).toHaveBeenCalledWith(304);
    expect(res2.end).toHaveBeenCalled();
  });

  it('should send full response when If-None-Match does not match', () => {
    const middleware = conditionalCache();
    const req = mockReq({ headers: { 'if-none-match': '"stale-etag"' } });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);
    res.json({ data: 'different' });

    expect(res.status).not.toHaveBeenCalledWith(304);
  });

  it('should generate different ETags for different response bodies', () => {
    const middleware = conditionalCache();

    const req1 = mockReq();
    const res1 = mockRes();
    middleware(req1, res1, nextFn as unknown as NextFunction);
    res1.json({ data: 'body1' });

    const req2 = mockReq();
    const res2 = mockRes();
    middleware(req2, res2, nextFn as unknown as NextFunction);
    res2.json({ data: 'body2' });

    const etag1 = res1.setHeader.mock.calls.find((c: [string, string]) => c[0] === 'ETag')?.[1];
    const etag2 = res2.setHeader.mock.calls.find((c: [string, string]) => c[0] === 'ETag')?.[1];

    expect(etag1).not.toBe(etag2);
  });

  it('should generate same ETag for identical response bodies', () => {
    const middleware = conditionalCache();
    const body = { data: 'consistent' };

    const req1 = mockReq();
    const res1 = mockRes();
    middleware(req1, res1, nextFn as unknown as NextFunction);
    res1.json(body);

    const req2 = mockReq();
    const res2 = mockRes();
    middleware(req2, res2, nextFn as unknown as NextFunction);
    res2.json(body);

    const etag1 = res1.setHeader.mock.calls.find((c: [string, string]) => c[0] === 'ETag')?.[1];
    const etag2 = res2.setHeader.mock.calls.find((c: [string, string]) => c[0] === 'ETag')?.[1];

    expect(etag1).toBe(etag2);
  });

  it('should skip caching for PUT requests', () => {
    const middleware = conditionalCache();
    const req = mockReq({ method: 'PUT' });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
  });

  it('should skip caching for DELETE requests', () => {
    const middleware = conditionalCache();
    const req = mockReq({ method: 'DELETE' });
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);

    expect(nextFn).toHaveBeenCalledOnce();
  });

  it('should handle zero max-age', () => {
    const middleware = conditionalCache(0);
    const req = mockReq();
    const res = mockRes();

    middleware(req, res, nextFn as unknown as NextFunction);
    res.json({ data: 'test' });

    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, max-age=0, must-revalidate');
  });
});
