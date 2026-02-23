import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { globalSearch } from './search.service.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID_1 = '11111111-1111-1111-1111-111111111111';
const UUID_2 = '22222222-2222-2222-2222-222222222222';

const now = new Date('2026-02-20T12:00:00.000Z');
const earlier = new Date('2026-02-19T12:00:00.000Z');
const earliest = new Date('2026-02-18T12:00:00.000Z');

function makeGrn(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_1,
    mrrvNumber: 'GRN-2026-0001',
    status: 'received',
    createdAt: now,
    ...overrides,
  };
}

function makeShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: UUID_2,
    shipmentNumber: 'SHP-2026-0001',
    poNumber: 'PO-12345',
    status: 'in_transit',
    createdAt: earlier,
    ...overrides,
  };
}

/** Set all 15 models to return empty arrays by default */
function stubAllModelsEmpty() {
  const models = [
    'mrrv',
    'mirv',
    'mrv',
    'materialRequisition',
    'rfim',
    'osdReport',
    'jobOrder',
    'gatePass',
    'shipment',
    'imsf',
    'stockTransfer',
    'scrapItem',
    'surplusItem',
    'storekeeperHandover',
    'toolIssue',
  ] as const;
  for (const model of models) {
    (mockPrisma as Record<string, { findMany: ReturnType<typeof vi.fn> }>)[model].findMany.mockResolvedValue([]);
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('search.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    stubAllModelsEmpty();
  });

  // -------------------------------------------------------------------------
  // Basic search
  // -------------------------------------------------------------------------
  describe('basic text search', () => {
    it('should search across all models with text fields and return matching results', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([makeGrn()]);

      const results = await globalSearch('GRN-2026');

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: 'grn',
        id: UUID_1,
        number: 'GRN-2026-0001',
        status: 'received',
        summary: 'GRN GRN-2026-0001',
        createdAt: now,
      });
    });

    it('should build OR conditions with contains + insensitive mode', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);

      await globalSearch('test-query');

      expect(mockPrisma.mrrv.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ mrrvNumber: { contains: 'test-query', mode: 'insensitive' } }],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should build multiple OR conditions for types with multiple searchFields', async () => {
      mockPrisma.jobOrder.findMany.mockResolvedValue([]);

      await globalSearch('JO-001');

      expect(mockPrisma.jobOrder.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { joNumber: { contains: 'JO-001', mode: 'insensitive' } },
            { description: { contains: 'JO-001', mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should search shipment by both shipmentNumber and poNumber fields', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([makeShipment()]);

      await globalSearch('PO-12345');

      expect(mockPrisma.shipment.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { shipmentNumber: { contains: 'PO-12345', mode: 'insensitive' } },
            { poNumber: { contains: 'PO-12345', mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      expect(mockPrisma.shipment.findMany).toHaveReturnedWith(expect.any(Promise));
    });
  });

  // -------------------------------------------------------------------------
  // UUID search
  // -------------------------------------------------------------------------
  describe('UUID search', () => {
    it('should add id condition when query is a valid UUID', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([makeGrn({ id: UUID_1 })]);

      await globalSearch(UUID_1);

      expect(mockPrisma.mrrv.findMany).toHaveBeenCalledWith({
        where: {
          OR: [{ mrrvNumber: { contains: UUID_1, mode: 'insensitive' } }, { id: UUID_1 }],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should include types with no searchFields (handover, tool-issue) when query is UUID', async () => {
      const handoverRecord = { id: UUID_1, status: 'completed', createdAt: now };
      mockPrisma.storekeeperHandover.findMany.mockResolvedValue([handoverRecord]);

      const results = await globalSearch(UUID_1);

      expect(mockPrisma.storekeeperHandover.findMany).toHaveBeenCalledWith({
        where: { OR: [{ id: UUID_1 }] },
        take: 5,
        orderBy: { createdAt: 'desc' },
      });
      const handoverResult = results.find(r => r.type === 'handover');
      expect(handoverResult).toBeDefined();
      expect(handoverResult!.number).toBe(UUID_1.slice(0, 8));
      expect(handoverResult!.summary).toBe(`Handover ${UUID_1.slice(0, 8)}`);
    });

    it('should NOT include handover/tool-issue for non-UUID queries', async () => {
      await globalSearch('some-text');

      expect(mockPrisma.storekeeperHandover.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.toolIssue.findMany).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Types with null numberField
  // -------------------------------------------------------------------------
  describe('null numberField handling', () => {
    it('should use id prefix as display number when numberField is null', async () => {
      const id = 'abcdef01-2222-3333-4444-555555555555';
      mockPrisma.storekeeperHandover.findMany.mockResolvedValue([{ id, status: 'pending', createdAt: now }]);

      const results = await globalSearch(id);

      const handover = results.find(r => r.type === 'handover');
      expect(handover).toBeDefined();
      expect(handover!.number).toBe('abcdef01');
    });

    it('should use id prefix when numberField value is undefined', async () => {
      const id = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
      mockPrisma.mrrv.findMany.mockResolvedValue([{ id, mrrvNumber: undefined, status: 'draft', createdAt: now }]);

      const results = await globalSearch(id);

      const grn = results.find(r => r.type === 'grn');
      expect(grn).toBeDefined();
      expect(grn!.number).toBe('aaaaaaaa');
    });
  });

  // -------------------------------------------------------------------------
  // Filtering by types
  // -------------------------------------------------------------------------
  describe('type filtering', () => {
    it('should only search specified types when filters.types is provided', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([makeGrn()]);

      const results = await globalSearch('GRN', { types: ['grn'] });

      expect(mockPrisma.mrrv.findMany).toHaveBeenCalled();
      expect(mockPrisma.mirv.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.jobOrder.findMany).not.toHaveBeenCalled();
      expect(mockPrisma.shipment.findMany).not.toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('grn');
    });

    it('should support filtering to multiple types', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([makeGrn()]);
      mockPrisma.shipment.findMany.mockResolvedValue([makeShipment()]);

      const results = await globalSearch('test', { types: ['grn', 'shipment'] });

      expect(mockPrisma.mrrv.findMany).toHaveBeenCalled();
      expect(mockPrisma.shipment.findMany).toHaveBeenCalled();
      expect(mockPrisma.mirv.findMany).not.toHaveBeenCalled();
      expect(results).toHaveLength(2);
    });

    it('should return empty results when filtering to types with no match', async () => {
      const results = await globalSearch('nonexistent', { types: ['grn'] });

      expect(results).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Sorting
  // -------------------------------------------------------------------------
  describe('sorting', () => {
    it('should sort results by createdAt descending across types', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        makeGrn({ id: 'a1a1a1a1-0000-0000-0000-000000000000', createdAt: earliest }),
      ]);
      mockPrisma.shipment.findMany.mockResolvedValue([
        makeShipment({ id: 'b2b2b2b2-0000-0000-0000-000000000000', createdAt: now }),
      ]);
      mockPrisma.jobOrder.findMany.mockResolvedValue([
        {
          id: 'c3c3c3c3-0000-0000-0000-000000000000',
          joNumber: 'JO-2026-0001',
          description: 'Test',
          status: 'open',
          createdAt: earlier,
        },
      ]);

      const results = await globalSearch('2026');

      expect(results[0].createdAt).toEqual(now);
      expect(results[1].createdAt).toEqual(earlier);
      expect(results[2].createdAt).toEqual(earliest);
    });
  });

  // -------------------------------------------------------------------------
  // Limit
  // -------------------------------------------------------------------------
  describe('limit', () => {
    it('should default total limit to 50', async () => {
      const records = Array.from({ length: 5 }, (_, i) =>
        makeGrn({
          id: `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`,
          mrrvNumber: `GRN-2026-${String(i).padStart(4, '0')}`,
          createdAt: new Date(now.getTime() - i * 60000),
        }),
      );
      // 13 types with searchFields * 5 records each = 65, should be capped at 50
      const models = [
        'mrrv',
        'mirv',
        'mrv',
        'materialRequisition',
        'rfim',
        'osdReport',
        'jobOrder',
        'gatePass',
        'shipment',
        'imsf',
        'stockTransfer',
        'scrapItem',
        'surplusItem',
      ] as const;
      for (const model of models) {
        (mockPrisma as Record<string, { findMany: ReturnType<typeof vi.fn> }>)[model].findMany.mockResolvedValue(
          records,
        );
      }

      const results = await globalSearch('GRN');

      expect(results.length).toBeLessThanOrEqual(50);
    });

    it('should respect custom limit from filters', async () => {
      const records = Array.from({ length: 5 }, (_, i) =>
        makeGrn({
          id: `${String(i).padStart(8, '0')}-0000-0000-0000-000000000000`,
          createdAt: new Date(now.getTime() - i * 60000),
        }),
      );
      mockPrisma.mrrv.findMany.mockResolvedValue(records);
      mockPrisma.mirv.findMany.mockResolvedValue(records);

      const results = await globalSearch('test', { limit: 3 });

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should limit to 5 per type via take parameter', async () => {
      await globalSearch('test');

      expect(mockPrisma.mrrv.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
      expect(mockPrisma.mirv.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
    });
  });

  // -------------------------------------------------------------------------
  // Result shape
  // -------------------------------------------------------------------------
  describe('result shape', () => {
    it('should return correct SearchResult structure for each type', async () => {
      mockPrisma.materialRequisition.findMany.mockResolvedValue([
        {
          id: UUID_1,
          mrfNumber: 'MR-2026-0100',
          status: 'pending',
          createdAt: now,
        },
      ]);

      const results = await globalSearch('MR-2026', { types: ['mr'] });

      expect(results).toEqual([
        {
          type: 'mr',
          id: UUID_1,
          number: 'MR-2026-0100',
          status: 'pending',
          summary: 'Material Requisition MR-2026-0100',
          createdAt: now,
        },
      ]);
    });

    it('should use TYPE_LABELS for summary generation', async () => {
      mockPrisma.osdReport.findMany.mockResolvedValue([
        {
          id: UUID_1,
          osdNumber: 'DR-2026-0001',
          status: 'open',
          createdAt: now,
        },
      ]);

      const results = await globalSearch('DR', { types: ['dr'] });

      expect(results[0].summary).toBe('Discrepancy Report DR-2026-0001');
    });

    it('should fall back to "unknown" when statusField is missing', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: UUID_1,
          mrrvNumber: 'GRN-2026-0001',
          createdAt: now,
          // no status field
        },
      ]);

      const results = await globalSearch('GRN', { types: ['grn'] });

      expect(results[0].status).toBe('unknown');
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------
  describe('error handling', () => {
    it('should gracefully handle model findMany throwing an error', async () => {
      mockPrisma.mrrv.findMany.mockRejectedValue(new Error('Table does not exist'));
      mockPrisma.mirv.findMany.mockResolvedValue([
        {
          id: UUID_1,
          mirvNumber: 'MI-2026-0001',
          status: 'issued',
          createdAt: now,
        },
      ]);

      const results = await globalSearch('2026');

      // mrrv failed but mirv succeeded — no throw, results from mirv present
      const grnResults = results.filter(r => r.type === 'grn');
      const miResults = results.filter(r => r.type === 'mi');
      expect(grnResults).toHaveLength(0);
      expect(miResults).toHaveLength(1);
    });

    it('should return empty array when all models fail', async () => {
      const models = [
        'mrrv',
        'mirv',
        'mrv',
        'materialRequisition',
        'rfim',
        'osdReport',
        'jobOrder',
        'gatePass',
        'shipment',
        'imsf',
        'stockTransfer',
        'scrapItem',
        'surplusItem',
      ] as const;
      for (const model of models) {
        (mockPrisma as Record<string, { findMany: ReturnType<typeof vi.fn> }>)[model].findMany.mockRejectedValue(
          new Error('DB down'),
        );
      }

      const results = await globalSearch('test');

      expect(results).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // All 15 definitions coverage
  // -------------------------------------------------------------------------
  describe('all document types', () => {
    it('should search all 13 types with searchFields for non-UUID queries', async () => {
      await globalSearch('test');

      // These 13 have searchFields and should be queried
      expect(mockPrisma.mrrv.findMany).toHaveBeenCalled();
      expect(mockPrisma.mirv.findMany).toHaveBeenCalled();
      expect(mockPrisma.mrv.findMany).toHaveBeenCalled();
      expect(mockPrisma.materialRequisition.findMany).toHaveBeenCalled();
      expect(mockPrisma.rfim.findMany).toHaveBeenCalled();
      expect(mockPrisma.osdReport.findMany).toHaveBeenCalled();
      expect(mockPrisma.jobOrder.findMany).toHaveBeenCalled();
      expect(mockPrisma.gatePass.findMany).toHaveBeenCalled();
      expect(mockPrisma.shipment.findMany).toHaveBeenCalled();
      expect(mockPrisma.imsf.findMany).toHaveBeenCalled();
      expect(mockPrisma.stockTransfer.findMany).toHaveBeenCalled();
      expect(mockPrisma.scrapItem.findMany).toHaveBeenCalled();
      expect(mockPrisma.surplusItem.findMany).toHaveBeenCalled();
    });

    it('should search all 15 types when query is a UUID', async () => {
      await globalSearch(UUID_1);

      // All 15 including handover and tool-issue
      expect(mockPrisma.mrrv.findMany).toHaveBeenCalled();
      expect(mockPrisma.mirv.findMany).toHaveBeenCalled();
      expect(mockPrisma.mrv.findMany).toHaveBeenCalled();
      expect(mockPrisma.materialRequisition.findMany).toHaveBeenCalled();
      expect(mockPrisma.rfim.findMany).toHaveBeenCalled();
      expect(mockPrisma.osdReport.findMany).toHaveBeenCalled();
      expect(mockPrisma.jobOrder.findMany).toHaveBeenCalled();
      expect(mockPrisma.gatePass.findMany).toHaveBeenCalled();
      expect(mockPrisma.shipment.findMany).toHaveBeenCalled();
      expect(mockPrisma.imsf.findMany).toHaveBeenCalled();
      expect(mockPrisma.stockTransfer.findMany).toHaveBeenCalled();
      expect(mockPrisma.scrapItem.findMany).toHaveBeenCalled();
      expect(mockPrisma.surplusItem.findMany).toHaveBeenCalled();
      expect(mockPrisma.storekeeperHandover.findMany).toHaveBeenCalled();
      expect(mockPrisma.toolIssue.findMany).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Edge cases
  // -------------------------------------------------------------------------
  describe('edge cases', () => {
    it('should return empty array when no models match', async () => {
      const results = await globalSearch('zzz-no-match');

      expect(results).toEqual([]);
    });

    it('should handle empty filters.types gracefully (searches all)', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([makeGrn()]);

      const results = await globalSearch('GRN', { types: [] });

      // Empty types array is falsy-length, so should search all
      expect(mockPrisma.mrrv.findMany).toHaveBeenCalled();
      expect(mockPrisma.mirv.findMany).toHaveBeenCalled();
      expect(results).toHaveLength(1);
    });

    it('should handle results from multiple types combined and sorted', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([makeGrn({ createdAt: earliest })]);
      mockPrisma.rfim.findMany.mockResolvedValue([
        {
          id: UUID_2,
          rfimNumber: 'QCI-2026-0001',
          status: 'inspecting',
          createdAt: now,
        },
      ]);
      mockPrisma.osdReport.findMany.mockResolvedValue([
        {
          id: 'dddddddd-0000-0000-0000-000000000000',
          osdNumber: 'DR-2026-0001',
          status: 'open',
          createdAt: earlier,
        },
      ]);

      const results = await globalSearch('2026');

      expect(results.length).toBe(3);
      expect(results[0].type).toBe('qci');
      expect(results[1].type).toBe('dr');
      expect(results[2].type).toBe('grn');
    });

    it('should treat uppercase UUID correctly', async () => {
      const uppercaseUuid = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE';

      await globalSearch(uppercaseUuid);

      // UUID regex uses /i flag, so uppercase should still be recognized as UUID
      expect(mockPrisma.storekeeperHandover.findMany).toHaveBeenCalled();
      expect(mockPrisma.toolIssue.findMany).toHaveBeenCalled();
    });
  });
});
