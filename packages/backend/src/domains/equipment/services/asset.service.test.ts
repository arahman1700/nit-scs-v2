import type { PrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import {
  list,
  getById,
  create,
  update,
  transfer,
  retire,
  dispose,
  calculateDepreciation,
  getAssetSummary,
} from './asset.service.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { eventBus } from '../../../events/event-bus.js';

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const ASSET_ID = 'asset-1';

function makeAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: ASSET_ID,
    assetCode: 'AST-001',
    description: 'Forklift',
    category: 'vehicles',
    serialNumber: 'SN-111',
    manufacturer: 'Toyota',
    model: 'FX-500',
    purchaseDate: new Date('2025-03-01'),
    purchaseCost: 100000,
    currentValue: 90000,
    depreciationMethod: 'straight_line',
    usefulLifeYears: 10,
    salvageValue: 10000,
    status: 'active',
    locationWarehouseId: 'wh-1',
    assignedToId: 'emp-1',
    condition: 'good',
    notes: null,
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

describe('asset.service', () => {
  // ─────────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────────
  describe('list', () => {
    it('should return data and total', async () => {
      const rows = [makeAsset()];
      mockPrisma.asset.findMany.mockResolvedValue(rows);
      mockPrisma.asset.count.mockResolvedValue(1);

      const result = await list(baseListParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause on assetCode, description, serialNumber', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await list({ ...baseListParams, search: 'fork' });

      const where = mockPrisma.asset.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(3);
      expect(where.OR[0]).toEqual({
        assetCode: { contains: 'fork', mode: 'insensitive' },
      });
    });

    it('should apply status filter', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await list({ ...baseListParams, status: 'active' });

      const where = mockPrisma.asset.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('active');
    });

    it('should apply category filter', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await list({ ...baseListParams, category: 'vehicles' });

      const where = mockPrisma.asset.findMany.mock.calls[0][0].where;
      expect(where.category).toBe('vehicles');
    });

    it('should apply condition filter', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await list({ ...baseListParams, condition: 'good' });

      const where = mockPrisma.asset.findMany.mock.calls[0][0].where;
      expect(where.condition).toBe('good');
    });

    it('should pass pagination to findMany', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);
      mockPrisma.asset.count.mockResolvedValue(0);

      await list({ ...baseListParams, skip: 20, pageSize: 10 });

      const args = mockPrisma.asset.findMany.mock.calls[0][0];
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('should return the asset when found', async () => {
      const asset = makeAsset();
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      const result = await getById(ASSET_ID);

      expect(result).toEqual(asset);
      expect(mockPrisma.asset.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ASSET_ID } }));
    });

    it('should throw NotFoundError when asset not found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────────
  describe('create', () => {
    const data = {
      description: 'Forklift',
      category: 'vehicles',
      serialNumber: 'SN-111',
      manufacturer: 'Toyota',
      purchaseCost: 100000,
    };

    it('should generate asset code via generateDocumentNumber', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AST-001');
      mockPrisma.asset.create.mockResolvedValue(makeAsset());

      await create(data, USER_ID);

      expect(generateDocumentNumber).toHaveBeenCalledWith('asset');
    });

    it('should set default status to active', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AST-002');
      mockPrisma.asset.create.mockResolvedValue(makeAsset());

      await create(data, USER_ID);

      const createArgs = mockPrisma.asset.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('active');
    });

    it('should set currentValue to purchaseCost when currentValue not provided', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AST-003');
      mockPrisma.asset.create.mockResolvedValue(makeAsset());

      await create(data, USER_ID);

      const createArgs = mockPrisma.asset.create.mock.calls[0][0];
      expect(createArgs.data.currentValue).toBe(100000);
    });

    it('should handle optional fields with null defaults', async () => {
      vi.mocked(generateDocumentNumber).mockResolvedValue('AST-004');
      mockPrisma.asset.create.mockResolvedValue(makeAsset());

      await create({ description: 'Minimal Asset', category: 'tools' }, USER_ID);

      const createArgs = mockPrisma.asset.create.mock.calls[0][0];
      expect(createArgs.data.serialNumber).toBeNull();
      expect(createArgs.data.manufacturer).toBeNull();
      expect(createArgs.data.model).toBeNull();
      expect(createArgs.data.locationWarehouseId).toBeNull();
      expect(createArgs.data.assignedToId).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────────
  describe('update', () => {
    it('should return existing and updated when found', async () => {
      const existing = makeAsset();
      const updated = makeAsset({ description: 'Updated Forklift' });
      mockPrisma.asset.findUnique.mockResolvedValue(existing);
      mockPrisma.asset.update.mockResolvedValue(updated);

      const result = await update(ASSET_ID, { description: 'Updated Forklift' });

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when asset not found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when asset is retired', async () => {
      const existing = makeAsset({ status: 'retired' });
      mockPrisma.asset.findUnique.mockResolvedValue(existing);

      await expect(update(ASSET_ID, { description: 'No update' })).rejects.toThrow(BusinessRuleError);
    });

    it('should throw BusinessRuleError when asset is disposed', async () => {
      const existing = makeAsset({ status: 'disposed' });
      mockPrisma.asset.findUnique.mockResolvedValue(existing);

      await expect(update(ASSET_ID, { description: 'No update' })).rejects.toThrow(BusinessRuleError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // transfer
  // ─────────────────────────────────────────────────────────────────────────
  describe('transfer', () => {
    it('should create a transfer record and update asset location', async () => {
      const asset = makeAsset({ locationWarehouseId: 'wh-1', assignedToId: 'emp-1' });
      const transferred = makeAsset({ locationWarehouseId: 'wh-2' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);
      mockPrisma.assetTransfer.create.mockResolvedValue({});
      mockPrisma.asset.update.mockResolvedValue(transferred);

      const result = await transfer(ASSET_ID, 'wh-2', undefined, 'Relocating', USER_ID);

      expect(result).toEqual(transferred);
      expect(mockPrisma.assetTransfer.create).toHaveBeenCalledOnce();
    });

    it('should throw NotFoundError when asset not found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(transfer('nonexistent', 'wh-2', undefined, undefined, USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when asset is retired', async () => {
      const asset = makeAsset({ status: 'retired' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      await expect(transfer(ASSET_ID, 'wh-2', undefined, undefined, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('should throw BusinessRuleError when asset is disposed', async () => {
      const asset = makeAsset({ status: 'disposed' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      await expect(transfer(ASSET_ID, 'wh-2', undefined, undefined, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('should throw BusinessRuleError when asset is lost', async () => {
      const asset = makeAsset({ status: 'lost' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      await expect(transfer(ASSET_ID, 'wh-2', undefined, undefined, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('should throw BusinessRuleError when no destination provided', async () => {
      const asset = makeAsset();
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      await expect(transfer(ASSET_ID, undefined, undefined, undefined, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('should publish event on successful transfer', async () => {
      const asset = makeAsset();
      mockPrisma.asset.findUnique.mockResolvedValue(asset);
      mockPrisma.assetTransfer.create.mockResolvedValue({});
      mockPrisma.asset.update.mockResolvedValue(makeAsset({ locationWarehouseId: 'wh-2' }));

      await transfer(ASSET_ID, 'wh-2', 'emp-2', 'New site', USER_ID);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          entityType: 'asset',
          payload: expect.objectContaining({ action: 'transfer', toWarehouseId: 'wh-2', toEmployeeId: 'emp-2' }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // retire
  // ─────────────────────────────────────────────────────────────────────────
  describe('retire', () => {
    it('should set status to retired when asset is active', async () => {
      const asset = makeAsset({ status: 'active' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);
      mockPrisma.asset.update.mockResolvedValue({ ...asset, status: 'retired' });

      const result = await retire(ASSET_ID, USER_ID);

      expect(result.status).toBe('retired');
    });

    it('should throw NotFoundError when asset not found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(retire('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when asset is already retired', async () => {
      const asset = makeAsset({ status: 'retired' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      await expect(retire(ASSET_ID, USER_ID)).rejects.toThrow('Asset is already retired');
    });

    it('should throw BusinessRuleError when asset is disposed', async () => {
      const asset = makeAsset({ status: 'disposed' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      await expect(retire(ASSET_ID, USER_ID)).rejects.toThrow('Cannot retire an asset that has been disposed');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // dispose
  // ─────────────────────────────────────────────────────────────────────────
  describe('dispose', () => {
    it('should set status to disposed and update currentValue', async () => {
      const asset = makeAsset({ status: 'active' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);
      mockPrisma.asset.update.mockResolvedValue({ ...asset, status: 'disposed', currentValue: 5000 });

      const result = await dispose(ASSET_ID, USER_ID, 5000);

      expect(result.status).toBe('disposed');
      expect(result.currentValue).toBe(5000);
    });

    it('should set currentValue to 0 when disposalValue not provided', async () => {
      const asset = makeAsset({ status: 'active' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);
      mockPrisma.asset.update.mockResolvedValue({ ...asset, status: 'disposed', currentValue: 0 });

      await dispose(ASSET_ID, USER_ID);

      const updateArgs = mockPrisma.asset.update.mock.calls[0][0];
      expect(updateArgs.data.currentValue).toBe(0);
    });

    it('should throw NotFoundError when asset not found', async () => {
      mockPrisma.asset.findUnique.mockResolvedValue(null);

      await expect(dispose('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when asset is already disposed', async () => {
      const asset = makeAsset({ status: 'disposed' });
      mockPrisma.asset.findUnique.mockResolvedValue(asset);

      await expect(dispose(ASSET_ID, USER_ID)).rejects.toThrow('Asset is already disposed');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // calculateDepreciation
  // ─────────────────────────────────────────────────────────────────────────
  describe('calculateDepreciation', () => {
    it('should skip assets that already have depreciation for current period', async () => {
      const asset = makeAsset({ depreciationMethod: 'straight_line', purchaseCost: 100000, usefulLifeYears: 10 });
      mockPrisma.asset.findMany.mockResolvedValue([asset]);
      mockPrisma.assetDepreciation.findUnique.mockResolvedValue({ id: 'dep-1' });

      await calculateDepreciation();

      expect(mockPrisma.assetDepreciation.create).not.toHaveBeenCalled();
    });

    it('should skip assets with no active depreciation-needed assets', async () => {
      mockPrisma.asset.findMany.mockResolvedValue([]);

      await calculateDepreciation();

      expect(mockPrisma.assetDepreciation.findUnique).not.toHaveBeenCalled();
    });

    it('should skip fully depreciated assets (currentValue <= salvageValue)', async () => {
      const asset = makeAsset({
        depreciationMethod: 'straight_line',
        purchaseCost: 100000,
        usefulLifeYears: 10,
        salvageValue: 10000,
        currentValue: 10000,
      });
      mockPrisma.asset.findMany.mockResolvedValue([asset]);
      mockPrisma.assetDepreciation.findUnique.mockResolvedValue(null);

      await calculateDepreciation();

      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should calculate straight_line depreciation correctly', async () => {
      const asset = makeAsset({
        id: 'asset-dep',
        depreciationMethod: 'straight_line',
        purchaseCost: 100000,
        usefulLifeYears: 10,
        salvageValue: 10000,
        currentValue: 90000,
      });
      mockPrisma.asset.findMany.mockResolvedValue([asset]);
      mockPrisma.assetDepreciation.findUnique.mockResolvedValue(null);
      mockPrisma.assetDepreciation.create.mockResolvedValue({});
      mockPrisma.asset.update.mockResolvedValue({});

      await calculateDepreciation();

      // Annual depreciation = (100000 - 10000) / 10 = 9000
      // Quarterly = 9000 / 4 = 2250
      expect(mockPrisma.assetDepreciation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assetId: 'asset-dep',
            openingValue: 90000,
            depreciationAmount: 2250,
            closingValue: 87750,
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getAssetSummary
  // ─────────────────────────────────────────────────────────────────────────
  describe('getAssetSummary', () => {
    it('should return summary with all aggregated data', async () => {
      mockPrisma.asset.count.mockResolvedValue(50);
      mockPrisma.asset.groupBy
        .mockResolvedValueOnce([
          { category: 'vehicles', _count: { id: 30 } },
          { category: 'tools', _count: { id: 20 } },
        ])
        .mockResolvedValueOnce([
          { status: 'active', _count: { id: 40 } },
          { status: 'retired', _count: { id: 10 } },
        ]);
      mockPrisma.asset.aggregate.mockResolvedValue({ _sum: { currentValue: 500000 } });
      mockPrisma.assetDepreciation.aggregate.mockResolvedValue({ _sum: { depreciationAmount: 12500 } });

      const result = await getAssetSummary();

      expect(result.totalCount).toBe(50);
      expect(result.byCategory).toHaveLength(2);
      expect(result.byStatus).toHaveLength(2);
      expect(result.totalValue).toBe(500000);
      expect(result.depreciationThisPeriod).toBe(12500);
      expect(result.currentPeriod).toMatch(/^\d{4}-Q[1-4]$/);
    });

    it('should handle null sums gracefully', async () => {
      mockPrisma.asset.count.mockResolvedValue(0);
      mockPrisma.asset.groupBy.mockResolvedValue([]).mockResolvedValue([]);
      mockPrisma.asset.aggregate.mockResolvedValue({ _sum: { currentValue: null } });
      mockPrisma.assetDepreciation.aggregate.mockResolvedValue({ _sum: { depreciationAmount: null } });

      const result = await getAssetSummary();

      expect(result.totalValue).toBe(0);
      expect(result.depreciationThisPeriod).toBe(0);
    });
  });
});
