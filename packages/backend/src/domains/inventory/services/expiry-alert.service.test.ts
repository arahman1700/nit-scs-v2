import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma, mockCreateNotification, mockEventBus, mockLog } = vi.hoisted(() => {
  return {
    mockPrisma: {} as PrismaMock,
    mockCreateNotification: vi.fn().mockResolvedValue({}),
    mockEventBus: { publish: vi.fn() },
    mockLog: vi.fn(),
  };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/notification.service.js', () => ({
  createNotification: mockCreateNotification,
}));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: mockEventBus }));
vi.mock('../../../config/logger.js', () => ({ log: mockLog }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { checkExpiringLots, autoQuarantineExpired } from './expiry-alert.service.js';

describe('expiry-alert.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    mockCreateNotification.mockClear();
    mockEventBus.publish.mockClear();
    mockLog.mockClear();
  });

  // ---------------------------------------------------------------------------
  // checkExpiringLots
  // ---------------------------------------------------------------------------
  describe('checkExpiringLots', () => {
    it('should skip when no recipients found', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await checkExpiringLots();

      expect(mockPrisma.inventoryLot.findMany).not.toHaveBeenCalled();
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it('should check all three thresholds (30, 60, 90 days)', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
      mockPrisma.inventoryLot.findMany.mockResolvedValue([]); // no lots at any threshold

      await checkExpiringLots();

      // findMany called 3 times (once per threshold)
      expect(mockPrisma.inventoryLot.findMany).toHaveBeenCalledTimes(3);
    });

    it('should create notifications for each recipient per threshold', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }, { id: 'emp-2' }]);

      // Only the 30-day threshold has results
      mockPrisma.inventoryLot.findMany
        .mockResolvedValueOnce([{ id: 'lot-1' }, { id: 'lot-2' }]) // 30 days
        .mockResolvedValueOnce([]) // 60 days
        .mockResolvedValueOnce([]); // 90 days

      await checkExpiringLots();

      // 2 lots for 30-day threshold × 2 recipients = 2 calls
      expect(mockCreateNotification).toHaveBeenCalledTimes(2);
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'emp-1',
          notificationType: 'expiry_alert',
          referenceTable: 'inventory_lots',
        }),
      );
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'emp-2',
        }),
      );
    });

    it('should include lot count in notification title', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
      mockPrisma.inventoryLot.findMany
        .mockResolvedValueOnce([{ id: 'lot-1' }, { id: 'lot-2' }, { id: 'lot-3' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await checkExpiringLots();

      const call = mockCreateNotification.mock.calls[0][0];
      expect(call.title).toContain('3 items');
      expect(call.title).toContain('30 days');
    });

    it('should use singular "item" for single lot', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
      mockPrisma.inventoryLot.findMany
        .mockResolvedValueOnce([{ id: 'lot-1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await checkExpiringLots();

      const call = mockCreateNotification.mock.calls[0][0];
      expect(call.title).toContain('1 item ');
    });

    it('should skip thresholds with no expiring lots', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
      mockPrisma.inventoryLot.findMany
        .mockResolvedValueOnce([]) // 30 days: none
        .mockResolvedValueOnce([{ id: 'lot-1' }]) // 60 days: 1
        .mockResolvedValueOnce([]); // 90 days: none

      await checkExpiringLots();

      // Only 1 notification for the 60-day threshold
      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      const call = mockCreateNotification.mock.calls[0][0];
      expect(call.title).toContain('60 days');
    });

    it('should query active lots with expiryDate between now and cutoff', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);
      mockPrisma.inventoryLot.findMany.mockResolvedValue([]);

      await checkExpiringLots();

      const callArgs = mockPrisma.inventoryLot.findMany.mock.calls[0][0];
      expect(callArgs.where.status).toBe('active');
      expect(callArgs.where.expiryDate).toEqual({
        gte: expect.any(Date),
        lte: expect.any(Date),
      });
    });

    it('should handle errors without throwing', async () => {
      mockPrisma.employee.findMany.mockRejectedValue(new Error('DB failure'));

      await expect(checkExpiringLots()).resolves.toBeUndefined();
      expect(mockLog).toHaveBeenCalledWith('error', expect.stringContaining('checkExpiringLots failed'));
    });
  });

  // ---------------------------------------------------------------------------
  // autoQuarantineExpired
  // ---------------------------------------------------------------------------
  describe('autoQuarantineExpired', () => {
    it('should skip when no expired lots found', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([]);

      await autoQuarantineExpired();

      expect(mockPrisma.inventoryLot.updateMany).not.toHaveBeenCalled();
      expect(mockCreateNotification).not.toHaveBeenCalled();
      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it('should bulk-update expired lots to "expired" status', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([{ id: 'lot-1' }, { id: 'lot-2' }]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await autoQuarantineExpired();

      expect(mockPrisma.inventoryLot.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['lot-1', 'lot-2'] } },
        data: { status: 'expired' },
      });
    });

    it('should notify recipients about auto-quarantined lots', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([{ id: 'lot-1' }]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }, { id: 'emp-2' }]);

      await autoQuarantineExpired();

      expect(mockCreateNotification).toHaveBeenCalledTimes(2);
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'emp-1',
          notificationType: 'expiry_alert',
          referenceTable: 'inventory_lots',
        }),
      );
    });

    it('should publish event bus event for expired lots', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([{ id: 'lot-1' }, { id: 'lot-2' }]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await autoQuarantineExpired();

      expect(mockEventBus.publish).toHaveBeenCalledWith({
        type: 'inventory:lots_expired',
        entityType: 'inventory_lot',
        entityId: 'lot-1', // first lot ID as primary reference
        action: 'auto_quarantine',
        payload: {
          lotIds: ['lot-1', 'lot-2'],
          count: 2,
        },
        timestamp: expect.any(String),
      });
    });

    it('should use singular "lot" in notification for single lot', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([{ id: 'lot-1' }]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);

      await autoQuarantineExpired();

      const call = mockCreateNotification.mock.calls[0][0];
      expect(call.title).toContain('1 lot ');
    });

    it('should use plural "lots" for multiple lots', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([{ id: 'lot-1' }, { id: 'lot-2' }]);
      mockPrisma.inventoryLot.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'emp-1' }]);

      await autoQuarantineExpired();

      const call = mockCreateNotification.mock.calls[0][0];
      expect(call.title).toContain('2 lots ');
    });

    it('should query active lots with expiryDate before today', async () => {
      mockPrisma.inventoryLot.findMany.mockResolvedValue([]);

      await autoQuarantineExpired();

      expect(mockPrisma.inventoryLot.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          expiryDate: { lt: expect.any(Date) },
        },
        select: { id: true },
      });
    });

    it('should handle errors without throwing', async () => {
      mockPrisma.inventoryLot.findMany.mockRejectedValue(new Error('connection lost'));

      await expect(autoQuarantineExpired()).resolves.toBeUndefined();
      expect(mockLog).toHaveBeenCalledWith('error', expect.stringContaining('autoQuarantineExpired failed'));
    });
  });
});
