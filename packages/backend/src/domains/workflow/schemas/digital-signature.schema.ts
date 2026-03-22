import { z } from 'zod';

export const createSignatureSchema = z.object({
  documentType: z.string().min(1).max(50),
  documentId: z.string().uuid(),
  signatureData: z.string().min(1, 'Signature data is required').max(10000),
  purpose: z.enum(['approval', 'delivery_confirmation', 'receipt', 'inspection', 'handover']),
  notes: z.string().max(1000).optional(),
});

export const listSignaturesQuerySchema = z.object({
  documentType: z.string().min(1).max(50),
  documentId: z.string().uuid(),
});
