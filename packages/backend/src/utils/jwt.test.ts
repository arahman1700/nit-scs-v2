import { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, decodeToken } from './jwt.js';
import { resetEnv } from '../config/env.js';
import type { JwtPayload } from './jwt.js';

// Set env vars before any module-level getEnv() calls
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long!!';

const testPayload: JwtPayload = {
  userId: 'user-123',
  email: 'test@example.com',
  role: 'admin',
  systemRole: 'admin',
  assignedProjectId: null,
  assignedWarehouseId: null,
};

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-chars-long!!';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-at-least-32-chars-long!!';
  resetEnv();
});

describe('JWT utilities', () => {
  describe('signAccessToken', () => {
    it('returns a string', () => {
      const token = signAccessToken(testPayload);
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyAccessToken', () => {
    it('decodes what signAccessToken produces', () => {
      const token = signAccessToken(testPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.systemRole).toBe(testPayload.systemRole);
    });

    it('preserves payload fields', () => {
      const payload: JwtPayload = {
        userId: 'u-456',
        email: 'specific@test.com',
        role: 'warehouse_supervisor',
        systemRole: 'warehouse_supervisor',
        assignedWarehouseId: 'wh-abc',
        assignedProjectId: null,
      };
      const token = signAccessToken(payload);
      const decoded = verifyAccessToken(token);

      expect(decoded.userId).toBe('u-456');
      expect(decoded.email).toBe('specific@test.com');
      expect(decoded.role).toBe('warehouse_supervisor');
      expect(decoded.systemRole).toBe('warehouse_supervisor');
      expect(decoded.assignedWarehouseId).toBe('wh-abc');
    });

    it('adds jti automatically', () => {
      const token = signAccessToken(testPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded.jti).toBeDefined();
      expect(typeof decoded.jti).toBe('string');
      expect(decoded.jti!.length).toBeGreaterThan(0);
    });

    it('throws on invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('throws on expired token', () => {
      // Sign with a very short expiry by manipulating time
      vi.useFakeTimers();
      const token = signAccessToken(testPayload);
      // Advance time beyond the default 15m expiry
      vi.advanceTimersByTime(16 * 60 * 1000);

      expect(() => verifyAccessToken(token)).toThrow();

      vi.useRealTimers();
    });
  });

  describe('signRefreshToken / verifyRefreshToken', () => {
    it('returns a different token than signAccessToken', () => {
      const accessToken = signAccessToken(testPayload);
      const refreshToken = signRefreshToken(testPayload);

      expect(refreshToken).not.toBe(accessToken);
    });

    it('verifyRefreshToken decodes refresh tokens', () => {
      const token = signRefreshToken(testPayload);
      const decoded = verifyRefreshToken(token);

      expect(decoded.userId).toBe(testPayload.userId);
      expect(decoded.email).toBe(testPayload.email);
      expect(decoded.systemRole).toBe(testPayload.systemRole);
    });

    it('verifyRefreshToken throws on access token (different secret)', () => {
      const accessToken = signAccessToken(testPayload);

      expect(() => verifyRefreshToken(accessToken)).toThrow();
    });

    it('verifyAccessToken throws on refresh token (different secret)', () => {
      const refreshToken = signRefreshToken(testPayload);

      expect(() => verifyAccessToken(refreshToken)).toThrow();
    });
  });

  describe('decodeToken', () => {
    it('returns payload without verification', () => {
      const token = signAccessToken(testPayload);
      const decoded = decodeToken(token);

      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe(testPayload.userId);
      expect(decoded!.email).toBe(testPayload.email);
    });

    it('returns null for garbage input', () => {
      const decoded = decodeToken('not-a-jwt-at-all');
      expect(decoded).toBeNull();
    });

    it('can decode expired tokens without throwing', () => {
      vi.useFakeTimers();
      const token = signAccessToken(testPayload);
      vi.advanceTimersByTime(16 * 60 * 1000); // past expiry

      // verifyAccessToken would throw, but decodeToken should not
      const decoded = decodeToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded!.userId).toBe(testPayload.userId);

      vi.useRealTimers();
    });
  });
});
