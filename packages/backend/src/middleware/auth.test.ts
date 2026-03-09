import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { Request, Response, NextFunction } from 'express';

const { mockVerifyAccessToken, mockIsTokenBlacklisted, mockSendError, mockSentry, mockLogger } = vi.hoisted(() => {
  return {
    mockVerifyAccessToken: vi.fn(),
    mockIsTokenBlacklisted: vi.fn(),
    mockSendError: vi.fn(),
    mockSentry: { setUser: vi.fn() },
    mockLogger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  };
});

vi.mock('../utils/jwt.js', () => ({ verifyAccessToken: mockVerifyAccessToken }));
vi.mock('../domains/auth/services/auth.service.js', () => ({
  isTokenBlacklisted: mockIsTokenBlacklisted,
}));
vi.mock('../utils/response.js', () => ({ sendError: mockSendError }));
vi.mock('../config/sentry.js', () => ({ Sentry: mockSentry }));
vi.mock('../config/logger.js', () => ({ logger: mockLogger }));

import { authenticate, optionalAuth } from './auth.js';

const mockReq = (overrides = {}) => ({ headers: {}, query: {}, body: {}, ...overrides }) as unknown as Request;

const mockRes = () => {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    locals: {},
  } as unknown as Response;
  return res;
};

describe('auth middleware', () => {
  let nextFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nextFn = vi.fn();
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // authenticate
  // ---------------------------------------------------------------------------
  describe('authenticate', () => {
    it('should return 401 when no Authorization header is present', async () => {
      const req = mockReq();
      const res = mockRes();

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(mockSendError).toHaveBeenCalledWith(res, 401, 'Authentication required');
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 when Authorization header does not start with Bearer', async () => {
      const req = mockReq({ headers: { authorization: 'Basic abc123' } });
      const res = mockRes();

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(mockSendError).toHaveBeenCalledWith(res, 401, 'Authentication required');
    });

    it('should return 401 when token is invalid', async () => {
      const req = mockReq({ headers: { authorization: 'Bearer invalid-token' } });
      const res = mockRes();
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(mockSendError).toHaveBeenCalledWith(res, 401, 'Invalid or expired token');
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 when token is blacklisted', async () => {
      const payload = { userId: 'u1', email: 'u@test.com', jti: 'token-id-1' };
      const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
      const res = mockRes();
      mockVerifyAccessToken.mockReturnValue(payload);
      mockIsTokenBlacklisted.mockResolvedValue(true);

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(mockSendError).toHaveBeenCalledWith(res, 401, 'Token has been revoked');
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should attach user payload to req.user on success', async () => {
      const payload = { userId: 'u1', email: 'u@test.com', jti: 'token-id-1' };
      const req = mockReq({ headers: { authorization: 'Bearer good-token' } });
      const res = mockRes();
      mockVerifyAccessToken.mockReturnValue(payload);
      mockIsTokenBlacklisted.mockResolvedValue(false);

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(req.user).toEqual(payload);
      expect(nextFn).toHaveBeenCalledOnce();
    });

    it('should attach rawAccessToken to request', async () => {
      const payload = { userId: 'u1', email: 'u@test.com', jti: 'jti1' };
      const req = mockReq({ headers: { authorization: 'Bearer my-token-value' } });
      const res = mockRes();
      mockVerifyAccessToken.mockReturnValue(payload);
      mockIsTokenBlacklisted.mockResolvedValue(false);

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(req.rawAccessToken).toBe('my-token-value');
    });

    it('should set Sentry user context', async () => {
      const payload = { userId: 'u1', email: 'u@test.com', jti: 'jti1' };
      const req = mockReq({ headers: { authorization: 'Bearer good-token' } });
      const res = mockRes();
      mockVerifyAccessToken.mockReturnValue(payload);
      mockIsTokenBlacklisted.mockResolvedValue(false);

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(mockSentry.setUser).toHaveBeenCalledWith({ id: 'u1', email: 'u@test.com' });
    });

    it('should continue authentication when Redis blacklist check fails (fallback)', async () => {
      const payload = { userId: 'u1', email: 'u@test.com', jti: 'jti1' };
      const req = mockReq({ headers: { authorization: 'Bearer good-token' } });
      const res = mockRes();
      mockVerifyAccessToken.mockReturnValue(payload);
      mockIsTokenBlacklisted.mockRejectedValue(new Error('Redis down'));

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(mockLogger.warn).toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalledOnce();
      expect(req.user).toEqual(payload);
    });

    it('should skip blacklist check when jti is not present', async () => {
      const payload = { userId: 'u1', email: 'u@test.com' };
      const req = mockReq({ headers: { authorization: 'Bearer good-token' } });
      const res = mockRes();
      mockVerifyAccessToken.mockReturnValue(payload);

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(mockIsTokenBlacklisted).not.toHaveBeenCalled();
      expect(nextFn).toHaveBeenCalledOnce();
    });

    it('should extract token correctly (strip "Bearer " prefix)', async () => {
      const req = mockReq({ headers: { authorization: 'Bearer abc.def.ghi' } });
      const res = mockRes();
      mockVerifyAccessToken.mockReturnValue({ userId: 'u1', email: 'u@test.com' });

      await authenticate(req, res, nextFn as unknown as NextFunction);

      expect(mockVerifyAccessToken).toHaveBeenCalledWith('abc.def.ghi');
    });
  });

  // ---------------------------------------------------------------------------
  // optionalAuth
  // ---------------------------------------------------------------------------
  describe('optionalAuth', () => {
    it('should set req.user when valid Bearer token is present', () => {
      const payload = { userId: 'u1', email: 'u@test.com' };
      const req = mockReq({ headers: { authorization: 'Bearer valid-token' } });
      const res = mockRes();
      mockVerifyAccessToken.mockReturnValue(payload);

      optionalAuth(req, res, nextFn as unknown as NextFunction);

      expect(req.user).toEqual(payload);
      expect(nextFn).toHaveBeenCalledOnce();
    });

    it('should not set req.user when no Authorization header', () => {
      const req = mockReq();
      const res = mockRes();

      optionalAuth(req, res, nextFn as unknown as NextFunction);

      expect(req.user).toBeUndefined();
      expect(nextFn).toHaveBeenCalledOnce();
    });

    it('should not set req.user when token is invalid (ignores error)', () => {
      const req = mockReq({ headers: { authorization: 'Bearer bad-token' } });
      const res = mockRes();
      mockVerifyAccessToken.mockImplementation(() => {
        throw new Error('expired');
      });

      optionalAuth(req, res, nextFn as unknown as NextFunction);

      expect(req.user).toBeUndefined();
      expect(nextFn).toHaveBeenCalledOnce();
    });

    it('should always call next regardless of auth status', () => {
      const req = mockReq({ headers: { authorization: 'Basic xyz' } });
      const res = mockRes();

      optionalAuth(req, res, nextFn as unknown as NextFunction);

      expect(nextFn).toHaveBeenCalledOnce();
    });
  });
});
