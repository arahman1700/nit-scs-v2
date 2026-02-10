import type { PrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, create, update, decommission } from './tool.service.js';
import { generateDocumentNumber } from './document-number.service.js';

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';

function makeTool(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tool-1',
    toolCode: 'TOOL-001',
    toolName: 'Power Drill',
    category: 'power_tools',
    serialNumber: 'SN-12345',
    condition: 'good',
    warehouseId: 'wh-1',
    purchaseDate: new Date('2025-01-15'),
    warrantyExpiry: new Date('2026-01-15'),
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

describe('tool.service', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('should return data and total', async () => {
      const rows = [makeTool()];
      mockPrisma.tool.findMany.mockResolvedValue(rows);
      mockPrisma.tool.count.mockResolvedValue(1);

      const result = await list(baseListParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause on toolCode and toolName', async () => {
      mockPrisma.tool.findMany.mockResolvedValue([]);
      mockPrisma.tool.count.mockResolvedValue(0);

      await list({ ...baseListParams, search: 'drill' });

      const where = mockPrisma.tool.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(2);
      expect(where.OR[0]).toEqual({
        toolCode: { contains: 'drill', mode: 'insensitive' },
      });
      expect(where.OR[1]).toEqual({
        toolName: { contains: 'drill', mode: 'insensitive' },
      });
    });

    it('should apply condition filter', async () => {
      mockPrisma.tool.findMany.mockResolvedValue([]);
      mockPrisma.tool.count.mockResolvedValue(0);

      await list({ ...baseListParams, condition: 'good' });

      const where = mockPrisma.tool.findMany.mock.calls[0][0].where;
      expect(where.condition).toBe('good');
    });

    it('should apply warehouseId filter', async () => {
      mockPrisma.tool.findMany.mockResolvedValue([]);
      mockPrisma.tool.count.mockResolvedValue(0);

      await list({ ...baseListParams, warehouseId: 'wh-1' });

      const where = mockPrisma.tool.findMany.mock.calls[0][0].where;
      expect(where.warehouseId).toBe('wh-1');
    });

    it('should apply category filter', async () => {
      mockPrisma.tool.findMany.mockResolvedValue([]);
      mockPrisma.tool.count.mockResolvedValue(0);

      await list({ ...baseListParams, category: 'power_tools' });

      const where = mockPrisma.tool.findMany.mock.calls[0][0].where;
      expect(where.category).toBe('power_tools');
    });

    it('should pass pagination to findMany', async () => {
      mockPrisma.tool.findMany.mockResolvedValue([]);
      mockPrisma.tool.count.mockResolvedValue(0);

      await list({ ...baseListParams, skip: 10, pageSize: 5 });

      const args = mockPrisma.tool.findMany.mock.calls[0][0];
      expect(args.skip).toBe(10);
      expect(args.take).toBe(5);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the tool when found', async () => {
      const tool = makeTool();
      mockPrisma.tool.findUnique.mockResolvedValue(tool);

      const result = await getById('tool-1');

      expect(result).toEqual(tool);
      expect(mockPrisma.tool.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tool-1' } }));
    });

    it('should throw NotFoundError when tool not found', async () => {
      mockPrisma.tool.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const data = {
      toolName: 'Power Drill',
      category: 'power_tools',
      serialNumber: 'SN-12345',
      warehouseId: 'wh-1',
    };

    it('should generate tool code via generateDocumentNumber', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('TOOL-001');
      mockPrisma.tool.create.mockResolvedValue(makeTool());

      await create(data as any, USER_ID);

      expect(generateDocumentNumber).toHaveBeenCalledWith('tool');
    });

    it('should set condition to good and use generated toolCode', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('TOOL-002');
      mockPrisma.tool.create.mockResolvedValue(makeTool({ toolCode: 'TOOL-002' }));

      const result = await create(data as any, USER_ID);

      const createArgs = mockPrisma.tool.create.mock.calls[0][0];
      expect(createArgs.data.condition).toBe('good');
      expect(createArgs.data.toolCode).toBe('TOOL-002');
      expect(createArgs.data.toolName).toBe('Power Drill');
      expect(result.toolCode).toBe('TOOL-002');
    });

    it('should handle optional fields', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('TOOL-003');
      mockPrisma.tool.create.mockResolvedValue(makeTool());

      await create({ toolName: 'Basic Tool' } as any, USER_ID);

      const createArgs = mockPrisma.tool.create.mock.calls[0][0];
      expect(createArgs.data.category).toBeNull();
      expect(createArgs.data.serialNumber).toBeNull();
      expect(createArgs.data.warehouseId).toBeNull();
      expect(createArgs.data.purchaseDate).toBeNull();
      expect(createArgs.data.warrantyExpiry).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should return existing and updated when found', async () => {
      const existing = makeTool();
      const updated = makeTool({ toolName: 'Updated Drill' });
      mockPrisma.tool.findUnique.mockResolvedValue(existing);
      mockPrisma.tool.update.mockResolvedValue(updated);

      const result = await update('tool-1', { toolName: 'Updated Drill' } as any);

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when tool not found', async () => {
      mockPrisma.tool.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {} as any)).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // decommission
  // ─────────────────────────────────────────────────────────────────────────
  describe('decommission', () => {
    it('should set condition to decommissioned when tool is active', async () => {
      const existing = makeTool({ condition: 'good' });
      mockPrisma.tool.findUnique.mockResolvedValue(existing);
      mockPrisma.tool.update.mockResolvedValue({ ...existing, condition: 'decommissioned' });

      const result = await decommission('tool-1');

      expect(result.condition).toBe('decommissioned');
      expect(mockPrisma.tool.update).toHaveBeenCalledWith({
        where: { id: 'tool-1' },
        data: { condition: 'decommissioned' },
      });
    });

    it('should throw NotFoundError when tool not found', async () => {
      mockPrisma.tool.findUnique.mockResolvedValue(null);

      await expect(decommission('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when tool is already decommissioned', async () => {
      const existing = makeTool({ condition: 'decommissioned' });
      mockPrisma.tool.findUnique.mockResolvedValue(existing);

      await expect(decommission('tool-1')).rejects.toThrow('Tool is already decommissioned');
    });
  });
});
