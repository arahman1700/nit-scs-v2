import { z } from 'zod';

export const createTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300),
    description: z.string().optional(),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).default('open'),
    priority: z.enum(['high', 'medium', 'low']).default('medium'),
    dueDate: z.string().optional(),
    assigneeId: z.string().uuid().optional(),
    projectId: z.string().uuid().optional(),
    tags: z.array(z.string().max(50)).default([]),
  }),
});

export const updateTaskSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300).optional(),
    description: z.string().optional(),
    priority: z.enum(['high', 'medium', 'low']).optional(),
    dueDate: z.string().nullable().optional(),
    projectId: z.string().uuid().nullable().optional(),
    tags: z.array(z.string().max(50)).optional(),
  }),
});

export const changeStatusSchema = z.object({
  body: z.object({
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']),
  }),
});

export const assignTaskSchema = z.object({
  body: z.object({
    assigneeId: z.string().uuid().nullable(),
  }),
});

export const addCommentSchema = z.object({
  body: z.object({
    body: z.string().min(1).max(5000),
  }),
});
