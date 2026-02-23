import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import {
  suggestPutAwayLocation,
  listRules,
  getRuleById,
  createRule,
  updateRule,
  deleteRule,
} from './putaway-rules.service.js';

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

describe('putaway-rules.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    // Add missing models
    (mockPrisma as Record<string, unknown>).putAwayRule = createModelMock();
    (mockPrisma as Record<string, unknown>).warehouseZone = createModelMock();
  });

  // ---------------------------------------------------------------------------
  // suggestPutAwayLocation
  // ---------------------------------------------------------------------------
  describe('suggestPutAwayLocation', () => {
    const mockItem = {
      id: 'item-1',
      itemCode: 'ITM-001',
      itemDescription: 'Steel Pipe',
      category: 'construction',
    };

    const mockZone1 = {
      id: 'zone-1',
      zoneName: 'Construction Zone',
      zoneCode: 'CZ-01',
      zoneType: 'storage',
      capacity: 100,
      currentOccupancy: 50,
    };

    const mockZone2 = {
      id: 'zone-2',
      zoneName: 'Safety Equipment Zone',
      zoneCode: 'SZ-01',
      zoneType: 'hazardous',
      capacity: 50,
      currentOccupancy: 10,
    };

    const mockZone3 = {
      id: 'zone-3',
      zoneName: 'General Storage',
      zoneCode: 'GS-01',
      zoneType: 'storage',
      capacity: 200,
      currentOccupancy: 100,
    };

    it('should throw NotFoundError if item does not exist', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(null);

      await expect(suggestPutAwayLocation('item-1', 'warehouse-1')).rejects.toThrow(
        new NotFoundError('Item', 'item-1'),
      );

      expect(mockPrisma.item.findUnique).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });

    it('should return category match suggestions with high confidence', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-1',
          itemCategory: 'construction',
          isHazardous: false,
          isActive: true,
          priority: 1,
          targetZone: mockZone1,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([mockZone1, mockZone3]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0]).toEqual({
        zoneId: 'zone-1',
        zoneName: 'Construction Zone',
        zoneCode: 'CZ-01',
        reason: 'Category match: construction',
        confidence: 'high',
      });
      expect(suggestions[1].confidence).toBe('low');
    });

    it('should return hazardous match suggestions for safety items', async () => {
      const safetyItem = { ...mockItem, category: 'safety' };
      mockPrisma.item.findUnique.mockResolvedValue(safetyItem);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-2',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-2',
          itemCategory: null,
          isHazardous: true,
          isActive: true,
          priority: 1,
          targetZone: mockZone2,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([mockZone2]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        zoneId: 'zone-2',
        zoneName: 'Safety Equipment Zone',
        zoneCode: 'SZ-01',
        reason: 'Hazardous material zone',
        confidence: 'high',
      });
    });

    it('should return default zone suggestions for generic rules (no category/hazardous)', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-3',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-3',
          itemCategory: null,
          isHazardous: false,
          isActive: true,
          priority: 10,
          targetZone: mockZone3,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([mockZone3]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        zoneId: 'zone-3',
        zoneName: 'General Storage',
        zoneCode: 'GS-01',
        reason: 'Default zone (priority 10)',
        confidence: 'medium',
      });
    });

    it('should skip zones at capacity', async () => {
      const fullZone = { ...mockZone1, currentOccupancy: 100 };
      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-1',
          itemCategory: 'construction',
          isHazardous: false,
          isActive: true,
          priority: 1,
          targetZone: fullZone,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([fullZone]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions).toHaveLength(0);
    });

    it('should not skip zones with null capacity', async () => {
      const unlimitedZone = { ...mockZone1, capacity: null, currentOccupancy: null };
      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-1',
          itemCategory: 'construction',
          isHazardous: false,
          isActive: true,
          priority: 1,
          targetZone: unlimitedZone,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([unlimitedZone]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].zoneId).toBe('zone-1');
    });

    it('should not duplicate zones already suggested by rules', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-1',
          itemCategory: 'construction',
          isHazardous: false,
          isActive: true,
          priority: 1,
          targetZone: mockZone1,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([mockZone1]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].confidence).toBe('high');
    });

    it('should add remaining zones as low-confidence fallbacks', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-1',
          itemCategory: 'construction',
          isHazardous: false,
          isActive: true,
          priority: 1,
          targetZone: mockZone1,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([mockZone1, mockZone3]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].confidence).toBe('high');
      expect(suggestions[1]).toEqual({
        zoneId: 'zone-3',
        zoneName: 'General Storage',
        zoneCode: 'GS-01',
        reason: 'Available zone',
        confidence: 'low',
      });
    });

    it('should skip rules with null targetZone', async () => {
      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-deleted',
          itemCategory: 'construction',
          isHazardous: false,
          isActive: true,
          priority: 1,
          targetZone: null,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([mockZone1]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].confidence).toBe('low');
    });

    it('should respect rule priority order (ascending)', async () => {
      const highPriorityZone = { ...mockZone1, id: 'zone-high', zoneName: 'High Priority' };
      const lowPriorityZone = { ...mockZone3, id: 'zone-low', zoneName: 'Low Priority' };

      mockPrisma.item.findUnique.mockResolvedValue(mockItem);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-high',
          itemCategory: null,
          isHazardous: false,
          isActive: true,
          priority: 1,
          targetZone: highPriorityZone,
        },
        {
          id: 'rule-2',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-low',
          itemCategory: null,
          isHazardous: false,
          isActive: true,
          priority: 10,
          targetZone: lowPriorityZone,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([highPriorityZone, lowPriorityZone]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions[0].zoneName).toBe('High Priority');
      expect(suggestions[0].reason).toBe('Default zone (priority 1)');
    });

    it('should handle items with null category', async () => {
      const itemNoCategory = { ...mockItem, category: null };
      mockPrisma.item.findUnique.mockResolvedValue(itemNoCategory);
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-1',
          itemCategory: 'construction',
          isHazardous: false,
          isActive: true,
          priority: 1,
          targetZone: mockZone1,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([mockZone1]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      // Should not match category rule, only fallback
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].confidence).toBe('low');
    });

    it('should perform case-insensitive category matching', async () => {
      mockPrisma.item.findUnique.mockResolvedValue({ ...mockItem, category: 'CONSTRUCTION' });
      mockPrisma.putAwayRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          warehouseId: 'warehouse-1',
          targetZoneId: 'zone-1',
          itemCategory: 'construction',
          isHazardous: false,
          isActive: true,
          priority: 1,
          targetZone: mockZone1,
        },
      ]);
      mockPrisma.warehouseZone.findMany.mockResolvedValue([mockZone1]);

      const suggestions = await suggestPutAwayLocation('item-1', 'warehouse-1');

      expect(suggestions[0].confidence).toBe('high');
      expect(suggestions[0].reason).toBe('Category match: CONSTRUCTION');
    });
  });

  // ---------------------------------------------------------------------------
  // listRules
  // ---------------------------------------------------------------------------
  describe('listRules', () => {
    const mockRules = [
      {
        id: 'rule-1',
        warehouseId: 'warehouse-1',
        targetZoneId: 'zone-1',
        itemCategory: 'construction',
        isHazardous: false,
        isActive: true,
        priority: 1,
        warehouse: { id: 'warehouse-1', warehouseName: 'Main Warehouse', warehouseCode: 'WH-01' },
        targetZone: { id: 'zone-1', zoneName: 'Zone A', zoneCode: 'ZA-01' },
      },
      {
        id: 'rule-2',
        warehouseId: 'warehouse-2',
        targetZoneId: 'zone-2',
        itemCategory: 'safety',
        isHazardous: true,
        isActive: true,
        priority: 2,
        warehouse: { id: 'warehouse-2', warehouseName: 'Safety Warehouse', warehouseCode: 'WH-02' },
        targetZone: { id: 'zone-2', zoneName: 'Zone B', zoneCode: 'ZB-01' },
      },
    ];

    it('should return all rules when warehouseId is not provided', async () => {
      mockPrisma.putAwayRule.findMany.mockResolvedValue(mockRules);

      const result = await listRules();

      expect(mockPrisma.putAwayRule.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.putAwayRule.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { priority: 'asc' },
        include: {
          warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
          targetZone: { select: { id: true, zoneName: true, zoneCode: true } },
        },
      });
      expect(result).toEqual(mockRules);
    });

    it('should filter by warehouseId when provided', async () => {
      const filteredRules = [mockRules[0]];
      mockPrisma.putAwayRule.findMany.mockResolvedValue(filteredRules);

      const result = await listRules('warehouse-1');

      expect(mockPrisma.putAwayRule.findMany).toHaveBeenCalledWith({
        where: { warehouseId: 'warehouse-1' },
        orderBy: { priority: 'asc' },
        include: {
          warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
          targetZone: { select: { id: true, zoneName: true, zoneCode: true } },
        },
      });
      expect(result).toEqual(filteredRules);
    });

    it('should return empty array when no rules exist', async () => {
      mockPrisma.putAwayRule.findMany.mockResolvedValue([]);

      const result = await listRules();

      expect(result).toEqual([]);
    });

    it('should propagate prisma errors', async () => {
      mockPrisma.putAwayRule.findMany.mockRejectedValue(new Error('DB error'));

      await expect(listRules()).rejects.toThrow('DB error');
    });
  });

  // ---------------------------------------------------------------------------
  // getRuleById
  // ---------------------------------------------------------------------------
  describe('getRuleById', () => {
    const mockRule = {
      id: 'rule-1',
      warehouseId: 'warehouse-1',
      targetZoneId: 'zone-1',
      itemCategory: 'construction',
      isHazardous: false,
      isActive: true,
      priority: 1,
      warehouse: { id: 'warehouse-1', warehouseName: 'Main Warehouse', warehouseCode: 'WH-01' },
      targetZone: { id: 'zone-1', zoneName: 'Zone A', zoneCode: 'ZA-01' },
    };

    it('should return rule with includes when found', async () => {
      mockPrisma.putAwayRule.findUnique.mockResolvedValue(mockRule);

      const result = await getRuleById('rule-1');

      expect(mockPrisma.putAwayRule.findUnique).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        include: {
          warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
          targetZone: { select: { id: true, zoneName: true, zoneCode: true } },
        },
      });
      expect(result).toEqual(mockRule);
    });

    it('should throw NotFoundError when rule does not exist', async () => {
      mockPrisma.putAwayRule.findUnique.mockResolvedValue(null);

      await expect(getRuleById('rule-999')).rejects.toThrow(new NotFoundError('PutAwayRule', 'rule-999'));
    });

    it('should propagate prisma errors', async () => {
      mockPrisma.putAwayRule.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(getRuleById('rule-1')).rejects.toThrow('DB error');
    });
  });

  // ---------------------------------------------------------------------------
  // createRule
  // ---------------------------------------------------------------------------
  describe('createRule', () => {
    const mockRuleData = {
      warehouseId: 'warehouse-1',
      targetZoneId: 'zone-1',
      itemCategory: 'construction',
      isHazardous: false,
      isActive: true,
      priority: 1,
    };

    const mockCreatedRule = {
      id: 'rule-new',
      ...mockRuleData,
      warehouse: { id: 'warehouse-1', warehouseName: 'Main Warehouse', warehouseCode: 'WH-01' },
      targetZone: { id: 'zone-1', zoneName: 'Zone A', zoneCode: 'ZA-01' },
    };

    it('should create rule with includes', async () => {
      mockPrisma.putAwayRule.create.mockResolvedValue(mockCreatedRule);

      const result = await createRule(mockRuleData);

      expect(mockPrisma.putAwayRule.create).toHaveBeenCalledWith({
        data: mockRuleData,
        include: {
          warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
          targetZone: { select: { id: true, zoneName: true, zoneCode: true } },
        },
      });
      expect(result).toEqual(mockCreatedRule);
    });

    it('should propagate prisma errors', async () => {
      mockPrisma.putAwayRule.create.mockRejectedValue(new Error('DB error'));

      await expect(createRule(mockRuleData)).rejects.toThrow('DB error');
    });
  });

  // ---------------------------------------------------------------------------
  // updateRule
  // ---------------------------------------------------------------------------
  describe('updateRule', () => {
    const mockExistingRule = {
      id: 'rule-1',
      warehouseId: 'warehouse-1',
      targetZoneId: 'zone-1',
      itemCategory: 'construction',
      isHazardous: false,
      isActive: true,
      priority: 1,
    };

    const mockUpdatedRule = {
      ...mockExistingRule,
      priority: 5,
      warehouse: { id: 'warehouse-1', warehouseName: 'Main Warehouse', warehouseCode: 'WH-01' },
      targetZone: { id: 'zone-1', zoneName: 'Zone A', zoneCode: 'ZA-01' },
    };

    it('should update rule when it exists', async () => {
      mockPrisma.putAwayRule.findUnique.mockResolvedValue(mockExistingRule);
      mockPrisma.putAwayRule.update.mockResolvedValue(mockUpdatedRule);

      const result = await updateRule('rule-1', { priority: 5 });

      expect(mockPrisma.putAwayRule.findUnique).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
      expect(mockPrisma.putAwayRule.update).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
        data: { priority: 5 },
        include: {
          warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
          targetZone: { select: { id: true, zoneName: true, zoneCode: true } },
        },
      });
      expect(result).toEqual(mockUpdatedRule);
    });

    it('should throw NotFoundError when rule does not exist', async () => {
      mockPrisma.putAwayRule.findUnique.mockResolvedValue(null);

      await expect(updateRule('rule-999', { priority: 5 })).rejects.toThrow(
        new NotFoundError('PutAwayRule', 'rule-999'),
      );

      expect(mockPrisma.putAwayRule.update).not.toHaveBeenCalled();
    });

    it('should propagate prisma errors from findUnique', async () => {
      mockPrisma.putAwayRule.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(updateRule('rule-1', { priority: 5 })).rejects.toThrow('DB error');
    });

    it('should propagate prisma errors from update', async () => {
      mockPrisma.putAwayRule.findUnique.mockResolvedValue(mockExistingRule);
      mockPrisma.putAwayRule.update.mockRejectedValue(new Error('DB error'));

      await expect(updateRule('rule-1', { priority: 5 })).rejects.toThrow('DB error');
    });
  });

  // ---------------------------------------------------------------------------
  // deleteRule
  // ---------------------------------------------------------------------------
  describe('deleteRule', () => {
    const mockExistingRule = {
      id: 'rule-1',
      warehouseId: 'warehouse-1',
      targetZoneId: 'zone-1',
      itemCategory: 'construction',
      isHazardous: false,
      isActive: true,
      priority: 1,
    };

    it('should delete rule when it exists', async () => {
      mockPrisma.putAwayRule.findUnique.mockResolvedValue(mockExistingRule);
      mockPrisma.putAwayRule.delete.mockResolvedValue(mockExistingRule);

      await deleteRule('rule-1');

      expect(mockPrisma.putAwayRule.findUnique).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
      expect(mockPrisma.putAwayRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
    });

    it('should throw NotFoundError when rule does not exist', async () => {
      mockPrisma.putAwayRule.findUnique.mockResolvedValue(null);

      await expect(deleteRule('rule-999')).rejects.toThrow(new NotFoundError('PutAwayRule', 'rule-999'));

      expect(mockPrisma.putAwayRule.delete).not.toHaveBeenCalled();
    });

    it('should propagate prisma errors from findUnique', async () => {
      mockPrisma.putAwayRule.findUnique.mockRejectedValue(new Error('DB error'));

      await expect(deleteRule('rule-1')).rejects.toThrow('DB error');
    });

    it('should propagate prisma errors from delete', async () => {
      mockPrisma.putAwayRule.findUnique.mockResolvedValue(mockExistingRule);
      mockPrisma.putAwayRule.delete.mockRejectedValue(new Error('DB error'));

      await expect(deleteRule('rule-1')).rejects.toThrow('DB error');
    });
  });
});
