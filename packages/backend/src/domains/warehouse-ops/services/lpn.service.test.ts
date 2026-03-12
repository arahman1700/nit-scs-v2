import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import {
  createLpn,
  getLpnById,
  getLpns,
  receiveLpn,
  storeLpn,
  pickLpn,
  packLpn,
  shipLpn,
  dissolveLpn,
  moveLpn,
  addContent,
  removeContent,
  getStats,
} from './lpn.service.js';

function createModelMock(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WH_ID = 'wh-001';

function makeLpnRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lpn-001',
    lpnNumber: 'LPN-0001',
    warehouseId: WH_ID,
    zoneId: 'zone-001',
    binId: 'bin-001',
    lpnType: 'pallet',
    status: 'created',
    parentLpnId: null,
    weight: null,
    volume: null,
    sourceDocType: null,
    sourceDocId: null,
    createdById: null,
    createdAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    warehouse: { id: WH_ID, warehouseName: 'Main WH', warehouseCode: 'WH-01' },
    zone: { id: 'zone-001', zoneName: 'Zone A', zoneCode: 'ZA' },
    bin: { id: 'bin-001', locationCode: 'A-01-01' },
    contents: [],
    rfidTags: [],
    ...overrides,
  };
}

function makeContentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'content-001',
    lpnId: 'lpn-001',
    itemId: 'item-001',
    lotId: null,
    quantity: 100,
    uomId: null,
    expiryDate: null,
    createdAt: new Date('2026-02-01T10:00:00Z'),
    item: { id: 'item-001', itemCode: 'ITM-001', itemDescription: 'Steel Pipes' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('lpn.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).licensePlate = createModelMock();
    (mockPrisma as Record<string, unknown>).lpnContent = createModelMock();
  });

  const lp = () => (mockPrisma as unknown as { licensePlate: PrismaModelMock }).licensePlate;
  const lpnContent = () => (mockPrisma as unknown as { lpnContent: PrismaModelMock }).lpnContent;

  // ########################################################################
  // createLpn
  // ########################################################################

  describe('createLpn', () => {
    it('should create an LPN record with given data', async () => {
      const input = {
        lpnNumber: 'LPN-0001',
        warehouseId: WH_ID,
        lpnType: 'pallet',
      };
      const created = makeLpnRecord();
      lp().create.mockResolvedValue(created);

      const result = await createLpn(input as never);

      expect(lp().create).toHaveBeenCalledWith({
        data: input,
        include: expect.objectContaining({
          warehouse: expect.any(Object),
          zone: expect.any(Object),
          bin: expect.any(Object),
          contents: expect.any(Object),
          rfidTags: true,
        }),
      });
      expect(result).toEqual(created);
    });
  });

  // ########################################################################
  // getLpnById
  // ########################################################################

  describe('getLpnById', () => {
    it('should return the record when found', async () => {
      const record = makeLpnRecord();
      lp().findUnique.mockResolvedValue(record);

      const result = await getLpnById('lpn-001');

      expect(lp().findUnique).toHaveBeenCalledWith({
        where: { id: 'lpn-001' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result).toEqual(record);
    });

    it('should throw NotFoundError when record does not exist', async () => {
      lp().findUnique.mockResolvedValue(null);

      await expect(getLpnById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // getLpns
  // ########################################################################

  describe('getLpns', () => {
    it('should return paginated results with defaults', async () => {
      const records = [makeLpnRecord()];
      lp().findMany.mockResolvedValue(records);
      lp().count.mockResolvedValue(1);

      const result = await getLpns({});

      expect(result).toEqual({ data: records, total: 1, page: 1, pageSize: 25 });
      expect(lp().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
          take: 25,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should apply warehouseId, status, and lpnType filters', async () => {
      lp().findMany.mockResolvedValue([]);
      lp().count.mockResolvedValue(0);

      await getLpns({ warehouseId: WH_ID, status: 'stored', lpnType: 'pallet' });

      expect(lp().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            warehouseId: WH_ID,
            status: 'stored',
            lpnType: 'pallet',
          }),
        }),
      );
    });

    it('should handle custom page and pageSize', async () => {
      lp().findMany.mockResolvedValue([]);
      lp().count.mockResolvedValue(50);

      const result = await getLpns({ page: 3, pageSize: 10 });

      expect(lp().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });
  });

  // ########################################################################
  // receiveLpn  (created → in_receiving)
  // ########################################################################

  describe('receiveLpn', () => {
    it('should receive a created LPN', async () => {
      const record = makeLpnRecord({ status: 'created' });
      const received = makeLpnRecord({ status: 'in_receiving' });
      lp().findUnique.mockResolvedValue(record);
      lp().update.mockResolvedValue(received);

      const result = await receiveLpn('lpn-001');

      expect(lp().update).toHaveBeenCalledWith({
        where: { id: 'lpn-001' },
        data: { status: 'in_receiving' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('in_receiving');
    });

    it('should throw NotFoundError when record does not exist', async () => {
      lp().findUnique.mockResolvedValue(null);
      await expect(receiveLpn('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when status is not created', async () => {
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'stored' }));
      await expect(receiveLpn('lpn-001')).rejects.toThrow("Cannot receive LPN in status 'stored'. Must be 'created'.");
    });
  });

  // ########################################################################
  // storeLpn  (in_receiving → stored)
  // ########################################################################

  describe('storeLpn', () => {
    it('should store an in_receiving LPN', async () => {
      const record = makeLpnRecord({ status: 'in_receiving' });
      const stored = makeLpnRecord({ status: 'stored' });
      lp().findUnique.mockResolvedValue(record);
      lp().update.mockResolvedValue(stored);

      const result = await storeLpn('lpn-001');

      expect(lp().update).toHaveBeenCalledWith({
        where: { id: 'lpn-001' },
        data: { status: 'stored' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result.status).toBe('stored');
    });

    it('should throw error when status is not in_receiving', async () => {
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'created' }));
      await expect(storeLpn('lpn-001')).rejects.toThrow(
        "Cannot store LPN in status 'created'. Must be 'in_receiving'.",
      );
    });
  });

  // ########################################################################
  // pickLpn  (stored → in_picking)
  // ########################################################################

  describe('pickLpn', () => {
    it('should pick a stored LPN', async () => {
      const record = makeLpnRecord({ status: 'stored' });
      const picked = makeLpnRecord({ status: 'in_picking' });
      lp().findUnique.mockResolvedValue(record);
      lp().update.mockResolvedValue(picked);

      const result = await pickLpn('lpn-001');
      expect(result.status).toBe('in_picking');
    });

    it('should throw error when status is not stored', async () => {
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'in_receiving' }));
      await expect(pickLpn('lpn-001')).rejects.toThrow("Cannot pick LPN in status 'in_receiving'. Must be 'stored'.");
    });
  });

  // ########################################################################
  // packLpn  (in_picking → in_packing)
  // ########################################################################

  describe('packLpn', () => {
    it('should pack an in_picking LPN', async () => {
      const record = makeLpnRecord({ status: 'in_picking' });
      const packed = makeLpnRecord({ status: 'in_packing' });
      lp().findUnique.mockResolvedValue(record);
      lp().update.mockResolvedValue(packed);

      const result = await packLpn('lpn-001');
      expect(result.status).toBe('in_packing');
    });

    it('should throw error when status is not in_picking', async () => {
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'stored' }));
      await expect(packLpn('lpn-001')).rejects.toThrow("Cannot pack LPN in status 'stored'. Must be 'in_picking'.");
    });
  });

  // ########################################################################
  // shipLpn  (in_packing → shipped)
  // ########################################################################

  describe('shipLpn', () => {
    it('should ship an in_packing LPN', async () => {
      const record = makeLpnRecord({ status: 'in_packing' });
      const shipped = makeLpnRecord({ status: 'shipped' });
      lp().findUnique.mockResolvedValue(record);
      lp().update.mockResolvedValue(shipped);

      const result = await shipLpn('lpn-001');
      expect(result.status).toBe('shipped');
    });

    it('should throw error when status is not in_packing', async () => {
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'stored' }));
      await expect(shipLpn('lpn-001')).rejects.toThrow("Cannot ship LPN in status 'stored'. Must be 'in_packing'.");
    });
  });

  // ########################################################################
  // dissolveLpn  (any except shipped/dissolved → dissolved)
  // ########################################################################

  describe('dissolveLpn', () => {
    it('should dissolve a created LPN', async () => {
      const record = makeLpnRecord({ status: 'created' });
      const dissolved = makeLpnRecord({ status: 'dissolved' });
      lp().findUnique.mockResolvedValue(record);
      lp().update.mockResolvedValue(dissolved);

      const result = await dissolveLpn('lpn-001');
      expect(result.status).toBe('dissolved');
    });

    it('should dissolve a stored LPN', async () => {
      const record = makeLpnRecord({ status: 'stored' });
      const dissolved = makeLpnRecord({ status: 'dissolved' });
      lp().findUnique.mockResolvedValue(record);
      lp().update.mockResolvedValue(dissolved);

      const result = await dissolveLpn('lpn-001');
      expect(result.status).toBe('dissolved');
    });

    it('should throw NotFoundError when record does not exist', async () => {
      lp().findUnique.mockResolvedValue(null);
      await expect(dissolveLpn('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when status is shipped', async () => {
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'shipped' }));
      await expect(dissolveLpn('lpn-001')).rejects.toThrow("Cannot dissolve LPN in status 'shipped'.");
    });

    it('should throw error when status is already dissolved', async () => {
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'dissolved' }));
      await expect(dissolveLpn('lpn-001')).rejects.toThrow("Cannot dissolve LPN in status 'dissolved'.");
    });
  });

  // ########################################################################
  // moveLpn
  // ########################################################################

  describe('moveLpn', () => {
    it('should update zone and bin location', async () => {
      const record = makeLpnRecord();
      const moved = makeLpnRecord({ zoneId: 'zone-002', binId: 'bin-002' });
      lp().findUnique.mockResolvedValue(record);
      lp().update.mockResolvedValue(moved);

      const result = await moveLpn('lpn-001', { zoneId: 'zone-002', binId: 'bin-002' });

      expect(lp().update).toHaveBeenCalledWith({
        where: { id: 'lpn-001' },
        data: { zoneId: 'zone-002', binId: 'bin-002' },
        include: expect.objectContaining({ warehouse: expect.any(Object) }),
      });
      expect(result).toEqual(moved);
    });

    it('should throw NotFoundError when record does not exist', async () => {
      lp().findUnique.mockResolvedValue(null);
      await expect(moveLpn('nonexistent', { zoneId: 'zone-002' })).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // addContent
  // ########################################################################

  describe('addContent', () => {
    it('should add content to an existing LPN', async () => {
      const record = makeLpnRecord();
      const content = makeContentRecord();
      lp().findUnique.mockResolvedValue(record);
      lpnContent().create.mockResolvedValue(content);

      const result = await addContent('lpn-001', { itemId: 'item-001', quantity: 100 });

      expect(lpnContent().create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          lpnId: 'lpn-001',
          itemId: 'item-001',
          quantity: 100,
        }),
        include: expect.objectContaining({
          item: expect.any(Object),
        }),
      });
      expect(result).toEqual(content);
    });

    it('should throw NotFoundError when LPN does not exist', async () => {
      lp().findUnique.mockResolvedValue(null);
      await expect(addContent('nonexistent', { itemId: 'item-001', quantity: 10 })).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // removeContent
  // ########################################################################

  describe('removeContent', () => {
    it('should remove content by id', async () => {
      const content = makeContentRecord();
      lpnContent().findUnique.mockResolvedValue(content);
      lpnContent().delete.mockResolvedValue(content);

      const result = await removeContent('content-001');

      expect(lpnContent().delete).toHaveBeenCalledWith({ where: { id: 'content-001' } });
      expect(result).toEqual(content);
    });

    it('should throw NotFoundError when content does not exist', async () => {
      lpnContent().findUnique.mockResolvedValue(null);
      await expect(removeContent('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // getStats
  // ########################################################################

  describe('getStats', () => {
    it('should return all zero stats when no records exist', async () => {
      lp().count.mockResolvedValue(0);

      const stats = await getStats();

      expect(stats).toEqual({
        created: 0,
        inReceiving: 0,
        stored: 0,
        inPicking: 0,
        inPacking: 0,
        shipped: 0,
        dissolved: 0,
      });
    });

    it('should compute correct counts by status', async () => {
      lp()
        .count.mockResolvedValueOnce(5) // created
        .mockResolvedValueOnce(3) // in_receiving
        .mockResolvedValueOnce(10) // stored
        .mockResolvedValueOnce(2) // in_picking
        .mockResolvedValueOnce(1) // in_packing
        .mockResolvedValueOnce(7) // shipped
        .mockResolvedValueOnce(4); // dissolved

      const stats = await getStats();

      expect(stats.created).toBe(5);
      expect(stats.inReceiving).toBe(3);
      expect(stats.stored).toBe(10);
      expect(stats.inPicking).toBe(2);
      expect(stats.inPacking).toBe(1);
      expect(stats.shipped).toBe(7);
      expect(stats.dissolved).toBe(4);
    });

    it('should filter by warehouseId when provided', async () => {
      lp().count.mockResolvedValue(0);

      await getStats(WH_ID);

      expect(lp().count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ warehouseId: WH_ID }),
        }),
      );
    });

    it('should not include warehouseId filter when not provided', async () => {
      lp().count.mockResolvedValue(0);

      await getStats();

      expect(lp().count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'created' }),
        }),
      );
    });
  });

  // ########################################################################
  // Full lifecycle: created → in_receiving → stored → in_picking → in_packing → shipped
  // ########################################################################

  describe('full lifecycle', () => {
    it('should transition through all happy-path states', async () => {
      // created → in_receiving
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'created' }));
      lp().update.mockResolvedValue(makeLpnRecord({ status: 'in_receiving' }));
      const r1 = await receiveLpn('lpn-001');
      expect(r1.status).toBe('in_receiving');

      // in_receiving → stored
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'in_receiving' }));
      lp().update.mockResolvedValue(makeLpnRecord({ status: 'stored' }));
      const r2 = await storeLpn('lpn-001');
      expect(r2.status).toBe('stored');

      // stored → in_picking
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'stored' }));
      lp().update.mockResolvedValue(makeLpnRecord({ status: 'in_picking' }));
      const r3 = await pickLpn('lpn-001');
      expect(r3.status).toBe('in_picking');

      // in_picking → in_packing
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'in_picking' }));
      lp().update.mockResolvedValue(makeLpnRecord({ status: 'in_packing' }));
      const r4 = await packLpn('lpn-001');
      expect(r4.status).toBe('in_packing');

      // in_packing → shipped
      lp().findUnique.mockResolvedValue(makeLpnRecord({ status: 'in_packing' }));
      lp().update.mockResolvedValue(makeLpnRecord({ status: 'shipped' }));
      const r5 = await shipLpn('lpn-001');
      expect(r5.status).toBe('shipped');
    });

    it('should allow dissolution at any non-terminal state', async () => {
      for (const status of ['created', 'in_receiving', 'stored', 'in_picking', 'in_packing']) {
        lp().findUnique.mockResolvedValue(makeLpnRecord({ status }));
        lp().update.mockResolvedValue(makeLpnRecord({ status: 'dissolved' }));

        const result = await dissolveLpn('lpn-001');
        expect(result.status).toBe('dissolved');
      }
    });
  });
});
