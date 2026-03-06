import { z } from 'zod';

/** Valid document types for comments (matches route patterns) */
const DOCUMENT_TYPES = [
  'mrrv',
  'mirv',
  'mrv',
  'rfim',
  'osd',
  'job-order',
  'gate-pass',
  'stock-transfer',
  'mrf',
  'shipment',
] as const;

export const createCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment cannot be empty').max(10000),
  }),
});

export const listCommentsQuerySchema = z.object({
  query: z
    .object({
      page: z.coerce.number().int().min(1).default(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).default(25).optional(),
    })
    .optional(),
});

export const commentParamsSchema = z.object({
  params: z.object({
    documentType: z.enum(DOCUMENT_TYPES),
    documentId: z.string().uuid(),
  }),
});

export const commentIdParamsSchema = z.object({
  params: z.object({
    documentType: z.enum(DOCUMENT_TYPES),
    documentId: z.string().uuid(),
    commentId: z.string().uuid(),
  }),
});

export const updateCommentSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Comment cannot be empty').max(10000),
  }),
});
