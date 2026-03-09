import type { Request, Response, NextFunction } from 'express';

const { mockSendError, mockGetRedis, mockLogger } = vi.hoisted(() => {
  return {
    mockSendError: vi.fn(),
    mockGetRedis: vi.fn(),
    mockLogger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
  };
});

vi.mock('../utils/response.js', () => ({ sendError: mockSendError }));
vi.mock('../config/redis.js', () => ({ getRedis: mockGetRedis }));
vi.mock('../config/logger.js', () => ({ logger: mockLogger }));

import { rateLimiter, authRateLimiter, aiRateLimiter, _resetRateLimiterForTesting } from './rate-limiter.js';

const mockReq = (overrides = {}) =>
  ({ ip: '127.0.0.1', headers: {}, path: '/api/test', ...overrides }) as unknown as Request;

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    locals: {},
  } as unknown as Response;
  return res;
};

describe('rate-limiter middleware', () => {
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn();
    vi.clearAllMocks();
    _resetRateLimiterForTesting();
    // Default: no Redis available (use in-memory fallback)
    mockGetRedis.mockReturnValue(null);
  });

  // ---------------------------------------------------------------------------
  // rateLimiter (general)
  // ---------------------------------------------------------------------------
  describe('rateLimiter', () => {
    it('should allow requests within the limit', async () => {
      const middleware = rateLimiter(5, 60000);
      const req = mockReq();
      const res = mockRes();

      await new Promise<void>(resolve => {
        middleware(req, res, (() => {
          nextFn();
          resolve();
        }) as unknown as NextFunction);
      });

      expect(nextFn).toHaveBeenCalledOnce();
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should set rate limit headers', async () => {
      const middleware = rateLimiter(100, 60000);
      const req = mockReq();
      const res = mockRes();

      await new Promise<void>(resolve => {
        middleware(req, res, (() => {
          resolve();
        }) as unknown as NextFunction);
      });

      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 100);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(Number));
    });

    it('should block requests exceeding the limit', async () => {
      const middleware = rateLimiter(2, 60000);

      // Make 3 requests from the same IP
      for (let i = 0; i < 3; i++) {
        const req = mockReq({ ip: '99.99.99.99' });
        const res = mockRes();
        await new Promise<void>(resolve => {
          middleware(req, res, (() => {
            resolve();
          }) as unknown as NextFunction);
          // Rate limited requests don't call next - they call sendError instead
          // We need to wait for the async redisLimiter promise to settle
          setTimeout(resolve, 20);
        });
      }

      expect(mockSendError).toHaveBeenCalledWith(expect.anything(), 429, 'Too many requests. Please try again later.');
    });

    it('should set Retry-After header when rate limited', async () => {
      const middleware = rateLimiter(1, 60000);

      // First request succeeds
      const req1 = mockReq();
      const res1 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req1, res1, (() => resolve()) as unknown as NextFunction);
      });

      // Second request is rate limited
      const req2 = mockReq();
      const res2 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req2, res2, (() => resolve()) as unknown as NextFunction);
        setTimeout(resolve, 10);
      });

      expect(res2.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });

    it('should key rate limiting by IP address', async () => {
      const middleware = rateLimiter(1, 60000);

      // First IP can make a request
      const req1 = mockReq({ ip: '10.0.0.1' });
      const res1 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req1, res1, (() => resolve()) as unknown as NextFunction);
      });

      // Different IP can also make a request
      const req2 = mockReq({ ip: '10.0.0.2' });
      const res2 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req2, res2, (() => resolve()) as unknown as NextFunction);
      });

      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should use "unknown" when ip is missing', async () => {
      const middleware = rateLimiter(100, 60000);
      const req = mockReq({ ip: undefined });
      const res = mockRes();

      await new Promise<void>(resolve => {
        middleware(req, res, (() => resolve()) as unknown as NextFunction);
      });

      expect(nextFn).not.toHaveBeenCalled(); // we used inline next
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should use Redis when available', async () => {
      const mockRedis = {
        eval: vi.fn().mockResolvedValue([1, 60]),
      };
      mockGetRedis.mockReturnValue(mockRedis);

      const middleware = rateLimiter(100, 60000);
      const req = mockReq();
      const res = mockRes();

      await new Promise<void>(resolve => {
        middleware(req, res, (() => resolve()) as unknown as NextFunction);
      });

      expect(mockRedis.eval).toHaveBeenCalled();
    });

    it('should fall back to in-memory when Redis eval fails', async () => {
      const mockRedis = {
        eval: vi.fn().mockRejectedValue(new Error('Redis connection lost')),
      };
      mockGetRedis.mockReturnValue(mockRedis);

      const middleware = rateLimiter(100, 60000);
      const req = mockReq();
      const res = mockRes();

      await new Promise<void>(resolve => {
        middleware(req, res, (() => resolve()) as unknown as NextFunction);
      });

      // Should succeed (in-memory fallback)
      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should call next() on unexpected errors', async () => {
      // Make redisLimiter throw an unexpected error
      mockGetRedis.mockImplementation(() => {
        throw new Error('Fatal');
      });

      const middleware = rateLimiter(100, 60000);
      const req = mockReq();
      const res = mockRes();

      await new Promise<void>(resolve => {
        middleware(req, res, (() => {
          nextFn();
          resolve();
        }) as unknown as NextFunction);
        setTimeout(resolve, 50);
      });

      // Should gracefully proceed
    });
  });

  // ---------------------------------------------------------------------------
  // authRateLimiter
  // ---------------------------------------------------------------------------
  describe('authRateLimiter', () => {
    it('should allow requests within auth limit (default 5)', async () => {
      const middleware = authRateLimiter();
      const req = mockReq();
      const res = mockRes();

      await new Promise<void>(resolve => {
        middleware(req, res, (() => {
          nextFn();
          resolve();
        }) as unknown as NextFunction);
      });

      expect(nextFn).toHaveBeenCalledOnce();
    });

    it('should key on IP + path', async () => {
      const middleware = authRateLimiter(1);

      // First request to /login succeeds
      const req1 = mockReq({ path: '/login' });
      const res1 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req1, res1, (() => resolve()) as unknown as NextFunction);
      });

      // Same IP, different path (/forgot-password) also succeeds
      const req2 = mockReq({ path: '/forgot-password' });
      const res2 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req2, res2, (() => resolve()) as unknown as NextFunction);
      });

      expect(mockSendError).not.toHaveBeenCalled();
    });

    it('should block after exceeding auth limit', async () => {
      const middleware = authRateLimiter(1);

      const req1 = mockReq();
      const res1 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req1, res1, (() => resolve()) as unknown as NextFunction);
      });

      const req2 = mockReq();
      const res2 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req2, res2, (() => resolve()) as unknown as NextFunction);
        setTimeout(resolve, 10);
      });

      expect(mockSendError).toHaveBeenCalledWith(expect.anything(), 429, 'Too many attempts. Please try again later.');
    });
  });

  // ---------------------------------------------------------------------------
  // aiRateLimiter
  // ---------------------------------------------------------------------------
  describe('aiRateLimiter', () => {
    it('should key on userId from req.user', async () => {
      const middleware = aiRateLimiter(30, 3600);
      const req = mockReq({ user: { userId: 'user-1' } });
      const res = mockRes();

      await new Promise<void>(resolve => {
        middleware(req, res, (() => {
          nextFn();
          resolve();
        }) as unknown as NextFunction);
      });

      expect(nextFn).toHaveBeenCalledOnce();
    });

    it('should use "anon" when user is not set', async () => {
      const middleware = aiRateLimiter(30, 3600);
      const req = mockReq(); // no user
      const res = mockRes();

      await new Promise<void>(resolve => {
        middleware(req, res, (() => {
          nextFn();
          resolve();
        }) as unknown as NextFunction);
      });

      expect(nextFn).toHaveBeenCalledOnce();
    });

    it('should block after exceeding AI limit', async () => {
      const middleware = aiRateLimiter(1, 3600);

      const req1 = mockReq({ user: { userId: 'user-1' } });
      const res1 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req1, res1, (() => resolve()) as unknown as NextFunction);
      });

      const req2 = mockReq({ user: { userId: 'user-1' } });
      const res2 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req2, res2, (() => resolve()) as unknown as NextFunction);
        setTimeout(resolve, 10);
      });

      expect(mockSendError).toHaveBeenCalledWith(
        expect.anything(),
        429,
        'AI chat rate limit exceeded. Please try again later.',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // _resetRateLimiterForTesting
  // ---------------------------------------------------------------------------
  describe('_resetRateLimiterForTesting', () => {
    it('should clear all in-memory state allowing new requests', async () => {
      const middleware = rateLimiter(1, 60000);

      // Use up the limit
      const req1 = mockReq({ ip: '1.2.3.4' });
      const res1 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req1, res1, (() => resolve()) as unknown as NextFunction);
      });

      // Reset
      _resetRateLimiterForTesting();

      // Same IP should be allowed again
      const req2 = mockReq({ ip: '1.2.3.4' });
      const res2 = mockRes();
      await new Promise<void>(resolve => {
        middleware(req2, res2, (() => {
          nextFn();
          resolve();
        }) as unknown as NextFunction);
      });

      expect(nextFn).toHaveBeenCalled();
      expect(mockSendError).not.toHaveBeenCalled();
    });
  });
});
