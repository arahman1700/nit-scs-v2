import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { getProductivitySummary } from './labor-productivity.service.js';

describe('labor-productivity.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
  });

  describe('getProductivitySummary', () => {
    it('returns empty summary when no data', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);

      const result = await getProductivitySummary(30);

      expect(result.workers).toEqual([]);
      expect(result.dailyThroughput).toEqual([]);
      expect(result.totals).toEqual({ grnsProcessed: 0, misIssued: 0, wtsTransferred: 0, tasksCompleted: 0 });
    });

    it('aggregates document counts per worker', async () => {
      // Mock 4 raw queries in sequence: documentCounts, taskMetrics, dailyData, dailyTasks
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { performed_by_id: 'u1', full_name: 'John', system_role: 'staff', table_name: 'mrrv', cnt: 5n },
          { performed_by_id: 'u1', full_name: 'John', system_role: 'staff', table_name: 'mirv', cnt: 3n },
        ])
        .mockResolvedValueOnce([]) // taskMetrics
        .mockResolvedValueOnce([]) // dailyData
        .mockResolvedValueOnce([]); // dailyTasks

      const result = await getProductivitySummary(30);

      expect(result.workers).toHaveLength(1);
      expect(result.workers[0].metrics.grnsProcessed).toBe(5);
      expect(result.workers[0].metrics.misIssued).toBe(3);
    });

    it('aggregates stock transfer counts', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { performed_by_id: 'u1', full_name: 'Jane', system_role: 'staff', table_name: 'stock_transfers', cnt: 7n },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getProductivitySummary(30);

      expect(result.workers[0].metrics.wtsTransferred).toBe(7);
    });

    it('includes task metrics with avg duration', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            assignee_id: 'u1',
            full_name: 'Ali',
            system_role: 'staff',
            completed_count: 10n,
            avg_duration_minutes: 45.678,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getProductivitySummary(30);

      expect(result.workers[0].metrics.tasksCompleted).toBe(10);
      expect(result.workers[0].metrics.avgTaskDurationMinutes).toBe(45.7);
    });

    it('handles null avg_duration_minutes', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            assignee_id: 'u1',
            full_name: 'Ali',
            system_role: 'staff',
            completed_count: 1n,
            avg_duration_minutes: null,
          },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getProductivitySummary(30);
      expect(result.workers[0].metrics.avgTaskDurationMinutes).toBeNull();
    });

    it('merges document and task workers correctly', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { performed_by_id: 'u1', full_name: 'John', system_role: 'staff', table_name: 'mrrv', cnt: 2n },
        ])
        .mockResolvedValueOnce([
          { assignee_id: 'u1', full_name: 'John', system_role: 'staff', completed_count: 4n, avg_duration_minutes: 30 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getProductivitySummary(30);
      expect(result.workers).toHaveLength(1);
      expect(result.workers[0].metrics.grnsProcessed).toBe(2);
      expect(result.workers[0].metrics.tasksCompleted).toBe(4);
    });

    it('aggregates daily throughput from document actions', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { day: '2026-02-01', table_name: 'mrrv', cnt: 3n },
          { day: '2026-02-01', table_name: 'mirv', cnt: 5n },
          { day: '2026-02-02', table_name: 'stock_transfers', cnt: 2n },
        ])
        .mockResolvedValueOnce([{ day: '2026-02-01', cnt: 8n }]);

      const result = await getProductivitySummary(30);

      expect(result.dailyThroughput).toHaveLength(2);
      expect(result.dailyThroughput[0]).toEqual({ date: '2026-02-01', grns: 3, mis: 5, wts: 0, tasks: 8 });
      expect(result.dailyThroughput[1]).toEqual({ date: '2026-02-02', grns: 0, mis: 0, wts: 2, tasks: 0 });
    });

    it('sorts workers by total activity descending', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { performed_by_id: 'u1', full_name: 'A', system_role: 'staff', table_name: 'mrrv', cnt: 1n },
          { performed_by_id: 'u2', full_name: 'B', system_role: 'staff', table_name: 'mrrv', cnt: 10n },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getProductivitySummary(30);
      expect(result.workers[0].fullName).toBe('B');
      expect(result.workers[1].fullName).toBe('A');
    });

    it('sorts daily throughput by date ascending', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { day: '2026-02-03', table_name: 'mrrv', cnt: 1n },
          { day: '2026-02-01', table_name: 'mrrv', cnt: 2n },
        ])
        .mockResolvedValueOnce([]);

      const result = await getProductivitySummary(30);
      expect(result.dailyThroughput[0].date).toBe('2026-02-01');
      expect(result.dailyThroughput[1].date).toBe('2026-02-03');
    });

    it('computes period from/to based on days param', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      const result = await getProductivitySummary(7);
      const from = new Date(result.period.from);
      const to = new Date(result.period.to);
      const diff = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      expect(diff).toBe(7);
    });

    it('computes totals as sum of all workers', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([
          { performed_by_id: 'u1', full_name: 'A', system_role: 'staff', table_name: 'mrrv', cnt: 3n },
          { performed_by_id: 'u2', full_name: 'B', system_role: 'staff', table_name: 'mrrv', cnt: 2n },
          { performed_by_id: 'u1', full_name: 'A', system_role: 'staff', table_name: 'mirv', cnt: 1n },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await getProductivitySummary(30);
      expect(result.totals.grnsProcessed).toBe(5);
      expect(result.totals.misIssued).toBe(1);
    });
  });
});
