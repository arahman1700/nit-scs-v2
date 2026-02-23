import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

// ── Hoisted mocks ──────────────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('./document-number.service.js', () => ({
  generateDocumentNumber: vi.fn().mockResolvedValue('CC-2026-0001'),
}));
vi.mock('./audit.service.js', () => ({ createAuditLog: vi.fn().mockResolvedValue({}) }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  list,
  getById,
  createCycleCount,
  generateCountLines,
  startCount,
  recordCount,
  completeCount,
  cancelCount,
  applyAdjustments,
  autoCreateCycleCounts,
} from './cycle-count.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { createAuditLog } from './audit.service.js';

// ── Helper: create model mock with findUniqueOrThrow ────────────────────
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

// ── Fixtures ────────────────────────────────────────────────────────────
const USER_ID = 'user-001';
const WAREHOUSE_ID = 'wh-001';
const ZONE_ID = 'zone-001';
const CC_ID = 'cc-001';
const LINE_ID = 'line-001';

function makeCycleCount(overrides: Record<string, unknown> = {}) {
  return {
    id: CC_ID,
    countNumber: 'CC-2026-0001',
    countType: 'full',
    warehouseId: WAREHOUSE_ID,
    zoneId: null,
    status: 'scheduled',
    scheduledDate: new Date('2026-03-01'),
    startedAt: null,
    completedAt: null,
    createdById: USER_ID,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCountLine(overrides: Record<string, unknown> = {}) {
  return {
    id: LINE_ID,
    cycleCountId: CC_ID,
    itemId: 'item-001',
    expectedQty: 100,
    countedQty: null,
    varianceQty: null,
    variancePercent: null,
    status: 'pending',
    countedById: null,
    countedAt: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeInventoryLevel(overrides: Record<string, unknown> = {}) {
  return {
    itemId: 'item-001',
    warehouseId: WAREHOUSE_ID,
    qtyOnHand: 100,
    version: 1,
    ...overrides,
  };
}

// ── Get typed mock references ──────────────────────────────────────────
function ccMock() {
  return (mockPrisma as Record<string, unknown>).cycleCount as ReturnType<typeof createModelMock>;
}
function lineMock() {
  return (mockPrisma as Record<string, unknown>).cycleCountLine as ReturnType<typeof createModelMock>;
}

// ── Setup ───────────────────────────────────────────────────────────────
beforeEach(() => {
  // Reinitialize standard mocks
  const fresh = createPrismaMock();
  Object.assign(mockPrisma, fresh);

  // Add models not in PrismaMock
  (mockPrisma as Record<string, unknown>).cycleCount = createModelMock();
  (mockPrisma as Record<string, unknown>).cycleCountLine = createModelMock();
  (mockPrisma as Record<string, unknown>).warehouseZone = createModelMock();

  // Ensure standard models also have findUniqueOrThrow
  (mockPrisma.inventoryLevel as Record<string, unknown>).findUniqueOrThrow = vi.fn();
  (mockPrisma.warehouse as Record<string, unknown>).findUniqueOrThrow = vi.fn();
  (mockPrisma.employee as Record<string, unknown>).findUniqueOrThrow = vi.fn();

  vi.clearAllMocks();

  // Override $transaction AFTER clearAllMocks so the callback receives mockPrisma
  // (which has cycleCount/cycleCountLine) instead of the internal mock from createPrismaMock's closure
  mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// list()
// ═══════════════════════════════════════════════════════════════════════
describe('list', () => {
  it('should return paginated results with default filters', async () => {
    const items = [makeCycleCount()];
    ccMock().findMany.mockResolvedValue(items);
    ccMock().count.mockResolvedValue(1);

    const result = await list({ page: 1, pageSize: 10 });

    expect(result).toEqual({ data: items, total: 1 });
    expect(ccMock().findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('should apply status filter', async () => {
    ccMock().findMany.mockResolvedValue([]);
    ccMock().count.mockResolvedValue(0);

    await list({ page: 1, pageSize: 10, status: 'in_progress' });

    expect(ccMock().findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'in_progress' }) }),
    );
  });

  it('should apply warehouseId filter', async () => {
    ccMock().findMany.mockResolvedValue([]);
    ccMock().count.mockResolvedValue(0);

    await list({ page: 1, pageSize: 10, warehouseId: WAREHOUSE_ID });

    expect(ccMock().findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ warehouseId: WAREHOUSE_ID }) }),
    );
  });

  it('should apply search filter on countNumber', async () => {
    ccMock().findMany.mockResolvedValue([]);
    ccMock().count.mockResolvedValue(0);

    await list({ page: 1, pageSize: 10, search: 'CC-2026' });

    expect(ccMock().findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          countNumber: { contains: 'CC-2026', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('should calculate pagination offset correctly for page 3', async () => {
    ccMock().findMany.mockResolvedValue([]);
    ccMock().count.mockResolvedValue(0);

    await list({ page: 3, pageSize: 20 });

    expect(ccMock().findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
  });
});

// ═══════════════════════════════════════════════════════════════════════
// getById()
// ═══════════════════════════════════════════════════════════════════════
describe('getById', () => {
  it('should return cycle count with all relations', async () => {
    const cc = makeCycleCount();
    ccMock().findUniqueOrThrow.mockResolvedValue(cc);

    const result = await getById(CC_ID);

    expect(result).toEqual(cc);
    expect(ccMock().findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CC_ID },
        include: expect.objectContaining({
          warehouse: expect.any(Object),
          zone: expect.any(Object),
          createdBy: expect.any(Object),
          lines: expect.any(Object),
        }),
      }),
    );
  });

  it('should throw if cycle count not found', async () => {
    ccMock().findUniqueOrThrow.mockRejectedValue(new Error('Record not found'));

    await expect(getById('non-existent')).rejects.toThrow('Record not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// createCycleCount()
// ═══════════════════════════════════════════════════════════════════════
describe('createCycleCount', () => {
  it('should create a cycle count with generated document number', async () => {
    const created = makeCycleCount();
    ccMock().create.mockResolvedValue(created);

    const dto = {
      countType: 'full' as const,
      warehouseId: WAREHOUSE_ID,
      scheduledDate: '2026-03-01',
    };

    const result = await createCycleCount(dto, USER_ID);

    expect(result).toEqual(created);
    expect(generateDocumentNumber).toHaveBeenCalledWith('cycle_count');
    expect(ccMock().create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          countNumber: 'CC-2026-0001',
          countType: 'full',
          warehouseId: WAREHOUSE_ID,
          createdById: USER_ID,
          zoneId: null,
          notes: null,
        }),
      }),
    );
  });

  it('should include zoneId and notes when provided', async () => {
    ccMock().create.mockResolvedValue(makeCycleCount({ zoneId: ZONE_ID, notes: 'Test note' }));

    const dto = {
      countType: 'zone' as const,
      warehouseId: WAREHOUSE_ID,
      zoneId: ZONE_ID,
      scheduledDate: '2026-03-01',
      notes: 'Test note',
    };

    await createCycleCount(dto, USER_ID);

    expect(ccMock().create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          zoneId: ZONE_ID,
          notes: 'Test note',
        }),
      }),
    );
  });

  it('should create an audit log entry', async () => {
    ccMock().create.mockResolvedValue(makeCycleCount());

    await createCycleCount({ countType: 'full', warehouseId: WAREHOUSE_ID, scheduledDate: '2026-03-01' }, USER_ID);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'cycle_counts',
        action: 'create',
        performedById: USER_ID,
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// generateCountLines()
// ═══════════════════════════════════════════════════════════════════════
describe('generateCountLines', () => {
  it('should throw if status is not scheduled', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));

    await expect(generateCountLines(CC_ID, USER_ID)).rejects.toThrow(
      'Can only generate lines for scheduled cycle counts',
    );
  });

  it('should delete existing lines before regenerating', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ countType: 'full' }));
    mockPrisma.inventoryLevel.findMany.mockResolvedValue([makeInventoryLevel()]);
    lineMock().createMany.mockResolvedValue({ count: 1 });
    lineMock().deleteMany.mockResolvedValue({ count: 0 });

    await generateCountLines(CC_ID, USER_ID);

    expect(lineMock().deleteMany).toHaveBeenCalledWith({ where: { cycleCountId: CC_ID } });
  });

  describe('count type: full', () => {
    it('should fetch all inventory levels for the warehouse', async () => {
      ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ countType: 'full' }));
      const levels = [
        makeInventoryLevel({ itemId: 'item-001', qtyOnHand: 100 }),
        makeInventoryLevel({ itemId: 'item-002', qtyOnHand: 200 }),
      ];
      mockPrisma.inventoryLevel.findMany.mockResolvedValue(levels);
      lineMock().createMany.mockResolvedValue({ count: 2 });
      lineMock().deleteMany.mockResolvedValue({ count: 0 });

      const result = await generateCountLines(CC_ID, USER_ID);

      expect(result).toEqual({ lineCount: 2 });
      expect(mockPrisma.inventoryLevel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { warehouseId: WAREHOUSE_ID },
        }),
      );
    });
  });

  describe('count type: abc_based', () => {
    it('should fetch only Class A items', async () => {
      ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ countType: 'abc_based' }));
      const levels = [makeInventoryLevel({ itemId: 'item-A1' })];
      mockPrisma.inventoryLevel.findMany.mockResolvedValue(levels);
      lineMock().createMany.mockResolvedValue({ count: 1 });
      lineMock().deleteMany.mockResolvedValue({ count: 0 });

      await generateCountLines(CC_ID, USER_ID);

      expect(mockPrisma.inventoryLevel.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            warehouseId: WAREHOUSE_ID,
            item: { abcClass: 'A' },
          },
        }),
      );
    });
  });

  describe('count type: zone', () => {
    it('should throw if zoneId is missing', async () => {
      ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ countType: 'zone', zoneId: null }));
      lineMock().deleteMany.mockResolvedValue({ count: 0 });

      await expect(generateCountLines(CC_ID, USER_ID)).rejects.toThrow('Zone-based count requires a zone ID');
    });

    it('should fetch warehouse inventory when zoneId is present', async () => {
      ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ countType: 'zone', zoneId: ZONE_ID }));
      mockPrisma.inventoryLevel.findMany.mockResolvedValue([makeInventoryLevel()]);
      lineMock().createMany.mockResolvedValue({ count: 1 });
      lineMock().deleteMany.mockResolvedValue({ count: 0 });

      const result = await generateCountLines(CC_ID, USER_ID);

      expect(result).toEqual({ lineCount: 1 });
    });
  });

  describe('count type: random', () => {
    it('should select ~20% of items (at least 1)', async () => {
      ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ countType: 'random' }));
      const levels = Array.from({ length: 10 }, (_, i) =>
        makeInventoryLevel({ itemId: `item-${i}`, qtyOnHand: (i + 1) * 10 }),
      );
      mockPrisma.inventoryLevel.findMany.mockResolvedValue(levels);
      lineMock().createMany.mockResolvedValue({ count: 2 });
      lineMock().deleteMany.mockResolvedValue({ count: 0 });

      await generateCountLines(CC_ID, USER_ID);

      // createMany is called with data array of length ceil(10*0.2) = 2
      const callData = lineMock().createMany.mock.calls[0][0].data;
      expect(callData).toHaveLength(2);
    });

    it('should select at least 1 item even for small inventories', async () => {
      ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ countType: 'random' }));
      mockPrisma.inventoryLevel.findMany.mockResolvedValue([makeInventoryLevel()]);
      lineMock().createMany.mockResolvedValue({ count: 1 });
      lineMock().deleteMany.mockResolvedValue({ count: 0 });

      await generateCountLines(CC_ID, USER_ID);

      const callData = lineMock().createMany.mock.calls[0][0].data;
      expect(callData).toHaveLength(1);
    });
  });

  it('should throw if no inventory items found', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ countType: 'full' }));
    mockPrisma.inventoryLevel.findMany.mockResolvedValue([]);
    lineMock().deleteMany.mockResolvedValue({ count: 0 });

    await expect(generateCountLines(CC_ID, USER_ID)).rejects.toThrow(
      'No inventory items found for the specified criteria',
    );
  });

  it('should create audit log after generating lines', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ countType: 'full' }));
    mockPrisma.inventoryLevel.findMany.mockResolvedValue([makeInventoryLevel()]);
    lineMock().createMany.mockResolvedValue({ count: 1 });
    lineMock().deleteMany.mockResolvedValue({ count: 0 });

    await generateCountLines(CC_ID, USER_ID);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'cycle_counts',
        recordId: CC_ID,
        action: 'update',
        newValues: expect.objectContaining({ action: 'generate_lines', lineCount: 1 }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// startCount()
// ═══════════════════════════════════════════════════════════════════════
describe('startCount', () => {
  it('should transition status from scheduled to in_progress', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'scheduled' }));
    lineMock().count.mockResolvedValue(5);
    const updated = makeCycleCount({ status: 'in_progress', startedAt: new Date() });
    ccMock().update.mockResolvedValue(updated);

    const result = await startCount(CC_ID, USER_ID);

    expect(result.status).toBe('in_progress');
    expect(ccMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CC_ID },
        data: expect.objectContaining({ status: 'in_progress' }),
      }),
    );
  });

  it('should throw if status is not scheduled', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));

    await expect(startCount(CC_ID, USER_ID)).rejects.toThrow('Can only start a scheduled cycle count');
  });

  it('should throw if no lines exist', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'scheduled' }));
    lineMock().count.mockResolvedValue(0);

    await expect(startCount(CC_ID, USER_ID)).rejects.toThrow('Generate count lines before starting');
  });

  it('should create audit log on start', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'scheduled' }));
    lineMock().count.mockResolvedValue(3);
    ccMock().update.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));

    await startCount(CC_ID, USER_ID);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValues: { status: 'scheduled' },
        newValues: expect.objectContaining({ status: 'in_progress' }),
        performedById: USER_ID,
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// recordCount()
// ═══════════════════════════════════════════════════════════════════════
describe('recordCount', () => {
  it('should record counted quantity and calculate positive variance', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine({ expectedQty: 100 }),
      cycleCount: makeCycleCount({ status: 'in_progress' }),
    });
    const updatedLine = makeCountLine({
      countedQty: 110,
      varianceQty: 10,
      variancePercent: 10,
      status: 'counted',
    });
    lineMock().update.mockResolvedValue(updatedLine);

    const result = await recordCount(LINE_ID, 110, USER_ID);

    expect(result).toEqual(updatedLine);
    expect(lineMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          countedQty: 110,
          varianceQty: 10,
          variancePercent: 10,
          status: 'counted',
          countedById: USER_ID,
        }),
      }),
    );
  });

  it('should calculate negative variance', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine({ expectedQty: 200 }),
      cycleCount: makeCycleCount({ status: 'in_progress' }),
    });
    lineMock().update.mockResolvedValue(makeCountLine());

    await recordCount(LINE_ID, 180, USER_ID);

    expect(lineMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          countedQty: 180,
          varianceQty: -20,
          variancePercent: -10,
        }),
      }),
    );
  });

  it('should calculate zero variance when counts match', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine({ expectedQty: 50 }),
      cycleCount: makeCycleCount({ status: 'in_progress' }),
    });
    lineMock().update.mockResolvedValue(makeCountLine());

    await recordCount(LINE_ID, 50, USER_ID);

    expect(lineMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          countedQty: 50,
          varianceQty: 0,
          variancePercent: 0,
        }),
      }),
    );
  });

  it('should handle expectedQty=0 with non-zero counted (100% variance)', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine({ expectedQty: 0 }),
      cycleCount: makeCycleCount({ status: 'in_progress' }),
    });
    lineMock().update.mockResolvedValue(makeCountLine());

    await recordCount(LINE_ID, 5, USER_ID);

    expect(lineMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          varianceQty: 5,
          variancePercent: 100,
        }),
      }),
    );
  });

  it('should handle both expected and counted as 0 (0% variance)', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine({ expectedQty: 0 }),
      cycleCount: makeCycleCount({ status: 'in_progress' }),
    });
    lineMock().update.mockResolvedValue(makeCountLine());

    await recordCount(LINE_ID, 0, USER_ID);

    expect(lineMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          varianceQty: 0,
          variancePercent: 0,
        }),
      }),
    );
  });

  it('should round variance percent to 2 decimal places', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine({ expectedQty: 300 }),
      cycleCount: makeCycleCount({ status: 'in_progress' }),
    });
    lineMock().update.mockResolvedValue(makeCountLine());

    // 310 / 300 = 3.33...%
    await recordCount(LINE_ID, 310, USER_ID);

    expect(lineMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          variancePercent: 3.33,
        }),
      }),
    );
  });

  it('should throw if cycle count is not in_progress', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine(),
      cycleCount: makeCycleCount({ status: 'scheduled' }),
    });

    await expect(recordCount(LINE_ID, 100, USER_ID)).rejects.toThrow(
      'Cycle count must be in progress to record counts',
    );
  });

  it('should store notes when provided', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine({ expectedQty: 100 }),
      cycleCount: makeCycleCount({ status: 'in_progress' }),
    });
    lineMock().update.mockResolvedValue(makeCountLine());

    await recordCount(LINE_ID, 100, USER_ID, 'Recount done');

    expect(lineMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: 'Recount done' }),
      }),
    );
  });

  it('should set notes to null when not provided', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine({ expectedQty: 100 }),
      cycleCount: makeCycleCount({ status: 'in_progress' }),
    });
    lineMock().update.mockResolvedValue(makeCountLine());

    await recordCount(LINE_ID, 100, USER_ID);

    expect(lineMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notes: null }),
      }),
    );
  });

  it('should create audit log for recording', async () => {
    lineMock().findUniqueOrThrow.mockResolvedValue({
      ...makeCountLine({ expectedQty: 100 }),
      cycleCount: makeCycleCount({ status: 'in_progress' }),
    });
    lineMock().update.mockResolvedValue(makeCountLine());

    await recordCount(LINE_ID, 95, USER_ID);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'cycle_count_lines',
        recordId: LINE_ID,
        action: 'update',
        newValues: expect.objectContaining({ countedQty: 95, status: 'counted' }),
        performedById: USER_ID,
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// completeCount()
// ═══════════════════════════════════════════════════════════════════════
describe('completeCount', () => {
  it('should transition from in_progress to completed', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));
    lineMock().count.mockResolvedValue(0); // 0 pending lines
    const updated = makeCycleCount({ status: 'completed', completedAt: new Date() });
    ccMock().update.mockResolvedValue(updated);

    const result = await completeCount(CC_ID, USER_ID);

    expect(result.status).toBe('completed');
    expect(ccMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('should throw if status is not in_progress', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'scheduled' }));

    await expect(completeCount(CC_ID, USER_ID)).rejects.toThrow('Can only complete an in-progress cycle count');
  });

  it('should throw if pending lines remain', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));
    lineMock().count.mockResolvedValue(3);

    await expect(completeCount(CC_ID, USER_ID)).rejects.toThrow('3 line(s) still pending');
  });

  it('should create audit log on completion', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));
    lineMock().count.mockResolvedValue(0);
    ccMock().update.mockResolvedValue(makeCycleCount({ status: 'completed' }));

    await completeCount(CC_ID, USER_ID);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValues: { status: 'in_progress' },
        newValues: expect.objectContaining({ status: 'completed' }),
        performedById: USER_ID,
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// cancelCount()
// ═══════════════════════════════════════════════════════════════════════
describe('cancelCount', () => {
  it('should cancel a scheduled cycle count', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'scheduled' }));
    const updated = makeCycleCount({ status: 'cancelled' });
    ccMock().update.mockResolvedValue(updated);

    const result = await cancelCount(CC_ID, USER_ID);

    expect(result.status).toBe('cancelled');
  });

  it('should cancel an in_progress cycle count', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));
    ccMock().update.mockResolvedValue(makeCycleCount({ status: 'cancelled' }));

    const result = await cancelCount(CC_ID, USER_ID);

    expect(result.status).toBe('cancelled');
  });

  it('should throw when cancelling a completed count', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'completed' }));

    await expect(cancelCount(CC_ID, USER_ID)).rejects.toThrow(
      'Cannot cancel a completed or already cancelled cycle count',
    );
  });

  it('should throw when cancelling an already cancelled count', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'cancelled' }));

    await expect(cancelCount(CC_ID, USER_ID)).rejects.toThrow(
      'Cannot cancel a completed or already cancelled cycle count',
    );
  });

  it('should record the old status in the audit log', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));
    ccMock().update.mockResolvedValue(makeCycleCount({ status: 'cancelled' }));

    await cancelCount(CC_ID, USER_ID);

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        oldValues: { status: 'in_progress' },
        newValues: { status: 'cancelled' },
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// applyAdjustments()
// ═══════════════════════════════════════════════════════════════════════
describe('applyAdjustments', () => {
  it('should throw if cycle count is not completed', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'in_progress', lines: [] }));

    await expect(applyAdjustments(CC_ID, USER_ID)).rejects.toThrow(
      'Can only apply adjustments to completed cycle counts',
    );
  });

  it('should adjust inventory and mark lines as adjusted', async () => {
    const lines = [
      makeCountLine({
        id: 'line-1',
        itemId: 'item-001',
        countedQty: 90,
        varianceQty: -10,
        status: 'counted',
      }),
    ];
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'completed', lines }));
    mockPrisma.inventoryLevel.findUnique.mockResolvedValue(makeInventoryLevel({ qtyOnHand: 100 }));
    mockPrisma.inventoryLevel.update.mockResolvedValue(makeInventoryLevel({ qtyOnHand: 90 }));
    lineMock().update.mockResolvedValue(makeCountLine({ status: 'adjusted' }));

    const result = await applyAdjustments(CC_ID, USER_ID);

    expect(result).toEqual({ adjustedCount: 1 });
    // Inventory update uses counted quantity
    expect(mockPrisma.inventoryLevel.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          qtyOnHand: 90,
          version: { increment: 1 },
        }),
      }),
    );
    // Line marked as adjusted
    expect(lineMock().update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'line-1' },
        data: { status: 'adjusted' },
      }),
    );
  });

  it('should skip lines with zero variance', async () => {
    const lines = [makeCountLine({ id: 'line-z', varianceQty: 0, countedQty: 100, status: 'counted' })];
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'completed', lines }));

    const result = await applyAdjustments(CC_ID, USER_ID);

    expect(result).toEqual({ adjustedCount: 0 });
    expect(mockPrisma.inventoryLevel.update).not.toHaveBeenCalled();
  });

  it('should skip lines with null variance', async () => {
    const lines = [makeCountLine({ id: 'line-n', varianceQty: null, countedQty: 100, status: 'counted' })];
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'completed', lines }));

    const result = await applyAdjustments(CC_ID, USER_ID);

    expect(result).toEqual({ adjustedCount: 0 });
  });

  it('should skip if inventory level not found', async () => {
    const lines = [
      makeCountLine({
        id: 'line-nf',
        itemId: 'item-missing',
        varianceQty: -5,
        countedQty: 95,
        status: 'counted',
      }),
    ];
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'completed', lines }));
    mockPrisma.inventoryLevel.findUnique.mockResolvedValue(null);

    const result = await applyAdjustments(CC_ID, USER_ID);

    expect(result).toEqual({ adjustedCount: 0 });
    expect(mockPrisma.inventoryLevel.update).not.toHaveBeenCalled();
  });

  it('should adjust multiple lines in a single transaction', async () => {
    const lines = [
      makeCountLine({
        id: 'line-a',
        itemId: 'item-001',
        countedQty: 90,
        varianceQty: -10,
        status: 'counted',
      }),
      makeCountLine({
        id: 'line-b',
        itemId: 'item-002',
        countedQty: 55,
        varianceQty: 5,
        status: 'counted',
      }),
    ];
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'completed', lines }));
    mockPrisma.inventoryLevel.findUnique.mockResolvedValue(makeInventoryLevel());
    mockPrisma.inventoryLevel.update.mockResolvedValue(makeInventoryLevel());
    lineMock().update.mockResolvedValue(makeCountLine({ status: 'adjusted' }));

    const result = await applyAdjustments(CC_ID, USER_ID);

    expect(result).toEqual({ adjustedCount: 2 });
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });

  it('should create audit logs for each adjusted line and the overall count', async () => {
    const lines = [
      makeCountLine({
        id: 'line-al',
        itemId: 'item-001',
        countedQty: 80,
        varianceQty: -20,
        status: 'counted',
      }),
    ];
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'completed', lines }));
    mockPrisma.inventoryLevel.findUnique.mockResolvedValue(makeInventoryLevel({ qtyOnHand: 100 }));
    mockPrisma.inventoryLevel.update.mockResolvedValue(makeInventoryLevel({ qtyOnHand: 80 }));
    lineMock().update.mockResolvedValue(makeCountLine({ status: 'adjusted' }));

    await applyAdjustments(CC_ID, USER_ID);

    // Per-line audit log (inventory_levels)
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'inventory_levels',
        action: 'update',
        oldValues: { qtyOnHand: 100 },
        newValues: expect.objectContaining({
          reason: 'cycle_count_adjustment',
          cycleCountId: CC_ID,
        }),
      }),
    );
    // Overall audit log (cycle_counts)
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        tableName: 'cycle_counts',
        recordId: CC_ID,
        newValues: expect.objectContaining({ action: 'apply_adjustments', adjustedLines: 1 }),
      }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════
// autoCreateCycleCounts()
// ═══════════════════════════════════════════════════════════════════════
describe('autoCreateCycleCounts', () => {
  const ADMIN_ID = 'admin-001';

  beforeEach(() => {
    mockPrisma.warehouse.findMany.mockResolvedValue([{ id: WAREHOUSE_ID, warehouseCode: 'WH-01' }]);
    mockPrisma.employee.findFirst.mockResolvedValue({ id: ADMIN_ID });
  });

  it('should create weekly abc_based count when Class A items exist and no existing count', async () => {
    mockPrisma.inventoryLevel.count
      .mockResolvedValueOnce(10) // Class A items > 0
      .mockResolvedValueOnce(0) // Class B (for monthly check)
      .mockResolvedValueOnce(0); // Class C (for quarterly check)
    ccMock().findFirst.mockResolvedValue(null); // no existing count this week

    await autoCreateCycleCounts();

    expect(ccMock().create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          countType: 'abc_based',
          warehouseId: WAREHOUSE_ID,
          createdById: ADMIN_ID,
          notes: expect.stringContaining('Weekly ABC'),
        }),
      }),
    );
  });

  it('should NOT create weekly count if one already exists this week', async () => {
    mockPrisma.inventoryLevel.count
      .mockResolvedValueOnce(10) // Class A items > 0
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);
    ccMock().findFirst.mockResolvedValue(makeCycleCount()); // existing count found

    await autoCreateCycleCounts();

    expect(ccMock().create).not.toHaveBeenCalled();
  });

  it('should NOT create weekly count if no Class A items', async () => {
    mockPrisma.inventoryLevel.count
      .mockResolvedValueOnce(0) // no Class A
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    await autoCreateCycleCounts();

    expect(ccMock().create).not.toHaveBeenCalled();
  });

  it('should create monthly random count on first day of month for Class B items', async () => {
    // Force "today" to be the 1st day of a non-quarter month (e.g., Feb 1)
    const firstOfFeb = new Date(2026, 1, 1);
    vi.useFakeTimers();
    vi.setSystemTime(firstOfFeb);

    mockPrisma.inventoryLevel.count
      .mockResolvedValueOnce(0) // no Class A
      .mockResolvedValueOnce(5) // Class B > 0
      .mockResolvedValueOnce(0); // no Class C

    await autoCreateCycleCounts();

    expect(ccMock().create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          countType: 'random',
          notes: expect.stringContaining('Monthly Class B'),
        }),
      }),
    );

    vi.useRealTimers();
  });

  it('should create quarterly full count on first day of quarter for Class C items', async () => {
    // Force today to be Jan 1 (quarter start, month index 0)
    const jan1 = new Date(2026, 0, 1);
    vi.useFakeTimers();
    vi.setSystemTime(jan1);

    mockPrisma.inventoryLevel.count
      .mockResolvedValueOnce(0) // no Class A
      .mockResolvedValueOnce(0) // no Class B (still first day, but 0 items)
      .mockResolvedValueOnce(8); // Class C > 0

    await autoCreateCycleCounts();

    expect(ccMock().create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          countType: 'full',
          notes: expect.stringContaining('Quarterly full count'),
        }),
      }),
    );

    vi.useRealTimers();
  });

  it('should process multiple warehouses', async () => {
    mockPrisma.warehouse.findMany.mockResolvedValue([
      { id: 'wh-1', warehouseCode: 'WH-01' },
      { id: 'wh-2', warehouseCode: 'WH-02' },
    ]);
    mockPrisma.inventoryLevel.count.mockResolvedValue(5); // always has items
    ccMock().findFirst.mockResolvedValue(null); // no existing counts

    await autoCreateCycleCounts();

    // Should create for both warehouses (at least abc_based for each)
    expect(ccMock().create).toHaveBeenCalledTimes(2);
  });

  it('should do nothing if no active warehouses', async () => {
    mockPrisma.warehouse.findMany.mockResolvedValue([]);

    await autoCreateCycleCounts();

    expect(ccMock().create).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Full State Machine (integration-style)
// ═══════════════════════════════════════════════════════════════════════
describe('state machine: full lifecycle', () => {
  it('should follow scheduled -> in_progress -> completed flow', async () => {
    // 1. Start: scheduled -> in_progress
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'scheduled' }));
    lineMock().count.mockResolvedValue(5);
    ccMock().update.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));

    const started = await startCount(CC_ID, USER_ID);
    expect(started.status).toBe('in_progress');

    // 2. Complete: in_progress -> completed
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'in_progress' }));
    lineMock().count.mockResolvedValue(0); // all lines counted
    ccMock().update.mockResolvedValue(makeCycleCount({ status: 'completed' }));

    const completed = await completeCount(CC_ID, USER_ID);
    expect(completed.status).toBe('completed');
  });

  it('should not allow skipping from scheduled to completed', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'scheduled' }));

    await expect(completeCount(CC_ID, USER_ID)).rejects.toThrow('Can only complete an in-progress cycle count');
  });

  it('should not allow restarting a completed count', async () => {
    ccMock().findUniqueOrThrow.mockResolvedValue(makeCycleCount({ status: 'completed' }));

    await expect(startCount(CC_ID, USER_ID)).rejects.toThrow('Can only start a scheduled cycle count');
  });
});
