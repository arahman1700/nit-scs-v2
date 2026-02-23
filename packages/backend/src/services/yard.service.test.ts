import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  listDockDoors,
  getDockDoor,
  createDockDoor,
  updateDockDoor,
  deleteDockDoor,
  getAvailableDockDoors,
  listAppointments,
  getAppointment,
  createAppointment,
  checkInAppointment,
  completeAppointment,
  cancelAppointment,
  listTruckVisits,
  checkInTruck,
  assignDock,
  checkOutTruck,
  getYardStatus,
  getDockUtilization,
} from './yard.service.js';

type ExtendedModelMock = PrismaModelMock & { findUniqueOrThrow: ReturnType<typeof vi.fn> };

function createModelMock(): ExtendedModelMock {
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

// Typed accessors for mocked models
function dockDoor(): ExtendedModelMock {
  return (mockPrisma as Record<string, unknown>).dockDoor as ExtendedModelMock;
}
function yardAppointment(): ExtendedModelMock {
  return (mockPrisma as Record<string, unknown>).yardAppointment as ExtendedModelMock;
}
function truckVisit(): ExtendedModelMock {
  return (mockPrisma as Record<string, unknown>).truckVisit as ExtendedModelMock;
}

beforeEach(() => {
  const fresh = createPrismaMock();
  Object.assign(mockPrisma, fresh);
  (mockPrisma as Record<string, unknown>).dockDoor = createModelMock();
  (mockPrisma as Record<string, unknown>).yardAppointment = createModelMock();
  (mockPrisma as Record<string, unknown>).truckVisit = createModelMock();
  vi.clearAllMocks();
});

// ── Fixtures ────────────────────────────────────────────────────────────────

const WH_ID = 'wh-001';
const DOCK_ID = 'dock-001';
const DOCK_ID_2 = 'dock-002';
const APPT_ID = 'appt-001';
const TRUCK_ID = 'truck-001';

const sampleDock = {
  id: DOCK_ID,
  warehouseId: WH_ID,
  doorNumber: 'D-01',
  doorType: 'inbound',
  status: 'available',
  warehouse: { id: WH_ID, warehouseName: 'Main WH', warehouseCode: 'WH01' },
};

const sampleAppointment = {
  id: APPT_ID,
  warehouseId: WH_ID,
  dockDoorId: DOCK_ID,
  appointmentType: 'delivery',
  scheduledStart: new Date('2026-03-01T08:00:00Z'),
  scheduledEnd: new Date('2026-03-01T10:00:00Z'),
  status: 'scheduled',
  carrierName: 'FastFreight',
  driverName: 'Ali',
  vehiclePlate: 'ABC-123',
  referenceType: null,
  referenceId: null,
  notes: null,
};

const sampleTruck = {
  id: TRUCK_ID,
  warehouseId: WH_ID,
  vehiclePlate: 'XYZ-789',
  driverName: 'Driver A',
  carrierName: 'Carrier X',
  purpose: 'delivery',
  status: 'in_yard',
  dockDoorId: null,
  checkInAt: new Date('2026-03-01T07:00:00Z'),
  checkOutAt: null,
  notes: null,
};

// ##########################################################################
// DOCK DOORS
// ##########################################################################

describe('Dock Doors', () => {
  describe('listDockDoors', () => {
    it('returns paginated dock doors', async () => {
      dockDoor().findMany.mockResolvedValue([sampleDock]);
      dockDoor().count.mockResolvedValue(1);

      const result = await listDockDoors({ page: 1, pageSize: 10 });

      expect(result).toEqual({ data: [sampleDock], total: 1 });
      expect(dockDoor().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          skip: 0,
          take: 10,
          orderBy: { doorNumber: 'asc' },
        }),
      );
    });

    it('filters by warehouseId', async () => {
      dockDoor().findMany.mockResolvedValue([]);
      dockDoor().count.mockResolvedValue(0);

      await listDockDoors({ page: 1, pageSize: 10, warehouseId: WH_ID });

      expect(dockDoor().findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ warehouseId: WH_ID }) }),
      );
    });

    it('filters by status', async () => {
      dockDoor().findMany.mockResolvedValue([]);
      dockDoor().count.mockResolvedValue(0);

      await listDockDoors({ page: 1, pageSize: 10, status: 'occupied' });

      expect(dockDoor().findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'occupied' }) }),
      );
    });

    it('filters by search (doorNumber)', async () => {
      dockDoor().findMany.mockResolvedValue([]);
      dockDoor().count.mockResolvedValue(0);

      await listDockDoors({ page: 1, pageSize: 10, search: 'D-01' });

      expect(dockDoor().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            doorNumber: { contains: 'D-01', mode: 'insensitive' },
          }),
        }),
      );
    });

    it('calculates correct skip for page 2', async () => {
      dockDoor().findMany.mockResolvedValue([]);
      dockDoor().count.mockResolvedValue(0);

      await listDockDoors({ page: 2, pageSize: 5 });

      expect(dockDoor().findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 5, take: 5 }));
    });
  });

  describe('getDockDoor', () => {
    it('returns dock door with appointments and truck visits', async () => {
      const enriched = { ...sampleDock, appointments: [], truckVisits: [] };
      dockDoor().findUniqueOrThrow.mockResolvedValue(enriched);

      const result = await getDockDoor(DOCK_ID);

      expect(result).toEqual(enriched);
      expect(dockDoor().findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({ where: { id: DOCK_ID } }));
    });
  });

  describe('createDockDoor', () => {
    it('creates a dock door with default status available', async () => {
      dockDoor().create.mockResolvedValue(sampleDock);

      const result = await createDockDoor({
        warehouseId: WH_ID,
        doorNumber: 'D-01',
        doorType: 'inbound',
      });

      expect(result).toEqual(sampleDock);
      expect(dockDoor().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            warehouseId: WH_ID,
            doorNumber: 'D-01',
            doorType: 'inbound',
            status: 'available',
          },
        }),
      );
    });

    it('creates a dock door with explicit status', async () => {
      const maintenanceDock = { ...sampleDock, status: 'maintenance' };
      dockDoor().create.mockResolvedValue(maintenanceDock);

      await createDockDoor({
        warehouseId: WH_ID,
        doorNumber: 'D-01',
        doorType: 'inbound',
        status: 'maintenance',
      });

      expect(dockDoor().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'maintenance' }),
        }),
      );
    });
  });

  describe('updateDockDoor', () => {
    it('updates a dock door', async () => {
      const updated = { ...sampleDock, status: 'maintenance' };
      dockDoor().update.mockResolvedValue(updated);

      const result = await updateDockDoor(DOCK_ID, { status: 'maintenance' });

      expect(result).toEqual(updated);
      expect(dockDoor().update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: DOCK_ID },
          data: { status: 'maintenance' },
        }),
      );
    });
  });

  describe('deleteDockDoor', () => {
    it('deletes a dock door', async () => {
      dockDoor().delete.mockResolvedValue(sampleDock);

      await deleteDockDoor(DOCK_ID);

      expect(dockDoor().delete).toHaveBeenCalledWith({ where: { id: DOCK_ID } });
    });
  });

  describe('getAvailableDockDoors', () => {
    it('returns available docks for a warehouse', async () => {
      dockDoor().findMany.mockResolvedValue([sampleDock]);

      const result = await getAvailableDockDoors(WH_ID);

      expect(result).toEqual([sampleDock]);
      expect(dockDoor().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { warehouseId: WH_ID, status: 'available' },
          orderBy: { doorNumber: 'asc' },
        }),
      );
    });

    it('filters by doorType including both', async () => {
      dockDoor().findMany.mockResolvedValue([]);

      await getAvailableDockDoors(WH_ID, 'inbound');

      expect(dockDoor().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            warehouseId: WH_ID,
            status: 'available',
            doorType: { in: ['inbound', 'both'] },
          },
        }),
      );
    });

    it('returns empty array when no docks available', async () => {
      dockDoor().findMany.mockResolvedValue([]);

      const result = await getAvailableDockDoors(WH_ID);

      expect(result).toEqual([]);
    });
  });
});

// ##########################################################################
// APPOINTMENTS
// ##########################################################################

describe('Appointments', () => {
  describe('listAppointments', () => {
    it('returns paginated appointments', async () => {
      yardAppointment().findMany.mockResolvedValue([sampleAppointment]);
      yardAppointment().count.mockResolvedValue(1);

      const result = await listAppointments({ page: 1, pageSize: 20 });

      expect(result).toEqual({ data: [sampleAppointment], total: 1 });
      expect(yardAppointment().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { scheduledStart: 'asc' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('filters by warehouseId', async () => {
      yardAppointment().findMany.mockResolvedValue([]);
      yardAppointment().count.mockResolvedValue(0);

      await listAppointments({ page: 1, pageSize: 10, warehouseId: WH_ID });

      expect(yardAppointment().findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ warehouseId: WH_ID }) }),
      );
    });

    it('filters by status', async () => {
      yardAppointment().findMany.mockResolvedValue([]);
      yardAppointment().count.mockResolvedValue(0);

      await listAppointments({ page: 1, pageSize: 10, status: 'scheduled' });

      expect(yardAppointment().findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'scheduled' }) }),
      );
    });

    it('filters by date range (full day)', async () => {
      yardAppointment().findMany.mockResolvedValue([]);
      yardAppointment().count.mockResolvedValue(0);

      await listAppointments({ page: 1, pageSize: 10, date: '2026-03-01' });

      expect(yardAppointment().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            scheduledStart: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('filters by search (carrier, plate, driver)', async () => {
      yardAppointment().findMany.mockResolvedValue([]);
      yardAppointment().count.mockResolvedValue(0);

      await listAppointments({ page: 1, pageSize: 10, search: 'Fast' });

      expect(yardAppointment().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { carrierName: { contains: 'Fast', mode: 'insensitive' } },
              { vehiclePlate: { contains: 'Fast', mode: 'insensitive' } },
              { driverName: { contains: 'Fast', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('getAppointment', () => {
    it('returns appointment by id', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue(sampleAppointment);

      const result = await getAppointment(APPT_ID);

      expect(result).toEqual(sampleAppointment);
      expect(yardAppointment().findUniqueOrThrow).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: APPT_ID } }),
      );
    });
  });

  describe('createAppointment', () => {
    const dto = {
      warehouseId: WH_ID,
      dockDoorId: DOCK_ID,
      appointmentType: 'delivery' as const,
      scheduledStart: '2026-03-01T08:00:00Z',
      scheduledEnd: '2026-03-01T10:00:00Z',
      carrierName: 'FastFreight',
      driverName: 'Ali',
      vehiclePlate: 'ABC-123',
    };

    it('creates appointment when no conflict', async () => {
      yardAppointment().findFirst.mockResolvedValue(null);
      yardAppointment().create.mockResolvedValue(sampleAppointment);

      const result = await createAppointment(dto);

      expect(result).toEqual(sampleAppointment);
      expect(yardAppointment().findFirst).toHaveBeenCalled(); // conflict check
      expect(yardAppointment().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            warehouseId: WH_ID,
            dockDoorId: DOCK_ID,
            appointmentType: 'delivery',
            scheduledStart: new Date('2026-03-01T08:00:00Z'),
            scheduledEnd: new Date('2026-03-01T10:00:00Z'),
            carrierName: 'FastFreight',
            driverName: 'Ali',
            vehiclePlate: 'ABC-123',
          }),
        }),
      );
    });

    it('throws on scheduling conflict', async () => {
      const conflicting = {
        scheduledStart: new Date('2026-03-01T09:00:00Z'),
        scheduledEnd: new Date('2026-03-01T11:00:00Z'),
      };
      yardAppointment().findFirst.mockResolvedValue(conflicting);

      await expect(createAppointment(dto)).rejects.toThrow('Dock door is already booked');
    });

    it('skips conflict check when no dockDoorId', async () => {
      const noDockDto = { ...dto, dockDoorId: undefined };
      yardAppointment().create.mockResolvedValue({ ...sampleAppointment, dockDoorId: null });

      await createAppointment(noDockDto);

      expect(yardAppointment().findFirst).not.toHaveBeenCalled();
    });

    it('sets null for optional fields when not provided', async () => {
      const minimalDto = {
        warehouseId: WH_ID,
        appointmentType: 'pickup' as const,
        scheduledStart: '2026-03-01T14:00:00Z',
        scheduledEnd: '2026-03-01T16:00:00Z',
      };
      yardAppointment().create.mockResolvedValue({ ...sampleAppointment, dockDoorId: null });

      await createAppointment(minimalDto);

      expect(yardAppointment().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            dockDoorId: null,
            carrierName: null,
            driverName: null,
            vehiclePlate: null,
            referenceType: null,
            referenceId: null,
            notes: null,
          }),
        }),
      );
    });
  });

  describe('checkInAppointment', () => {
    it('checks in a scheduled appointment and marks dock occupied', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'scheduled' });
      dockDoor().update.mockResolvedValue({ ...sampleDock, status: 'occupied' });
      yardAppointment().update.mockResolvedValue({ ...sampleAppointment, status: 'checked_in' });

      const result = await checkInAppointment(APPT_ID);

      expect(result.status).toBe('checked_in');
      expect(dockDoor().update).toHaveBeenCalledWith({
        where: { id: DOCK_ID },
        data: { status: 'occupied' },
      });
      expect(yardAppointment().update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: APPT_ID },
          data: { status: 'checked_in' },
        }),
      );
    });

    it('checks in without dock update when no dockDoorId', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({
        ...sampleAppointment,
        status: 'scheduled',
        dockDoorId: null,
      });
      yardAppointment().update.mockResolvedValue({ ...sampleAppointment, status: 'checked_in', dockDoorId: null });

      await checkInAppointment(APPT_ID);

      expect(dockDoor().update).not.toHaveBeenCalled();
    });

    it('throws if appointment not in scheduled status', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'checked_in' });

      await expect(checkInAppointment(APPT_ID)).rejects.toThrow('Cannot check in appointment with status: checked_in');
    });

    it('throws for completed appointment', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'completed' });

      await expect(checkInAppointment(APPT_ID)).rejects.toThrow('Cannot check in appointment with status: completed');
    });

    it('throws for cancelled appointment', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'cancelled' });

      await expect(checkInAppointment(APPT_ID)).rejects.toThrow('Cannot check in appointment with status: cancelled');
    });
  });

  describe('completeAppointment', () => {
    it('completes a checked_in appointment and frees dock', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'checked_in' });
      dockDoor().update.mockResolvedValue({ ...sampleDock, status: 'available' });
      yardAppointment().update.mockResolvedValue({ ...sampleAppointment, status: 'completed' });

      const result = await completeAppointment(APPT_ID);

      expect(result.status).toBe('completed');
      expect(dockDoor().update).toHaveBeenCalledWith({
        where: { id: DOCK_ID },
        data: { status: 'available' },
      });
    });

    it('completes a loading appointment and frees dock', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'loading' });
      dockDoor().update.mockResolvedValue({ ...sampleDock, status: 'available' });
      yardAppointment().update.mockResolvedValue({ ...sampleAppointment, status: 'completed' });

      const result = await completeAppointment(APPT_ID);

      expect(result.status).toBe('completed');
      expect(dockDoor().update).toHaveBeenCalledWith({
        where: { id: DOCK_ID },
        data: { status: 'available' },
      });
    });

    it('completes without dock update when no dockDoorId', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({
        ...sampleAppointment,
        status: 'checked_in',
        dockDoorId: null,
      });
      yardAppointment().update.mockResolvedValue({ ...sampleAppointment, status: 'completed', dockDoorId: null });

      await completeAppointment(APPT_ID);

      expect(dockDoor().update).not.toHaveBeenCalled();
    });

    it('throws for scheduled appointment', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'scheduled' });

      await expect(completeAppointment(APPT_ID)).rejects.toThrow('Cannot complete appointment with status: scheduled');
    });

    it('throws for already completed appointment', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'completed' });

      await expect(completeAppointment(APPT_ID)).rejects.toThrow('Cannot complete appointment with status: completed');
    });

    it('throws for cancelled appointment', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'cancelled' });

      await expect(completeAppointment(APPT_ID)).rejects.toThrow('Cannot complete appointment with status: cancelled');
    });
  });

  describe('cancelAppointment', () => {
    it('cancels a scheduled appointment without freeing dock', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'scheduled' });
      yardAppointment().update.mockResolvedValue({ ...sampleAppointment, status: 'cancelled' });

      const result = await cancelAppointment(APPT_ID);

      expect(result.status).toBe('cancelled');
      // Dock is NOT freed when status is 'scheduled'
      expect(dockDoor().update).not.toHaveBeenCalled();
    });

    it('cancels a checked_in appointment and frees dock', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'checked_in' });
      dockDoor().update.mockResolvedValue({ ...sampleDock, status: 'available' });
      yardAppointment().update.mockResolvedValue({ ...sampleAppointment, status: 'cancelled' });

      const result = await cancelAppointment(APPT_ID);

      expect(result.status).toBe('cancelled');
      expect(dockDoor().update).toHaveBeenCalledWith({
        where: { id: DOCK_ID },
        data: { status: 'available' },
      });
    });

    it('cancels a loading appointment and frees dock', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'loading' });
      dockDoor().update.mockResolvedValue({ ...sampleDock, status: 'available' });
      yardAppointment().update.mockResolvedValue({ ...sampleAppointment, status: 'cancelled' });

      await cancelAppointment(APPT_ID);

      expect(dockDoor().update).toHaveBeenCalledWith({
        where: { id: DOCK_ID },
        data: { status: 'available' },
      });
    });

    it('does not free dock when cancelling checked_in appointment without dockDoorId', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({
        ...sampleAppointment,
        status: 'checked_in',
        dockDoorId: null,
      });
      yardAppointment().update.mockResolvedValue({ ...sampleAppointment, status: 'cancelled', dockDoorId: null });

      await cancelAppointment(APPT_ID);

      expect(dockDoor().update).not.toHaveBeenCalled();
    });

    it('throws for already completed appointment', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'completed' });

      await expect(cancelAppointment(APPT_ID)).rejects.toThrow('Cannot cancel appointment with status: completed');
    });

    it('throws for already cancelled appointment', async () => {
      yardAppointment().findUniqueOrThrow.mockResolvedValue({ ...sampleAppointment, status: 'cancelled' });

      await expect(cancelAppointment(APPT_ID)).rejects.toThrow('Cannot cancel appointment with status: cancelled');
    });
  });
});

// ##########################################################################
// TRUCK VISITS
// ##########################################################################

describe('Truck Visits', () => {
  describe('listTruckVisits', () => {
    it('returns paginated truck visits', async () => {
      truckVisit().findMany.mockResolvedValue([sampleTruck]);
      truckVisit().count.mockResolvedValue(1);

      const result = await listTruckVisits({ page: 1, pageSize: 10 });

      expect(result).toEqual({ data: [sampleTruck], total: 1 });
      expect(truckVisit().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { checkInAt: 'desc' },
          skip: 0,
          take: 10,
        }),
      );
    });

    it('filters by warehouseId', async () => {
      truckVisit().findMany.mockResolvedValue([]);
      truckVisit().count.mockResolvedValue(0);

      await listTruckVisits({ page: 1, pageSize: 10, warehouseId: WH_ID });

      expect(truckVisit().findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ warehouseId: WH_ID }) }),
      );
    });

    it('filters by status', async () => {
      truckVisit().findMany.mockResolvedValue([]);
      truckVisit().count.mockResolvedValue(0);

      await listTruckVisits({ page: 1, pageSize: 10, status: 'in_yard' });

      expect(truckVisit().findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'in_yard' }) }),
      );
    });

    it('filters by search (plate, driver, carrier)', async () => {
      truckVisit().findMany.mockResolvedValue([]);
      truckVisit().count.mockResolvedValue(0);

      await listTruckVisits({ page: 1, pageSize: 10, search: 'XYZ' });

      expect(truckVisit().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { vehiclePlate: { contains: 'XYZ', mode: 'insensitive' } },
              { driverName: { contains: 'XYZ', mode: 'insensitive' } },
              { carrierName: { contains: 'XYZ', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });
  });

  describe('checkInTruck', () => {
    it('creates a truck visit with provided data', async () => {
      truckVisit().create.mockResolvedValue(sampleTruck);

      const result = await checkInTruck({
        warehouseId: WH_ID,
        vehiclePlate: 'XYZ-789',
        driverName: 'Driver A',
        carrierName: 'Carrier X',
        purpose: 'delivery',
        notes: 'Fragile items',
      });

      expect(result).toEqual(sampleTruck);
      expect(truckVisit().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            warehouseId: WH_ID,
            vehiclePlate: 'XYZ-789',
            driverName: 'Driver A',
            carrierName: 'Carrier X',
            purpose: 'delivery',
            notes: 'Fragile items',
          },
        }),
      );
    });

    it('sets null for optional fields when not provided', async () => {
      truckVisit().create.mockResolvedValue(sampleTruck);

      await checkInTruck({
        warehouseId: WH_ID,
        vehiclePlate: 'XYZ-789',
        purpose: 'pickup',
      });

      expect(truckVisit().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            driverName: null,
            carrierName: null,
            notes: null,
          }),
        }),
      );
    });
  });

  describe('assignDock', () => {
    it('assigns an available dock to an in_yard truck', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({ ...sampleTruck, status: 'in_yard', dockDoorId: null });
      dockDoor().findUniqueOrThrow.mockResolvedValue({ ...sampleDock, status: 'available', doorNumber: 'D-01' });
      dockDoor().update.mockResolvedValue({ ...sampleDock, status: 'occupied' });
      truckVisit().update.mockResolvedValue({ ...sampleTruck, status: 'at_dock', dockDoorId: DOCK_ID });

      const result = await assignDock(TRUCK_ID, DOCK_ID);

      expect(result.status).toBe('at_dock');
      expect(result.dockDoorId).toBe(DOCK_ID);
      // Mark new dock occupied
      expect(dockDoor().update).toHaveBeenCalledWith({
        where: { id: DOCK_ID },
        data: { status: 'occupied' },
      });
    });

    it('frees old dock when reassigning', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({
        ...sampleTruck,
        status: 'in_yard',
        dockDoorId: DOCK_ID_2,
      });
      dockDoor().findUniqueOrThrow.mockResolvedValue({ ...sampleDock, id: DOCK_ID, status: 'available' });
      dockDoor().update.mockResolvedValue({});
      truckVisit().update.mockResolvedValue({ ...sampleTruck, status: 'at_dock', dockDoorId: DOCK_ID });

      await assignDock(TRUCK_ID, DOCK_ID);

      // First call: mark new dock occupied
      expect(dockDoor().update).toHaveBeenCalledWith({
        where: { id: DOCK_ID },
        data: { status: 'occupied' },
      });
      // Second call: free old dock
      expect(dockDoor().update).toHaveBeenCalledWith({
        where: { id: DOCK_ID_2 },
        data: { status: 'available' },
      });
      expect(dockDoor().update).toHaveBeenCalledTimes(2);
    });

    it('throws if truck is not in_yard', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({ ...sampleTruck, status: 'at_dock' });

      await expect(assignDock(TRUCK_ID, DOCK_ID)).rejects.toThrow('Cannot assign dock to truck with status: at_dock');
    });

    it('throws if truck already departed', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({ ...sampleTruck, status: 'departed' });

      await expect(assignDock(TRUCK_ID, DOCK_ID)).rejects.toThrow('Cannot assign dock to truck with status: departed');
    });

    it('throws if dock is not available', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({ ...sampleTruck, status: 'in_yard' });
      dockDoor().findUniqueOrThrow.mockResolvedValue({
        ...sampleDock,
        status: 'occupied',
        doorNumber: 'D-01',
      });

      await expect(assignDock(TRUCK_ID, DOCK_ID)).rejects.toThrow('Dock door D-01 is not available (status: occupied)');
    });

    it('throws if dock is in maintenance', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({ ...sampleTruck, status: 'in_yard' });
      dockDoor().findUniqueOrThrow.mockResolvedValue({
        ...sampleDock,
        status: 'maintenance',
        doorNumber: 'D-01',
      });

      await expect(assignDock(TRUCK_ID, DOCK_ID)).rejects.toThrow(
        'Dock door D-01 is not available (status: maintenance)',
      );
    });

    it('does not free old dock when truck has no previous dock', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({ ...sampleTruck, status: 'in_yard', dockDoorId: null });
      dockDoor().findUniqueOrThrow.mockResolvedValue({ ...sampleDock, status: 'available' });
      dockDoor().update.mockResolvedValue({});
      truckVisit().update.mockResolvedValue({ ...sampleTruck, status: 'at_dock', dockDoorId: DOCK_ID });

      await assignDock(TRUCK_ID, DOCK_ID);

      // Only one dock update: mark new dock occupied
      expect(dockDoor().update).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkOutTruck', () => {
    it('checks out a truck in_yard without dock', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({ ...sampleTruck, status: 'in_yard', dockDoorId: null });
      truckVisit().update.mockResolvedValue({
        ...sampleTruck,
        status: 'departed',
        checkOutAt: expect.any(Date),
      });

      const result = await checkOutTruck(TRUCK_ID);

      expect(result.status).toBe('departed');
      expect(dockDoor().update).not.toHaveBeenCalled();
      expect(truckVisit().update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TRUCK_ID },
          data: { status: 'departed', checkOutAt: expect.any(Date) },
        }),
      );
    });

    it('checks out truck at_dock and frees dock', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({ ...sampleTruck, status: 'at_dock', dockDoorId: DOCK_ID });
      dockDoor().update.mockResolvedValue({ ...sampleDock, status: 'available' });
      truckVisit().update.mockResolvedValue({ ...sampleTruck, status: 'departed' });

      await checkOutTruck(TRUCK_ID);

      expect(dockDoor().update).toHaveBeenCalledWith({
        where: { id: DOCK_ID },
        data: { status: 'available' },
      });
    });

    it('throws if truck already departed', async () => {
      truckVisit().findUniqueOrThrow.mockResolvedValue({ ...sampleTruck, status: 'departed' });

      await expect(checkOutTruck(TRUCK_ID)).rejects.toThrow('Truck has already departed');
    });
  });
});

// ##########################################################################
// YARD STATUS & UTILIZATION
// ##########################################################################

describe('Yard Status & Utilization', () => {
  describe('getYardStatus', () => {
    it('returns summary with dock counts and active trucks', async () => {
      const docks = [
        { ...sampleDock, id: 'dock-1', status: 'available', truckVisits: [] },
        {
          ...sampleDock,
          id: 'dock-2',
          status: 'occupied',
          truckVisits: [{ id: 't1', vehiclePlate: 'A', driverName: 'D', checkInAt: new Date() }],
        },
        { ...sampleDock, id: 'dock-3', status: 'maintenance', truckVisits: [] },
        { ...sampleDock, id: 'dock-4', status: 'available', truckVisits: [] },
      ];
      const activeTrucks = [sampleTruck];
      const todayAppts = [
        { ...sampleAppointment, status: 'scheduled' },
        { ...sampleAppointment, id: 'appt-2', status: 'completed' },
      ];

      dockDoor().findMany.mockResolvedValue(docks);
      truckVisit().findMany.mockResolvedValue(activeTrucks);
      yardAppointment().findMany.mockResolvedValue(todayAppts);

      const result = await getYardStatus(WH_ID);

      expect(result.summary).toEqual({
        totalDocks: 4,
        occupiedDocks: 1,
        availableDocks: 2,
        maintenanceDocks: 1,
        trucksInYard: 1,
        appointmentsToday: 2,
        upcomingAppointments: 1,
      });
      expect(result.dockDoors).toHaveLength(4);
      expect(result.activeTrucks).toHaveLength(1);
      expect(result.todayAppointments).toHaveLength(2);
    });

    it('returns zeroes when warehouse is empty', async () => {
      dockDoor().findMany.mockResolvedValue([]);
      truckVisit().findMany.mockResolvedValue([]);
      yardAppointment().findMany.mockResolvedValue([]);

      const result = await getYardStatus(WH_ID);

      expect(result.summary).toEqual({
        totalDocks: 0,
        occupiedDocks: 0,
        availableDocks: 0,
        maintenanceDocks: 0,
        trucksInYard: 0,
        appointmentsToday: 0,
        upcomingAppointments: 0,
      });
    });

    it('filters docks and trucks by warehouseId', async () => {
      dockDoor().findMany.mockResolvedValue([]);
      truckVisit().findMany.mockResolvedValue([]);
      yardAppointment().findMany.mockResolvedValue([]);

      await getYardStatus(WH_ID);

      expect(dockDoor().findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { warehouseId: WH_ID } }));
      expect(truckVisit().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { warehouseId: WH_ID, status: { in: ['in_yard', 'at_dock'] } },
        }),
      );
      expect(yardAppointment().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: WH_ID }),
        }),
      );
    });
  });

  describe('getDockUtilization', () => {
    it('returns per-dock metrics with average dwell time', async () => {
      const dock1 = { id: 'dock-1', doorNumber: 'D-01', doorType: 'inbound', status: 'available' };
      const dock2 = { id: 'dock-2', doorNumber: 'D-02', doorType: 'outbound', status: 'available' };

      const appointments = [
        {
          id: 'a1',
          dockDoorId: 'dock-1',
          appointmentType: 'delivery',
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          status: 'completed',
        },
        {
          id: 'a2',
          dockDoorId: 'dock-1',
          appointmentType: 'delivery',
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          status: 'scheduled',
        },
        {
          id: 'a3',
          dockDoorId: 'dock-2',
          appointmentType: 'pickup',
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          status: 'cancelled',
        },
      ];

      const checkIn1 = new Date('2026-03-01T08:00:00Z');
      const checkOut1 = new Date('2026-03-01T09:00:00Z'); // 60 min
      const checkIn2 = new Date('2026-03-01T10:00:00Z');
      const checkOut2 = new Date('2026-03-01T10:30:00Z'); // 30 min

      const visits = [
        {
          id: 'v1',
          dockDoorId: 'dock-1',
          checkInAt: checkIn1,
          checkOutAt: checkOut1,
          status: 'departed',
          purpose: 'delivery',
        },
        {
          id: 'v2',
          dockDoorId: 'dock-1',
          checkInAt: checkIn2,
          checkOutAt: checkOut2,
          status: 'departed',
          purpose: 'delivery',
        },
        {
          id: 'v3',
          dockDoorId: 'dock-2',
          checkInAt: new Date(),
          checkOutAt: null,
          status: 'at_dock',
          purpose: 'pickup',
        },
      ];

      dockDoor().findMany.mockResolvedValue([dock1, dock2]);
      yardAppointment().findMany.mockResolvedValue(appointments);
      truckVisit().findMany.mockResolvedValue(visits);

      const result = await getDockUtilization(WH_ID, '2026-03-01');

      expect(result.date).toBe('2026-03-01');
      expect(result.dockMetrics).toHaveLength(2);

      // dock-1: 2 appointments, 2 visits, 2 completed, avg (60+30)/2 = 45 min
      const dock1Metrics = result.dockMetrics.find((d: { id: string }) => d.id === 'dock-1');
      expect(dock1Metrics).toMatchObject({
        appointmentCount: 2,
        visitCount: 2,
        completedCount: 2,
        avgDwellMinutes: 45,
      });

      // dock-2: 1 appointment, 1 visit, 0 completed (no checkOut), avg 0
      const dock2Metrics = result.dockMetrics.find((d: { id: string }) => d.id === 'dock-2');
      expect(dock2Metrics).toMatchObject({
        appointmentCount: 1,
        visitCount: 1,
        completedCount: 0,
        avgDwellMinutes: 0,
      });

      expect(result.summary).toMatchObject({
        totalDocks: 2,
        totalAppointments: 3,
        completedAppointments: 1,
        cancelledAppointments: 1,
        noShowAppointments: 0,
        totalTruckVisits: 3,
      });
    });

    it('returns zero utilization when no docks', async () => {
      dockDoor().findMany.mockResolvedValue([]);
      yardAppointment().findMany.mockResolvedValue([]);
      truckVisit().findMany.mockResolvedValue([]);

      const result = await getDockUtilization(WH_ID, '2026-03-01');

      expect(result.summary.utilizationRate).toBe(0);
      expect(result.dockMetrics).toHaveLength(0);
    });

    it('calculates utilization rate based on dock count and appointments', async () => {
      // 2 docks * 8 slots = 16. 4 appointments => 4/16 * 100 = 25%
      const docks = [
        { id: 'd1', doorNumber: 'D-01', doorType: 'inbound', status: 'available' },
        { id: 'd2', doorNumber: 'D-02', doorType: 'outbound', status: 'available' },
      ];
      const appointments = [
        {
          id: 'a1',
          dockDoorId: 'd1',
          appointmentType: 'delivery',
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          status: 'completed',
        },
        {
          id: 'a2',
          dockDoorId: 'd1',
          appointmentType: 'delivery',
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          status: 'completed',
        },
        {
          id: 'a3',
          dockDoorId: 'd2',
          appointmentType: 'pickup',
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          status: 'scheduled',
        },
        {
          id: 'a4',
          dockDoorId: 'd2',
          appointmentType: 'pickup',
          scheduledStart: new Date(),
          scheduledEnd: new Date(),
          status: 'no_show',
        },
      ];

      dockDoor().findMany.mockResolvedValue(docks);
      yardAppointment().findMany.mockResolvedValue(appointments);
      truckVisit().findMany.mockResolvedValue([]);

      const result = await getDockUtilization(WH_ID, '2026-03-01');

      expect(result.summary.utilizationRate).toBe(25); // 4/(2*8)*100
      expect(result.summary.noShowAppointments).toBe(1);
    });

    it('filters queries by warehouse and date range', async () => {
      dockDoor().findMany.mockResolvedValue([]);
      yardAppointment().findMany.mockResolvedValue([]);
      truckVisit().findMany.mockResolvedValue([]);

      await getDockUtilization(WH_ID, '2026-03-01');

      expect(dockDoor().findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { warehouseId: WH_ID } }));
      expect(yardAppointment().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: WH_ID,
            scheduledStart: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
      expect(truckVisit().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: WH_ID,
            checkInAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
          }),
        }),
      );
    });
  });
});
