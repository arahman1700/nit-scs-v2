import { z } from 'zod';

export const createDelegationSchema = z.object({
  body: z.object({
    delegateId: z.string().uuid('Invalid delegate ID'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().min(1, 'End date is required'),
    scope: z.string().default('all'),
    notes: z.string().max(1000).optional(),
  }),
});

export const updateDelegationSchema = z.object({
  body: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    scope: z.string().optional(),
    isActive: z.boolean().optional(),
    notes: z.string().max(1000).optional(),
  }),
});
