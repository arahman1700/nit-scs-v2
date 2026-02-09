import { prisma } from '../utils/prisma.js';
import { DOC_PREFIXES } from '@nit-scs-v2/shared/constants';

/**
 * Generate a sequential document number: PREFIX-YYYY-NNNN
 * Uses upsert on document_counters for concurrency safety.
 */
export async function generateDocumentNumber(documentType: string): Promise<string> {
  const prefix = DOC_PREFIXES[documentType] || documentType.toUpperCase();
  const year = new Date().getFullYear();

  // Atomically increment the counter
  const counter = await prisma.$queryRaw<{ last_number: number }[]>`
    INSERT INTO document_counters (id, document_type, prefix, year, last_number)
    VALUES (gen_random_uuid(), ${documentType}, ${prefix}, ${year}, 1)
    ON CONFLICT (document_type, year)
    DO UPDATE SET last_number = document_counters.last_number + 1
    RETURNING last_number
  `;

  const lastNumber = counter[0].last_number;
  return `${prefix}-${year}-${String(lastNumber).padStart(4, '0')}`;
}
