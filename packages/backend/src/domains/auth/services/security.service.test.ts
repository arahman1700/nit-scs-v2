import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma, mockCreateNotification, mockLog } = vi.hoisted(() => {
  return {
    mockPrisma: {} as PrismaMock,
    mockCreateNotification: vi.fn().mockResolvedValue({}),
    mockLog: vi.fn(),
  };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/notification.service.js', () => ({
  createNotification: mockCreateNotification,
}));
vi.mock('../../../config/logger.js', () => ({ log: mockLog }));
vi.mock('@nit-scs-v2/shared', () => ({
  NotFoundError: class NotFoundError extends Error {
    constructor(entity: string) {
      super(`${entity} not found`);
      this.name = 'NotFoundError';
    }
  },
}));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import {
  recordLoginAttempt,
  checkAccountLockout,
  getLoginHistory,
  getSecurityDashboard,
  detectSuspiciousActivity,
} from './security.service.js';

describe('security.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    mockCreateNotification.mockClear();
    mockLog.mockClear();
  });

  // ---------------------------------------------------------------------------
  // recordLoginAttempt
  // ---------------------------------------------------------------------------
  describe('recordLoginAttempt', () => {
    it('should create a login attempt record', async () => {
      mockPrisma.loginAttempt.create.mockResolvedValue({ id: 'la-1' });

      await recordLoginAttempt('emp-1', '192.168.1.1', 'Mozilla/5.0', true);

      expect(mockPrisma.loginAttempt.create).toHaveBeenCalledWith({
        data: {
          employeeId: 'emp-1',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          success: true,
          failureReason: undefined,
        },
      });
    });

    it('should record failure reason for failed attempts', async () => {
      mockPrisma.loginAttempt.create.mockResolvedValue({ id: 'la-2' });

      await recordLoginAttempt('emp-1', '10.0.0.1', 'curl', false, 'Invalid password');

      const data = mockPrisma.loginAttempt.create.mock.calls[0][0].data;
      expect(data.success).toBe(false);
      expect(data.failureReason).toBe('Invalid password');
    });

    it('should truncate userAgent to 500 characters', async () => {
      mockPrisma.loginAttempt.create.mockResolvedValue({ id: 'la-3' });
      const longUA = 'x'.repeat(600);

      await recordLoginAttempt('emp-1', '10.0.0.1', longUA, true);

      const data = mockPrisma.loginAttempt.create.mock.calls[0][0].data;
      expect(data.userAgent?.length).toBe(500);
    });

    it('should truncate failureReason to 100 characters', async () => {
      mockPrisma.loginAttempt.create.mockResolvedValue({ id: 'la-4' });
      const longReason = 'x'.repeat(200);

      await recordLoginAttempt('emp-1', '10.0.0.1', 'UA', false, longReason);

      const data = mockPrisma.loginAttempt.create.mock.calls[0][0].data;
      expect(data.failureReason?.length).toBe(100);
    });

    it('should handle undefined userAgent', async () => {
      mockPrisma.loginAttempt.create.mockResolvedValue({ id: 'la-5' });

      await recordLoginAttempt('emp-1', '10.0.0.1', undefined, true);

      const data = mockPrisma.loginAttempt.create.mock.calls[0][0].data;
      expect(data.userAgent).toBeUndefined();
    });

    it('should not throw on database error (logs warning)', async () => {
      mockPrisma.loginAttempt.create.mockRejectedValue(new Error('DB error'));

      await expect(recordLoginAttempt('emp-1', '10.0.0.1', 'UA', true)).resolves.toBeUndefined();
      expect(mockLog).toHaveBeenCalledWith('warn', expect.stringContaining('Failed to record login attempt'));
    });
  });

  // ---------------------------------------------------------------------------
  // checkAccountLockout
  // ---------------------------------------------------------------------------
  describe('checkAccountLockout', () => {
    it('should return locked:false when failed attempts below threshold', async () => {
      mockPrisma.loginAttempt.count.mockResolvedValue(3);

      const result = await checkAccountLockout('emp-1');

      expect(result).toEqual({ locked: false, remainingMinutes: 0 });
    });

    it('should return locked:true when failed attempts reach threshold (5)', async () => {
      mockPrisma.loginAttempt.count.mockResolvedValue(5);
      mockPrisma.loginAttempt.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 10 * 60 * 1000), // 10 min ago
      });

      const result = await checkAccountLockout('emp-1');

      expect(result.locked).toBe(true);
      expect(result.remainingMinutes).toBeGreaterThan(0);
    });

    it('should return locked:true with default window when no recent attempt found', async () => {
      mockPrisma.loginAttempt.count.mockResolvedValue(5);
      mockPrisma.loginAttempt.findFirst.mockResolvedValue(null);

      const result = await checkAccountLockout('emp-1');

      expect(result).toEqual({ locked: true, remainingMinutes: 30 });
    });

    it('should return remaining minutes at least 1', async () => {
      mockPrisma.loginAttempt.count.mockResolvedValue(10);
      // Very recent attempt — lockout just started
      mockPrisma.loginAttempt.findFirst.mockResolvedValue({
        createdAt: new Date(Date.now() - 1000), // 1 second ago
      });

      const result = await checkAccountLockout('emp-1');

      expect(result.locked).toBe(true);
      expect(result.remainingMinutes).toBeGreaterThanOrEqual(1);
    });

    it('should query within the 30-minute lockout window', async () => {
      mockPrisma.loginAttempt.count.mockResolvedValue(0);

      await checkAccountLockout('emp-1');

      const callArgs = mockPrisma.loginAttempt.count.mock.calls[0][0];
      expect(callArgs.where.employeeId).toBe('emp-1');
      expect(callArgs.where.success).toBe(false);
      expect(callArgs.where.createdAt.gte).toBeInstanceOf(Date);
    });
  });

  // ---------------------------------------------------------------------------
  // getLoginHistory
  // ---------------------------------------------------------------------------
  describe('getLoginHistory', () => {
    it('should return paginated login history', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      const history = [{ id: 'la-1', success: true }];
      mockPrisma.loginAttempt.findMany.mockResolvedValue(history);
      mockPrisma.loginAttempt.count.mockResolvedValue(50);

      const result = await getLoginHistory('emp-1', { page: 1, pageSize: 20 });

      expect(result).toEqual({ data: history, total: 50 });
    });

    it('should apply correct skip for page 3', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.loginAttempt.findMany.mockResolvedValue([]);
      mockPrisma.loginAttempt.count.mockResolvedValue(0);

      await getLoginHistory('emp-1', { page: 3, pageSize: 10 });

      const callArgs = mockPrisma.loginAttempt.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(20); // (3-1) * 10
      expect(callArgs.take).toBe(10);
    });

    it('should use default pagination when params not provided', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.loginAttempt.findMany.mockResolvedValue([]);
      mockPrisma.loginAttempt.count.mockResolvedValue(0);

      await getLoginHistory('emp-1');

      const callArgs = mockPrisma.loginAttempt.findMany.mock.calls[0][0];
      expect(callArgs.skip).toBe(0);
      expect(callArgs.take).toBe(20);
    });

    it('should throw NotFoundError when employee does not exist', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue(null);

      await expect(getLoginHistory('missing')).rejects.toThrow('not found');
    });

    it('should order by createdAt desc', async () => {
      mockPrisma.employee.findUnique.mockResolvedValue({ id: 'emp-1' });
      mockPrisma.loginAttempt.findMany.mockResolvedValue([]);
      mockPrisma.loginAttempt.count.mockResolvedValue(0);

      await getLoginHistory('emp-1');

      const callArgs = mockPrisma.loginAttempt.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  // ---------------------------------------------------------------------------
  // getSecurityDashboard
  // ---------------------------------------------------------------------------
  describe('getSecurityDashboard', () => {
    it('should return aggregated security metrics', async () => {
      mockPrisma.loginAttempt.findMany.mockResolvedValue([{ employeeId: 'e1' }, { employeeId: 'e2' }]);
      mockPrisma.loginAttempt.count.mockResolvedValue(15);
      mockPrisma.loginAttempt.groupBy
        .mockResolvedValueOnce([{ employeeId: 'e3' }]) // locked accounts
        .mockResolvedValueOnce([{ ipAddress: '10.0.0.1', _count: { id: 12 } }]); // suspicious IPs

      const result = await getSecurityDashboard();

      expect(result).toEqual({
        activeUsers24h: 2,
        failedAttempts24h: 15,
        lockedAccounts: 1,
        suspiciousIps: ['10.0.0.1'],
      });
    });

    it('should return zeros when no activity', async () => {
      mockPrisma.loginAttempt.findMany.mockResolvedValue([]);
      mockPrisma.loginAttempt.count.mockResolvedValue(0);
      mockPrisma.loginAttempt.groupBy.mockResolvedValue([]);

      const result = await getSecurityDashboard();

      expect(result).toEqual({
        activeUsers24h: 0,
        failedAttempts24h: 0,
        lockedAccounts: 0,
        suspiciousIps: [],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // detectSuspiciousActivity
  // ---------------------------------------------------------------------------
  describe('detectSuspiciousActivity', () => {
    it('should skip when no suspicious IPs found', async () => {
      mockPrisma.loginAttempt.groupBy.mockResolvedValue([]);

      await detectSuspiciousActivity();

      expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('should notify all admin users about suspicious IPs', async () => {
      mockPrisma.loginAttempt.groupBy.mockResolvedValue([{ ipAddress: '10.0.0.1', _count: { id: 15 } }]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);

      await detectSuspiciousActivity();

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: { systemRole: 'admin', isActive: true },
        select: { id: true },
      });
      expect(mockCreateNotification).toHaveBeenCalledTimes(2);
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'admin-1',
          notificationType: 'security_alert',
          referenceTable: 'login_attempts',
        }),
      );
    });

    it('should create notifications for each suspicious IP × admin combination', async () => {
      mockPrisma.loginAttempt.groupBy.mockResolvedValue([
        { ipAddress: '10.0.0.1', _count: { id: 15 } },
        { ipAddress: '10.0.0.2', _count: { id: 20 } },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      await detectSuspiciousActivity();

      // 2 IPs × 1 admin = 2 notifications
      expect(mockCreateNotification).toHaveBeenCalledTimes(2);
    });

    it('should include IP address and count in notification', async () => {
      mockPrisma.loginAttempt.groupBy.mockResolvedValue([{ ipAddress: '192.168.1.100', _count: { id: 25 } }]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'admin-1' }]);

      await detectSuspiciousActivity();

      const call = mockCreateNotification.mock.calls[0][0];
      expect(call.title).toContain('192.168.1.100');
      expect(call.body).toContain('25');
      expect(call.body).toContain('brute-force');
    });

    it('should log warning for each suspicious IP', async () => {
      mockPrisma.loginAttempt.groupBy.mockResolvedValue([{ ipAddress: '10.0.0.1', _count: { id: 15 } }]);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await detectSuspiciousActivity();

      expect(mockLog).toHaveBeenCalledWith('warn', expect.stringContaining('Suspicious activity detected'));
    });

    it('should handle notification creation failure gracefully', async () => {
      mockPrisma.loginAttempt.groupBy.mockResolvedValue([{ ipAddress: '10.0.0.1', _count: { id: 15 } }]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'admin-1' }]);
      mockCreateNotification.mockRejectedValue(new Error('notification failed'));

      // Should not throw
      await expect(detectSuspiciousActivity()).resolves.toBeUndefined();
      expect(mockLog).toHaveBeenCalledWith('warn', expect.stringContaining('Failed to create notification'));
    });
  });
});
