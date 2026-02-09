import crypto from 'crypto';
import { prisma } from '../utils/prisma.js';
import { comparePassword, hashPassword } from '../utils/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken, decodeToken, type JwtPayload } from '../utils/jwt.js';
import { AuthenticationError, NotFoundError, RateLimitError, BusinessRuleError } from '@nit-scs-v2/shared';
import { sendTemplatedEmail } from './email.service.js';
import { log } from '../config/logger.js';
import { getRedis } from '../config/redis.js';

// ── Token Blacklist (Redis) ─────────────────────────────────────────────

const TOKEN_BLACKLIST_PREFIX = 'bl:';

/**
 * Blacklist an access token's jti in Redis until its natural expiry.
 * Falls back silently if Redis is unavailable.
 */
async function blacklistToken(jti: string, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis || !jti) return;
  try {
    await redis.setex(`${TOKEN_BLACKLIST_PREFIX}${jti}`, ttlSeconds, '1');
  } catch (err) {
    log('warn', `[Auth] Failed to blacklist token: ${(err as Error).message}`);
  }
}

/**
 * Check if a token jti is blacklisted.
 */
export async function isTokenBlacklisted(jti: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis || !jti) return false;
  try {
    const result = await redis.get(`${TOKEN_BLACKLIST_PREFIX}${jti}`);
    return result !== null;
  } catch {
    return false;
  }
}

// ── Auth Service ────────────────────────────────────────────────────────

export interface LoginResult {
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    systemRole: string;
    department: string;
    assignedProjectId: string | null;
    assignedWarehouseId: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee || !employee.passwordHash) {
    throw new AuthenticationError('Invalid email or password');
  }

  if (!employee.isActive) {
    throw new AuthenticationError('Account is deactivated');
  }

  const valid = await comparePassword(password, employee.passwordHash);
  if (!valid) {
    throw new AuthenticationError('Invalid email or password');
  }

  const payload: JwtPayload = {
    userId: employee.id,
    email: employee.email,
    role: employee.role,
    systemRole: employee.systemRole,
    assignedProjectId: employee.assignedProjectId,
    assignedWarehouseId: employee.assignedWarehouseId,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store refresh token in DB for server-side revocation
  const REFRESH_TTL_DAYS = 7;
  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: employee.id,
      expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });

  // Update last login
  await prisma.employee.update({
    where: { id: employee.id },
    data: { lastLogin: new Date() },
  });

  return {
    user: {
      id: employee.id,
      email: employee.email,
      fullName: employee.fullName,
      role: employee.role,
      systemRole: employee.systemRole,
      department: employee.department,
      assignedProjectId: employee.assignedProjectId,
      assignedWarehouseId: employee.assignedWarehouseId,
    },
    accessToken,
    refreshToken,
  };
}

export async function refreshTokens(token: string): Promise<{ accessToken: string; refreshToken: string }> {
  const payload = verifyRefreshToken(token);

  // Verify the refresh token exists in DB (not revoked)
  const storedToken = await prisma.refreshToken.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() },
    },
  });

  if (!storedToken) {
    throw new AuthenticationError('Refresh token has been revoked or expired');
  }

  // Verify user still exists and is active
  const employee = await prisma.employee.findUnique({ where: { id: payload.userId } });
  if (!employee || !employee.isActive) {
    throw new AuthenticationError('User not found or deactivated');
  }

  const newPayload: JwtPayload = {
    userId: employee.id,
    email: employee.email,
    role: employee.role,
    systemRole: employee.systemRole,
    assignedProjectId: employee.assignedProjectId,
    assignedWarehouseId: employee.assignedWarehouseId,
  };

  const newAccessToken = signAccessToken(newPayload);
  const newRefreshToken = signRefreshToken(newPayload);

  // Rotate: delete old refresh token and store new one
  const REFRESH_TTL_DAYS = 7;
  await prisma.$transaction([
    prisma.refreshToken.delete({ where: { id: storedToken.id } }),
    prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: employee.id,
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
      },
    }),
  ]);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

/**
 * Logout: revoke the refresh token and blacklist the current access token.
 */
export async function logout(accessToken: string, refreshToken?: string): Promise<void> {
  // Blacklist the access token in Redis (short TTL, matches token expiry)
  const decoded = decodeToken(accessToken);
  if (decoded?.jti) {
    await blacklistToken(decoded.jti, 15 * 60); // 15 min max access token lifetime
  }

  // Revoke refresh token from DB
  if (refreshToken) {
    await prisma.refreshToken.deleteMany({ where: { token: refreshToken } }).catch(() => {});
  }
}

/**
 * Revoke all refresh tokens for a user (e.g. on password change).
 */
export async function revokeAllTokens(userId: string): Promise<void> {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const employee = await prisma.employee.findUnique({ where: { id: userId } });
  if (!employee || !employee.passwordHash) {
    throw new NotFoundError('User');
  }

  const valid = await comparePassword(currentPassword, employee.passwordHash);
  if (!valid) {
    throw new BusinessRuleError('Current password is incorrect');
  }

  const newHash = await hashPassword(newPassword);
  await prisma.employee.update({
    where: { id: userId },
    data: { passwordHash: newHash },
  });

  // Revoke all existing refresh tokens (force re-login)
  await revokeAllTokens(userId);
}

// ── Forgot / Reset Password ─────────────────────────────────────────────

const MAX_RESET_CODES_PER_HOUR = 3;

export async function forgotPassword(email: string): Promise<void> {
  const employee = await prisma.employee.findUnique({ where: { email } });

  // Generate code regardless (don't reveal user existence)
  const code = String(crypto.randomInt(100000, 999999));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  if (employee) {
    // Rate limit: max 3 reset codes per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentCount = await prisma.passwordResetCode.count({
      where: {
        email: email.toLowerCase(),
        createdAt: { gte: oneHourAgo },
      },
    });

    if (recentCount >= MAX_RESET_CODES_PER_HOUR) {
      throw new RateLimitError('Too many reset code requests. Please try again later.');
    }

    // Store in database
    await prisma.passwordResetCode.create({
      data: {
        email: email.toLowerCase(),
        code,
        expiresAt,
      },
    });

    // Send password reset email via templated email service
    try {
      await sendTemplatedEmail({
        templateCode: 'password_reset',
        to: email,
        variables: {
          code,
          fullName: employee.fullName,
          expiryMinutes: 15,
        },
        referenceTable: 'passwordResetCode',
      });
    } catch (err) {
      // Log but don't fail — the code is still stored in DB as a fallback
      log('warn', `[Auth] Failed to send password reset email to ${email}: ${(err as Error).message}`);
    }
  }
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const entry = await prisma.passwordResetCode.findFirst({
    where: {
      email: email.toLowerCase(),
      code,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) {
    throw new BusinessRuleError('Invalid or expired reset code');
  }

  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee) {
    throw new BusinessRuleError('Invalid or expired reset code');
  }

  const newHash = await hashPassword(newPassword);
  await prisma.employee.update({
    where: { id: employee.id },
    data: { passwordHash: newHash },
  });

  // Clean up all reset codes for this email
  await prisma.passwordResetCode.deleteMany({
    where: { email: email.toLowerCase() },
  });

  // Revoke all existing refresh tokens (force re-login with new password)
  await revokeAllTokens(employee.id);
}

export async function getMe(userId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: userId },
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
  if (!employee) throw new NotFoundError('User');
  return employee;
}

// ── Cleanup Job ─────────────────────────────────────────────────────────

/**
 * Remove expired refresh tokens from DB. Should be called periodically.
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
