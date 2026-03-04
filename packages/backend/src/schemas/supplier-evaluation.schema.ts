import { z } from 'zod';

const uuid = z.string().uuid();

// ── Supplier Evaluation Metric ──────────────────────────────────────────

const metricSchema = z.object({
  metricName: z.string().min(1).max(50),
  weight: z.number().min(0).max(100),
  rawScore: z.number().min(0).max(100),
  notes: z.string().optional(),
});

// ── Create ──────────────────────────────────────────────────────────────

export const supplierEvaluationCreateSchema = z.object({
  supplierId: uuid,
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  notes: z.string().optional(),
  metrics: z.array(metricSchema).optional(),
});

// ── Update ──────────────────────────────────────────────────────────────

export const supplierEvaluationUpdateSchema = z.object({
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  notes: z.string().optional(),
  metrics: z.array(metricSchema).optional(),
});
