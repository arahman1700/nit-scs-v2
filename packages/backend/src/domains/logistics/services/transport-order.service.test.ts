import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn(), subscribe: vi.fn() } }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});
vi.mock('../../../utils/safe-status-transition.js', () => ({
  safeStatusUpdate: vi.fn().mockResolvedValue({ count: 1 }),
}));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { eventBus } from '../../../events/event-bus.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';
import { safeStatusUpdate } from '../../../utils/safe-status-transition.js';
import { list, getById, create, update, schedule, dispatch, deliver, cancel } from './transport-order.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedEventBus = eventBus as { publish: ReturnType<typeof vi.fn> };
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;
const mockedSafeStatusUpdate = safeStatusUpdate as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const TO_ID = 'to-1';

function makeTransportOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: TO_ID,
    orderNumber: 'TO-2025-0001',
    status: 'draft',
    originWarehouseId: 'wh-1',
    destinationWarehouseId: 'wh-2',
    destinationAddress: null,
    projectId: 'proj-1',
    jobOrderId: null,
    loadDescription: 'Steel beams shipment',
    vehicleType: 'truck',
    vehicleNumber: 'ABC-123',
    driverName: 'John Doe',
    driverPhone: '+966-555-0001',
    driverIdNumber: null,
    scheduledDate: new Date('2025-06-01'),
    estimatedWeight: 5000,
    gatePassId: null,
    requestedById: USER_ID,
    notes: null,
    actualPickupDate: null,
    actualDeliveryDate: null,
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('transport-order.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── list ──────────────────────────────────────────────────────────

  describe('list', () => {
    const baseParams = { skip: 0, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' as const };

    it('returns data and total', async () => {
      const rows = [makeTransportOrder()];
      mockPrisma.transportOrder.findMany.mockResolvedValue(rows);
      mockPrisma.transportOrder.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('applies search filter to orderNumber, loadDescription, driverName, vehicleNumber', async () => {
      mockPrisma.transportOrder.findMany.mockResolvedValue([]);
      mockPrisma.transportOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'steel' });

      const call = mockPrisma.transportOrder.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(4);
      expect(call.where.OR).toEqual([
        { orderNumber: { contains: 'steel', mode: 'insensitive' } },
        { loadDescription: { contains: 'steel', mode: 'insensitive' } },
        { driverName: { contains: 'steel', mode: 'insensitive' } },
        { vehicleNumber: { contains: 'steel', mode: 'insensitive' } },
      ]);
    });

    it('applies status filter', async () => {
      mockPrisma.transportOrder.findMany.mockResolvedValue([]);
      mockPrisma.transportOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'scheduled' });

      const call = mockPrisma.transportOrder.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('scheduled');
    });

    it('applies originWarehouseId filter', async () => {
      mockPrisma.transportOrder.findMany.mockResolvedValue([]);
      mockPrisma.transportOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, originWarehouseId: 'wh-5' });

      const call = mockPrisma.transportOrder.findMany.mock.calls[0][0];
      expect(call.where.originWarehouseId).toBe('wh-5');
    });

    it('applies warehouseId as originWarehouseId filter', async () => {
      mockPrisma.transportOrder.findMany.mockResolvedValue([]);
      mockPrisma.transportOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, warehouseId: 'wh-3' });

      const call = mockPrisma.transportOrder.findMany.mock.calls[0][0];
      expect(call.where.originWarehouseId).toBe('wh-3');
    });

    it('applies projectId filter', async () => {
      mockPrisma.transportOrder.findMany.mockResolvedValue([]);
      mockPrisma.transportOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, projectId: 'proj-1' });

      const call = mockPrisma.transportOrder.findMany.mock.calls[0][0];
      expect(call.where.projectId).toBe('proj-1');
    });

    it('applies requestedById filter', async () => {
      mockPrisma.transportOrder.findMany.mockResolvedValue([]);
      mockPrisma.transportOrder.count.mockResolvedValue(0);

      await list({ ...baseParams, requestedById: USER_ID });

      const call = mockPrisma.transportOrder.findMany.mock.calls[0][0];
      expect(call.where.requestedById).toBe(USER_ID);
    });

    it('applies pagination and sorting', async () => {
      mockPrisma.transportOrder.findMany.mockResolvedValue([]);
      mockPrisma.transportOrder.count.mockResolvedValue(0);

      await list({ skip: 20, pageSize: 5, sortBy: 'orderNumber', sortDir: 'asc' });

      const call = mockPrisma.transportOrder.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(5);
      expect(call.orderBy).toEqual({ orderNumber: 'asc' });
    });
  });

  // ─── getById ──────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns the transport order with detail includes', async () => {
      const to = makeTransportOrder();
      mockPrisma.transportOrder.findUnique.mockResolvedValue(to);

      const result = await getById(TO_ID);

      expect(result).toEqual(to);
    });

    it('throws NotFoundError when not found', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── create ──────────────────────────────────────────────────────

  describe('create', () => {
    const createInput = {
      originWarehouseId: 'wh-1',
      loadDescription: 'Steel beams',
      scheduledDate: '2025-06-01',
      items: [{ description: 'Steel beams', quantity: 100, itemId: 'item-1', uomId: 'uom-1', weight: 5000 }],
    };

    it('generates a document number and creates with draft status', async () => {
      mockedGenDoc.mockResolvedValue('TO-2025-0001');
      const created = makeTransportOrder();
      mockPrisma.transportOrder.create.mockResolvedValue(created);

      const result = await create(createInput, USER_ID);

      expect(result).toEqual(created);
      expect(mockedGenDoc).toHaveBeenCalledWith('transport');
    });

    it('creates transport order items as nested create', async () => {
      mockedGenDoc.mockResolvedValue('TO-2025-0002');
      mockPrisma.transportOrder.create.mockResolvedValue(makeTransportOrder());

      await create(createInput, USER_ID);

      const call = mockPrisma.transportOrder.create.mock.calls[0][0];
      expect(call.data.transportOrderItems.create).toHaveLength(1);
      expect(call.data.transportOrderItems.create[0]).toEqual(
        expect.objectContaining({
          description: 'Steel beams',
          quantity: 100,
          itemId: 'item-1',
          uomId: 'uom-1',
          weight: 5000,
        }),
      );
    });

    it('sets status to draft', async () => {
      mockedGenDoc.mockResolvedValue('TO-2025-0003');
      mockPrisma.transportOrder.create.mockResolvedValue(makeTransportOrder());

      await create(createInput, USER_ID);

      const call = mockPrisma.transportOrder.create.mock.calls[0][0];
      expect(call.data.status).toBe('draft');
    });

    it('sets requestedById to the current user', async () => {
      mockedGenDoc.mockResolvedValue('TO-2025-0004');
      mockPrisma.transportOrder.create.mockResolvedValue(makeTransportOrder());

      await create(createInput, USER_ID);

      const call = mockPrisma.transportOrder.create.mock.calls[0][0];
      expect(call.data.requestedById).toBe(USER_ID);
    });

    it('converts scheduledDate string to Date', async () => {
      mockedGenDoc.mockResolvedValue('TO-2025-0005');
      mockPrisma.transportOrder.create.mockResolvedValue(makeTransportOrder());

      await create(createInput, USER_ID);

      const call = mockPrisma.transportOrder.create.mock.calls[0][0];
      expect(call.data.scheduledDate).toEqual(new Date('2025-06-01'));
    });

    it('sets optional fields to null when not provided', async () => {
      mockedGenDoc.mockResolvedValue('TO-2025-0006');
      mockPrisma.transportOrder.create.mockResolvedValue(makeTransportOrder());

      await create(
        { originWarehouseId: 'wh-1', loadDescription: 'Load', scheduledDate: '2025-06-01', items: [] },
        USER_ID,
      );

      const call = mockPrisma.transportOrder.create.mock.calls[0][0];
      expect(call.data.jobOrderId).toBeNull();
      expect(call.data.destinationWarehouseId).toBeNull();
      expect(call.data.vehicleType).toBeNull();
      expect(call.data.driverName).toBeNull();
      expect(call.data.notes).toBeNull();
    });
  });

  // ─── update ──────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a draft transport order', async () => {
      const existing = makeTransportOrder({ status: 'draft' });
      const updated = { ...existing, notes: 'Updated' };
      mockPrisma.transportOrder.findUnique.mockResolvedValue(existing);
      mockPrisma.transportOrder.update.mockResolvedValue(updated);

      const result = await update(TO_ID, { notes: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('throws NotFoundError when not found', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', { notes: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is not draft', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(makeTransportOrder({ status: 'scheduled' }));

      await expect(update(TO_ID, { notes: 'x' })).rejects.toThrow(BusinessRuleError);
    });

    it('converts scheduledDate string to Date', async () => {
      const existing = makeTransportOrder({ status: 'draft' });
      mockPrisma.transportOrder.findUnique.mockResolvedValue(existing);
      mockPrisma.transportOrder.update.mockResolvedValue(existing);

      await update(TO_ID, { scheduledDate: '2025-07-15' });

      const call = mockPrisma.transportOrder.update.mock.calls[0][0];
      expect(call.data.scheduledDate).toEqual(new Date('2025-07-15'));
    });
  });

  // ─── schedule ─────────────────────────────────────────────────────

  describe('schedule', () => {
    it('schedules a transport order and publishes event', async () => {
      const existing = makeTransportOrder({ status: 'draft' });
      const updated = makeTransportOrder({ status: 'scheduled' });
      mockPrisma.transportOrder.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);

      const result = await schedule(TO_ID);

      expect(result).toEqual(updated);
      expect(mockedAssertTransition).toHaveBeenCalledWith('transport_order', 'draft', 'scheduled');
      expect(mockedSafeStatusUpdate).toHaveBeenCalled();
      expect(mockedEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          payload: expect.objectContaining({ from: 'draft', to: 'scheduled' }),
        }),
      );
    });

    it('throws NotFoundError when not found', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(null);

      await expect(schedule('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('delegates transition validation to assertTransition', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(makeTransportOrder({ status: 'in_transit' }));
      mockedAssertTransition.mockImplementationOnce(() => {
        throw new Error('Invalid status transition');
      });

      await expect(schedule(TO_ID)).rejects.toThrow('Invalid status transition');
    });
  });

  // ─── dispatch ─────────────────────────────────────────────────────

  describe('dispatch', () => {
    it('dispatches a scheduled transport order', async () => {
      const existing = makeTransportOrder({ status: 'scheduled' });
      const updated = makeTransportOrder({ status: 'in_transit' });
      mockPrisma.transportOrder.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);

      const result = await dispatch(TO_ID);

      expect(result).toEqual(updated);
      expect(mockedAssertTransition).toHaveBeenCalledWith('transport_order', 'scheduled', 'in_transit');
    });

    it('throws NotFoundError when not found', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(null);

      await expect(dispatch('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('sets actualPickupDate on dispatch', async () => {
      mockPrisma.transportOrder.findUnique
        .mockResolvedValueOnce(makeTransportOrder({ status: 'scheduled' }))
        .mockResolvedValueOnce(makeTransportOrder({ status: 'in_transit' }));

      await dispatch(TO_ID);

      expect(mockedSafeStatusUpdate).toHaveBeenCalledWith(
        mockPrisma.transportOrder,
        TO_ID,
        'scheduled',
        expect.objectContaining({
          status: 'in_transit',
          actualPickupDate: expect.any(Date),
        }),
      );
    });

    it('publishes document:status_changed event', async () => {
      mockPrisma.transportOrder.findUnique
        .mockResolvedValueOnce(makeTransportOrder({ status: 'scheduled' }))
        .mockResolvedValueOnce(makeTransportOrder({ status: 'in_transit' }));

      await dispatch(TO_ID);

      expect(mockedEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          entityType: 'transport_order',
          payload: expect.objectContaining({ from: 'scheduled', to: 'in_transit' }),
        }),
      );
    });
  });

  // ─── deliver ──────────────────────────────────────────────────────

  describe('deliver', () => {
    it('delivers an in_transit transport order', async () => {
      const existing = makeTransportOrder({ status: 'in_transit' });
      const updated = makeTransportOrder({ status: 'delivered' });
      mockPrisma.transportOrder.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);

      const result = await deliver(TO_ID);

      expect(result).toEqual(updated);
      expect(mockedAssertTransition).toHaveBeenCalledWith('transport_order', 'in_transit', 'delivered');
    });

    it('throws NotFoundError when not found', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(null);

      await expect(deliver('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('sets actualDeliveryDate on deliver', async () => {
      mockPrisma.transportOrder.findUnique
        .mockResolvedValueOnce(makeTransportOrder({ status: 'in_transit' }))
        .mockResolvedValueOnce(makeTransportOrder({ status: 'delivered' }));

      await deliver(TO_ID);

      expect(mockedSafeStatusUpdate).toHaveBeenCalledWith(
        mockPrisma.transportOrder,
        TO_ID,
        'in_transit',
        expect.objectContaining({
          status: 'delivered',
          actualDeliveryDate: expect.any(Date),
        }),
      );
    });
  });

  // ─── cancel ───────────────────────────────────────────────────────

  describe('cancel', () => {
    it('cancels a draft transport order', async () => {
      const existing = makeTransportOrder({ status: 'draft' });
      const updated = makeTransportOrder({ status: 'cancelled' });
      mockPrisma.transportOrder.findUnique.mockResolvedValue(existing);
      mockPrisma.transportOrder.update.mockResolvedValue(updated);

      const result = await cancel(TO_ID);

      expect(result).toEqual(updated);
    });

    it('cancels a scheduled transport order', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(makeTransportOrder({ status: 'scheduled' }));
      mockPrisma.transportOrder.update.mockResolvedValue(makeTransportOrder({ status: 'cancelled' }));

      const result = await cancel(TO_ID);

      expect(result.status).toBe('cancelled');
    });

    it('throws NotFoundError when not found', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(null);

      await expect(cancel('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when cancelling from in_transit', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(makeTransportOrder({ status: 'in_transit' }));

      await expect(cancel(TO_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('throws BusinessRuleError when cancelling from delivered', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(makeTransportOrder({ status: 'delivered' }));

      await expect(cancel(TO_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('throws BusinessRuleError when already cancelled', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(makeTransportOrder({ status: 'cancelled' }));

      await expect(cancel(TO_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('publishes document:status_changed event on cancel', async () => {
      mockPrisma.transportOrder.findUnique.mockResolvedValue(makeTransportOrder({ status: 'draft' }));
      mockPrisma.transportOrder.update.mockResolvedValue(makeTransportOrder({ status: 'cancelled' }));

      await cancel(TO_ID);

      expect(mockedEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          entityType: 'transport_order',
          payload: expect.objectContaining({ from: 'draft', to: 'cancelled' }),
        }),
      );
    });
  });
});
