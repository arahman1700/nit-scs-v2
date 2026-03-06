import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import type { ListParams } from '../../../types/dto.js';

// ── Prisma includes ─────────────────────────────────────────────────────

const LIST_INCLUDE = {
  supplier: { select: { id: true, supplierCode: true, supplierName: true } },
  evaluator: { select: { id: true, fullName: true } },
  _count: { select: { metrics: true } },
} satisfies Prisma.SupplierEvaluationInclude;

const DETAIL_INCLUDE = {
  supplier: { select: { id: true, supplierCode: true, supplierName: true, rating: true, status: true } },
  evaluator: { select: { id: true, fullName: true, email: true } },
  metrics: { orderBy: { weight: 'desc' as const } },
} satisfies Prisma.SupplierEvaluationInclude;

// ── List ──────────────────────────────────────────────────────────────────

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};

  if (params.search) {
    where.OR = [
      { evaluationNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { supplierName: { contains: params.search, mode: 'insensitive' } } },
      { supplier: { supplierCode: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.supplierId) where.supplierId = params.supplierId;

  const [data, total] = await Promise.all([
    prisma.supplierEvaluation.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.supplierEvaluation.count({ where }),
  ]);

  return { data, total };
}

// ── Get by ID ────────────────────────────────────────────────────────────

export async function getById(id: string) {
  const evaluation = await prisma.supplierEvaluation.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!evaluation) throw new NotFoundError('Supplier Evaluation', id);
  return evaluation;
}

// ── Auto-calculate metrics from historical data ──────────────────────────

export async function autoCalculateMetrics(
  supplierId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<Array<{ metricName: string; weight: number; rawScore: number; weightedScore: number; notes: string }>> {
  const metrics: Array<{ metricName: string; weight: number; rawScore: number; weightedScore: number; notes: string }> =
    [];

  // ── On-Time Delivery (weight: 30%) ────────────────────────────────────
  // Compare Mrrv receiveDate against Shipment etaPort for supplier's GRNs
  const grns = await prisma.mrrv.findMany({
    where: {
      supplierId,
      receiveDate: { gte: periodStart, lte: periodEnd },
    },
    select: {
      id: true,
      receiveDate: true,
      shipments: {
        select: { etaPort: true, actualArrivalDate: true },
        take: 1,
      },
    },
  });

  let onTimeCount = 0;
  let deliveryTotal = 0;
  for (const grn of grns) {
    const shipment = grn.shipments[0];
    if (shipment?.etaPort) {
      deliveryTotal++;
      const actualDate = shipment.actualArrivalDate ?? grn.receiveDate;
      if (actualDate <= shipment.etaPort) {
        onTimeCount++;
      }
    }
  }
  const onTimeScore = deliveryTotal > 0 ? Math.round((onTimeCount / deliveryTotal) * 100) : 50;
  const onTimeWeight = 30;
  metrics.push({
    metricName: 'On-Time Delivery',
    weight: onTimeWeight,
    rawScore: onTimeScore,
    weightedScore: Number(((onTimeScore * onTimeWeight) / 100).toFixed(2)),
    notes: `${onTimeCount}/${deliveryTotal} deliveries on time in period`,
  });

  // ── Quality (weight: 30%) ─────────────────────────────────────────────
  // Count QCI inspections (Rfim) that passed vs failed for this supplier's GRNs
  const rfims = await prisma.rfim.findMany({
    where: {
      mrrv: {
        supplierId,
        receiveDate: { gte: periodStart, lte: periodEnd },
      },
      status: 'completed',
    },
    select: { result: true },
  });

  let passCount = 0;
  const totalInspections = rfims.length;
  for (const rfim of rfims) {
    if (rfim.result === 'pass' || rfim.result === 'conditional') {
      passCount++;
    }
  }
  const qualityScore = totalInspections > 0 ? Math.round((passCount / totalInspections) * 100) : 50;
  const qualityWeight = 30;
  metrics.push({
    metricName: 'Quality',
    weight: qualityWeight,
    rawScore: qualityScore,
    weightedScore: Number(((qualityScore * qualityWeight) / 100).toFixed(2)),
    notes: `${passCount}/${totalInspections} inspections passed in period`,
  });

  // ── Pricing Compliance (weight: 15%) ──────────────────────────────────
  // Placeholder — manual scoring; default to 50 if no data
  const pricingWeight = 15;
  const pricingScore = 50;
  metrics.push({
    metricName: 'Pricing Compliance',
    weight: pricingWeight,
    rawScore: pricingScore,
    weightedScore: Number(((pricingScore * pricingWeight) / 100).toFixed(2)),
    notes: 'Manual assessment required — default score applied',
  });

  // ── Responsiveness (weight: 15%) ──────────────────────────────────────
  // Placeholder — manual scoring; default to 50 if no data
  const responsivenessWeight = 15;
  const responsivenessScore = 50;
  metrics.push({
    metricName: 'Responsiveness',
    weight: responsivenessWeight,
    rawScore: responsivenessScore,
    weightedScore: Number(((responsivenessScore * responsivenessWeight) / 100).toFixed(2)),
    notes: 'Manual assessment required — default score applied',
  });

  // ── Safety Record (weight: 10%) ───────────────────────────────────────
  // Placeholder — manual scoring; default to 50 if no data
  const safetyWeight = 10;
  const safetyScore = 50;
  metrics.push({
    metricName: 'Safety Record',
    weight: safetyWeight,
    rawScore: safetyScore,
    weightedScore: Number(((safetyScore * safetyWeight) / 100).toFixed(2)),
    notes: 'Manual assessment required — default score applied',
  });

  return metrics;
}

// ── Create ───────────────────────────────────────────────────────────────

export async function create(
  data: {
    supplierId: string;
    periodStart: string;
    periodEnd: string;
    notes?: string;
    metrics?: Array<{ metricName: string; weight: number; rawScore: number; notes?: string }>;
  },
  userId: string,
) {
  return prisma.$transaction(async tx => {
    const evaluationNumber = await generateDocumentNumber('supplier_eval');

    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);

    // Auto-calculate metrics if none provided
    let metricsData = data.metrics;
    if (!metricsData || metricsData.length === 0) {
      metricsData = await autoCalculateMetrics(data.supplierId, periodStart, periodEnd);
    }

    // Calculate weighted scores and overall
    const metricsToCreate = metricsData.map(m => ({
      metricName: m.metricName,
      weight: m.weight,
      rawScore: m.rawScore,
      weightedScore: Number(((m.rawScore * m.weight) / 100).toFixed(2)),
      notes: m.notes ?? null,
    }));

    const overallScore = metricsToCreate.reduce((sum, m) => sum + m.weightedScore, 0);

    const evaluation = await tx.supplierEvaluation.create({
      data: {
        evaluationNumber,
        supplierId: data.supplierId,
        evaluatorId: userId,
        periodStart,
        periodEnd,
        status: 'draft',
        overallScore,
        notes: data.notes ?? null,
        metrics: {
          create: metricsToCreate,
        },
      },
      include: DETAIL_INCLUDE,
    });

    return evaluation;
  });
}

// ── Update ───────────────────────────────────────────────────────────────

export async function update(
  id: string,
  data: {
    periodStart?: string;
    periodEnd?: string;
    notes?: string;
    metrics?: Array<{ metricName: string; weight: number; rawScore: number; notes?: string }>;
  },
) {
  const existing = await prisma.supplierEvaluation.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Supplier Evaluation', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft evaluations can be updated');

  const updateData: Record<string, unknown> = {};
  if (data.periodStart) updateData.periodStart = new Date(data.periodStart);
  if (data.periodEnd) updateData.periodEnd = new Date(data.periodEnd);
  if (data.notes !== undefined) updateData.notes = data.notes;

  // If metrics provided, replace them and recalculate overall score
  if (data.metrics && data.metrics.length > 0) {
    const metricsToCreate = data.metrics.map(m => ({
      metricName: m.metricName,
      weight: m.weight,
      rawScore: m.rawScore,
      weightedScore: Number(((m.rawScore * m.weight) / 100).toFixed(2)),
      notes: m.notes ?? null,
    }));
    const overallScore = metricsToCreate.reduce((sum, m) => sum + m.weightedScore, 0);
    updateData.overallScore = overallScore;

    // Delete existing metrics and recreate
    await prisma.supplierEvaluationMetric.deleteMany({ where: { evaluationId: id } });
    await prisma.supplierEvaluationMetric.createMany({
      data: metricsToCreate.map(m => ({ ...m, evaluationId: id })),
    });
  }

  const updated = await prisma.supplierEvaluation.update({
    where: { id },
    data: updateData,
    include: DETAIL_INCLUDE,
  });

  return { existing, updated };
}

// ── Complete (finalize evaluation) ───────────────────────────────────────

export async function complete(id: string) {
  const evaluation = await prisma.supplierEvaluation.findUnique({
    where: { id },
    include: { metrics: true },
  });
  if (!evaluation) throw new NotFoundError('Supplier Evaluation', id);
  if (evaluation.status !== 'draft') throw new BusinessRuleError('Only draft evaluations can be completed');
  if (evaluation.metrics.length === 0)
    throw new BusinessRuleError('Evaluation must have at least one metric before completing');

  const updated = await prisma.supplierEvaluation.update({
    where: { id },
    data: { status: 'completed' },
    include: DETAIL_INCLUDE,
  });

  return updated;
}
