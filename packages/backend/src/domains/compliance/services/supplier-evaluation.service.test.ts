import type { PrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { list, getById, autoCalculateMetrics, create, update, complete } from './supplier-evaluation.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function makeEvaluation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'eval-1',
    evaluationNumber: 'SE-001',
    supplierId: 'sup-1',
    evaluatorId: 'user-1',
    periodStart: new Date('2026-01-01'),
    periodEnd: new Date('2026-03-31'),
    status: 'draft',
    overallScore: 50,
    notes: null,
    metrics: [],
    supplier: { id: 'sup-1', supplierCode: 'SUP-001', supplierName: 'Acme Corp' },
    evaluator: { id: 'user-1', fullName: 'John Doe' },
    _count: { metrics: 0 },
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('supplier-evaluation.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────
  // list
  // ─────────────────────────────────────────────────────────────────────

  describe('list', () => {
    const baseParams = { sortBy: 'createdAt', sortDir: 'desc' as const, skip: 0, pageSize: 25 };

    it('should return data and total', async () => {
      const rows = [makeEvaluation()];
      mockPrisma.supplierEvaluation.findMany.mockResolvedValue(rows);
      mockPrisma.supplierEvaluation.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause', async () => {
      mockPrisma.supplierEvaluation.findMany.mockResolvedValue([]);
      mockPrisma.supplierEvaluation.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'acme' });

      const where = mockPrisma.supplierEvaluation.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(3);
    });

    it('should apply status filter', async () => {
      mockPrisma.supplierEvaluation.findMany.mockResolvedValue([]);
      mockPrisma.supplierEvaluation.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'draft' });

      const where = mockPrisma.supplierEvaluation.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('draft');
    });

    it('should apply supplierId filter', async () => {
      mockPrisma.supplierEvaluation.findMany.mockResolvedValue([]);
      mockPrisma.supplierEvaluation.count.mockResolvedValue(0);

      await list({ ...baseParams, supplierId: 'sup-1' } as any);

      const where = mockPrisma.supplierEvaluation.findMany.mock.calls[0][0].where;
      expect(where.supplierId).toBe('sup-1');
    });

    it('should pass pagination parameters', async () => {
      mockPrisma.supplierEvaluation.findMany.mockResolvedValue([]);
      mockPrisma.supplierEvaluation.count.mockResolvedValue(0);

      await list({ ...baseParams, skip: 20, pageSize: 10 });

      const args = mockPrisma.supplierEvaluation.findMany.mock.calls[0][0];
      expect(args.skip).toBe(20);
      expect(args.take).toBe(10);
    });

    it('should return empty result when no evaluations exist', async () => {
      mockPrisma.supplierEvaluation.findMany.mockResolvedValue([]);
      mockPrisma.supplierEvaluation.count.mockResolvedValue(0);

      const result = await list(baseParams);

      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // getById
  // ─────────────────────────────────────────────────────────────────────

  describe('getById', () => {
    it('should return evaluation when found', async () => {
      const evaluation = makeEvaluation();
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(evaluation);

      const result = await getById('eval-1');

      expect(result).toEqual(evaluation);
      expect(mockPrisma.supplierEvaluation.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'eval-1' } }),
      );
    });

    it('should throw NotFoundError when evaluation not found', async () => {
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // autoCalculateMetrics
  // ─────────────────────────────────────────────────────────────────────

  describe('autoCalculateMetrics', () => {
    const periodStart = new Date('2026-01-01');
    const periodEnd = new Date('2026-03-31');

    it('should return 5 metrics', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.rfim.findMany.mockResolvedValue([]);

      const metrics = await autoCalculateMetrics('sup-1', periodStart, periodEnd);

      expect(metrics).toHaveLength(5);
      const names = metrics.map(m => m.metricName);
      expect(names).toContain('On-Time Delivery');
      expect(names).toContain('Quality');
      expect(names).toContain('Pricing Compliance');
      expect(names).toContain('Responsiveness');
      expect(names).toContain('Safety Record');
    });

    it('should calculate on-time delivery score from GRN data', async () => {
      const etaPort = new Date('2026-02-10');
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-1',
          receiveDate: new Date('2026-02-09'), // on time
          shipments: [{ etaPort, actualArrivalDate: new Date('2026-02-08') }],
        },
        {
          id: 'grn-2',
          receiveDate: new Date('2026-02-15'), // late
          shipments: [{ etaPort, actualArrivalDate: new Date('2026-02-15') }],
        },
      ]);
      mockPrisma.rfim.findMany.mockResolvedValue([]);

      const metrics = await autoCalculateMetrics('sup-1', periodStart, periodEnd);

      const onTime = metrics.find(m => m.metricName === 'On-Time Delivery')!;
      // 1 out of 2 on time = 50%
      expect(onTime.rawScore).toBe(50);
      expect(onTime.weight).toBe(30);
      expect(onTime.weightedScore).toBe(15); // 50*30/100
      expect(onTime.notes).toContain('1/2');
    });

    it('should default on-time delivery to 50 when no deliveries exist', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.rfim.findMany.mockResolvedValue([]);

      const metrics = await autoCalculateMetrics('sup-1', periodStart, periodEnd);

      const onTime = metrics.find(m => m.metricName === 'On-Time Delivery')!;
      expect(onTime.rawScore).toBe(50);
    });

    it('should calculate quality score from inspection data', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.rfim.findMany.mockResolvedValue([
        { result: 'pass' },
        { result: 'pass' },
        { result: 'fail' },
        { result: 'conditional' },
      ]);

      const metrics = await autoCalculateMetrics('sup-1', periodStart, periodEnd);

      const quality = metrics.find(m => m.metricName === 'Quality')!;
      // 3 out of 4 passed (pass + conditional count as passing)
      expect(quality.rawScore).toBe(75);
      expect(quality.weight).toBe(30);
      expect(quality.notes).toContain('3/4');
    });

    it('should default quality score to 50 when no inspections exist', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.rfim.findMany.mockResolvedValue([]);

      const metrics = await autoCalculateMetrics('sup-1', periodStart, periodEnd);

      const quality = metrics.find(m => m.metricName === 'Quality')!;
      expect(quality.rawScore).toBe(50);
    });

    it('should set placeholder metrics with default score of 50', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.rfim.findMany.mockResolvedValue([]);

      const metrics = await autoCalculateMetrics('sup-1', periodStart, periodEnd);

      const pricing = metrics.find(m => m.metricName === 'Pricing Compliance')!;
      expect(pricing.rawScore).toBe(50);
      expect(pricing.weight).toBe(15);
      expect(pricing.notes).toContain('Manual assessment required');

      const responsiveness = metrics.find(m => m.metricName === 'Responsiveness')!;
      expect(responsiveness.rawScore).toBe(50);
      expect(responsiveness.weight).toBe(15);

      const safety = metrics.find(m => m.metricName === 'Safety Record')!;
      expect(safety.rawScore).toBe(50);
      expect(safety.weight).toBe(10);
    });

    it('should sum all weights to 100', async () => {
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.rfim.findMany.mockResolvedValue([]);

      const metrics = await autoCalculateMetrics('sup-1', periodStart, periodEnd);

      const totalWeight = metrics.reduce((sum, m) => sum + m.weight, 0);
      expect(totalWeight).toBe(100);
    });

    it('should use receiveDate when actualArrivalDate is missing', async () => {
      const etaPort = new Date('2026-02-10');
      mockPrisma.mrrv.findMany.mockResolvedValue([
        {
          id: 'grn-1',
          receiveDate: new Date('2026-02-09'), // before etaPort, so on time
          shipments: [{ etaPort, actualArrivalDate: null }],
        },
      ]);
      mockPrisma.rfim.findMany.mockResolvedValue([]);

      const metrics = await autoCalculateMetrics('sup-1', periodStart, periodEnd);

      const onTime = metrics.find(m => m.metricName === 'On-Time Delivery')!;
      expect(onTime.rawScore).toBe(100); // 1/1 on time
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // create
  // ─────────────────────────────────────────────────────────────────────

  describe('create', () => {
    const data = {
      supplierId: 'sup-1',
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
    };

    it('should create evaluation with auto-calculated metrics when none provided', async () => {
      mockedGenDoc.mockResolvedValue('SE-001');
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.rfim.findMany.mockResolvedValue([]);
      const created = makeEvaluation();
      mockPrisma.supplierEvaluation.create.mockResolvedValue(created);

      const result = await create(data, 'user-1');

      expect(result).toEqual(created);
      expect(mockedGenDoc).toHaveBeenCalledWith('supplier_eval');
    });

    it('should create evaluation with provided metrics', async () => {
      mockedGenDoc.mockResolvedValue('SE-002');
      const metrics = [
        { metricName: 'Quality', weight: 50, rawScore: 80 },
        { metricName: 'Delivery', weight: 50, rawScore: 90 },
      ];
      const created = makeEvaluation({ metrics });
      mockPrisma.supplierEvaluation.create.mockResolvedValue(created);

      await create({ ...data, metrics }, 'user-1');

      const createArgs = mockPrisma.supplierEvaluation.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('draft');
      expect(createArgs.data.evaluatorId).toBe('user-1');
      expect(createArgs.data.metrics.create).toHaveLength(2);
    });

    it('should calculate overall score from weighted metrics', async () => {
      mockedGenDoc.mockResolvedValue('SE-003');
      const metrics = [
        { metricName: 'A', weight: 60, rawScore: 100 },
        { metricName: 'B', weight: 40, rawScore: 50 },
      ];
      mockPrisma.supplierEvaluation.create.mockResolvedValue(makeEvaluation());

      await create({ ...data, metrics }, 'user-1');

      const createArgs = mockPrisma.supplierEvaluation.create.mock.calls[0][0];
      // A: 100*60/100 = 60, B: 50*40/100 = 20, overall = 80
      expect(createArgs.data.overallScore).toBe(80);
    });

    it('should use $transaction for atomic creation', async () => {
      mockedGenDoc.mockResolvedValue('SE-004');
      mockPrisma.mrrv.findMany.mockResolvedValue([]);
      mockPrisma.rfim.findMany.mockResolvedValue([]);
      mockPrisma.supplierEvaluation.create.mockResolvedValue(makeEvaluation());

      await create(data, 'user-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // update
  // ─────────────────────────────────────────────────────────────────────

  describe('update', () => {
    it('should update a draft evaluation', async () => {
      const existing = makeEvaluation({ status: 'draft' });
      const updated = makeEvaluation({ notes: 'Updated notes' });
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(existing);
      mockPrisma.supplierEvaluation.update.mockResolvedValue(updated);

      const result = await update('eval-1', { notes: 'Updated notes' });

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when evaluation not found', async () => {
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', {})).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when evaluation is not draft', async () => {
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(makeEvaluation({ status: 'completed' }));

      await expect(update('eval-1', {})).rejects.toThrow('Only draft evaluations can be updated');
    });

    it('should replace metrics and recalculate overall score', async () => {
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(makeEvaluation({ status: 'draft' }));
      mockPrisma.supplierEvaluationMetric.deleteMany.mockResolvedValue({ count: 5 });
      mockPrisma.supplierEvaluationMetric.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.supplierEvaluation.update.mockResolvedValue(makeEvaluation());

      const metrics = [
        { metricName: 'X', weight: 70, rawScore: 100 },
        { metricName: 'Y', weight: 30, rawScore: 60 },
      ];

      await update('eval-1', { metrics });

      expect(mockPrisma.supplierEvaluationMetric.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { evaluationId: 'eval-1' } }),
      );
      expect(mockPrisma.supplierEvaluationMetric.createMany).toHaveBeenCalled();

      const updateArgs = mockPrisma.supplierEvaluation.update.mock.calls[0][0];
      // X: 100*70/100 = 70, Y: 60*30/100 = 18, overall = 88
      expect(updateArgs.data.overallScore).toBe(88);
    });

    it('should not delete metrics when none are provided', async () => {
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(makeEvaluation({ status: 'draft' }));
      mockPrisma.supplierEvaluation.update.mockResolvedValue(makeEvaluation());

      await update('eval-1', { notes: 'just notes' });

      expect(mockPrisma.supplierEvaluationMetric.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.supplierEvaluationMetric.createMany).not.toHaveBeenCalled();
    });

    it('should convert period strings to Date objects', async () => {
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(makeEvaluation({ status: 'draft' }));
      mockPrisma.supplierEvaluation.update.mockResolvedValue(makeEvaluation());

      await update('eval-1', { periodStart: '2026-04-01', periodEnd: '2026-06-30' });

      const updateArgs = mockPrisma.supplierEvaluation.update.mock.calls[0][0];
      expect(updateArgs.data.periodStart).toEqual(new Date('2026-04-01'));
      expect(updateArgs.data.periodEnd).toEqual(new Date('2026-06-30'));
    });
  });

  // ─────────────────────────────────────────────────────────────────────
  // complete
  // ─────────────────────────────────────────────────────────────────────

  describe('complete', () => {
    it('should complete a draft evaluation with metrics', async () => {
      const evaluation = makeEvaluation({
        status: 'draft',
        metrics: [{ metricName: 'Quality', weight: 100, rawScore: 90 }],
      });
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(evaluation);
      const completed = makeEvaluation({ status: 'completed' });
      mockPrisma.supplierEvaluation.update.mockResolvedValue(completed);

      const result = await complete('eval-1');

      expect(result.status).toBe('completed');
      expect(mockPrisma.supplierEvaluation.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'eval-1' },
          data: { status: 'completed' },
        }),
      );
    });

    it('should throw NotFoundError when evaluation not found', async () => {
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(null);

      await expect(complete('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when evaluation is not draft', async () => {
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(makeEvaluation({ status: 'completed', metrics: [] }));

      await expect(complete('eval-1')).rejects.toThrow('Only draft evaluations can be completed');
    });

    it('should throw BusinessRuleError when evaluation has no metrics', async () => {
      mockPrisma.supplierEvaluation.findUnique.mockResolvedValue(makeEvaluation({ status: 'draft', metrics: [] }));

      await expect(complete('eval-1')).rejects.toThrow('Evaluation must have at least one metric before completing');
    });
  });
});
