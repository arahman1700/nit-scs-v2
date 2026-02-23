import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import * as stagingService from './staging.service.js';

function createModelMock(): PrismaModelMock {
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

describe('staging.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).stagingAssignment = createModelMock();
    (mockPrisma as Record<string, unknown>).warehouseZone = createModelMock();
  });

  // ############################################################################
  // listStagingZones
  // ############################################################################

  describe('listStagingZones', () => {
    it('should return staging zones with active assignment counts', async () => {
      const zones = [
        {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 50,
          currentOccupancy: 10,
          warehouseId: 'wh-1',
        },
        {
          id: 'zone-2',
          zoneName: 'Staging B',
          zoneCode: 'STG-B',
          zoneType: 'staging_outbound',
          capacity: 30,
          currentOccupancy: 5,
          warehouseId: 'wh-1',
        },
      ];

      const counts = [
        {
          zoneId: 'zone-1',
          _count: { id: 8 },
          _sum: { quantity: 120 },
        },
        {
          zoneId: 'zone-2',
          _count: { id: 3 },
          _sum: { quantity: 45 },
        },
      ];

      mockPrisma.warehouseZone.findMany.mockResolvedValue(zones);
      mockPrisma.stagingAssignment.groupBy.mockResolvedValue(counts);

      const result = await stagingService.listStagingZones('wh-1');

      expect(mockPrisma.warehouseZone.findMany).toHaveBeenCalledWith({
        where: { warehouseId: 'wh-1', zoneType: { startsWith: 'staging_' } },
        orderBy: { zoneName: 'asc' },
      });

      expect(mockPrisma.stagingAssignment.groupBy).toHaveBeenCalledWith({
        by: ['zoneId'],
        where: { warehouseId: 'wh-1', status: 'staged' },
        _count: { id: true },
        _sum: { quantity: true },
      });

      expect(result).toEqual([
        { ...zones[0], activeAssignments: 8, totalStagedQty: 120 },
        { ...zones[1], activeAssignments: 3, totalStagedQty: 45 },
      ]);
    });

    it('should handle zones with no active assignments', async () => {
      const zones = [
        {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 50,
          currentOccupancy: 0,
          warehouseId: 'wh-1',
        },
      ];

      mockPrisma.warehouseZone.findMany.mockResolvedValue(zones);
      mockPrisma.stagingAssignment.groupBy.mockResolvedValue([]);

      const result = await stagingService.listStagingZones('wh-1');

      expect(result).toEqual([{ ...zones[0], activeAssignments: 0, totalStagedQty: 0 }]);
    });

    it('should handle null sum quantity', async () => {
      const zones = [
        {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 50,
          currentOccupancy: 0,
          warehouseId: 'wh-1',
        },
      ];

      const counts = [
        {
          zoneId: 'zone-1',
          _count: { id: 2 },
          _sum: { quantity: null },
        },
      ];

      mockPrisma.warehouseZone.findMany.mockResolvedValue(zones);
      mockPrisma.stagingAssignment.groupBy.mockResolvedValue(counts);

      const result = await stagingService.listStagingZones('wh-1');

      expect(result).toEqual([{ ...zones[0], activeAssignments: 2, totalStagedQty: 0 }]);
    });
  });

  // ############################################################################
  // listAssignments
  // ############################################################################

  describe('listAssignments', () => {
    it('should return paginated assignments with filters', async () => {
      const assignments = [
        {
          id: 'assign-1',
          zoneId: 'zone-1',
          warehouseId: 'wh-1',
          itemId: 'item-1',
          sourceDocType: 'grn' as const,
          sourceDocId: 'grn-1',
          quantity: 100,
          direction: 'inbound' as const,
          status: 'staged',
          stagedAt: new Date('2026-02-20'),
          zone: {
            id: 'zone-1',
            zoneName: 'Staging A',
            zoneCode: 'STG-A',
            zoneType: 'staging_inbound',
            capacity: 50,
            currentOccupancy: 10,
          },
          item: { id: 'item-1', code: 'IT001', name: 'Item 1', category: 'Cat A' },
          assignedBy: { id: 'user-1', name: 'John Doe', employeeCode: 'EMP001' },
        },
      ];

      mockPrisma.stagingAssignment.findMany.mockResolvedValue(assignments);
      mockPrisma.stagingAssignment.count.mockResolvedValue(25);

      const result = await stagingService.listAssignments({
        warehouseId: 'wh-1',
        status: 'staged',
        page: 2,
        pageSize: 10,
      });

      expect(mockPrisma.stagingAssignment.findMany).toHaveBeenCalledWith({
        where: { warehouseId: 'wh-1', status: 'staged' },
        orderBy: { stagedAt: 'desc' },
        skip: 10,
        take: 10,
        include: expect.any(Object),
      });

      expect(mockPrisma.stagingAssignment.count).toHaveBeenCalledWith({
        where: { warehouseId: 'wh-1', status: 'staged' },
      });

      expect(result).toEqual({
        data: assignments,
        total: 25,
      });
    });

    it('should filter by zoneId and direction', async () => {
      mockPrisma.stagingAssignment.findMany.mockResolvedValue([]);
      mockPrisma.stagingAssignment.count.mockResolvedValue(0);

      await stagingService.listAssignments({
        zoneId: 'zone-1',
        direction: 'outbound',
        page: 1,
        pageSize: 20,
      });

      expect(mockPrisma.stagingAssignment.findMany).toHaveBeenCalledWith({
        where: { zoneId: 'zone-1', direction: 'outbound' },
        orderBy: { stagedAt: 'desc' },
        skip: 0,
        take: 20,
        include: expect.any(Object),
      });
    });

    it('should return empty results when no filters match', async () => {
      mockPrisma.stagingAssignment.findMany.mockResolvedValue([]);
      mockPrisma.stagingAssignment.count.mockResolvedValue(0);

      const result = await stagingService.listAssignments({
        warehouseId: 'wh-nonexistent',
        page: 1,
        pageSize: 10,
      });

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  // ############################################################################
  // createAssignment
  // ############################################################################

  describe('createAssignment', () => {
    it('should create assignment and increment zone occupancy', async () => {
      const createDto = {
        zoneId: 'zone-1',
        warehouseId: 'wh-1',
        itemId: 'item-1',
        sourceDocType: 'grn' as const,
        sourceDocId: 'grn-123',
        quantity: 50,
        direction: 'inbound' as const,
        maxDwellHours: 48,
        notes: 'Fragile items',
      };

      const createdAssignment = {
        id: 'assign-1',
        ...createDto,
        assignedById: 'user-1',
        status: 'staged',
        stagedAt: new Date(),
        movedAt: null,
        zone: {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 50,
          currentOccupancy: 10,
        },
        item: { id: 'item-1', code: 'IT001', name: 'Item 1', category: 'Cat A' },
        assignedBy: { id: 'user-1', name: 'John Doe', employeeCode: 'EMP001' },
      };

      mockPrisma.stagingAssignment.create.mockResolvedValue(createdAssignment);
      mockPrisma.warehouseZone.update.mockResolvedValue({} as never);

      const result = await stagingService.createAssignment(createDto, 'user-1');

      expect(mockPrisma.stagingAssignment.create).toHaveBeenCalledWith({
        data: {
          zoneId: 'zone-1',
          warehouseId: 'wh-1',
          itemId: 'item-1',
          sourceDocType: 'grn',
          sourceDocId: 'grn-123',
          quantity: 50,
          direction: 'inbound',
          maxDwellHours: 48,
          notes: 'Fragile items',
          assignedById: 'user-1',
        },
        include: expect.any(Object),
      });

      expect(mockPrisma.warehouseZone.update).toHaveBeenCalledWith({
        where: { id: 'zone-1' },
        data: { currentOccupancy: { increment: 1 } },
      });

      expect(result).toEqual(createdAssignment);
    });

    it('should use default maxDwellHours of 24 when not provided', async () => {
      const createDto = {
        zoneId: 'zone-1',
        warehouseId: 'wh-1',
        itemId: 'item-1',
        sourceDocType: 'mi' as const,
        sourceDocId: 'mi-456',
        quantity: 30,
        direction: 'outbound' as const,
      };

      const createdAssignment = {
        id: 'assign-2',
        ...createDto,
        maxDwellHours: 24,
        notes: null,
        assignedById: 'user-2',
        status: 'staged',
        stagedAt: new Date(),
        movedAt: null,
        zone: {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 50,
          currentOccupancy: 10,
        },
        item: { id: 'item-1', code: 'IT001', name: 'Item 1', category: 'Cat A' },
        assignedBy: { id: 'user-2', name: 'Jane Smith', employeeCode: 'EMP002' },
      };

      mockPrisma.stagingAssignment.create.mockResolvedValue(createdAssignment);
      mockPrisma.warehouseZone.update.mockResolvedValue({} as never);

      const result = await stagingService.createAssignment(createDto, 'user-2');

      expect(mockPrisma.stagingAssignment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          maxDwellHours: 24,
          notes: null,
        }),
        include: expect.any(Object),
      });

      expect(result.maxDwellHours).toBe(24);
    });

    it('should handle cross-dock source doc type', async () => {
      const createDto = {
        zoneId: 'zone-1',
        warehouseId: 'wh-1',
        itemId: 'item-1',
        sourceDocType: 'cross_dock' as const,
        sourceDocId: 'cd-789',
        quantity: 100,
        direction: 'inbound' as const,
      };

      const createdAssignment = {
        id: 'assign-3',
        ...createDto,
        maxDwellHours: 24,
        notes: null,
        assignedById: 'user-1',
        status: 'staged',
        stagedAt: new Date(),
        movedAt: null,
        zone: {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 50,
          currentOccupancy: 10,
        },
        item: { id: 'item-1', code: 'IT001', name: 'Item 1', category: 'Cat A' },
        assignedBy: { id: 'user-1', name: 'John Doe', employeeCode: 'EMP001' },
      };

      mockPrisma.stagingAssignment.create.mockResolvedValue(createdAssignment);
      mockPrisma.warehouseZone.update.mockResolvedValue({} as never);

      const result = await stagingService.createAssignment(createDto, 'user-1');

      expect(result.sourceDocType).toBe('cross_dock');
    });
  });

  // ############################################################################
  // moveFromStaging
  // ############################################################################

  describe('moveFromStaging', () => {
    it('should move assignment and decrement zone occupancy', async () => {
      const assignment = {
        id: 'assign-1',
        zoneId: 'zone-1',
        warehouseId: 'wh-1',
        itemId: 'item-1',
        sourceDocType: 'grn' as const,
        sourceDocId: 'grn-123',
        quantity: 50,
        direction: 'inbound' as const,
        status: 'staged',
        stagedAt: new Date('2026-02-20'),
        movedAt: null,
        maxDwellHours: 24,
        notes: null,
        assignedById: 'user-1',
      };

      const movedAssignment = {
        ...assignment,
        status: 'moved',
        movedAt: new Date('2026-02-21'),
        zone: {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 50,
          currentOccupancy: 9,
        },
        item: { id: 'item-1', code: 'IT001', name: 'Item 1', category: 'Cat A' },
        assignedBy: { id: 'user-1', name: 'John Doe', employeeCode: 'EMP001' },
      };

      mockPrisma.stagingAssignment.findUniqueOrThrow.mockResolvedValue(assignment);
      mockPrisma.stagingAssignment.update.mockResolvedValue(movedAssignment);
      mockPrisma.warehouseZone.update.mockResolvedValue({} as never);

      const result = await stagingService.moveFromStaging('assign-1', 'user-2');

      expect(mockPrisma.stagingAssignment.findUniqueOrThrow).toHaveBeenCalledWith({
        where: { id: 'assign-1' },
      });

      expect(mockPrisma.stagingAssignment.update).toHaveBeenCalledWith({
        where: { id: 'assign-1' },
        data: { status: 'moved', movedAt: expect.any(Date) },
        include: expect.any(Object),
      });

      expect(mockPrisma.warehouseZone.update).toHaveBeenCalledWith({
        where: { id: 'zone-1' },
        data: { currentOccupancy: { decrement: 1 } },
      });

      expect(result.status).toBe('moved');
      expect(result.movedAt).toBeTruthy();
    });

    it('should throw error when assignment not found', async () => {
      mockPrisma.stagingAssignment.findUniqueOrThrow.mockRejectedValue(new Error('Record not found'));

      await expect(stagingService.moveFromStaging('nonexistent', 'user-1')).rejects.toThrow('Record not found');

      expect(mockPrisma.stagingAssignment.update).not.toHaveBeenCalled();
      expect(mockPrisma.warehouseZone.update).not.toHaveBeenCalled();
    });

    it('should throw error when assignment is already moved', async () => {
      const movedAssignment = {
        id: 'assign-1',
        zoneId: 'zone-1',
        warehouseId: 'wh-1',
        itemId: 'item-1',
        sourceDocType: 'grn' as const,
        sourceDocId: 'grn-123',
        quantity: 50,
        direction: 'inbound' as const,
        status: 'moved',
        stagedAt: new Date('2026-02-20'),
        movedAt: new Date('2026-02-21'),
        maxDwellHours: 24,
        notes: null,
        assignedById: 'user-1',
      };

      mockPrisma.stagingAssignment.findUniqueOrThrow.mockResolvedValue(movedAssignment);

      await expect(stagingService.moveFromStaging('assign-1', 'user-2')).rejects.toThrow(
        'Cannot move assignment with status: moved',
      );

      expect(mockPrisma.stagingAssignment.update).not.toHaveBeenCalled();
      expect(mockPrisma.warehouseZone.update).not.toHaveBeenCalled();
    });

    it('should throw error when assignment is cancelled', async () => {
      const cancelledAssignment = {
        id: 'assign-1',
        zoneId: 'zone-1',
        warehouseId: 'wh-1',
        itemId: 'item-1',
        sourceDocType: 'grn' as const,
        sourceDocId: 'grn-123',
        quantity: 50,
        direction: 'inbound' as const,
        status: 'cancelled',
        stagedAt: new Date('2026-02-20'),
        movedAt: null,
        maxDwellHours: 24,
        notes: null,
        assignedById: 'user-1',
      };

      mockPrisma.stagingAssignment.findUniqueOrThrow.mockResolvedValue(cancelledAssignment);

      await expect(stagingService.moveFromStaging('assign-1', 'user-2')).rejects.toThrow(
        'Cannot move assignment with status: cancelled',
      );
    });
  });

  // ############################################################################
  // getOverstayAlerts
  // ############################################################################

  describe('getOverstayAlerts', () => {
    it('should return assignments exceeding maxDwellHours', async () => {
      const now = new Date('2026-02-23T12:00:00Z');
      vi.setSystemTime(now);

      const assignments = [
        {
          id: 'assign-1',
          zoneId: 'zone-1',
          warehouseId: 'wh-1',
          itemId: 'item-1',
          sourceDocType: 'grn' as const,
          sourceDocId: 'grn-123',
          quantity: 50,
          direction: 'inbound' as const,
          status: 'staged',
          stagedAt: new Date('2026-02-21T12:00:00Z'), // 48 hours ago
          movedAt: null,
          maxDwellHours: 24,
          notes: null,
          assignedById: 'user-1',
          zone: {
            id: 'zone-1',
            zoneName: 'Staging A',
            zoneCode: 'STG-A',
            zoneType: 'staging_inbound',
            capacity: 50,
            currentOccupancy: 10,
          },
          item: { id: 'item-1', code: 'IT001', name: 'Item 1', category: 'Cat A' },
          assignedBy: { id: 'user-1', name: 'John Doe', employeeCode: 'EMP001' },
        },
        {
          id: 'assign-2',
          zoneId: 'zone-1',
          warehouseId: 'wh-1',
          itemId: 'item-2',
          sourceDocType: 'mi' as const,
          sourceDocId: 'mi-456',
          quantity: 30,
          direction: 'outbound' as const,
          status: 'staged',
          stagedAt: new Date('2026-02-23T06:00:00Z'), // 6 hours ago
          movedAt: null,
          maxDwellHours: 24,
          notes: null,
          assignedById: 'user-2',
          zone: {
            id: 'zone-1',
            zoneName: 'Staging A',
            zoneCode: 'STG-A',
            zoneType: 'staging_inbound',
            capacity: 50,
            currentOccupancy: 10,
          },
          item: { id: 'item-2', code: 'IT002', name: 'Item 2', category: 'Cat B' },
          assignedBy: { id: 'user-2', name: 'Jane Smith', employeeCode: 'EMP002' },
        },
      ];

      mockPrisma.stagingAssignment.findMany.mockResolvedValue(assignments);

      const result = await stagingService.getOverstayAlerts('wh-1');

      expect(mockPrisma.stagingAssignment.findMany).toHaveBeenCalledWith({
        where: { warehouseId: 'wh-1', status: 'staged' },
        include: expect.any(Object),
      });

      // Only assign-1 should be returned (48 hours > 24 hours)
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('assign-1');

      vi.useRealTimers();
    });

    it('should respect custom maxDwellHours', async () => {
      const now = new Date('2026-02-23T12:00:00Z');
      vi.setSystemTime(now);

      const assignments = [
        {
          id: 'assign-1',
          zoneId: 'zone-1',
          warehouseId: 'wh-1',
          itemId: 'item-1',
          sourceDocType: 'grn' as const,
          sourceDocId: 'grn-123',
          quantity: 50,
          direction: 'inbound' as const,
          status: 'staged',
          stagedAt: new Date('2026-02-22T11:00:00Z'), // 25 hours ago
          movedAt: null,
          maxDwellHours: 48,
          notes: null,
          assignedById: 'user-1',
          zone: {
            id: 'zone-1',
            zoneName: 'Staging A',
            zoneCode: 'STG-A',
            zoneType: 'staging_inbound',
            capacity: 50,
            currentOccupancy: 10,
          },
          item: { id: 'item-1', code: 'IT001', name: 'Item 1', category: 'Cat A' },
          assignedBy: { id: 'user-1', name: 'John Doe', employeeCode: 'EMP001' },
        },
      ];

      mockPrisma.stagingAssignment.findMany.mockResolvedValue(assignments);

      const result = await stagingService.getOverstayAlerts('wh-1');

      // Should not be returned (25 hours < 48 hours)
      expect(result).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should return empty array when no overstays', async () => {
      const now = new Date('2026-02-23T12:00:00Z');
      vi.setSystemTime(now);

      const assignments = [
        {
          id: 'assign-1',
          zoneId: 'zone-1',
          warehouseId: 'wh-1',
          itemId: 'item-1',
          sourceDocType: 'grn' as const,
          sourceDocId: 'grn-123',
          quantity: 50,
          direction: 'inbound' as const,
          status: 'staged',
          stagedAt: new Date('2026-02-23T11:00:00Z'), // 1 hour ago
          movedAt: null,
          maxDwellHours: 24,
          notes: null,
          assignedById: 'user-1',
          zone: {
            id: 'zone-1',
            zoneName: 'Staging A',
            zoneCode: 'STG-A',
            zoneType: 'staging_inbound',
            capacity: 50,
            currentOccupancy: 10,
          },
          item: { id: 'item-1', code: 'IT001', name: 'Item 1', category: 'Cat A' },
          assignedBy: { id: 'user-1', name: 'John Doe', employeeCode: 'EMP001' },
        },
      ];

      mockPrisma.stagingAssignment.findMany.mockResolvedValue(assignments);

      const result = await stagingService.getOverstayAlerts('wh-1');

      expect(result).toHaveLength(0);

      vi.useRealTimers();
    });

    it('should use default 24 hours when maxDwellHours is null', async () => {
      const now = new Date('2026-02-23T12:00:00Z');
      vi.setSystemTime(now);

      const assignments = [
        {
          id: 'assign-1',
          zoneId: 'zone-1',
          warehouseId: 'wh-1',
          itemId: 'item-1',
          sourceDocType: 'grn' as const,
          sourceDocId: 'grn-123',
          quantity: 50,
          direction: 'inbound' as const,
          status: 'staged',
          stagedAt: new Date('2026-02-21T11:00:00Z'), // 49 hours ago
          movedAt: null,
          maxDwellHours: null,
          notes: null,
          assignedById: 'user-1',
          zone: {
            id: 'zone-1',
            zoneName: 'Staging A',
            zoneCode: 'STG-A',
            zoneType: 'staging_inbound',
            capacity: 50,
            currentOccupancy: 10,
          },
          item: { id: 'item-1', code: 'IT001', name: 'Item 1', category: 'Cat A' },
          assignedBy: { id: 'user-1', name: 'John Doe', employeeCode: 'EMP001' },
        },
      ];

      mockPrisma.stagingAssignment.findMany.mockResolvedValue(assignments);

      const result = await stagingService.getOverstayAlerts('wh-1');

      // Should be returned (49 hours > 24 hours default)
      expect(result).toHaveLength(1);

      vi.useRealTimers();
    });
  });

  // ############################################################################
  // getStagingOccupancy
  // ############################################################################

  describe('getStagingOccupancy', () => {
    it('should return occupancy stats for all staging zones', async () => {
      const zones = [
        {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 100,
          currentOccupancy: 75,
          warehouseId: 'wh-1',
        },
        {
          id: 'zone-2',
          zoneName: 'Staging B',
          zoneCode: 'STG-B',
          zoneType: 'staging_outbound',
          capacity: 50,
          currentOccupancy: 20,
          warehouseId: 'wh-1',
        },
      ];

      const stats = [
        {
          zoneId: 'zone-1',
          _count: { id: 10 },
          _sum: { quantity: 750 },
        },
        {
          zoneId: 'zone-2',
          _count: { id: 5 },
          _sum: { quantity: 200 },
        },
      ];

      mockPrisma.warehouseZone.findMany.mockResolvedValue(zones);
      mockPrisma.stagingAssignment.groupBy.mockResolvedValue(stats);

      const result = await stagingService.getStagingOccupancy('wh-1');

      expect(mockPrisma.warehouseZone.findMany).toHaveBeenCalledWith({
        where: { warehouseId: 'wh-1', zoneType: { startsWith: 'staging_' } },
        orderBy: { zoneName: 'asc' },
      });

      expect(mockPrisma.stagingAssignment.groupBy).toHaveBeenCalledWith({
        by: ['zoneId'],
        where: { warehouseId: 'wh-1', status: 'staged' },
        _count: { id: true },
        _sum: { quantity: true },
      });

      expect(result).toEqual([
        {
          zoneId: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 100,
          currentOccupancy: 75,
          stagedCount: 10,
          stagedQty: 750,
          utilizationPct: 75,
        },
        {
          zoneId: 'zone-2',
          zoneName: 'Staging B',
          zoneCode: 'STG-B',
          zoneType: 'staging_outbound',
          capacity: 50,
          currentOccupancy: 20,
          stagedCount: 5,
          stagedQty: 200,
          utilizationPct: 40,
        },
      ]);
    });

    it('should handle zones with no staged assignments', async () => {
      const zones = [
        {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 100,
          currentOccupancy: 0,
          warehouseId: 'wh-1',
        },
      ];

      mockPrisma.warehouseZone.findMany.mockResolvedValue(zones);
      mockPrisma.stagingAssignment.groupBy.mockResolvedValue([]);

      const result = await stagingService.getStagingOccupancy('wh-1');

      expect(result).toEqual([
        {
          zoneId: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 100,
          currentOccupancy: 0,
          stagedCount: 0,
          stagedQty: 0,
          utilizationPct: 0,
        },
      ]);
    });

    it('should handle null capacity gracefully', async () => {
      const zones = [
        {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: null,
          currentOccupancy: 10,
          warehouseId: 'wh-1',
        },
      ];

      const stats = [
        {
          zoneId: 'zone-1',
          _count: { id: 5 },
          _sum: { quantity: 100 },
        },
      ];

      mockPrisma.warehouseZone.findMany.mockResolvedValue(zones);
      mockPrisma.stagingAssignment.groupBy.mockResolvedValue(stats);

      const result = await stagingService.getStagingOccupancy('wh-1');

      expect(result[0]).toMatchObject({
        capacity: 0,
        utilizationPct: 0,
      });
    });

    it('should handle null currentOccupancy gracefully', async () => {
      const zones = [
        {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 100,
          currentOccupancy: null,
          warehouseId: 'wh-1',
        },
      ];

      const stats = [
        {
          zoneId: 'zone-1',
          _count: { id: 5 },
          _sum: { quantity: 100 },
        },
      ];

      mockPrisma.warehouseZone.findMany.mockResolvedValue(zones);
      mockPrisma.stagingAssignment.groupBy.mockResolvedValue(stats);

      const result = await stagingService.getStagingOccupancy('wh-1');

      expect(result[0]).toMatchObject({
        currentOccupancy: 0,
        utilizationPct: 0,
      });
    });

    it('should calculate utilization percentage correctly', async () => {
      const zones = [
        {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 80,
          currentOccupancy: 60,
          warehouseId: 'wh-1',
        },
      ];

      const stats = [
        {
          zoneId: 'zone-1',
          _count: { id: 8 },
          _sum: { quantity: 600 },
        },
      ];

      mockPrisma.warehouseZone.findMany.mockResolvedValue(zones);
      mockPrisma.stagingAssignment.groupBy.mockResolvedValue(stats);

      const result = await stagingService.getStagingOccupancy('wh-1');

      // 60 / 80 * 100 = 75
      expect(result[0].utilizationPct).toBe(75);
    });

    it('should handle null sum quantity in stats', async () => {
      const zones = [
        {
          id: 'zone-1',
          zoneName: 'Staging A',
          zoneCode: 'STG-A',
          zoneType: 'staging_inbound',
          capacity: 100,
          currentOccupancy: 10,
          warehouseId: 'wh-1',
        },
      ];

      const stats = [
        {
          zoneId: 'zone-1',
          _count: { id: 3 },
          _sum: { quantity: null },
        },
      ];

      mockPrisma.warehouseZone.findMany.mockResolvedValue(zones);
      mockPrisma.stagingAssignment.groupBy.mockResolvedValue(stats);

      const result = await stagingService.getStagingOccupancy('wh-1');

      expect(result[0].stagedQty).toBe(0);
    });
  });
});
