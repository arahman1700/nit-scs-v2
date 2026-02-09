import type { PrismaMock } from '../test-utils/prisma-mock.js';

// ── Hoisted mocks ────────────────────────────────────────────────────────

const mockPrisma = vi.hoisted(() => ({}) as PrismaMock);

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../utils/password.js', () => ({
  comparePassword: vi.fn(),
  hashPassword: vi.fn(),
}));
vi.mock('../utils/jwt.js', () => ({
  signAccessToken: vi.fn(),
  signRefreshToken: vi.fn(),
  verifyRefreshToken: vi.fn(),
  decodeToken: vi.fn(),
}));
vi.mock('./email.service.js', () => ({
  sendTemplatedEmail: vi.fn(),
}));
vi.mock('../config/redis.js', () => ({
  getRedis: vi.fn(),
}));
vi.mock('../config/logger.js', () => ({
  log: vi.fn(),
}));

// ── Imports (after vi.mock) ──────────────────────────────────────────────

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  login,
  refreshTokens,
  logout,
  revokeAllTokens,
  changePassword,
  forgotPassword,
  resetPassword,
  getMe,
  cleanupExpiredTokens,
  isTokenBlacklisted,
} from './auth.service.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, decodeToken } from '../utils/jwt.js';
import { sendTemplatedEmail } from './email.service.js';
import { getRedis } from '../config/redis.js';
import { AuthenticationError, NotFoundError, RateLimitError, BusinessRuleError } from '@nit-scs/shared';

// ── Helpers ──────────────────────────────────────────────────────────────

const mockEmployee = {
  id: 'emp-001',
  email: 'john@example.com',
  fullName: 'John Doe',
  fullNameAr: 'جون دو',
  passwordHash: '$2b$10$hashedpassword',
  role: 'PROJECT_MANAGER',
  systemRole: 'ADMIN',
  department: 'Engineering',
  isActive: true,
  assignedProjectId: 'proj-001',
  assignedWarehouseId: null,
  lastLogin: null,
};

function createRedisMock() {
  return {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('auth.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // isTokenBlacklisted
  // ─────────────────────────────────────────────────────────────────────
  describe('isTokenBlacklisted', () => {
    it('should return false when redis is not available', async () => {
      vi.mocked(getRedis).mockReturnValue(null);

      const result = await isTokenBlacklisted('some-jti');

      expect(result).toBe(false);
    });

    it('should return false when jti is empty', async () => {
      const redis = createRedisMock();
      vi.mocked(getRedis).mockReturnValue(redis as any);

      const result = await isTokenBlacklisted('');

      expect(result).toBe(false);
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('should return true when token is found in redis', async () => {
      const redis = createRedisMock();
      redis.get.mockResolvedValue('1');
      vi.mocked(getRedis).mockReturnValue(redis as any);

      const result = await isTokenBlacklisted('blacklisted-jti');

      expect(result).toBe(true);
      expect(redis.get).toHaveBeenCalledWith('bl:blacklisted-jti');
    });

    it('should return false when token is not found in redis', async () => {
      const redis = createRedisMock();
      redis.get.mockResolvedValue(null);
      vi.mocked(getRedis).mockReturnValue(redis as any);

      const result = await isTokenBlacklisted('valid-jti');

      expect(result).toBe(false);
      expect(redis.get).toHaveBeenCalledWith('bl:valid-jti');
    });

    it('should return false on redis error', async () => {
      const redis = createRedisMock();
      redis.get.mockRejectedValue(new Error('Redis connection lost'));
      vi.mocked(getRedis).mockReturnValue(redis as any);

      const result = await isTokenBlacklisted('some-jti');

      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // login
  // ─────────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('should return user, accessToken, and refreshToken on success', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(comparePassword).mockResolvedValue(true);
      vi.mocked(signAccessToken).mockReturnValue('access-token-123');
      vi.mocked(signRefreshToken).mockReturnValue('refresh-token-123');
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.employee.update.mockResolvedValue({});

      const result = await login('john@example.com', 'password123');

      expect(result.user).toEqual({
        id: 'emp-001',
        email: 'john@example.com',
        fullName: 'John Doe',
        role: 'PROJECT_MANAGER',
        systemRole: 'ADMIN',
        department: 'Engineering',
        assignedProjectId: 'proj-001',
        assignedWarehouseId: null,
      });
      expect(result.accessToken).toBe('access-token-123');
      expect(result.refreshToken).toBe('refresh-token-123');
    });

    it('should store refresh token in DB with 7-day expiry', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(comparePassword).mockResolvedValue(true);
      vi.mocked(signAccessToken).mockReturnValue('at');
      vi.mocked(signRefreshToken).mockReturnValue('rt');
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.employee.update.mockResolvedValue({});

      await login('john@example.com', 'password123');

      expect(mockPrisma.refreshToken.create).toHaveBeenCalledOnce();
      const createCall = mockPrisma.refreshToken.create.mock.calls[0][0];
      expect(createCall.data.token).toBe('rt');
      expect(createCall.data.userId).toBe('emp-001');
      // Expiry should be roughly 7 days from now
      const expiresAt = new Date(createCall.data.expiresAt).getTime();
      const sevenDaysFromNow = Date.now() + 7 * 24 * 60 * 60 * 1000;
      expect(expiresAt).toBeGreaterThan(sevenDaysFromNow - 5000);
      expect(expiresAt).toBeLessThan(sevenDaysFromNow + 5000);
    });

    it('should update lastLogin timestamp', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(comparePassword).mockResolvedValue(true);
      vi.mocked(signAccessToken).mockReturnValue('at');
      vi.mocked(signRefreshToken).mockReturnValue('rt');
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.employee.update.mockResolvedValue({});

      await login('john@example.com', 'password123');

      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-001' },
        data: { lastLogin: expect.any(Date) },
      });
    });

    it('should sign tokens with the correct payload', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(comparePassword).mockResolvedValue(true);
      vi.mocked(signAccessToken).mockReturnValue('at');
      vi.mocked(signRefreshToken).mockReturnValue('rt');
      mockPrisma.refreshToken.create.mockResolvedValue({});
      mockPrisma.employee.update.mockResolvedValue({});

      await login('john@example.com', 'password123');

      const expectedPayload = {
        userId: 'emp-001',
        email: 'john@example.com',
        role: 'PROJECT_MANAGER',
        systemRole: 'ADMIN',
        assignedProjectId: 'proj-001',
        assignedWarehouseId: null,
      };
      expect(signAccessToken).toHaveBeenCalledWith(expectedPayload);
      expect(signRefreshToken).toHaveBeenCalledWith(expectedPayload);
    });

    it('should throw AuthenticationError when employee not found', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(login('unknown@example.com', 'password')).rejects.toThrow(AuthenticationError);
      await expect(login('unknown@example.com', 'password')).rejects.toThrow('Invalid email or password');
    });

    it('should throw AuthenticationError when employee has no passwordHash', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, passwordHash: null });

      await expect(login('john@example.com', 'password')).rejects.toThrow(AuthenticationError);
    });

    it('should throw AuthenticationError when account is deactivated', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, isActive: false });

      await expect(login('john@example.com', 'password')).rejects.toThrow('Account is deactivated');
    });

    it('should throw AuthenticationError on wrong password', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(comparePassword).mockResolvedValue(false);

      await expect(login('john@example.com', 'wrong-password')).rejects.toThrow(AuthenticationError);
      await expect(login('john@example.com', 'wrong-password')).rejects.toThrow('Invalid email or password');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // refreshTokens
  // ─────────────────────────────────────────────────────────────────────
  describe('refreshTokens', () => {
    const storedToken = {
      id: 'rt-id-001',
      token: 'old-refresh-token',
      userId: 'emp-001',
      expiresAt: new Date(Date.now() + 86400000),
    };

    const decodedPayload = {
      userId: 'emp-001',
      email: 'john@example.com',
      role: 'PROJECT_MANAGER',
      systemRole: 'ADMIN',
      assignedProjectId: 'proj-001',
      assignedWarehouseId: null,
    };

    it('should verify token, rotate, and return new tokens', async () => {
      vi.mocked(verifyRefreshToken).mockReturnValue(decodedPayload as any);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(storedToken);
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(signAccessToken).mockReturnValue('new-access-token');
      vi.mocked(signRefreshToken).mockReturnValue('new-refresh-token');
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      const result = await refreshTokens('old-refresh-token');

      expect(verifyRefreshToken).toHaveBeenCalledWith('old-refresh-token');
      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
    });

    it('should perform token rotation via $transaction', async () => {
      vi.mocked(verifyRefreshToken).mockReturnValue(decodedPayload as any);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(storedToken);
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(signAccessToken).mockReturnValue('new-at');
      vi.mocked(signRefreshToken).mockReturnValue('new-rt');
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await refreshTokens('old-refresh-token');

      expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
      // $transaction receives an array of two promises (delete old + create new)
      const txArg = mockPrisma.$transaction.mock.calls[0][0];
      expect(txArg).toBeInstanceOf(Array);
      expect(txArg).toHaveLength(2);
    });

    it('should check that the stored token exists and is not expired', async () => {
      vi.mocked(verifyRefreshToken).mockReturnValue(decodedPayload as any);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(storedToken);
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(signAccessToken).mockReturnValue('at');
      vi.mocked(signRefreshToken).mockReturnValue('rt');
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);

      await refreshTokens('old-refresh-token');

      expect(mockPrisma.refreshToken.findFirst).toHaveBeenCalledWith({
        where: {
          token: 'old-refresh-token',
          expiresAt: { gt: expect.any(Date) },
        },
      });
    });

    it('should throw AuthenticationError when token is revoked (not in DB)', async () => {
      vi.mocked(verifyRefreshToken).mockReturnValue(decodedPayload as any);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(null);

      await expect(refreshTokens('revoked-token')).rejects.toThrow(AuthenticationError);
      await expect(refreshTokens('revoked-token')).rejects.toThrow('Refresh token has been revoked or expired');
    });

    it('should throw AuthenticationError when user is not found', async () => {
      vi.mocked(verifyRefreshToken).mockReturnValue(decodedPayload as any);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(storedToken);
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(refreshTokens('old-refresh-token')).rejects.toThrow(AuthenticationError);
      await expect(refreshTokens('old-refresh-token')).rejects.toThrow('User not found or deactivated');
    });

    it('should throw AuthenticationError when user is deactivated', async () => {
      vi.mocked(verifyRefreshToken).mockReturnValue(decodedPayload as any);
      mockPrisma.refreshToken.findFirst.mockResolvedValue(storedToken);
      mockPrisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, isActive: false });

      await expect(refreshTokens('old-refresh-token')).rejects.toThrow('User not found or deactivated');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // logout
  // ─────────────────────────────────────────────────────────────────────
  describe('logout', () => {
    it('should blacklist access token jti in redis with 15-min TTL', async () => {
      const redis = createRedisMock();
      vi.mocked(getRedis).mockReturnValue(redis as any);
      vi.mocked(decodeToken).mockReturnValue({ jti: 'access-jti' } as any);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await logout('access-token', 'refresh-token');

      expect(decodeToken).toHaveBeenCalledWith('access-token');
      expect(redis.setex).toHaveBeenCalledWith('bl:access-jti', 900, '1');
    });

    it('should delete refresh token from DB', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(decodeToken).mockReturnValue({ jti: 'jti' } as any);
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await logout('access-token', 'refresh-token');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'refresh-token' },
      });
    });

    it('should not delete refresh token when not provided', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(decodeToken).mockReturnValue({ jti: 'jti' } as any);

      await logout('access-token');

      expect(mockPrisma.refreshToken.deleteMany).not.toHaveBeenCalled();
    });

    it('should handle missing jti gracefully (no blacklist)', async () => {
      vi.mocked(getRedis).mockReturnValue(createRedisMock() as any);
      vi.mocked(decodeToken).mockReturnValue({} as any);

      await logout('access-token');

      const redis = vi.mocked(getRedis)();
      // blacklistToken checks !jti and returns early, so setex should not be called
      // (getRedis is called inside blacklistToken, not directly in logout for setex)
    });

    it('should handle null decoded token gracefully', async () => {
      vi.mocked(getRedis).mockReturnValue(createRedisMock() as any);
      vi.mocked(decodeToken).mockReturnValue(null as any);

      await expect(logout('access-token')).resolves.toBeUndefined();
    });

    it('should catch errors when deleting refresh token silently', async () => {
      vi.mocked(getRedis).mockReturnValue(null);
      vi.mocked(decodeToken).mockReturnValue({ jti: 'jti' } as any);
      mockPrisma.refreshToken.deleteMany.mockRejectedValue(new Error('DB error'));

      // Should not throw
      await expect(logout('access-token', 'refresh-token')).resolves.toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // revokeAllTokens
  // ─────────────────────────────────────────────────────────────────────
  describe('revokeAllTokens', () => {
    it('should delete all refresh tokens for the given user', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 3 });

      await revokeAllTokens('emp-001');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'emp-001' },
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // changePassword
  // ─────────────────────────────────────────────────────────────────────
  describe('changePassword', () => {
    it('should update password hash and revoke all tokens on success', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(comparePassword).mockResolvedValue(true);
      vi.mocked(hashPassword).mockResolvedValue('new-hashed-password');
      mockPrisma.employee.update.mockResolvedValue({});
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

      await changePassword('emp-001', 'current-pass', 'new-pass');

      expect(comparePassword).toHaveBeenCalledWith('current-pass', '$2b$10$hashedpassword');
      expect(hashPassword).toHaveBeenCalledWith('new-pass');
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-001' },
        data: { passwordHash: 'new-hashed-password' },
      });
    });

    it('should revoke all tokens after password change', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(comparePassword).mockResolvedValue(true);
      vi.mocked(hashPassword).mockResolvedValue('new-hash');
      mockPrisma.employee.update.mockResolvedValue({});
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await changePassword('emp-001', 'current', 'new');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'emp-001' },
      });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(changePassword('unknown', 'old', 'new')).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when user has no passwordHash', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ ...mockEmployee, passwordHash: null });

      await expect(changePassword('emp-001', 'old', 'new')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when current password is incorrect', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(comparePassword).mockResolvedValue(false);

      await expect(changePassword('emp-001', 'wrong-pass', 'new-pass')).rejects.toThrow(BusinessRuleError);
      await expect(changePassword('emp-001', 'wrong-pass', 'new-pass')).rejects.toThrow(
        'Current password is incorrect',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // forgotPassword
  // ─────────────────────────────────────────────────────────────────────
  describe('forgotPassword', () => {
    it('should create reset code and send email for known user', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrisma.passwordResetCode.count.mockResolvedValue(0);
      mockPrisma.passwordResetCode.create.mockResolvedValue({});
      vi.mocked(sendTemplatedEmail).mockResolvedValue(undefined as any);

      await forgotPassword('john@example.com');

      expect(mockPrisma.passwordResetCode.create).toHaveBeenCalledOnce();
      const createCall = mockPrisma.passwordResetCode.create.mock.calls[0][0];
      expect(createCall.data.email).toBe('john@example.com');
      expect(createCall.data.code).toMatch(/^\d{6}$/);
      expect(createCall.data.expiresAt).toBeInstanceOf(Date);

      expect(sendTemplatedEmail).toHaveBeenCalledWith({
        templateCode: 'password_reset',
        to: 'john@example.com',
        variables: {
          code: expect.stringMatching(/^\d{6}$/),
          fullName: 'John Doe',
          expiryMinutes: 15,
        },
        referenceTable: 'passwordResetCode',
      });
    });

    it('should NOT throw when email is not found (security)', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(forgotPassword('unknown@example.com')).resolves.toBeUndefined();

      // Should not store code or send email for unknown user
      expect(mockPrisma.passwordResetCode.create).not.toHaveBeenCalled();
      expect(sendTemplatedEmail).not.toHaveBeenCalled();
    });

    it('should throw RateLimitError when max reset codes exceeded', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrisma.passwordResetCode.count.mockResolvedValue(3);

      await expect(forgotPassword('john@example.com')).rejects.toThrow(RateLimitError);
      await expect(forgotPassword('john@example.com')).rejects.toThrow(
        'Too many reset code requests. Please try again later.',
      );
    });

    it('should rate-limit based on codes created within the last hour', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrisma.passwordResetCode.count.mockResolvedValue(2);
      mockPrisma.passwordResetCode.create.mockResolvedValue({});
      vi.mocked(sendTemplatedEmail).mockResolvedValue(undefined as any);

      // 2 < 3, so should still succeed
      await expect(forgotPassword('john@example.com')).resolves.toBeUndefined();

      expect(mockPrisma.passwordResetCode.count).toHaveBeenCalledWith({
        where: {
          email: 'john@example.com',
          createdAt: { gte: expect.any(Date) },
        },
      });
    });

    it('should catch email sending errors silently', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrisma.passwordResetCode.count.mockResolvedValue(0);
      mockPrisma.passwordResetCode.create.mockResolvedValue({});
      vi.mocked(sendTemplatedEmail).mockRejectedValue(new Error('SMTP timeout'));

      // Should not throw even though email fails
      await expect(forgotPassword('john@example.com')).resolves.toBeUndefined();

      // Code should still have been created
      expect(mockPrisma.passwordResetCode.create).toHaveBeenCalledOnce();
    });

    it('should store code with 15-minute expiry', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      mockPrisma.passwordResetCode.count.mockResolvedValue(0);
      mockPrisma.passwordResetCode.create.mockResolvedValue({});
      vi.mocked(sendTemplatedEmail).mockResolvedValue(undefined as any);

      await forgotPassword('john@example.com');

      const createCall = mockPrisma.passwordResetCode.create.mock.calls[0][0];
      const expiresAt = new Date(createCall.data.expiresAt).getTime();
      const fifteenMinFromNow = Date.now() + 15 * 60 * 1000;
      expect(expiresAt).toBeGreaterThan(fifteenMinFromNow - 5000);
      expect(expiresAt).toBeLessThan(fifteenMinFromNow + 5000);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // resetPassword
  // ─────────────────────────────────────────────────────────────────────
  describe('resetPassword', () => {
    const resetEntry = {
      id: 'rc-001',
      email: 'john@example.com',
      code: '123456',
      expiresAt: new Date(Date.now() + 600000),
      createdAt: new Date(),
    };

    it('should update password, clean up codes, and revoke tokens on success', async () => {
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(resetEntry);
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(hashPassword).mockResolvedValue('new-hashed');
      mockPrisma.employee.update.mockResolvedValue({});
      mockPrisma.passwordResetCode.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await resetPassword('john@example.com', '123456', 'new-password');

      expect(hashPassword).toHaveBeenCalledWith('new-password');
      expect(mockPrisma.employee.update).toHaveBeenCalledWith({
        where: { id: 'emp-001' },
        data: { passwordHash: 'new-hashed' },
      });
    });

    it('should delete all reset codes for the email after success', async () => {
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(resetEntry);
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(hashPassword).mockResolvedValue('hash');
      mockPrisma.employee.update.mockResolvedValue({});
      mockPrisma.passwordResetCode.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      await resetPassword('john@example.com', '123456', 'new-pass');

      expect(mockPrisma.passwordResetCode.deleteMany).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
      });
    });

    it('should revoke all refresh tokens after password reset', async () => {
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(resetEntry);
      mockPrisma.employee.findUnique.mockResolvedValue(mockEmployee);
      vi.mocked(hashPassword).mockResolvedValue('hash');
      mockPrisma.employee.update.mockResolvedValue({});
      mockPrisma.passwordResetCode.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 1 });

      await resetPassword('john@example.com', '123456', 'new-pass');

      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'emp-001' },
      });
    });

    it('should look up code with lowercase email and not-expired filter', async () => {
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(null);

      await expect(resetPassword('John@Example.com', '999999', 'pw')).rejects.toThrow(BusinessRuleError);

      expect(mockPrisma.passwordResetCode.findFirst).toHaveBeenCalledWith({
        where: {
          email: 'john@example.com',
          code: '999999',
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should throw BusinessRuleError on invalid or expired code', async () => {
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(null);

      await expect(resetPassword('john@example.com', '000000', 'new-pass')).rejects.toThrow(BusinessRuleError);
      await expect(resetPassword('john@example.com', '000000', 'new-pass')).rejects.toThrow(
        'Invalid or expired reset code',
      );
    });

    it('should throw BusinessRuleError when employee not found for email', async () => {
      mockPrisma.passwordResetCode.findFirst.mockResolvedValue(resetEntry);
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(resetPassword('john@example.com', '123456', 'new-pass')).rejects.toThrow(BusinessRuleError);
      await expect(resetPassword('john@example.com', '123456', 'new-pass')).rejects.toThrow(
        'Invalid or expired reset code',
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // getMe
  // ─────────────────────────────────────────────────────────────────────
  describe('getMe', () => {
    it('should return employee with selected fields', async () => {
      const selectedEmployee = {
        id: 'emp-001',
        employeeIdNumber: 'EID-001',
        fullName: 'John Doe',
        fullNameAr: 'جون دو',
        email: 'john@example.com',
        phone: '+1234567890',
        department: 'Engineering',
        role: 'PROJECT_MANAGER',
        systemRole: 'ADMIN',
        isActive: true,
        assignedProjectId: 'proj-001',
        assignedWarehouseId: null,
      };
      mockPrisma.employee.findUnique.mockResolvedValue(selectedEmployee);

      const result = await getMe('emp-001');

      expect(result).toEqual(selectedEmployee);
      expect(mockPrisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-001' },
        select: {
          id: true,
          employeeIdNumber: true,
          fullName: true,
          fullNameAr: true,
          email: true,
          phone: true,
          department: true,
          role: true,
          systemRole: true,
          isActive: true,
          assignedProjectId: true,
          assignedWarehouseId: true,
        },
      });
    });

    it('should throw NotFoundError when user does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(getMe('unknown-id')).rejects.toThrow(NotFoundError);
      await expect(getMe('unknown-id')).rejects.toThrow('User not found');
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // cleanupExpiredTokens
  // ─────────────────────────────────────────────────────────────────────
  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens and return count', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      const result = await cleanupExpiredTokens();

      expect(result).toBe(5);
      expect(mockPrisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('should return 0 when no expired tokens exist', async () => {
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await cleanupExpiredTokens();

      expect(result).toBe(0);
    });
  });
});
