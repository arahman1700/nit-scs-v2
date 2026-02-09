import { z } from 'zod';

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

export const bulkActionSchema = z.object({
  body: z.object({
    documentType: z.enum(DOCUMENT_TYPES),
    ids: z.array(z.string().uuid()).min(1).max(100),
    action: z.string().min(1).max(50),
    /** Optional payload for actions that require body data (e.g., reject with reason) */
    payload: z.record(z.unknown()).optional(),
  }),
});
