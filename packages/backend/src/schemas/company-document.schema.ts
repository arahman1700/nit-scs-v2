import { z } from 'zod';

export const updateDocumentSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(300).optional(),
    titleAr: z.string().max(300).optional(),
    description: z.string().optional(),
    category: z.enum(['policy', 'procedure', 'contract', 'certificate', 'template', 'sop', 'other']).optional(),
    tags: z.array(z.string().max(50)).optional(),
    visibility: z.enum(['all', 'admin_only', 'management']).optional(),
  }),
});
