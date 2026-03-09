import type { PrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../system/services/notification.service.js', () => ({ createNotification: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});
vi.mock('../../../utils/safe-status-transition.js', () => ({
  safeStatusUpdate: vi.fn().mockResolvedValue(1),
  safeStatusUpdateTx: vi.fn().mockResolvedValue(1),
}));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import {
  list,
  getById,
  create,
  update,
  complete,
  cancel,
  checkDueMaintenances,
} from './vehicle-maintenance.service.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { createNotification } from '../../system/services/notification.service.js';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../../../events/event-bus.js';

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const VM_ID = 'vm-1';

function makeVehicleMaintenance(overrides: Record<string, unknown> = {}) {
  return {
    id: VM_ID,
    vehicleId: 'veh-1',
    maintenanceNumber: 'VM-001',
    maintenanceType: 'preventive',
    scheduledDate: new Date('2026-03-15'),
    description: 'Oil change and filter replacement',
    currentHoursAtService: 1200,
    currentMileageAtService: 50000,
    vendorName: null,
    performedById: null,
    completedDate: null,
    workPerformed: null,
    partsUsed: null,
    cost: null,
    nextServiceHours: 1500,
    nextServiceMileage: 55000,
    nextServiceDate: new Date('2026-06-15'),
    notes: null,
    status: 'scheduled',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const baseListParams = { sortBy: 'createdAt', sortDir: 'desc' as const, skip: 0, pageSize: 20 };

// ── setup ────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(mockPrisma, createPrismaMock());
});

describe('vehicle-maintenance.service', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('should return data and total count', async () => {
      const records = [makeVehicleMaintenance()];
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue(records);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(1);

      const result = await list(baseListParams);

      expect(result).toEqual({ data: records, total: 1 });
      expect(mockPrisma.vehicleMaintenance.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.vehicleMaintenance.count).toHaveBeenCalledOnce();
    });

    it('should apply search filter with OR clause on maintenanceNumber, vehicleCode, plateNumber, description', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(0);

      await list({ ...baseListParams, search: 'VM-00' });

      const call = mockPrisma.vehicleMaintenance.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeDefined();
      expect(call.where.OR).toHaveLength(4);
      expect(call.where.OR[0]).toEqual({
        maintenanceNumber: { contains: 'VM-00', mode: 'insensitive' },
      });
    });

    it('should apply status filter', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(0);

      await list({ ...baseListParams, status: 'scheduled' });

      const call = mockPrisma.vehicleMaintenance.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('scheduled');
    });

    it('should apply vehicleId filter', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(0);

      await list({ ...baseListParams, vehicleId: 'veh-1' });

      const call = mockPrisma.vehicleMaintenance.findMany.mock.calls[0][0];
      expect(call.where.vehicleId).toBe('veh-1');
    });

    it('should apply maintenanceType filter', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(0);

      await list({ ...baseListParams, maintenanceType: 'corrective' });

      const call = mockPrisma.vehicleMaintenance.findMany.mock.calls[0][0];
      expect(call.where.maintenanceType).toBe('corrective');
    });

    it('should pass pagination parameters', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([]);
      mockPrisma.vehicleMaintenance.count.mockResolvedValue(0);

      await list({ ...baseListParams, skip: 10, pageSize: 5 });

      const args = mockPrisma.vehicleMaintenance.findMany.mock.calls[0][0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the maintenance record when found', async () => {
      const record = makeVehicleMaintenance();
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(record);

      const result = await getById(VM_ID);

      expect(result).toEqual(record);
      expect(mockPrisma.vehicleMaintenance.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: VM_ID } }),
      );
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const data = {
      vehicleId: 'veh-1',
      maintenanceType: 'preventive',
      scheduledDate: '2026-03-15',
      description: 'Oil change and filter replacement',
    };

    it('should verify vehicle exists and create maintenance record', async () => {
      mockPrisma.equipmentFleet.findUnique.mockResolvedValue({ id: 'veh-1', vehicleCode: 'VH-001' });
      vi.mocked(generateDocumentNumber).mockResolvedValue('VM-001');
      const created = makeVehicleMaintenance();
      mockPrisma.vehicleMaintenance.create.mockResolvedValue(created);

      const result = await create(data as any, USER_ID);

      expect(mockPrisma.equipmentFleet.findUnique).toHaveBeenCalledWith({ where: { id: 'veh-1' } });
      expect(generateDocumentNumber).toHaveBeenCalledWith('vm');
      expect(result).toEqual(created);
    });

    it('should set status to scheduled', async () => {
      mockPrisma.equipmentFleet.findUnique.mockResolvedValue({ id: 'veh-1' });
      vi.mocked(generateDocumentNumber).mockResolvedValue('VM-002');
      mockPrisma.vehicleMaintenance.create.mockResolvedValue(makeVehicleMaintenance());

      await create(data as any, USER_ID);

      const createCall = mockPrisma.vehicleMaintenance.create.mock.calls[0][0];
      expect(createCall.data.status).toBe('scheduled');
    });

    it('should throw NotFoundError when vehicle does not exist', async () => {
      mockPrisma.equipmentFleet.findUnique.mockResolvedValue(null);

      await expect(create(data as any, USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should handle optional fields with null defaults', async () => {
      mockPrisma.equipmentFleet.findUnique.mockResolvedValue({ id: 'veh-1' });
      vi.mocked(generateDocumentNumber).mockResolvedValue('VM-003');
      mockPrisma.vehicleMaintenance.create.mockResolvedValue(makeVehicleMaintenance());

      await create(data as any, USER_ID);

      const createCall = mockPrisma.vehicleMaintenance.create.mock.calls[0][0];
      expect(createCall.data.currentHoursAtService).toBeNull();
      expect(createCall.data.currentMileageAtService).toBeNull();
      expect(createCall.data.vendorName).toBeNull();
      expect(createCall.data.performedById).toBeNull();
      expect(createCall.data.notes).toBeNull();
    });

    it('should publish event on creation', async () => {
      mockPrisma.equipmentFleet.findUnique.mockResolvedValue({ id: 'veh-1' });
      vi.mocked(generateDocumentNumber).mockResolvedValue('VM-004');
      mockPrisma.vehicleMaintenance.create.mockResolvedValue(makeVehicleMaintenance());

      await create(data as any, USER_ID);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:created',
          entityType: 'vehicle_maintenance',
          performedById: USER_ID,
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should update a scheduled maintenance record', async () => {
      const existing = makeVehicleMaintenance({ status: 'scheduled' });
      const updated = makeVehicleMaintenance({ description: 'Full service' });
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(existing);
      mockPrisma.vehicleMaintenance.update.mockResolvedValue(updated);

      const result = await update(VM_ID, { description: 'Full service' } as any);

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {} as any)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when maintenance is completed', async () => {
      const existing = makeVehicleMaintenance({ status: 'completed' });
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(existing);

      await expect(update(VM_ID, { description: 'No update' } as any)).rejects.toThrow(BusinessRuleError);
    });

    it('should throw BusinessRuleError when maintenance is cancelled', async () => {
      const existing = makeVehicleMaintenance({ status: 'cancelled' });
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(existing);

      await expect(update(VM_ID, { description: 'No update' } as any)).rejects.toThrow(BusinessRuleError);
    });

    it('should convert date fields when provided', async () => {
      const existing = makeVehicleMaintenance({ status: 'scheduled' });
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(existing);
      mockPrisma.vehicleMaintenance.update.mockResolvedValue(existing);

      await update(VM_ID, { scheduledDate: '2026-04-01', nextServiceDate: '2026-07-01' } as any);

      const updateCall = mockPrisma.vehicleMaintenance.update.mock.calls[0][0];
      expect(updateCall.data.scheduledDate).toBeInstanceOf(Date);
      expect(updateCall.data.nextServiceDate).toBeInstanceOf(Date);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // complete
  // ─────────────────────────────────────────────────────────────────────────
  describe('complete', () => {
    it('should transition maintenance to completed and update vehicle next maintenance date', async () => {
      const record = makeVehicleMaintenance({
        status: 'in_progress',
        nextServiceDate: new Date('2026-06-15'),
      });
      const completed = makeVehicleMaintenance({ status: 'completed', completedDate: new Date() });
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValueOnce(record).mockResolvedValueOnce(completed);
      mockPrisma.vehicleMaintenance.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.equipmentFleet.update.mockResolvedValue({});

      const body = { workPerformed: 'Changed oil and filters' };
      const result = await complete(VM_ID, USER_ID, body as any);

      expect(assertTransition).toHaveBeenCalledWith('vehicle_maintenance', 'in_progress', 'completed');
      expect(result.status).toBe('completed');
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(null);

      await expect(complete('nonexistent', USER_ID, {} as any)).rejects.toThrow(NotFoundError);
    });

    it('should call assertTransition which may throw on invalid transition', async () => {
      const record = makeVehicleMaintenance({ status: 'cancelled' });
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(record);
      vi.mocked(assertTransition).mockImplementation(() => {
        throw new BusinessRuleError('Invalid transition');
      });

      await expect(complete(VM_ID, USER_ID, {} as any)).rejects.toThrow('Invalid transition');
    });

    it('should publish event on completion', async () => {
      const record = makeVehicleMaintenance({ status: 'in_progress', nextServiceDate: null });
      mockPrisma.vehicleMaintenance.findUnique
        .mockResolvedValueOnce(record)
        .mockResolvedValueOnce(makeVehicleMaintenance({ status: 'completed' }));
      mockPrisma.vehicleMaintenance.updateMany.mockResolvedValue({ count: 1 });

      await complete(VM_ID, USER_ID, { workPerformed: 'Service done' } as any);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          entityType: 'vehicle_maintenance',
          payload: expect.objectContaining({ from: 'in_progress', to: 'completed' }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cancel
  // ─────────────────────────────────────────────────────────────────────────
  describe('cancel', () => {
    it('should transition maintenance to cancelled', async () => {
      const record = makeVehicleMaintenance({ status: 'scheduled' });
      const cancelled = makeVehicleMaintenance({ status: 'cancelled' });
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValueOnce(record).mockResolvedValueOnce(cancelled);
      mockPrisma.vehicleMaintenance.updateMany.mockResolvedValue({ count: 1 });

      const result = await cancel(VM_ID, USER_ID);

      expect(assertTransition).toHaveBeenCalledWith('vehicle_maintenance', 'scheduled', 'cancelled');
      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.vehicleMaintenance.findUnique.mockResolvedValue(null);

      await expect(cancel('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should publish event on cancellation', async () => {
      const record = makeVehicleMaintenance({ status: 'scheduled' });
      mockPrisma.vehicleMaintenance.findUnique
        .mockResolvedValueOnce(record)
        .mockResolvedValueOnce(makeVehicleMaintenance({ status: 'cancelled' }));
      mockPrisma.vehicleMaintenance.updateMany.mockResolvedValue({ count: 1 });

      await cancel(VM_ID, USER_ID);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          payload: expect.objectContaining({ from: 'scheduled', to: 'cancelled' }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // checkDueMaintenances
  // ─────────────────────────────────────────────────────────────────────────
  describe('checkDueMaintenances', () => {
    it('should return early when no maintenances are due', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([]);

      await checkDueMaintenances();

      expect(mockPrisma.employee.findMany).not.toHaveBeenCalled();
      expect(createNotification).not.toHaveBeenCalled();
    });

    it('should return early when no supervisors found', async () => {
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([
        {
          id: 'vm-due',
          maintenanceNumber: 'VM-DUE-001',
          maintenanceType: 'preventive',
          scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          vehicle: { vehicleCode: 'VH-001', plateNumber: 'ABC-123' },
        },
      ]);
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await checkDueMaintenances();

      expect(createNotification).not.toHaveBeenCalled();
    });

    it('should create notifications for due maintenances', async () => {
      const dueMaintenance = {
        id: 'vm-due',
        maintenanceNumber: 'VM-DUE-001',
        maintenanceType: 'preventive',
        scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        vehicle: { vehicleCode: 'VH-001', plateNumber: 'ABC-123' },
      };
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([dueMaintenance]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'sup-1' }]);

      await checkDueMaintenances();

      expect(createNotification).toHaveBeenCalledTimes(1);
      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          recipientId: 'sup-1',
          title: 'Vehicle Maintenance Due Soon',
          notificationType: 'vehicle_maintenance_due',
          referenceId: 'vm-due',
        }),
      );
    });

    it('should flag overdue maintenances differently', async () => {
      const overdueMaintenance = {
        id: 'vm-overdue',
        maintenanceNumber: 'VM-OD-001',
        maintenanceType: 'corrective',
        scheduledDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        vehicle: { vehicleCode: 'VH-002', plateNumber: null },
      };
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([overdueMaintenance]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'sup-1' }]);

      await checkDueMaintenances();

      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Vehicle Maintenance Overdue',
        }),
      );
    });

    it('should notify all supervisors for each due maintenance', async () => {
      const dueMaint = {
        id: 'vm-due',
        maintenanceNumber: 'VM-001',
        maintenanceType: 'preventive',
        scheduledDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        vehicle: { vehicleCode: 'VH-001', plateNumber: 'XYZ-789' },
      };
      mockPrisma.vehicleMaintenance.findMany.mockResolvedValue([dueMaint]);
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'sup-1' }, { id: 'sup-2' }, { id: 'sup-3' }]);

      await checkDueMaintenances();

      expect(createNotification).toHaveBeenCalledTimes(3);
    });
  });
});
