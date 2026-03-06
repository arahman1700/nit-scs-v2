import { z } from 'zod';

// ── Workflow Schemas ────────────────────────────────────────────────────

export const createWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  entityType: z.string().min(1).max(50),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(0),
});

export const updateWorkflowSchema = createWorkflowSchema.partial();

// ── Condition Schemas ───────────────────────────────────────────────────

const leafConditionSchema = z.object({
  field: z.string().min(1),
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
  ]),
  params: z.record(z.unknown()),
});

// ── Rule Schemas ────────────────────────────────────────────────────────

export const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  triggerEvent: z.string().min(1).max(100),
  conditions: conditionSchema.optional().default({}),
  actions: z.array(actionSchema).min(1),
  isActive: z.boolean().optional().default(true),
  stopOnMatch: z.boolean().optional().default(false),
  sortOrder: z.number().int().optional().default(0),
});

export const updateRuleSchema = createRuleSchema.partial();

// ── Test Rule Schema ────────────────────────────────────────────────────

export const testRuleSchema = z.object({
  event: z.object({
    type: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    action: z.string(),
    payload: z.record(z.unknown()),
    performedById: z.string().optional(),
    timestamp: z.string().optional(),
  }),
});
