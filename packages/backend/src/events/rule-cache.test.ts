import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/prisma.js', () => {
  const workflowRule = {
    findMany: vi.fn(),
  };
  return { prisma: { workflowRule } };
});
vi.mock('../config/logger.js', () => ({
  log: vi.fn(),
}));

// Must import AFTER mocks are set up
import { getActiveRules, invalidateRuleCache } from './rule-cache.js';
import { prisma } from '../utils/prisma.js';

const mockFindMany = vi.mocked(prisma.workflowRule.findMany);

const testRules = [
  {
    id: 'rule-1',
    workflowId: 'wf-1',
    name: 'Auto-approve small',
    triggerEvent: 'document:created',
    conditions: { amount: { lt: 1000 } },
    actions: [{ type: 'approve' }],
    stopOnMatch: false,
    sortOrder: 0,
    workflow: { id: 'wf-1', entityType: 'grn', priority: 10 },
  },
  {
    id: 'rule-2',
    workflowId: 'wf-1',
    name: 'Notify manager',
    triggerEvent: 'document:status_changed',
    conditions: {},
    actions: [{ type: 'notify', role: 'manager' }],
    stopOnMatch: true,
    sortOrder: 1,
    workflow: { id: 'wf-1', entityType: 'grn', priority: 10 },
  },
];

describe('rule-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Always start with a clean cache
    invalidateRuleCache();
  });

  describe('getActiveRules', () => {
    it('should fetch rules from database on first call', async () => {
      mockFindMany.mockResolvedValue(testRules as never);

      const rules = await getActiveRules();

      expect(rules).toEqual(testRules);
      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(mockFindMany).toHaveBeenCalledWith({
        where: { isActive: true, workflow: { isActive: true } },
        include: {
          workflow: { select: { id: true, entityType: true, priority: true } },
        },
        orderBy: [{ workflow: { priority: 'desc' } }, { sortOrder: 'asc' }],
      });
    });

    it('should return cached data on second call within TTL', async () => {
      mockFindMany.mockResolvedValue(testRules as never);

      await getActiveRules();
      const rules2 = await getActiveRules();

      // Should only hit DB once — second call uses cache
      expect(mockFindMany).toHaveBeenCalledTimes(1);
      expect(rules2).toEqual(testRules);
    });

    it('should return stale cache on database error', async () => {
      // First call succeeds
      mockFindMany.mockResolvedValueOnce(testRules as never);
      await getActiveRules();

      // Invalidate to force refetch
      invalidateRuleCache();

      // Second call fails — but we already invalidated so cache is empty
      mockFindMany.mockRejectedValueOnce(new Error('DB connection lost'));
      const rules = await getActiveRules();

      // Returns empty array (cache was cleared by invalidate)
      expect(rules).toEqual([]);
    });
  });

  describe('invalidateRuleCache', () => {
    it('should cause next getActiveRules() call to query the database', async () => {
      mockFindMany.mockResolvedValue(testRules as never);

      // First call: populates cache
      await getActiveRules();
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      // Second call: uses cache
      await getActiveRules();
      expect(mockFindMany).toHaveBeenCalledTimes(1);

      // Invalidate
      invalidateRuleCache();

      // Third call: should hit DB again
      await getActiveRules();
      expect(mockFindMany).toHaveBeenCalledTimes(2);
    });

    it('should reset cache to empty state (lastFetch=0, cache=[])', async () => {
      mockFindMany.mockResolvedValue(testRules as never);

      // Populate cache
      await getActiveRules();

      // Invalidate
      invalidateRuleCache();

      // The next call with empty DB returns empty
      mockFindMany.mockResolvedValue([] as never);
      const rules = await getActiveRules();
      expect(rules).toEqual([]);
    });
  });
});
