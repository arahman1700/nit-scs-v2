/**
 * Security Service — M6: Access Control & Security
 *
 * Provides login attempt tracking, account lockout detection,
 * login history retrieval, security dashboard metrics, and
 * suspicious activity detection.
 */

import { prisma } from '../../../utils/prisma.js';
import { createNotification } from '../../../services/notification.service.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import { log } from '../../../config/logger.js';

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MINUTES = 30;
const SUSPICIOUS_IP_THRESHOLD = 10;
const SUSPICIOUS_IP_WINDOW_HOURS = 1;

// ── Login Attempt Recording ──────────────────────────────────────────────────

export async function recordLoginAttempt(
  employeeId: string,
  ipAddress: string,
  userAgent: string | undefined,
  success: boolean,
  failureReason?: string,
): Promise<void> {
  try {
    await prisma.loginAttempt.create({
      data: {
        employeeId,
        ipAddress,
        userAgent: userAgent?.slice(0, 500),
        success,
        failureReason: failureReason?.slice(0, 100),
      },
    });
  } catch (err) {
    // Non-critical: log but don't fail the login flow
    log('warn', `[Security] Failed to record login attempt: ${(err as Error).message}`);
  }
}

// ── Account Lockout Check ────────────────────────────────────────────────────

export async function checkAccountLockout(employeeId: string): Promise<{ locked: boolean; remainingMinutes: number }> {
  const windowStart = new Date(Date.now() - LOCKOUT_WINDOW_MINUTES * 60 * 1000);

  const failedCount = await prisma.loginAttempt.count({
    where: {
      employeeId,
      success: false,
      createdAt: { gte: windowStart },
    },
  });

  if (failedCount >= MAX_FAILED_ATTEMPTS) {
    // Find the most recent failed attempt to calculate remaining lockout time
    const lastFailed = await prisma.loginAttempt.findFirst({
      where: {
        employeeId,
        success: false,
        createdAt: { gte: windowStart },
      },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    if (lastFailed) {
      const lockoutEnd = new Date(lastFailed.createdAt.getTime() + LOCKOUT_WINDOW_MINUTES * 60 * 1000);
      const remainingMs = lockoutEnd.getTime() - Date.now();
      const remainingMinutes = Math.max(1, Math.ceil(remainingMs / (60 * 1000)));
      return { locked: true, remainingMinutes };
    }

    return { locked: true, remainingMinutes: LOCKOUT_WINDOW_MINUTES };
  }

  return { locked: false, remainingMinutes: 0 };
}

// ── Login History ────────────────────────────────────────────────────────────

interface LoginHistoryParams {
  page?: number;
  pageSize?: number;
}

export async function getLoginHistory(employeeId: string, params: LoginHistoryParams = {}) {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const skip = (page - 1) * pageSize;

  // Verify employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true },
  });
  if (!employee) throw new NotFoundError('Employee');

  const [data, total] = await Promise.all([
    prisma.loginAttempt.findMany({
      where: { employeeId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        success: true,
        failureReason: true,
        createdAt: true,
      },
    }),
    prisma.loginAttempt.count({ where: { employeeId } }),
  ]);

  return { data, total };
}

// ── Security Dashboard ──────────────────────────────────────────────────────

export async function getSecurityDashboard() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const thirtyMinutesAgo = new Date(now.getTime() - LOCKOUT_WINDOW_MINUTES * 60 * 1000);

  const [activeUsers24h, failedAttempts24h, lockedAccountsRaw, suspiciousIpsRaw] = await Promise.all([
    // Active users: distinct employees with successful login in last 24h
    prisma.loginAttempt.findMany({
      where: {
        success: true,
        createdAt: { gte: twentyFourHoursAgo },
      },
      distinct: ['employeeId'],
      select: { employeeId: true },
    }),

    // Failed attempts in last 24h
    prisma.loginAttempt.count({
      where: {
        success: false,
        createdAt: { gte: twentyFourHoursAgo },
      },
    }),

    // Locked accounts: employees with >= MAX_FAILED_ATTEMPTS failures in last 30 min
    prisma.loginAttempt.groupBy({
      by: ['employeeId'],
      where: {
        success: false,
        createdAt: { gte: thirtyMinutesAgo },
      },
      _count: { id: true },
      having: {
        id: { _count: { gte: MAX_FAILED_ATTEMPTS } },
      },
    }),

    // Suspicious IPs: IPs with >= SUSPICIOUS_IP_THRESHOLD failures in last hour
    prisma.loginAttempt.groupBy({
      by: ['ipAddress'],
      where: {
        success: false,
        createdAt: { gte: new Date(now.getTime() - SUSPICIOUS_IP_WINDOW_HOURS * 60 * 60 * 1000) },
      },
      _count: { id: true },
      having: {
        id: { _count: { gte: SUSPICIOUS_IP_THRESHOLD } },
      },
    }),
  ]);

  return {
    activeUsers24h: activeUsers24h.length,
    failedAttempts24h,
    lockedAccounts: lockedAccountsRaw.length,
    suspiciousIps: suspiciousIpsRaw.map(ip => ip.ipAddress),
  };
}

// ── Suspicious Activity Detection (Scheduled Job) ───────────────────────────

export async function detectSuspiciousActivity(): Promise<void> {
  const oneHourAgo = new Date(Date.now() - SUSPICIOUS_IP_WINDOW_HOURS * 60 * 60 * 1000);

  // Find IPs with > SUSPICIOUS_IP_THRESHOLD failed attempts in the last hour
  const suspiciousIps = await prisma.loginAttempt.groupBy({
    by: ['ipAddress'],
    where: {
      success: false,
      createdAt: { gte: oneHourAgo },
    },
    _count: { id: true },
    having: {
      id: { _count: { gte: SUSPICIOUS_IP_THRESHOLD } },
    },
  });

  if (suspiciousIps.length === 0) return;

  // Notify all admin users about suspicious activity
  const admins = await prisma.employee.findMany({
    where: { systemRole: 'admin', isActive: true },
    select: { id: true },
  });

  for (const ip of suspiciousIps) {
    const ipAddr = ip.ipAddress;
    const count = ip._count.id;

    log(
      'warn',
      `[Security] Suspicious activity detected: IP ${ipAddr} has ${count} failed login attempts in the last hour`,
    );

    for (const admin of admins) {
      try {
        await createNotification({
          recipientId: admin.id,
          title: `Suspicious login activity from IP ${ipAddr}`,
          body: `${count} failed login attempts detected from IP ${ipAddr} in the last hour. This may indicate a brute-force attack.`,
          notificationType: 'security_alert',
          referenceTable: 'login_attempts',
        });
      } catch (err) {
        log('warn', `[Security] Failed to create notification for admin ${admin.id}: ${(err as Error).message}`);
      }
    }
  }
}
