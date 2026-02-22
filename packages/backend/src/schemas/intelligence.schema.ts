import { z } from 'zod';

/**
 * Validation schemas for Intelligence API query parameters.
 */

/** GET /intelligence/anomalies */
export const anomaliesQuerySchema = z.object({
  since: z.string().datetime({ message: 'since must be a valid ISO 8601 date string' }).optional(),
  notify: z.enum(['true', 'false'], { message: 'notify must be "true" or "false"' }).optional(),
});

/** GET /intelligence/reorder-predictions */
export const reorderPredictionsQuerySchema = z.object({
  warehouseId: z.string().uuid({ message: 'warehouseId must be a valid UUID' }).optional(),
});
