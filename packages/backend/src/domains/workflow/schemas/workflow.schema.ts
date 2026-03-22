import { z } from 'zod';

// ── Workflow Schemas ────────────────────────────────────────────────────

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  entityType: z.string().min(1).max(50),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
});

export const updateWorkflowSchema = createWorkflowSchema.partial();

// ── Condition Schemas ───────────────────────────────────────────────────

const leafConditionSchema = z.object({
  field: z.string().min(1).max(255),
  op: z.enum(['eq', 'ne', 'gt', 'gte', 'lt', 'lte', 'in', 'contains']),
  value: z.unknown(),
});

// Recursive condition tree
const conditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    leafConditionSchema,
    z.object({
      operator: z.enum(['AND', 'OR']),
      conditions: z.array(conditionSchema),
    }),
  ]),
);

// ── Action Schemas ──────────────────────────────────────────────────────

const actionSchema = z.object({
  type: z.enum([
    'send_email',
    'create_notification',
    'change_status',
    'create_follow_up',
    'reserve_stock',
    'assign_task',
    'webhook',
    'conditional_branch',
  ]),
  params: z.record(z.unknown()),
});

// ── Rule Schemas ────────────────────────────────────────────────────────

/**
 * Validates a standard 5-part cron expression (minute hour day month weekday).
 * Accepts: *, numbers, ranges (1-5), steps (* /10), lists (1,3,5).
 */
const CRON_PART = /^(\*|\d+((-\d+)?(,\d+(-\d+)?)*)?)(\/\d+)?$/;
function isValidCron(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every(p => CRON_PART.test(p));
}

export const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  triggerEvent: z.string().min(1).max(100),
  conditions: conditionSchema.optional().default({}),
  actions: z.array(actionSchema).min(1),
  isActive: z.boolean().optional().default(true),
  stopOnMatch: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
  cronExpression: z
    .string()
    .max(50)
    .refine(isValidCron, 'Invalid cron expression (expected 5-part: minute hour day month weekday)')
    .optional(),
});

export const updateRuleSchema = createRuleSchema
  .extend({
    cronExpression: z
      .string()
      .max(50)
      .refine(isValidCron, 'Invalid cron expression (expected 5-part: minute hour day month weekday)')
      .nullable()
      .optional(),
  })
  .partial();

// ── Test Rule Schema ────────────────────────────────────────────────────

export const testRuleSchema = z.object({
  event: z.object({
    type: z.string().max(100),
    entityType: z.string().max(100),
    entityId: z.string().max(100),
    action: z.string().max(100),
    payload: z.record(z.unknown()),
    performedById: z.string().max(100).optional(),
    timestamp: z.string().max(50).optional(),
  }),
});
