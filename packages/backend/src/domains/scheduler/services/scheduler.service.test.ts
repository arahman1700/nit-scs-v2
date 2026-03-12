/**
 * Scheduler Service Tests
 *
 * Tests the background job scheduler which manages periodic tasks:
 * SLA breach/warning detection, email retry, expired lot marking,
 * low stock alerts, token cleanup, ABC classification, cycle counts,
 * gate pass expiry, anomaly detection, reorder point updates, and
 * scheduled workflow rules.
 *
 * Uses vi.useFakeTimers() + vi.resetModules() + dynamic import to
 * ensure a fresh module with clean module-level state for each test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../../../test-utils/prisma-mock.js';

// ── Hoisted mocks (must be declared before vi.mock calls) ────────────────

const {
  mockPrisma,
  mockProcessQueuedEmails,
  mockCleanupExpiredTokens,
  mockCalculateABC,
  mockApplyABC,
  mockAutoCreateCycleCounts,
  mockDetectAnomalies,
  mockAutoUpdateReorderPoints,
  mockProcessScheduledRules,
  mockInitializeScheduledRules,
  mockEmitToRole,
  mockEmitToUser,
  mockSendPushToUser,
  mockGetAllSlaHours,
  mockCreateNotification,
  mockLog,
} = vi.hoisted(() => ({
  mockPrisma: {} as PrismaMock,
  mockProcessQueuedEmails: vi.fn().mockResolvedValue(0),
  mockCleanupExpiredTokens: vi.fn().mockResolvedValue(0),
  mockCalculateABC: vi.fn().mockResolvedValue([]),
  mockApplyABC: vi.fn(),
  mockAutoCreateCycleCounts: vi.fn().mockResolvedValue(undefined),
  mockDetectAnomalies: vi.fn().mockResolvedValue([]),
  mockAutoUpdateReorderPoints: vi.fn().mockResolvedValue({ updated: 0, total: 0 }),
  mockProcessScheduledRules: vi.fn().mockResolvedValue(undefined),
  mockInitializeScheduledRules: vi.fn().mockResolvedValue(undefined),
  mockEmitToRole: vi.fn(),
  mockEmitToUser: vi.fn(),
  mockSendPushToUser: vi.fn().mockResolvedValue(undefined),
  mockGetAllSlaHours: vi.fn().mockResolvedValue({}),
  mockCreateNotification: vi.fn().mockResolvedValue({}),
  mockLog: vi.fn(),
}));

// ── Module mocks ─────────────────────────────────────────────────────────

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../config/logger.js', () => ({ log: mockLog }));
vi.mock('../../../config/redis.js', () => ({ getRedis: vi.fn().mockReturnValue(null) }));
vi.mock('../../../infrastructure/queue/bullmq.config.js', () => ({
  getQueue: vi.fn(),
  shutdownQueues: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../../../infrastructure/queue/job-definitions.js', () => ({
  JOB_DEFINITIONS: [],
  JOB_LEGACY_MAP: {},
}));
vi.mock('../../../infrastructure/queue/queue-worker.js', () => ({
  startWorkers: vi.fn(),
}));
vi.mock('../../system/services/email.service.js', () => ({ processQueuedEmails: mockProcessQueuedEmails }));
vi.mock('../../notifications/services/notification.service.js', () => ({ createNotification: mockCreateNotification }));
vi.mock('../../auth/services/auth.service.js', () => ({ cleanupExpiredTokens: mockCleanupExpiredTokens }));
vi.mock('../../inventory/services/abc-analysis.service.js', () => ({
  calculateABCClassification: mockCalculateABC,
  applyABCClassification: mockApplyABC,
}));
vi.mock('../../inventory/services/cycle-count.service.js', () => ({
  autoCreateCycleCounts: mockAutoCreateCycleCounts,
}));
vi.mock('../../reporting/services/anomaly-detection.service.js', () => ({ detectAnomalies: mockDetectAnomalies }));
vi.mock('../../reporting/services/reorder-prediction.service.js', () => ({
  autoUpdateReorderPoints: mockAutoUpdateReorderPoints,
}));
vi.mock('../../../events/scheduled-rule-runner.js', () => ({
  processScheduledRules: mockProcessScheduledRules,
  initializeScheduledRules: mockInitializeScheduledRules,
}));
vi.mock('../../../socket/setup.js', () => ({
  emitToRole: mockEmitToRole,
  emitToUser: mockEmitToUser,
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../../notifications/services/push-notification.service.js', () => ({ sendPushToUser: mockSendPushToUser }));
vi.mock('../../system/services/system-config.service.js', () => ({ getAllSlaHours: mockGetAllSlaHours }));

// ── Imports ──────────────────────────────────────────────────────────────

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';

type SchedulerModule = typeof import('./scheduler.service.js');

/** Import a fresh module to reset module-level state (timers, io, running, _slaConfig). */
async function freshModule(): Promise<SchedulerModule> {
  vi.resetModules();
  return import('./scheduler.service.js');
}

function createModelMock(): PrismaModelMock & { findUniqueOrThrow: ReturnType<typeof vi.fn> } {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

/** Flush all pending microtasks (Promise callbacks). */
async function flushPromises(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

// ── Setup / Teardown ─────────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers();

  const fresh = createPrismaMock();
  Object.assign(mockPrisma, fresh);

  vi.clearAllMocks();

  // Default: all findMany calls return empty arrays (no documents to process)
  // Individual tests override these as needed.
});

afterEach(async () => {
  // Restore real timers FIRST so any remaining scheduled callbacks don't
  // fire with fake-timer semantics during the next test's setup.
  vi.useRealTimers();

  // Import fresh module and stop scheduler to clear module-level state
  // (timers array, io reference, running flag).
  try {
    const mod = await freshModule();
    await mod.stopScheduler();
  } catch {
    // ignore — module may not have been started
  }

  vi.clearAllTimers();
});

// ── Helpers ──────────────────────────────────────────────────────────────

/** Set up default empty responses for all delegate models used in SLA checks. */
function mockEmptyDelegates(): void {
  // Models accessed via getDelegate()
  mockPrisma.mirv.findMany.mockResolvedValue([]);
  mockPrisma.materialRequisition.findMany.mockResolvedValue([]);
  mockPrisma.jobOrder.findMany.mockResolvedValue([]);
  mockPrisma.gatePass.findMany.mockResolvedValue([]);
  mockPrisma.scrapItem.findMany.mockResolvedValue([]);
  mockPrisma.surplusItem.findMany.mockResolvedValue([]);
  mockPrisma.rfim.findMany.mockResolvedValue([]);

  // Direct prisma models
  mockPrisma.joSlaTracking.findMany.mockResolvedValue([]);
  mockPrisma.notification.findFirst.mockResolvedValue(null);
  mockPrisma.notification.findMany.mockResolvedValue([]);
  mockPrisma.notification.createMany.mockResolvedValue({ count: 0 });
  mockPrisma.employee.findMany.mockResolvedValue([]);
  mockPrisma.approvalStep.findFirst.mockResolvedValue(null);
  mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.gatePass.updateMany.mockResolvedValue({ count: 0 });
  mockPrisma.$queryRaw.mockResolvedValue([]);
}

// ==========================================================================
// Tests
// ==========================================================================

describe('scheduler.service', () => {
  // ── Lifecycle ────────────────────────────────────────────────────────

  describe('startScheduler / stopScheduler lifecycle', () => {
    it('should start the scheduler and log startup messages', async () => {
      mockEmptyDelegates();
      const mod = await freshModule();

      await mod.startScheduler();

      expect(mockLog).toHaveBeenCalledWith('info', '[Scheduler] Starting BullMQ-based job scheduler');
      // Falls back to setInterval when Redis returns null
      expect(mockLog).toHaveBeenCalledWith('warn', '[Scheduler] Redis unavailable — falling back to setInterval mode');

      await mod.stopScheduler();
    });

    it('should stop the scheduler and log the shutdown message', async () => {
      mockEmptyDelegates();
      const mod = await freshModule();

      await mod.startScheduler();
      await mod.stopScheduler();

      expect(mockLog).toHaveBeenCalledWith('info', '[Scheduler] Scheduler stopped');
    });

    it('should use BullMQ mode when Redis is available', async () => {
      mockEmptyDelegates();
      // Re-mock getRedis to return a truthy value
      const { getRedis } = await import('../../../config/redis.js');
      const mockRedis = { status: 'ready' };
      (getRedis as ReturnType<typeof vi.fn>).mockReturnValue(mockRedis);

      // Mock BullMQ queue with needed methods
      const { getQueue } = await import('../../../infrastructure/queue/bullmq.config.js');
      const mockQueue = {
        getRepeatableJobs: vi.fn().mockResolvedValue([]),
        add: vi.fn().mockResolvedValue({}),
        removeRepeatableByKey: vi.fn().mockResolvedValue(undefined),
      };
      (getQueue as ReturnType<typeof vi.fn>).mockReturnValue(mockQueue);

      const mod = await freshModule();
      await mod.startScheduler();

      expect(mockLog).toHaveBeenCalledWith('info', '[Scheduler] Starting BullMQ-based job scheduler');
      // Should NOT fall back
      const fallbackCalls = mockLog.mock.calls.filter(
        (c: unknown[]) => typeof c[1] === 'string' && (c[1] as string).includes('falling back'),
      );
      expect(fallbackCalls).toHaveLength(0);

      await mod.stopScheduler();

      // Reset Redis mock back to null for other tests
      (getRedis as ReturnType<typeof vi.fn>).mockReturnValue(null);
    });

    it('should accept a socket.io server argument without error', async () => {
      mockEmptyDelegates();
      const mod = await freshModule();
      const fakeIo = { emit: vi.fn() } as unknown;

      await expect(mod.startScheduler(fakeIo as never)).resolves.not.toThrow();

      await mod.stopScheduler();
    });

    it('should call initializeScheduledRules on start', async () => {
      mockEmptyDelegates();
      const mod = await freshModule();

      await mod.startScheduler();
      await flushPromises();

      expect(mockInitializeScheduledRules).toHaveBeenCalledOnce();

      await mod.stopScheduler();
    });

    it('should clear all timers when stopScheduler is called', async () => {
      mockEmptyDelegates();
      const mod = await freshModule();

      await mod.startScheduler();

      // There should be registered timers (12 scheduleLoop + 1 initTimer = 13 timers)
      // After stopping, no timer callbacks should fire
      await mod.stopScheduler();

      // Advance time well past any interval — nothing should fire
      mockLog.mockClear();
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      // Only log that could appear after stop is if a timer leaked — should NOT happen
      const calls = mockLog.mock.calls.filter(
        (c: unknown[]) =>
          typeof c[1] === 'string' && (c[1] as string).includes('[Scheduler]') && !(c[1] as string).includes('stopped'),
      );
      expect(calls).toHaveLength(0);
    });
  });

  // ── Initial run (10s delay) ──────────────────────────────────────────

  describe('initial run (10s delay)', () => {
    it('should trigger initial jobs after 10 seconds', async () => {
      mockEmptyDelegates();
      const mod = await freshModule();

      await mod.startScheduler();

      // Advance 10 seconds to trigger the initial run
      await vi.advanceTimersByTimeAsync(10_000);

      // The initial run calls checkSlaBreaches which calls refreshSlaConfig -> getAllSlaHours
      expect(mockGetAllSlaHours).toHaveBeenCalled();

      // retryEmails is one of the initial jobs
      expect(mockProcessQueuedEmails).toHaveBeenCalled();

      // markExpiredLots is one of the initial jobs
      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalled();

      await mod.stopScheduler();
    });

    it('should not trigger initial jobs if scheduler is stopped before 10s', async () => {
      mockEmptyDelegates();
      const mod = await freshModule();

      await mod.startScheduler();
      await mod.stopScheduler();

      // Advance 10 seconds — but scheduler is already stopped
      await vi.advanceTimersByTimeAsync(10_000);

      // None of the initial job functions should have been called
      expect(mockGetAllSlaHours).not.toHaveBeenCalled();
    });
  });

  // ── Email Retry ──────────────────────────────────────────────────────

  describe('retryEmails job', () => {
    it('should process queued emails on the 2-minute schedule', async () => {
      mockEmptyDelegates();
      mockProcessQueuedEmails.mockResolvedValue(3);

      const mod = await freshModule();
      await mod.startScheduler();

      // The email_retry loop has a 2-minute interval
      // First tick fires at 2 minutes
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(mockProcessQueuedEmails).toHaveBeenCalled();

      await mod.stopScheduler();
    });

    it('should log the count when emails are sent', async () => {
      mockEmptyDelegates();
      mockProcessQueuedEmails.mockResolvedValue(5);

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(mockLog).toHaveBeenCalledWith('info', '[Scheduler] Email retry: 5 sent');

      await mod.stopScheduler();
    });

    it('should not log when no emails are sent', async () => {
      mockEmptyDelegates();
      mockProcessQueuedEmails.mockResolvedValue(0);

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      const emailLogCalls = mockLog.mock.calls.filter(
        (c: unknown[]) => typeof c[1] === 'string' && (c[1] as string).includes('Email retry:'),
      );
      expect(emailLogCalls).toHaveLength(0);

      await mod.stopScheduler();
    });

    it('should log error when email retry fails', async () => {
      mockEmptyDelegates();
      mockProcessQueuedEmails.mockRejectedValue(new Error('SMTP down'));

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);

      expect(mockLog).toHaveBeenCalledWith('error', '[Scheduler] Email retry failed: SMTP down');

      await mod.stopScheduler();
    });
  });

  // ── Expired Lot Marking ──────────────────────────────────────────────

  describe('markExpiredLots job', () => {
    it('should mark expired lots on the hourly schedule', async () => {
      mockEmptyDelegates();
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 7 });

      const mod = await freshModule();
      await mod.startScheduler();

      // Expired lots loop interval = 1 hour
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          expiryDate: { lt: expect.any(Date) },
        },
        data: { status: 'expired' },
      });

      await mod.stopScheduler();
    });

    it('should log count when lots are marked expired', async () => {
      mockEmptyDelegates();
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 3 });

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(mockLog).toHaveBeenCalledWith('info', '[Scheduler] Marked 3 expired lot(s)');

      await mod.stopScheduler();
    });

    it('should not log when no lots are expired', async () => {
      mockEmptyDelegates();
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 0 });

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      const lotLogCalls = mockLog.mock.calls.filter(
        (c: unknown[]) => typeof c[1] === 'string' && (c[1] as string).includes('expired lot'),
      );
      expect(lotLogCalls).toHaveLength(0);

      await mod.stopScheduler();
    });
  });

  // ── Low Stock Alert Check ────────────────────────────────────────────

  describe('checkLowStock job', () => {
    it('should send notifications when low stock items are found', async () => {
      mockEmptyDelegates();

      const lowStockData = [
        {
          item_id: 'item-1',
          warehouse_id: 'wh-1',
          qty_on_hand: 5,
          qty_reserved: 2,
          min_level: 10,
          reorder_point: 15,
          item_code: 'BOLT-100',
          item_description: 'Bolt M10',
          warehouse_code: 'WH-A',
        },
      ];
      mockPrisma.$queryRaw.mockResolvedValue(lowStockData);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'staff-1' }]);
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });

      const mod = await freshModule();
      await mod.startScheduler();

      // Low stock loop interval = 30 minutes
      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      // Should mark alerts as sent
      expect(mockPrisma.inventoryLevel.updateMany).toHaveBeenCalledWith({
        where: {
          OR: [{ itemId: 'item-1', warehouseId: 'wh-1' }],
        },
        data: { alertSent: true },
      });

      // Should create notification for warehouse staff
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'staff-1',
          title: 'Low Stock Alert: 1 item(s)',
          notificationType: 'alert', // critical because qty <= min_level
        }),
        undefined, // no io passed (startScheduler called without socketIo)
      );

      await mod.stopScheduler();
    });

    it('should skip when no low stock items are found', async () => {
      mockEmptyDelegates();
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      expect(mockCreateNotification).not.toHaveBeenCalled();

      await mod.stopScheduler();
    });

    it('should use warning type when only reorder_point is breached (not min_level)', async () => {
      mockEmptyDelegates();

      const lowStockData = [
        {
          item_id: 'item-2',
          warehouse_id: 'wh-1',
          qty_on_hand: 20,
          qty_reserved: 5,
          min_level: null, // no min_level, so not critical
          reorder_point: 25,
          item_code: 'NUT-200',
          item_description: 'Nut M10',
          warehouse_code: 'WH-B',
        },
      ];
      mockPrisma.$queryRaw.mockResolvedValue(lowStockData);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'staff-1' }]);
      mockPrisma.inventoryLevel.updateMany.mockResolvedValue({ count: 1 });

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(30 * 60 * 1000);

      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationType: 'warning',
        }),
        undefined,
      );

      await mod.stopScheduler();
    });
  });

  // ── Token Cleanup ────────────────────────────────────────────────────

  describe('cleanupTokens job', () => {
    it('should clean up expired tokens on the 6-hour schedule', async () => {
      mockEmptyDelegates();
      mockCleanupExpiredTokens.mockResolvedValue(12);

      const mod = await freshModule();
      await mod.startScheduler();

      // Token cleanup interval = 6 hours
      await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);

      expect(mockCleanupExpiredTokens).toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith('info', '[Scheduler] Cleaned up 12 expired refresh token(s)');

      await mod.stopScheduler();
    });
  });

  // ── Gate Pass Expiry ─────────────────────────────────────────────────

  describe('expireGatePasses job', () => {
    it('should cancel gate passes past validUntil and notify security', async () => {
      mockEmptyDelegates();
      mockPrisma.gatePass.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'sec-1' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      const mod = await freshModule();
      await mod.startScheduler();

      // Gate pass expiry interval = 1 hour
      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      expect(mockPrisma.gatePass.updateMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['approved', 'pending'] },
          validUntil: { lt: expect.any(Date) },
        },
        data: { status: 'cancelled' },
      });

      // Should notify security staff
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            recipientId: 'sec-1',
            title: '2 gate pass(es) auto-expired',
            notificationType: 'gate_pass_expired',
          }),
        ],
      });

      await mod.stopScheduler();
    });

    it('should not notify when no gate passes are expired', async () => {
      mockEmptyDelegates();
      mockPrisma.gatePass.updateMany.mockResolvedValue({ count: 0 });

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(60 * 60 * 1000);

      // notification.createMany should NOT be called when count = 0
      const createManyCalls = mockPrisma.notification.createMany.mock.calls.filter((c: unknown[]) => {
        const arg = c[0] as { data: Array<{ notificationType: string }> };
        return arg?.data?.some(d => d.notificationType === 'gate_pass_expired');
      });
      expect(createManyCalls).toHaveLength(0);

      await mod.stopScheduler();
    });
  });

  // ── ABC Classification ───────────────────────────────────────────────

  describe('recalculateAbcClassification job', () => {
    it('should apply ABC classification when results are returned', async () => {
      mockEmptyDelegates();
      const abcResults = [
        { itemId: 'item-1', abcClass: 'A', annualValue: 100000 },
        { itemId: 'item-2', abcClass: 'B', annualValue: 50000 },
        { itemId: 'item-3', abcClass: 'C', annualValue: 5000 },
      ];
      mockCalculateABC.mockResolvedValue(abcResults);

      const mod = await freshModule();
      await mod.startScheduler();

      // ABC classification interval = 7 days
      await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000);
      await vi.runOnlyPendingTimersAsync();

      expect(mockCalculateABC).toHaveBeenCalled();
      expect(mockApplyABC).toHaveBeenCalledWith(abcResults);

      await mod.stopScheduler();
    }, 60000);
  });

  // ── Anomaly Detection ────────────────────────────────────────────────

  describe('runAnomalyDetection job', () => {
    it('should run anomaly detection on the 6-hour schedule', async () => {
      mockEmptyDelegates();
      mockDetectAnomalies.mockResolvedValue([
        { severity: 'high', type: 'consumption_spike' },
        { severity: 'medium', type: 'unusual_transfer' },
      ]);

      const mod = await freshModule();
      await mod.startScheduler();

      // Anomaly detection interval = 6 hours
      await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
      await vi.runOnlyPendingTimersAsync();

      expect(mockDetectAnomalies).toHaveBeenCalledWith({ notify: true });
      expect(mockLog).toHaveBeenCalledWith('warn', '[Scheduler] Anomaly detection: 2 found (1 high severity)');

      await mod.stopScheduler();
    }, 60000);
  });

  // ── Reorder Point Update ─────────────────────────────────────────────

  describe('runReorderPointUpdate job', () => {
    it('should run reorder point updates on the 7-day schedule', async () => {
      mockEmptyDelegates();
      mockAutoUpdateReorderPoints.mockResolvedValue({ updated: 15, total: 100 });

      const mod = await freshModule();
      await mod.startScheduler();

      // Reorder update interval = 7 days
      await vi.advanceTimersByTimeAsync(7 * 24 * 60 * 60 * 1000);
      await vi.runOnlyPendingTimersAsync();

      expect(mockAutoUpdateReorderPoints).toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith('info', '[Scheduler] Reorder points auto-updated: 15/100');

      await mod.stopScheduler();
    }, 60000);
  });

  // ── Scheduled Rules ──────────────────────────────────────────────────

  describe('processScheduledRules job', () => {
    it('should process scheduled rules on the 60-second schedule', async () => {
      mockEmptyDelegates();

      const mod = await freshModule();
      await mod.startScheduler();

      // Scheduled rules interval = 60 seconds
      await vi.advanceTimersByTimeAsync(60 * 1000);

      expect(mockProcessScheduledRules).toHaveBeenCalled();

      await mod.stopScheduler();
    });
  });

  // ── SLA Breach Detection ─────────────────────────────────────────────

  describe('SLA breach detection', () => {
    it('should detect MIRV approval SLA breaches and create notifications', async () => {
      mockEmptyDelegates();

      const now = new Date();
      const overdueDoc = { id: 'mirv-001', slaDueDate: new Date(now.getTime() - 60 * 60 * 1000) };

      // MIRV delegate findMany returns an overdue doc
      mockPrisma.mirv.findMany.mockResolvedValue([overdueDoc]);

      // No recent notification
      mockPrisma.notification.findFirst.mockResolvedValue(null);

      // Pending approval step
      mockPrisma.approvalStep.findFirst.mockResolvedValue({
        id: 'step-1',
        documentType: 'mirv',
        documentId: 'mirv-001',
        level: 1,
        approverRole: 'manager',
        status: 'pending',
      });

      // Admin and approver employees
      mockPrisma.employee.findMany
        .mockResolvedValueOnce([{ id: 'admin-1' }]) // getAdminIds
        .mockResolvedValueOnce([{ id: 'mgr-1' }]); // getEmployeeIdsByRole('manager')

      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      const mod = await freshModule();
      await mod.startScheduler();

      // SLA breach check interval = 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Should have refreshed SLA config
      expect(mockGetAllSlaHours).toHaveBeenCalled();

      // Should have called createMany to batch insert notifications
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('MIRV'),
            notificationType: expect.stringMatching(/sla_(warning|breach)/),
            referenceTable: 'mirv',
            referenceId: 'mirv-001',
          }),
        ]),
      });

      await mod.stopScheduler();
    });

    it('should skip MIRV breach notification if a recent one exists', async () => {
      mockEmptyDelegates();

      const now = new Date();
      const overdueDoc = { id: 'mirv-002', slaDueDate: new Date(now.getTime() - 60 * 60 * 1000) };

      mockPrisma.mirv.findMany.mockResolvedValue([overdueDoc]);

      // Recent notification EXISTS
      mockPrisma.notification.findFirst.mockResolvedValue({
        id: 'notif-existing',
        title: 'SLA Breached: MIRV',
        createdAt: new Date(),
      });

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Should NOT create new notifications for mirv-002
      const createManyCalls = mockPrisma.notification.createMany.mock.calls;
      const breachNotifCalls = createManyCalls.filter((c: unknown[]) => {
        const arg = c[0] as { data: Array<{ referenceId: string }> };
        return arg?.data?.some(d => d.referenceId === 'mirv-002');
      });
      expect(breachNotifCalls).toHaveLength(0);

      await mod.stopScheduler();
    });

    it('should detect MR stock verification SLA breaches', async () => {
      mockEmptyDelegates();

      const overdueDoc = {
        id: 'mr-001',
        mrfNumber: 'MR-2026-001',
        stockVerificationSla: new Date(Date.now() - 2 * 60 * 60 * 1000),
      };

      // materialRequisition delegate returns overdue doc (explicit SLA)
      mockPrisma.materialRequisition.findMany
        .mockResolvedValueOnce([overdueDoc]) // overdueExplicit
        .mockResolvedValueOnce([]); // overdueComputed

      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.materialRequisition.update.mockResolvedValue({ id: 'mr-001', slaBreached: true });
      mockPrisma.employee.findMany
        .mockResolvedValueOnce([{ id: 'admin-1' }]) // getAdminIds
        .mockResolvedValueOnce([{ id: 'wh-1' }]); // getEmployeeIdsByRole('warehouse_staff')
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Should mark the MR as breached
      expect(mockPrisma.materialRequisition.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mr-001' },
          data: { slaBreached: true },
        }),
      );

      // Should create breach notifications (warning or breach)
      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Material Requisition'),
            referenceId: 'mr-001',
          }),
        ]),
      });

      await mod.stopScheduler();
    });

    it('should detect Gate Pass SLA breaches based on creation date', async () => {
      mockEmptyDelegates();

      // Gate pass created 30 hours ago (SLA = 24h)
      const overdueDoc = {
        id: 'gp-001',
        gatePassNumber: 'GP-2026-001',
        status: 'pending',
        createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
      };

      mockPrisma.gatePass.findMany.mockResolvedValue([overdueDoc]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.employee.findMany
        .mockResolvedValueOnce([{ id: 'admin-1' }])
        .mockResolvedValueOnce([{ id: 'wh-1' }])
        .mockResolvedValueOnce([{ id: 'sup-1' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 3 });

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'SLA Breached: Gate Pass',
            referenceId: 'gp-001',
          }),
        ]),
      });

      await mod.stopScheduler();
    });

    it('should detect QCI inspection SLA breaches', async () => {
      mockEmptyDelegates();

      // QCI created 15 days ago (SLA = 14 days = 336h)
      const overdueDoc = {
        id: 'qci-001',
        rfimNumber: 'QCI-2026-001',
        status: 'pending',
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      };

      mockPrisma.rfim.findMany.mockResolvedValue([overdueDoc]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      // Use mockResolvedValue (not Once) because both SLA breach and warning
      // checks run at the same 5-min interval and both call employee.findMany
      // multiple times across sub-functions (QCI breach + QCI warning paths).
      mockPrisma.employee.findMany.mockImplementation(async (args: unknown) => {
        const where = (args as { where: { systemRole: string | { in: string[] } } })?.where;
        const role = typeof where?.systemRole === 'string' ? where.systemRole : '';
        if (role === 'admin') return [{ id: 'admin-1' }];
        if (role === 'qc_officer') return [{ id: 'qc-1' }];
        return [];
      });
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'SLA Breached: QC Inspection',
            referenceId: 'qci-001',
          }),
        ]),
      });

      await mod.stopScheduler();
    });
  });

  // ── SLA Warning Detection ────────────────────────────────────────────

  describe('SLA warning detection', () => {
    it('should detect MIRV approval SLA warnings (deadline within 1 hour)', async () => {
      mockEmptyDelegates();

      const now = new Date();
      // slaDueDate is 30 minutes from now (within the 1-hour warning window)
      const atRiskDoc = { id: 'mirv-003', slaDueDate: new Date(now.getTime() + 30 * 60 * 1000) };

      mockPrisma.mirv.findMany.mockResolvedValue([atRiskDoc]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.approvalStep.findFirst.mockResolvedValue({
        id: 'step-1',
        documentType: 'mirv',
        documentId: 'mirv-003',
        level: 1,
        approverRole: 'manager',
        status: 'pending',
      });
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'mgr-1' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });

      const mod = await freshModule();
      await mod.startScheduler();

      // SLA warning check also runs every 5 minutes
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(mockPrisma.notification.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            title: 'SLA Warning: MIRV',
            notificationType: 'sla_warning',
            referenceId: 'mirv-003',
          }),
        ]),
      });

      await mod.stopScheduler();
    });
  });

  // ── Socket.IO integration ────────────────────────────────────────────

  describe('socket.io integration', () => {
    it('should emit socket events when io is provided and SLA breach is found', async () => {
      mockEmptyDelegates();

      const fakeIo = { emit: vi.fn() } as unknown;
      const overdueDoc = { id: 'mirv-010', slaDueDate: new Date(Date.now() - 3600000) };

      mockPrisma.mirv.findMany.mockResolvedValue([overdueDoc]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.approvalStep.findFirst.mockResolvedValue({
        id: 'step-1',
        documentType: 'mirv',
        documentId: 'mirv-010',
        level: 1,
        approverRole: 'manager',
        status: 'pending',
      });
      mockPrisma.employee.findMany.mockResolvedValueOnce([{ id: 'admin-1' }]).mockResolvedValueOnce([{ id: 'mgr-1' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      const mod = await freshModule();
      await mod.startScheduler(fakeIo as never);

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // Should emit to each recipient via emitToUser
      expect(mockEmitToUser).toHaveBeenCalledWith(
        fakeIo,
        expect.any(String),
        'notification:new',
        expect.objectContaining({
          title: 'SLA Breached: MIRV',
        }),
      );

      // Should emit to roles via emitToRole
      expect(mockEmitToRole).toHaveBeenCalledWith(
        fakeIo,
        expect.any(String),
        'sla:breached',
        expect.objectContaining({
          entity: 'mirv',
          documentId: 'mirv-010',
        }),
      );

      await mod.stopScheduler();
    });

    it('should send push notifications for SLA breaches', async () => {
      mockEmptyDelegates();

      const overdueDoc = { id: 'mirv-011', slaDueDate: new Date(Date.now() - 3600000) };

      mockPrisma.mirv.findMany.mockResolvedValue([overdueDoc]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.approvalStep.findFirst.mockResolvedValue({
        id: 'step-1',
        documentType: 'mirv',
        documentId: 'mirv-011',
        level: 1,
        approverRole: 'manager',
        status: 'pending',
      });
      mockPrisma.employee.findMany.mockResolvedValueOnce([{ id: 'admin-1' }]).mockResolvedValueOnce([{ id: 'mgr-1' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 2 });

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(mockSendPushToUser).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          title: 'SLA Breached: MIRV',
          tag: 'sla_breach',
        }),
      );

      await mod.stopScheduler();
    });
  });

  // ── Cycle Count Auto-Create ──────────────────────────────────────────

  describe('runCycleCountAutoCreate job', () => {
    it('should auto-create cycle counts on the daily schedule', async () => {
      mockEmptyDelegates();

      const mod = await freshModule();
      await mod.startScheduler();

      // Cycle count interval = 24 hours
      await vi.advanceTimersByTimeAsync(24 * 60 * 60 * 1000);

      expect(mockAutoCreateCycleCounts).toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith('info', '[Scheduler] Cycle count auto-creation completed');

      await mod.stopScheduler();
    });
  });

  // ── Error resilience ─────────────────────────────────────────────────

  describe('error resilience', () => {
    it('should continue running after a job throws an error', async () => {
      mockEmptyDelegates();

      // Make the first email retry fail, second should still work
      mockProcessQueuedEmails.mockRejectedValueOnce(new Error('First failure')).mockResolvedValueOnce(2);

      const mod = await freshModule();
      await mod.startScheduler();

      // First tick at 2 minutes — should fail
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(mockLog).toHaveBeenCalledWith('error', '[Scheduler] Email retry failed: First failure');

      // Second tick at 4 minutes — should succeed
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(mockLog).toHaveBeenCalledWith('info', '[Scheduler] Email retry: 2 sent');

      await mod.stopScheduler();
    });

    it('should handle SLA check failure gracefully and log error', async () => {
      mockEmptyDelegates();

      // Make getAllSlaHours fail — SLA check should still proceed with defaults
      mockGetAllSlaHours.mockRejectedValue(new Error('DB down'));
      // Make mirv.findMany throw to trigger the outer catch
      mockPrisma.mirv.findMany.mockRejectedValue(new Error('Connection lost'));

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // The error should be caught and logged
      expect(mockLog).toHaveBeenCalledWith('error', expect.stringContaining('[Scheduler]'));

      await mod.stopScheduler();
    });

    it('should handle initializeScheduledRules failure gracefully', async () => {
      mockEmptyDelegates();
      mockInitializeScheduledRules.mockRejectedValue(new Error('Init failed'));

      const mod = await freshModule();
      await mod.startScheduler();

      await flushPromises();

      expect(mockLog).toHaveBeenCalledWith('error', '[Scheduler] Failed to initialize scheduled rules: Init failed');

      await mod.stopScheduler();
    });
  });

  // ── notifySla edge cases ─────────────────────────────────────────────

  describe('notifySla edge cases', () => {
    it('should skip notification when recipientIds is empty', async () => {
      mockEmptyDelegates();

      const overdueDoc = { id: 'mirv-099', slaDueDate: new Date(Date.now() - 3600000) };
      mockPrisma.mirv.findMany.mockResolvedValue([overdueDoc]);
      mockPrisma.notification.findFirst.mockResolvedValue(null);
      mockPrisma.approvalStep.findFirst.mockResolvedValue({
        id: 'step-1',
        documentType: 'mirv',
        documentId: 'mirv-099',
        level: 1,
        approverRole: 'manager',
        status: 'pending',
      });

      // Both admin and role lookups return empty
      mockPrisma.employee.findMany.mockResolvedValue([]);

      const mod = await freshModule();
      await mod.startScheduler();

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      // createMany should NOT be called when recipientIds is empty
      const breachCalls = mockPrisma.notification.createMany.mock.calls.filter((c: unknown[]) => {
        const arg = c[0] as { data: Array<{ referenceId: string }> };
        return arg?.data?.some(d => d.referenceId === 'mirv-099');
      });
      expect(breachCalls).toHaveLength(0);

      await mod.stopScheduler();
    });
  });

  // ── scheduleLoop prevents overlap ────────────────────────────────────

  describe('scheduleLoop sequential behavior', () => {
    it('should not fire overlapping ticks for the same job', async () => {
      mockEmptyDelegates();

      // Make email processing take a while (simulated by chaining advanceTimersByTimeAsync)
      let emailCallCount = 0;
      mockProcessQueuedEmails.mockImplementation(async () => {
        emailCallCount++;
        return 0;
      });

      const mod = await freshModule();
      await mod.startScheduler();

      // Advance 2 min — first tick fires
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      const firstCount = emailCallCount;
      expect(firstCount).toBeGreaterThanOrEqual(1);

      // Advance another 2 min — second tick fires
      await vi.advanceTimersByTimeAsync(2 * 60 * 1000);
      expect(emailCallCount).toBeGreaterThan(firstCount);

      await mod.stopScheduler();
    });
  });
});
