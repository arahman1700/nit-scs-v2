import { z } from 'zod';

const uuid = z.string().uuid();

// ── Notification Schemas ──────────────────────────────────────────────

export const notificationListSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  unreadOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => val === 'true'),
});

export const notificationCreateSchema = z.object({
  recipientId: uuid,
  title: z.string().min(1, 'Title is required').max(200),
  titleAr: z.string().max(200).optional(),
  body: z.string().optional(),
  notificationType: z.string().min(1, 'Notification type is required').max(30),
  referenceTable: z.string().max(50).optional(),
  referenceId: uuid.optional(),
});

// ── Audit Log Schemas ─────────────────────────────────────────────────

export const auditLogQuerySchema = z.object({
  tableName: z.string().optional(),
  recordId: uuid.optional(),
  action: z.string().optional(),
  performedById: uuid.optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

// ── Dashboard Schemas ─────────────────────────────────────────────────

export const dashboardQuerySchema = z.object({
  projectId: uuid.optional(),
  warehouseId: uuid.optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});
