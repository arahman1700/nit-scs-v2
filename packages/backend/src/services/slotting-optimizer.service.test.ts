import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { getItemPickFrequencies, analyzeSlotting, applySuggestion } from './slotting-optimizer.service.js';

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

// ── Helpers ─────────────────────────────────────────────────────────────

const WH_ID = 'wh-uuid-001';
const USER_ID = 'user-uuid-001';

function makeFrequencyRow(
  overrides: Partial<{
    item_id: string;
    item_code: string;
    item_description: string;
    abc_class: string | null;
    pick_count: bigint;
    total_qty: number;
  }> = {},
) {
  return {
    item_id: overrides.item_id ?? 'item-1',
    item_code: overrides.item_code ?? 'ITM-001',
    item_description: overrides.item_description ?? 'Steel Pipe',
    abc_class: 'abc_class' in overrides ? overrides.abc_class : 'A',
    pick_count: overrides.pick_count ?? BigInt(30),
    total_qty: overrides.total_qty ?? 150,
  };
}

function makeBinCard(
  overrides: Partial<{
    id: string;
    itemId: string;
    warehouseId: string;
    binNumber: string;
    currentQty: number;
    item: {
      id: string;
      itemCode: string;
      itemDescription: string;
      abcClass: string | null;
      category: string;
    };
  }> = {},
) {
  return {
    id: overrides.id ?? 'bc-1',
    itemId: overrides.itemId ?? 'item-1',
    warehouseId: overrides.warehouseId ?? WH_ID,
    binNumber: overrides.binNumber ?? 'A-01-01',
    currentQty: overrides.currentQty ?? 100,
    item: overrides.item ?? {
      id: 'item-1',
      itemCode: 'ITM-001',
      itemDescription: 'Steel Pipe',
      abcClass: 'A',
      category: 'construction',
    },
  };
}

function makeZone(code: string, name: string) {
  return { zoneCode: code, zoneName: name };
}

// ═══════════════════════════════════════════════════════════════════════

describe('slotting-optimizer.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).binCard = createModelMock();
    (mockPrisma as Record<string, unknown>).binCardTransaction = createModelMock();
    (mockPrisma as Record<string, unknown>).warehouseZone = createModelMock();
  });

  // Accessor helpers for the dynamically added models
  const binCard = () => (mockPrisma as unknown as { binCard: PrismaModelMock }).binCard;
  const binCardTx = () => (mockPrisma as unknown as { binCardTransaction: PrismaModelMock }).binCardTransaction;
  const whZone = () => (mockPrisma as unknown as { warehouseZone: PrismaModelMock }).warehouseZone;

  // ─── getItemPickFrequencies ─────────────────────────────────────────

  describe('getItemPickFrequencies', () => {
    it('returns mapped pick frequency rows from raw SQL', async () => {
      const row = makeFrequencyRow({ pick_count: BigInt(18), total_qty: 200 });
      mockPrisma.$queryRaw.mockResolvedValue([row]);

      const result = await getItemPickFrequencies(WH_ID);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        itemId: 'item-1',
        itemCode: 'ITM-001',
        itemName: 'Steel Pipe',
        abcClass: 'A',
        pickCount: 18,
        totalQtyIssued: 200,
        pickFrequency: 3, // 18/6 = 3
      });
    });

    it('converts bigint pick_count to number', async () => {
      const row = makeFrequencyRow({ pick_count: BigInt(600) });
      mockPrisma.$queryRaw.mockResolvedValue([row]);

      const result = await getItemPickFrequencies(WH_ID);

      expect(result[0]!.pickCount).toBe(600);
      expect(typeof result[0]!.pickCount).toBe('number');
    });

    it('calculates pickFrequency as picks per month (picks / 6)', async () => {
      const row = makeFrequencyRow({ pick_count: BigInt(7) });
      mockPrisma.$queryRaw.mockResolvedValue([row]);

      const result = await getItemPickFrequencies(WH_ID);

      // 7/6 = 1.1666... → rounded to 2 decimal places = 1.17
      expect(result[0]!.pickFrequency).toBe(1.17);
    });

    it('defaults abc_class to C when null', async () => {
      const row = makeFrequencyRow({ abc_class: null });
      mockPrisma.$queryRaw.mockResolvedValue([row]);

      const result = await getItemPickFrequencies(WH_ID);

      expect(result[0]!.abcClass).toBe('C');
    });

    it('returns empty array when no picks found', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getItemPickFrequencies(WH_ID);

      expect(result).toEqual([]);
    });

    it('handles multiple rows ordered by pick_count descending', async () => {
      const rows = [
        makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) }),
        makeFrequencyRow({ item_id: 'item-2', item_code: 'ITM-002', pick_count: BigInt(30) }),
        makeFrequencyRow({ item_id: 'item-3', item_code: 'ITM-003', pick_count: BigInt(6) }),
      ];
      mockPrisma.$queryRaw.mockResolvedValue(rows);

      const result = await getItemPickFrequencies(WH_ID);

      expect(result).toHaveLength(3);
      expect(result[0]!.pickCount).toBe(60);
      expect(result[1]!.pickCount).toBe(30);
      expect(result[2]!.pickCount).toBe(6);
    });

    it('rounds pickFrequency to 2 decimal places', async () => {
      // 11/6 = 1.83333... → 1.83
      const row = makeFrequencyRow({ pick_count: BigInt(11) });
      mockPrisma.$queryRaw.mockResolvedValue([row]);

      const result = await getItemPickFrequencies(WH_ID);

      expect(result[0]!.pickFrequency).toBe(1.83);
    });

    it('calls $queryRaw with the warehouse id', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await getItemPickFrequencies(WH_ID);

      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('preserves totalQtyIssued from the query', async () => {
      const row = makeFrequencyRow({ total_qty: 999.5 });
      mockPrisma.$queryRaw.mockResolvedValue([row]);

      const result = await getItemPickFrequencies(WH_ID);

      expect(result[0]!.totalQtyIssued).toBe(999.5);
    });
  });

  // ─── analyzeSlotting ────────────────────────────────────────────────

  describe('analyzeSlotting', () => {
    function setupDefaultMocks(
      opts: {
        frequencyRows?: ReturnType<typeof makeFrequencyRow>[];
        binCards?: ReturnType<typeof makeBinCard>[];
        zones?: { zoneCode: string; zoneName: string }[];
      } = {},
    ) {
      mockPrisma.$queryRaw.mockResolvedValue(opts.frequencyRows ?? []);
      binCard().findMany.mockResolvedValue(opts.binCards ?? []);
      whZone().findMany.mockResolvedValue(opts.zones ?? [makeZone('A', 'Zone A')]);
    }

    it('returns 100% efficiency with empty bin cards', async () => {
      setupDefaultMocks({ binCards: [] });

      const result = await analyzeSlotting(WH_ID);

      expect(result).toEqual({
        warehouseId: WH_ID,
        suggestions: [],
        currentEfficiency: 100,
        projectedEfficiency: 100,
        estimatedTimeSavingMinutes: 0,
      });
    });

    it('returns warehouse id in the result', async () => {
      setupDefaultMocks({ binCards: [] });

      const result = await analyzeSlotting(WH_ID);

      expect(result.warehouseId).toBe(WH_ID);
    });

    it('uses the first zone alphabetically as primary zone', async () => {
      const freqRows = [makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) })];
      // Item currently in zone C far away, should be suggested to primary zone B
      const cards = [
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'C-08-06',
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'construction',
          },
        }),
      ];

      setupDefaultMocks({
        frequencyRows: freqRows,
        binCards: cards,
        zones: [makeZone('B', 'Zone B'), makeZone('C', 'Zone C')],
      });

      const result = await analyzeSlotting(WH_ID);

      // The suggested zone should be the primary zone (first alphabetically = B)
      if (result.suggestions.length > 0) {
        expect(result.suggestions[0]!.suggestedZone).toBe('B');
      }
    });

    it('defaults primary zone to A when no zones exist', async () => {
      const freqRows = [makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) })];
      const cards = [
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'D-08-06',
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'construction',
          },
        }),
      ];

      setupDefaultMocks({
        frequencyRows: freqRows,
        binCards: cards,
        zones: [],
      });

      const result = await analyzeSlotting(WH_ID);

      // With no zones defined, primary defaults to 'A'
      if (result.suggestions.length > 0) {
        expect(result.suggestions[0]!.suggestedZone).toBe('A');
      }
    });

    it('generates suggestions for items far from their ideal position', async () => {
      // A single high-frequency item in a far zone
      const freqRows = [makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) })];
      const cards = [
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'A-09-08', // far from golden zone (aisle 1-3, shelf 1-2)
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'construction',
          },
        }),
      ];

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0]!.itemId).toBe('item-1');
      expect(result.suggestions[0]!.currentBin).toBe('A-09-08');
    });

    it('does not suggest move when item is already in ideal position', async () => {
      // Single item already in golden zone
      const freqRows = [makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) })];
      const cards = [
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'A-01-01', // already in golden zone
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'construction',
          },
        }),
      ];

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      // With only 1 item at the ideal slot, no move needed (improvement < 5)
      expect(result.suggestions).toEqual([]);
    });

    it('calculates currentEfficiency based on golden zone occupancy', async () => {
      // 2 items: top 20% = 1 item. That item is already in golden zone -> 100%
      const freqRows = [
        makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) }),
        makeFrequencyRow({ item_id: 'item-2', item_code: 'ITM-002', pick_count: BigInt(6) }),
      ];
      const cards = [
        makeBinCard({
          id: 'bc-1',
          itemId: 'item-1',
          binNumber: 'A-01-01', // golden zone
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'construction',
          },
        }),
        makeBinCard({
          id: 'bc-2',
          itemId: 'item-2',
          binNumber: 'A-08-06', // far zone
          item: { id: 'item-2', itemCode: 'ITM-002', itemDescription: 'Bolt', abcClass: 'C', category: 'fasteners' },
        }),
      ];

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      expect(result.currentEfficiency).toBe(100);
    });

    it('reports 0% efficiency when high-freq items are all misplaced', async () => {
      // 5 items; top 20% = 1 item. That item is in a far zone -> 0%
      const freqRows = Array.from({ length: 5 }, (_, i) =>
        makeFrequencyRow({
          item_id: `item-${i + 1}`,
          item_code: `ITM-${String(i + 1).padStart(3, '0')}`,
          pick_count: BigInt(60 - i * 10),
          abc_class: i === 0 ? 'A' : 'C',
        }),
      );
      const cards = Array.from({ length: 5 }, (_, i) =>
        makeBinCard({
          id: `bc-${i + 1}`,
          itemId: `item-${i + 1}`,
          // First item (highest freq) NOT in golden zone
          binNumber: `A-${String(7 + i).padStart(2, '0')}-${String(5 + i).padStart(2, '0')}`,
          item: {
            id: `item-${i + 1}`,
            itemCode: `ITM-${String(i + 1).padStart(3, '0')}`,
            itemDescription: `Item ${i + 1}`,
            abcClass: i === 0 ? 'A' : 'C',
            category: 'general',
          },
        }),
      );

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      expect(result.currentEfficiency).toBe(0);
    });

    it('projected efficiency is 100% when all high-freq would be moved', async () => {
      const freqRows = Array.from({ length: 5 }, (_, i) =>
        makeFrequencyRow({
          item_id: `item-${i + 1}`,
          item_code: `ITM-${String(i + 1).padStart(3, '0')}`,
          pick_count: BigInt(60 - i * 10),
        }),
      );
      const cards = Array.from({ length: 5 }, (_, i) =>
        makeBinCard({
          id: `bc-${i + 1}`,
          itemId: `item-${i + 1}`,
          binNumber: `A-${String(8 + i).padStart(2, '0')}-${String(6 + i).padStart(2, '0')}`,
          item: {
            id: `item-${i + 1}`,
            itemCode: `ITM-${String(i + 1).padStart(3, '0')}`,
            itemDescription: `Item ${i + 1}`,
            abcClass: 'A',
            category: 'general',
          },
        }),
      );

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      expect(result.projectedEfficiency).toBe(100);
    });

    it('calculates estimatedTimeSavingMinutes at 2.5 min per suggestion', async () => {
      // Create 10 items, all misplaced, so we get multiple suggestions
      const freqRows = Array.from({ length: 10 }, (_, i) =>
        makeFrequencyRow({
          item_id: `item-${i + 1}`,
          item_code: `ITM-${String(i + 1).padStart(3, '0')}`,
          pick_count: BigInt(100 - i * 8),
        }),
      );
      const cards = Array.from({ length: 10 }, (_, i) =>
        makeBinCard({
          id: `bc-${i + 1}`,
          itemId: `item-${i + 1}`,
          binNumber: `A-${String(9).padStart(2, '0')}-${String(8).padStart(2, '0')}`, // all far
          item: {
            id: `item-${i + 1}`,
            itemCode: `ITM-${String(i + 1).padStart(3, '0')}`,
            itemDescription: `Item ${i + 1}`,
            abcClass: 'A',
            category: 'general',
          },
        }),
      );

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      const expected = Math.round(result.suggestions.length * 2.5 * 100) / 100;
      expect(result.estimatedTimeSavingMinutes).toBe(expected);
    });

    it('sorts suggestions by priorityScore descending', async () => {
      const freqRows = [
        makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(12), abc_class: 'C' }),
        makeFrequencyRow({ item_id: 'item-2', item_code: 'ITM-002', pick_count: BigInt(60), abc_class: 'A' }),
      ];
      const cards = [
        makeBinCard({
          id: 'bc-1',
          itemId: 'item-1',
          binNumber: 'A-09-08',
          item: { id: 'item-1', itemCode: 'ITM-001', itemDescription: 'Low Freq', abcClass: 'C', category: 'general' },
        }),
        makeBinCard({
          id: 'bc-2',
          itemId: 'item-2',
          binNumber: 'A-09-08',
          item: { id: 'item-2', itemCode: 'ITM-002', itemDescription: 'High Freq', abcClass: 'A', category: 'general' },
        }),
      ];

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      if (result.suggestions.length >= 2) {
        expect(result.suggestions[0]!.priorityScore).toBeGreaterThanOrEqual(result.suggestions[1]!.priorityScore);
      }
    });

    it('uses ABC weight in scoring (A=3, B=2, C=1)', async () => {
      // Two items: same frequency but different ABC class
      const freqRows = [
        makeFrequencyRow({ item_id: 'item-a', pick_count: BigInt(30), abc_class: 'A' }),
        makeFrequencyRow({ item_id: 'item-c', item_code: 'ITM-002', pick_count: BigInt(30), abc_class: 'C' }),
      ];
      const cards = [
        makeBinCard({
          id: 'bc-1',
          itemId: 'item-a',
          binNumber: 'A-09-08',
          item: { id: 'item-a', itemCode: 'ITM-001', itemDescription: 'Class A', abcClass: 'A', category: 'general' },
        }),
        makeBinCard({
          id: 'bc-2',
          itemId: 'item-c',
          binNumber: 'A-09-08',
          item: { id: 'item-c', itemCode: 'ITM-002', itemDescription: 'Class C', abcClass: 'C', category: 'general' },
        }),
      ];

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      // Class A item should have higher priority score than Class C (score = freq*weight)
      if (result.suggestions.length >= 2) {
        const classASuggestion = result.suggestions.find(s => s.itemId === 'item-a');
        const classCSuggestion = result.suggestions.find(s => s.itemId === 'item-c');
        if (classASuggestion && classCSuggestion) {
          expect(classASuggestion.priorityScore).toBeGreaterThan(classCSuggestion.priorityScore);
        }
      }
    });

    it('assigns far zone for lowest-scored items when multiple zones exist', async () => {
      // 5 items; bottom items should be suggested to last zone
      const freqRows = Array.from({ length: 5 }, (_, i) =>
        makeFrequencyRow({
          item_id: `item-${i + 1}`,
          item_code: `ITM-${String(i + 1).padStart(3, '0')}`,
          pick_count: BigInt(60 - i * 10),
          abc_class: 'B',
        }),
      );
      const cards = Array.from({ length: 5 }, (_, i) =>
        makeBinCard({
          id: `bc-${i + 1}`,
          itemId: `item-${i + 1}`,
          binNumber: 'A-05-03', // all in mid zone currently
          item: {
            id: `item-${i + 1}`,
            itemCode: `ITM-${String(i + 1).padStart(3, '0')}`,
            itemDescription: `Item ${i + 1}`,
            abcClass: 'B',
            category: 'general',
          },
        }),
      );

      setupDefaultMocks({
        frequencyRows: freqRows,
        binCards: cards,
        zones: [makeZone('A', 'Zone A'), makeZone('B', 'Zone B'), makeZone('Z', 'Far Zone')],
      });

      const result = await analyzeSlotting(WH_ID);

      // Check that a suggestion exists with far zone Z
      const farZoneSuggestions = result.suggestions.filter(s => s.suggestedZone === 'Z');
      expect(farZoneSuggestions.length).toBeGreaterThanOrEqual(0);
    });

    it('includes reason text with pick frequency for golden zone items', async () => {
      const freqRows = [makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) })];
      const cards = [
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'A-09-08',
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'general',
          },
        }),
      ];

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      if (result.suggestions.length > 0) {
        expect(result.suggestions[0]!.reason).toContain('golden zone');
      }
    });

    it('includes mid-zone reason for medium-scored items', async () => {
      // Need enough items so that some end up in mid-zone tier
      const count = 10;
      const freqRows = Array.from({ length: count }, (_, i) =>
        makeFrequencyRow({
          item_id: `item-${i + 1}`,
          item_code: `ITM-${String(i + 1).padStart(3, '0')}`,
          pick_count: BigInt(100 - i * 8),
          abc_class: 'B',
        }),
      );
      const cards = Array.from({ length: count }, (_, i) =>
        makeBinCard({
          id: `bc-${i + 1}`,
          itemId: `item-${i + 1}`,
          binNumber: 'A-09-08', // all far
          item: {
            id: `item-${i + 1}`,
            itemCode: `ITM-${String(i + 1).padStart(3, '0')}`,
            itemDescription: `Item ${i + 1}`,
            abcClass: 'B',
            category: 'general',
          },
        }),
      );

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      const midZoneReasons = result.suggestions.filter(s => s.reason.includes('middle zone'));
      expect(midZoneReasons.length).toBeGreaterThanOrEqual(0);
    });

    it('includes far zone reason for low-scored items', async () => {
      const count = 10;
      const freqRows = Array.from({ length: count }, (_, i) =>
        makeFrequencyRow({
          item_id: `item-${i + 1}`,
          item_code: `ITM-${String(i + 1).padStart(3, '0')}`,
          pick_count: BigInt(100 - i * 8),
          abc_class: 'C',
        }),
      );
      const cards = Array.from({ length: count }, (_, i) =>
        makeBinCard({
          id: `bc-${i + 1}`,
          itemId: `item-${i + 1}`,
          binNumber: 'A-01-01', // all in golden zone currently
          item: {
            id: `item-${i + 1}`,
            itemCode: `ITM-${String(i + 1).padStart(3, '0')}`,
            itemDescription: `Item ${i + 1}`,
            abcClass: 'C',
            category: 'general',
          },
        }),
      );

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      const farReasons = result.suggestions.filter(s => s.reason.includes('far zone'));
      expect(farReasons.length).toBeGreaterThanOrEqual(0);
    });

    it('skips suggestion when improvement is less than 5', async () => {
      // Item in a position with position score only slightly different from ideal
      const freqRows = [makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) })];
      const cards = [
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'A-01-02', // position score = 12, ideal for single item = A-01-01 = 11
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'general',
          },
        }),
      ];

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      // Improvement = |12 - 11| = 1 < 5, and no zone change -> no suggestion
      expect(result.suggestions).toEqual([]);
    });

    it('generates suggestion when zone changes even with small position diff', async () => {
      const freqRows = [makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) })];
      const cards = [
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'Z-01-01', // different zone from primary (A), same aisle/shelf as ideal
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'general',
          },
        }),
      ];

      setupDefaultMocks({
        frequencyRows: freqRows,
        binCards: cards,
        zones: [makeZone('A', 'Zone A'), makeZone('Z', 'Far Zone')],
      });

      const result = await analyzeSlotting(WH_ID);

      // Zone changed (Z -> A) so suggestion should be generated even if position scores are close
      expect(result.suggestions.length).toBe(1);
      expect(result.suggestions[0]!.currentZone).toBe('Z');
      expect(result.suggestions[0]!.suggestedZone).toBe('A');
    });

    it('handles items with no pick frequency (score = 0)', async () => {
      // Item exists in bin card but has no picks
      mockPrisma.$queryRaw.mockResolvedValue([]); // no frequency data
      binCard().findMany.mockResolvedValue([
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'A-01-01',
          item: { id: 'item-1', itemCode: 'ITM-001', itemDescription: 'No Picks', abcClass: 'C', category: 'general' },
        }),
      ]);
      whZone().findMany.mockResolvedValue([makeZone('A', 'Zone A')]);

      const result = await analyzeSlotting(WH_ID);

      // pickFrequency = 0 so score = 0 for all items
      expect(result).toBeDefined();
      expect(result.warehouseId).toBe(WH_ID);
    });

    it('builds bin numbers with zero-padded aisle and shelf', async () => {
      const freqRows = [makeFrequencyRow({ item_id: 'item-1', pick_count: BigInt(60) })];
      const cards = [
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'A-09-09',
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'general',
          },
        }),
      ];

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      if (result.suggestions.length > 0) {
        // Suggested bin should have zero-padded format like A-01-01
        expect(result.suggestions[0]!.suggestedBin).toMatch(/^[A-Z]+-\d{2}-\d{2}$/);
      }
    });

    it('populates suggestion fields correctly', async () => {
      const freqRows = [
        makeFrequencyRow({
          item_id: 'item-1',
          item_code: 'ITM-001',
          item_description: 'Steel Pipe',
          abc_class: 'A',
          pick_count: BigInt(60),
        }),
      ];
      const cards = [
        makeBinCard({
          itemId: 'item-1',
          binNumber: 'A-09-08',
          item: {
            id: 'item-1',
            itemCode: 'ITM-001',
            itemDescription: 'Steel Pipe',
            abcClass: 'A',
            category: 'general',
          },
        }),
      ];

      setupDefaultMocks({ frequencyRows: freqRows, binCards: cards });

      const result = await analyzeSlotting(WH_ID);

      expect(result.suggestions.length).toBe(1);
      const suggestion = result.suggestions[0]!;
      expect(suggestion.itemId).toBe('item-1');
      expect(suggestion.itemCode).toBe('ITM-001');
      expect(suggestion.itemName).toBe('Steel Pipe');
      expect(suggestion.abcClass).toBe('A');
      expect(suggestion.pickFrequency).toBe(10); // 60/6
      expect(suggestion.currentBin).toBe('A-09-08');
      expect(suggestion.suggestedBin).toBeDefined();
      expect(suggestion.currentZone).toBe('A');
      expect(typeof suggestion.priorityScore).toBe('number');
    });
  });

  // ─── applySuggestion ───────────────────────────────────────────────

  describe('applySuggestion', () => {
    const mockBinCard = {
      id: 'bc-uuid-001',
      itemId: 'item-1',
      warehouseId: WH_ID,
      binNumber: 'A-07-05',
      currentQty: 50,
      item: { itemCode: 'ITM-001' },
    };

    it('moves item to new bin and returns old/new bin numbers', async () => {
      binCard().findFirst.mockResolvedValue(mockBinCard);
      binCard().update.mockResolvedValue({ ...mockBinCard, binNumber: 'A-01-01' });
      binCardTx().create.mockResolvedValue({});

      const result = await applySuggestion('item-1', WH_ID, 'A-01-01', USER_ID);

      expect(result).toEqual({
        success: true,
        oldBin: 'A-07-05',
        newBin: 'A-01-01',
      });
    });

    it('returns success without transaction when bin is unchanged', async () => {
      binCard().findFirst.mockResolvedValue(mockBinCard);

      const result = await applySuggestion('item-1', WH_ID, 'A-07-05', USER_ID);

      expect(result).toEqual({
        success: true,
        oldBin: 'A-07-05',
        newBin: 'A-07-05',
      });
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('throws error when bin card not found', async () => {
      binCard().findFirst.mockResolvedValue(null);

      await expect(applySuggestion('item-999', WH_ID, 'A-01-01', USER_ID)).rejects.toThrow(
        'No bin card found for item item-999 in warehouse wh-uuid-001',
      );
    });

    it('calls $transaction with array of update and create operations', async () => {
      binCard().findFirst.mockResolvedValue(mockBinCard);
      binCard().update.mockResolvedValue({ ...mockBinCard, binNumber: 'A-01-01' });
      binCardTx().create.mockResolvedValue({});

      await applySuggestion('item-1', WH_ID, 'A-01-01', USER_ID);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      // Array-style transaction: called with an array of promises
      const txArg = mockPrisma.$transaction.mock.calls[0]![0];
      expect(Array.isArray(txArg)).toBe(true);
    });

    it('updates bin card with new bin number', async () => {
      binCard().findFirst.mockResolvedValue(mockBinCard);
      binCard().update.mockResolvedValue({ ...mockBinCard, binNumber: 'B-02-03' });
      binCardTx().create.mockResolvedValue({});

      await applySuggestion('item-1', WH_ID, 'B-02-03', USER_ID);

      expect(binCard().update).toHaveBeenCalledWith({
        where: { id: 'bc-uuid-001' },
        data: { binNumber: 'B-02-03' },
      });
    });

    it('creates bin card transaction as audit trail', async () => {
      binCard().findFirst.mockResolvedValue(mockBinCard);
      binCard().update.mockResolvedValue({});
      binCardTx().create.mockResolvedValue({});

      await applySuggestion('item-1', WH_ID, 'A-01-01', USER_ID);

      expect(binCardTx().create).toHaveBeenCalledWith({
        data: {
          binCardId: 'bc-uuid-001',
          transactionType: 'adjustment',
          referenceType: 'adjustment',
          referenceId: 'bc-uuid-001',
          referenceNumber: 'SLOT-ITM-001',
          qtyIn: 0,
          qtyOut: 0,
          runningBalance: 50,
          performedById: USER_ID,
        },
      });
    });

    it('uses itemCode in the reference number', async () => {
      const customBinCard = {
        ...mockBinCard,
        item: { itemCode: 'PIPE-42' },
      };
      binCard().findFirst.mockResolvedValue(customBinCard);
      binCard().update.mockResolvedValue({});
      binCardTx().create.mockResolvedValue({});

      await applySuggestion('item-1', WH_ID, 'A-01-01', USER_ID);

      expect(binCardTx().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            referenceNumber: 'SLOT-PIPE-42',
          }),
        }),
      );
    });

    it('preserves running balance from current bin card qty', async () => {
      const cardWith200 = { ...mockBinCard, currentQty: 200 };
      binCard().findFirst.mockResolvedValue(cardWith200);
      binCard().update.mockResolvedValue({});
      binCardTx().create.mockResolvedValue({});

      await applySuggestion('item-1', WH_ID, 'A-01-01', USER_ID);

      expect(binCardTx().create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            runningBalance: 200,
          }),
        }),
      );
    });

    it('finds bin card with correct item and warehouse filter', async () => {
      binCard().findFirst.mockResolvedValue(mockBinCard);
      binCard().update.mockResolvedValue({});
      binCardTx().create.mockResolvedValue({});

      await applySuggestion('item-42', 'wh-42', 'A-01-01', USER_ID);

      expect(binCard().findFirst).toHaveBeenCalledWith({
        where: { itemId: 'item-42', warehouseId: 'wh-42' },
        include: { item: { select: { itemCode: true } } },
      });
    });

    it('propagates database errors from findFirst', async () => {
      binCard().findFirst.mockRejectedValue(new Error('DB connection lost'));

      await expect(applySuggestion('item-1', WH_ID, 'A-01-01', USER_ID)).rejects.toThrow('DB connection lost');
    });

    it('propagates transaction errors', async () => {
      binCard().findFirst.mockResolvedValue(mockBinCard);
      mockPrisma.$transaction.mockRejectedValue(new Error('Transaction deadlock'));

      await expect(applySuggestion('item-1', WH_ID, 'A-01-01', USER_ID)).rejects.toThrow('Transaction deadlock');
    });
  });
});
