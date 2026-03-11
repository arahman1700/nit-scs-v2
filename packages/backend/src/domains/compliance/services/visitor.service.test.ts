import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../notifications/services/notification.service.js', () => ({ createNotification: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { createNotification } from '../../notifications/services/notification.service.js';
import { list, getById, register, update, checkIn, checkOut, cancel } from './visitor.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedCreateNotification = createNotification as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function makeVisitorPass(overrides: Record<string, unknown> = {}) {
  return {
    id: 'vp-1',
    passNumber: 'VP-001',
    visitorName: 'Jane Smith',
    visitorCompany: 'Acme Corp',
    visitorIdNumber: 'ID-12345',
    visitorPhone: '+971501234567',
    visitorEmail: 'jane@acme.com',
    hostEmployeeId: 'host-1',
    warehouseId: 'wh-1',
    purpose: 'Site inspection',
    visitDate: new Date('2026-03-10'),
    expectedDuration: 120,
    vehicleNumber: null,
    vehicleType: null,
    badgeNumber: null,
    status: 'scheduled',
    checkInTime: null,
    checkOutTime: null,
    registeredById: 'user-1',
    notes: null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('visitor.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────

  describe('list', () => {
    const baseParams = { page: 1, pageSize: 25 };

    it('should return data and total', async () => {
      const rows = [makeVisitorPass()];
      mockPrisma.visitorPass.findMany.mockResolvedValue(rows);
      mockPrisma.visitorPass.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause', async () => {
      mockPrisma.visitorPass.findMany.mockResolvedValue([]);
      mockPrisma.visitorPass.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'Jane' });

      const where = mockPrisma.visitorPass.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(4);
    });

    it('should apply status filter', async () => {
      mockPrisma.visitorPass.findMany.mockResolvedValue([]);
      mockPrisma.visitorPass.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'checked_in' });

      const where = mockPrisma.visitorPass.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('checked_in');
    });

    it('should apply warehouseId and hostEmployeeId filters', async () => {
      mockPrisma.visitorPass.findMany.mockResolvedValue([]);
      mockPrisma.visitorPass.count.mockResolvedValue(0);

      await list({ ...baseParams, warehouseId: 'wh-1', hostEmployeeId: 'host-1' });

      const where = mockPrisma.visitorPass.findMany.mock.calls[0][0].where;
      expect(where.warehouseId).toBe('wh-1');
      expect(where.hostEmployeeId).toBe('host-1');
    });

    it('should apply date range filters', async () => {
      mockPrisma.visitorPass.findMany.mockResolvedValue([]);
      mockPrisma.visitorPass.count.mockResolvedValue(0);

      await list({ ...baseParams, dateFrom: '2026-01-01', dateTo: '2026-03-31' });

      const where = mockPrisma.visitorPass.findMany.mock.calls[0][0].where;
      expect(where.visitDate).toBeDefined();
      expect(where.visitDate.gte).toEqual(new Date('2026-01-01'));
      expect(where.visitDate.lte).toEqual(new Date('2026-03-31'));
    });

    it('should apply only dateFrom when dateTo is not provided', async () => {
      mockPrisma.visitorPass.findMany.mockResolvedValue([]);
      mockPrisma.visitorPass.count.mockResolvedValue(0);

      await list({ ...baseParams, dateFrom: '2026-01-01' });

      const where = mockPrisma.visitorPass.findMany.mock.calls[0][0].where;
      expect(where.visitDate.gte).toEqual(new Date('2026-01-01'));
      expect(where.visitDate.lte).toBeUndefined();
    });

    it('should calculate skip from page and pageSize', async () => {
      mockPrisma.visitorPass.findMany.mockResolvedValue([]);
      mockPrisma.visitorPass.count.mockResolvedValue(0);

      await list({ page: 3, pageSize: 10 });

      const args = mockPrisma.visitorPass.findMany.mock.calls[0][0];
      expect(args.skip).toBe(20); // (3-1) * 10
      expect(args.take).toBe(10);
    });

    it('should use default sortBy=createdAt and sortDir=desc', async () => {
      mockPrisma.visitorPass.findMany.mockResolvedValue([]);
      mockPrisma.visitorPass.count.mockResolvedValue(0);

      await list(baseParams);

      const args = mockPrisma.visitorPass.findMany.mock.calls[0][0];
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return visitor pass when found', async () => {
      const pass = makeVisitorPass();
      mockPrisma.visitorPass.findUnique.mockResolvedValue(pass);

      const result = await getById('vp-1');

      expect(result).toEqual(pass);
      expect(mockPrisma.visitorPass.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'vp-1' } }),
      );
    });

    it('should throw NotFoundError when visitor pass not found', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // register
  // ─────────────────────────────────────────────────────────────────────

  describe('register', () => {
    const data = {
      visitorName: 'Jane Smith',
      visitorIdNumber: 'ID-12345',
      hostEmployeeId: 'host-1',
      warehouseId: 'wh-1',
      purpose: 'Site inspection',
      visitDate: '2026-03-10',
      expectedDuration: 120,
    };

    it('should create visitor pass with generated pass number', async () => {
      mockedGenDoc.mockResolvedValue('VP-001');
      mockedCreateNotification.mockResolvedValue(undefined);
      const created = makeVisitorPass();
      mockPrisma.visitorPass.create.mockResolvedValue(created);

      const result = await register(data, 'user-1');

      expect(result).toEqual(created);
      expect(mockedGenDoc).toHaveBeenCalledWith('visitor_pass');
    });

    it('should set status to scheduled', async () => {
      mockedGenDoc.mockResolvedValue('VP-002');
      mockedCreateNotification.mockResolvedValue(undefined);
      mockPrisma.visitorPass.create.mockResolvedValue(makeVisitorPass());

      await register(data, 'user-1');

      const createArgs = mockPrisma.visitorPass.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('scheduled');
      expect(createArgs.data.registeredById).toBe('user-1');
    });

    it('should send notification to host employee', async () => {
      mockedGenDoc.mockResolvedValue('VP-003');
      mockedCreateNotification.mockResolvedValue(undefined);
      mockPrisma.visitorPass.create.mockResolvedValue(makeVisitorPass());

      await register(data, 'user-1');

      expect(mockedCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'host-1',
          title: 'Visitor Scheduled',
          notificationType: 'visitor_scheduled',
        }),
      );
    });

    it('should include visitor company in notification when provided', async () => {
      mockedGenDoc.mockResolvedValue('VP-004');
      mockedCreateNotification.mockResolvedValue(undefined);
      mockPrisma.visitorPass.create.mockResolvedValue(makeVisitorPass());

      await register({ ...data, visitorCompany: 'Acme Corp' }, 'user-1');

      const notifyArgs = mockedCreateNotification.mock.calls[0][0];
      expect(notifyArgs.body).toContain('Acme Corp');
    });

    it('should set optional fields to null when not provided', async () => {
      mockedGenDoc.mockResolvedValue('VP-005');
      mockedCreateNotification.mockResolvedValue(undefined);
      mockPrisma.visitorPass.create.mockResolvedValue(makeVisitorPass());

      await register(data, 'user-1');

      const createArgs = mockPrisma.visitorPass.create.mock.calls[0][0];
      expect(createArgs.data.visitorCompany).toBeNull();
      expect(createArgs.data.visitorPhone).toBeNull();
      expect(createArgs.data.visitorEmail).toBeNull();
      expect(createArgs.data.vehicleNumber).toBeNull();
      expect(createArgs.data.vehicleType).toBeNull();
      expect(createArgs.data.badgeNumber).toBeNull();
      expect(createArgs.data.notes).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update a scheduled visitor pass', async () => {
      const existing = makeVisitorPass({ status: 'scheduled' });
      const updated = makeVisitorPass({ purpose: 'Updated purpose' });
      mockPrisma.visitorPass.findUnique.mockResolvedValue(existing);
      mockPrisma.visitorPass.update.mockResolvedValue(updated);

      const result = await update('vp-1', { purpose: 'Updated purpose' } as any);

      expect(result).toEqual(updated);
    });

    it('should throw NotFoundError when visitor pass not found', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {} as any)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when pass is not in scheduled status', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'checked_in' }));

      await expect(update('vp-1', {} as any)).rejects.toThrow(
        'Only visitor passes in "scheduled" status can be updated',
      );
    });

    it('should convert visitDate string to Date when provided', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'scheduled' }));
      mockPrisma.visitorPass.update.mockResolvedValue(makeVisitorPass());

      await update('vp-1', { visitDate: '2026-04-01' } as any);

      const updateArgs = mockPrisma.visitorPass.update.mock.calls[0][0];
      expect(updateArgs.data.visitDate).toEqual(new Date('2026-04-01'));
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // checkIn
  // ─────────────────────────────────────────────────────────────────────

  describe('checkIn', () => {
    it('should check in a scheduled visitor', async () => {
      const pass = makeVisitorPass({ status: 'scheduled' });
      const checkedIn = makeVisitorPass({ status: 'checked_in', checkInTime: new Date() });
      mockPrisma.visitorPass.findUnique.mockResolvedValue(pass);
      mockPrisma.visitorPass.update.mockResolvedValue(checkedIn);
      mockedCreateNotification.mockResolvedValue(undefined);

      const result = await checkIn('vp-1');

      expect(result).toEqual(checkedIn);
    });

    it('should set checkInTime to current date', async () => {
      const pass = makeVisitorPass({ status: 'scheduled' });
      mockPrisma.visitorPass.findUnique.mockResolvedValue(pass);
      mockPrisma.visitorPass.update.mockResolvedValue(makeVisitorPass({ status: 'checked_in' }));
      mockedCreateNotification.mockResolvedValue(undefined);

      await checkIn('vp-1');

      const updateArgs = mockPrisma.visitorPass.update.mock.calls[0][0];
      expect(updateArgs.data.status).toBe('checked_in');
      expect(updateArgs.data.checkInTime).toBeInstanceOf(Date);
    });

    it('should set badge number when provided in check-in data', async () => {
      const pass = makeVisitorPass({ status: 'scheduled' });
      mockPrisma.visitorPass.findUnique.mockResolvedValue(pass);
      mockPrisma.visitorPass.update.mockResolvedValue(makeVisitorPass({ status: 'checked_in' }));
      mockedCreateNotification.mockResolvedValue(undefined);

      await checkIn('vp-1', { badgeNumber: 'B-42' });

      const updateArgs = mockPrisma.visitorPass.update.mock.calls[0][0];
      expect(updateArgs.data.badgeNumber).toBe('B-42');
    });

    it('should not set badge number when check-in data is undefined', async () => {
      const pass = makeVisitorPass({ status: 'scheduled' });
      mockPrisma.visitorPass.findUnique.mockResolvedValue(pass);
      mockPrisma.visitorPass.update.mockResolvedValue(makeVisitorPass({ status: 'checked_in' }));
      mockedCreateNotification.mockResolvedValue(undefined);

      await checkIn('vp-1');

      const updateArgs = mockPrisma.visitorPass.update.mock.calls[0][0];
      expect(updateArgs.data.badgeNumber).toBeUndefined();
    });

    it('should throw NotFoundError when visitor pass not found', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(null);

      await expect(checkIn('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when status is not scheduled', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'checked_out' }));

      await expect(checkIn('vp-1')).rejects.toThrow(/Cannot check in a visitor with status "checked_out"/);
    });

    it('should throw BusinessRuleError when already checked in', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'checked_in' }));

      await expect(checkIn('vp-1')).rejects.toThrow(/Cannot check in a visitor with status "checked_in"/);
    });

    it('should send arrival notification to host employee', async () => {
      const pass = makeVisitorPass({ status: 'scheduled', visitorName: 'Bob', passNumber: 'VP-010' });
      mockPrisma.visitorPass.findUnique.mockResolvedValue(pass);
      mockPrisma.visitorPass.update.mockResolvedValue(makeVisitorPass({ status: 'checked_in' }));
      mockedCreateNotification.mockResolvedValue(undefined);

      await checkIn('vp-1');

      expect(mockedCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'host-1',
          title: 'Visitor Arrived',
          notificationType: 'visitor_checked_in',
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // checkOut
  // ─────────────────────────────────────────────────────────────────────

  describe('checkOut', () => {
    it('should check out a checked_in visitor', async () => {
      const pass = makeVisitorPass({ status: 'checked_in' });
      const checkedOut = makeVisitorPass({ status: 'checked_out', checkOutTime: new Date() });
      mockPrisma.visitorPass.findUnique.mockResolvedValue(pass);
      mockPrisma.visitorPass.update.mockResolvedValue(checkedOut);

      const result = await checkOut('vp-1');

      expect(result).toEqual(checkedOut);
    });

    it('should check out an overstay visitor', async () => {
      const pass = makeVisitorPass({ status: 'overstay' });
      const checkedOut = makeVisitorPass({ status: 'checked_out', checkOutTime: new Date() });
      mockPrisma.visitorPass.findUnique.mockResolvedValue(pass);
      mockPrisma.visitorPass.update.mockResolvedValue(checkedOut);

      const result = await checkOut('vp-1');

      expect(result).toEqual(checkedOut);
    });

    it('should set checkOutTime to current date', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'checked_in' }));
      mockPrisma.visitorPass.update.mockResolvedValue(makeVisitorPass({ status: 'checked_out' }));

      await checkOut('vp-1');

      const updateArgs = mockPrisma.visitorPass.update.mock.calls[0][0];
      expect(updateArgs.data.status).toBe('checked_out');
      expect(updateArgs.data.checkOutTime).toBeInstanceOf(Date);
    });

    it('should throw NotFoundError when visitor pass not found', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(null);

      await expect(checkOut('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when status is scheduled', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'scheduled' }));

      await expect(checkOut('vp-1')).rejects.toThrow(/Cannot check out a visitor with status "scheduled"/);
    });

    it('should throw BusinessRuleError when status is cancelled', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'cancelled' }));

      await expect(checkOut('vp-1')).rejects.toThrow(/Cannot check out a visitor with status "cancelled"/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // cancel
  // ─────────────────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should cancel a scheduled visitor pass', async () => {
      const pass = makeVisitorPass({ status: 'scheduled' });
      const cancelled = makeVisitorPass({ status: 'cancelled' });
      mockPrisma.visitorPass.findUnique.mockResolvedValue(pass);
      mockPrisma.visitorPass.update.mockResolvedValue(cancelled);

      const result = await cancel('vp-1');

      expect(result).toEqual(cancelled);
    });

    it('should set status to cancelled', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'scheduled' }));
      mockPrisma.visitorPass.update.mockResolvedValue(makeVisitorPass({ status: 'cancelled' }));

      await cancel('vp-1');

      const updateArgs = mockPrisma.visitorPass.update.mock.calls[0][0];
      expect(updateArgs.data.status).toBe('cancelled');
    });

    it('should throw NotFoundError when visitor pass not found', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(null);

      await expect(cancel('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when status is checked_in', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'checked_in' }));

      await expect(cancel('vp-1')).rejects.toThrow(/Cannot cancel a visitor pass with status "checked_in"/);
    });

    it('should throw BusinessRuleError when status is checked_out', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'checked_out' }));

      await expect(cancel('vp-1')).rejects.toThrow(/Cannot cancel a visitor pass with status "checked_out"/);
    });

    it('should throw BusinessRuleError when status is overstay', async () => {
      mockPrisma.visitorPass.findUnique.mockResolvedValue(makeVisitorPass({ status: 'overstay' }));

      await expect(cancel('vp-1')).rejects.toThrow(/Cannot cancel a visitor pass with status "overstay"/);
    });
  });
});
