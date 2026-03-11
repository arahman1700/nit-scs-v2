import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return {
    mockPrisma: {} as PrismaMock & { aiSuggestion: any },
  };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../config/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { generateSuggestions, listSuggestions, dismissSuggestion, applySuggestion } from './ai-suggestions.service.js';

function createModelMock() {
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

describe('ai-suggestions.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as any).aiSuggestion = createModelMock();
  });

  // ---------------------------------------------------------------------------
  // generateSuggestions
  // ---------------------------------------------------------------------------
  describe('generateSuggestions', () => {
    it('should run all 4 analysis engines', async () => {
      // All engines return empty arrays (no matching data)
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      const result = await generateSuggestions();

      // $queryRaw called 4 times (slow-moving, delays, low-stock, SLA)
      expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(4);
      expect(result).toBe(0);
    });

    it('should upsert suggestions from slow-moving engine', async () => {
      const slowMovingRows = [{ item_id: 'i1', item_name: 'Bolt', warehouse_name: 'WH-A', qty: 50, days_since: 200 }];
      // First call is slow-moving, rest are empty
      mockPrisma.$queryRaw
        .mockResolvedValueOnce(slowMovingRows)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.aiSuggestion.upsert.mockResolvedValue({});
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      const result = await generateSuggestions();

      expect(mockPrisma.aiSuggestion.upsert).toHaveBeenCalledOnce();
      expect(result).toBe(1);
    });

    it('should set higher priority for slow-moving items over 180 days', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { item_id: 'i1', item_name: 'Old Bolt', warehouse_name: 'WH-A', qty: 10, days_since: 200 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.aiSuggestion.upsert.mockResolvedValue({});
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      await generateSuggestions();

      const upsertCall = mockPrisma.aiSuggestion.upsert.mock.calls[0][0];
      expect(upsertCall.create.priority).toBe(2); // > 180 days = priority 2
    });

    it('should set priority 3 for slow-moving items under 180 days', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { item_id: 'i1', item_name: 'Recent', warehouse_name: 'WH-A', qty: 10, days_since: 100 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.aiSuggestion.upsert.mockResolvedValue({});
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      await generateSuggestions();

      const upsertCall = mockPrisma.aiSuggestion.upsert.mock.calls[0][0];
      expect(upsertCall.create.priority).toBe(3);
    });

    it('should upsert delay suggestions with correct priority', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // slow-moving
        .mockResolvedValueOnce([{ doc_type: 'MI', doc_number: 'MI-001', doc_id: 'id1', days_pending: 10 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.aiSuggestion.upsert.mockResolvedValue({});
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      await generateSuggestions();

      const upsertCall = mockPrisma.aiSuggestion.upsert.mock.calls[0][0];
      expect(upsertCall.create.priority).toBe(1); // > 7 days pending
      expect(upsertCall.create.suggestionType).toBe('delay');
    });

    it('should create reorder suggestions with actionPayload', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { item_name: 'Nut', warehouse_name: 'WH-B', qty: 0, reorder_point: 100, item_id: 'i2' },
        ])
        .mockResolvedValueOnce([]);
      mockPrisma.aiSuggestion.upsert.mockResolvedValue({});
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      await generateSuggestions();

      const upsertCall = mockPrisma.aiSuggestion.upsert.mock.calls[0][0];
      expect(upsertCall.create.suggestionType).toBe('reorder');
      expect(upsertCall.create.priority).toBe(1); // qty === 0 → priority 1
      expect(upsertCall.create.actionPayload).toEqual({ type: 'create_mr', params: { itemId: 'i2' } });
    });

    it('should create SLA breach suggestions', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ doc_type: 'MI', doc_number: 'MI-002', days_overdue: 5 }]);
      mockPrisma.aiSuggestion.upsert.mockResolvedValue({});
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      await generateSuggestions();

      const upsertCall = mockPrisma.aiSuggestion.upsert.mock.calls[0][0];
      expect(upsertCall.create.suggestionType).toBe('sla');
      expect(upsertCall.create.priority).toBe(1); // > 3 days overdue
    });

    it('should continue processing when an engine throws', async () => {
      mockPrisma.$queryRaw
        .mockRejectedValueOnce(new Error('DB down')) // slow-moving fails
        .mockResolvedValueOnce([]) // delays
        .mockResolvedValueOnce([]) // low-stock
        .mockResolvedValueOnce([]); // SLA
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      const result = await generateSuggestions();

      expect(result).toBe(0); // no suggestions created, but no crash
    });

    it('should handle upsert failure gracefully without throwing', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ item_id: 'i1', item_name: 'Bolt', warehouse_name: 'WH-A', qty: 5, days_since: 100 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.aiSuggestion.upsert.mockRejectedValue(new Error('unique constraint'));
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      // Should not throw, and count stays 0 since upsert failed before increment
      const result = await generateSuggestions();
      expect(result).toBe(0);
    });

    it('should clean expired suggestions after processing', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 3 });

      await generateSuggestions();

      expect(mockPrisma.aiSuggestion.deleteMany).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });

    it('should generate unique fingerprints for different items', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { item_id: 'i1', item_name: 'A', warehouse_name: 'W', qty: 1, days_since: 100 },
          { item_id: 'i2', item_name: 'B', warehouse_name: 'W', qty: 1, days_since: 100 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      mockPrisma.aiSuggestion.upsert.mockResolvedValue({});
      mockPrisma.aiSuggestion.deleteMany.mockResolvedValue({ count: 0 });

      await generateSuggestions();

      const fp1 = mockPrisma.aiSuggestion.upsert.mock.calls[0][0].where.fingerprint;
      const fp2 = mockPrisma.aiSuggestion.upsert.mock.calls[1][0].where.fingerprint;
      expect(fp1).not.toBe(fp2);
    });
  });

  // ---------------------------------------------------------------------------
  // listSuggestions
  // ---------------------------------------------------------------------------
  describe('listSuggestions', () => {
    it('should filter by status when provided', async () => {
      mockPrisma.aiSuggestion.findMany.mockResolvedValue([]);

      await listSuggestions('pending');

      expect(mockPrisma.aiSuggestion.findMany).toHaveBeenCalledWith({
        where: { status: 'pending' },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });
    });

    it('should exclude dismissed when no status provided', async () => {
      mockPrisma.aiSuggestion.findMany.mockResolvedValue([]);

      await listSuggestions();

      expect(mockPrisma.aiSuggestion.findMany).toHaveBeenCalledWith({
        where: { status: { not: 'dismissed' } },
        orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      });
    });

    it('should return the list of suggestions', async () => {
      const suggestions = [{ id: 's1', title: 'Test' }];
      mockPrisma.aiSuggestion.findMany.mockResolvedValue(suggestions);

      const result = await listSuggestions();

      expect(result).toEqual(suggestions);
    });
  });

  // ---------------------------------------------------------------------------
  // dismissSuggestion
  // ---------------------------------------------------------------------------
  describe('dismissSuggestion', () => {
    it('should update suggestion status to dismissed', async () => {
      mockPrisma.aiSuggestion.update.mockResolvedValue({ id: 's1', status: 'dismissed' });

      await dismissSuggestion('s1');

      expect(mockPrisma.aiSuggestion.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'dismissed' },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // applySuggestion
  // ---------------------------------------------------------------------------
  describe('applySuggestion', () => {
    it('should update suggestion status to applied', async () => {
      mockPrisma.aiSuggestion.update.mockResolvedValue({ id: 's1', status: 'applied' });

      await applySuggestion('s1');

      expect(mockPrisma.aiSuggestion.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { status: 'applied' },
      });
    });
  });
});
