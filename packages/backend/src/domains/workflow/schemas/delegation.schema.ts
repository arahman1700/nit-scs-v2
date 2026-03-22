import { z } from 'zod';

export const createDelegationSchema = z.object({
  delegateId: z.string().uuid('Invalid delegate ID'),
  startDate: z.string().min(1, 'Start date is required').max(50),
  endDate: z.string().min(1, 'End date is required').max(50),
  scope: z.string().max(255).default('all'),
  notes: z.string().max(1000).optional(),
});

export const updateDelegationSchema = z.object({
  startDate: z.string().max(50).optional(),
  endDate: z.string().max(50).optional(),
  scope: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(1000).optional(),
});
