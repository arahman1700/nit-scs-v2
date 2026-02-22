import { prisma } from '../utils/prisma.js';
import { getDocPrefix, getDocNumberFormat, getDocNumberPadding } from './system-config.service.js';

/**
 * Generate a sequential document number.
 * Format is DB-configurable (default: PREFIX-YYYY-NNNN).
 * Prefix and padding are also configurable via SystemSetting.
 * Uses upsert on document_counters for concurrency safety.
 */
export async function generateDocumentNumber(documentType: string): Promise<string> {
  const [prefix, format, padding] = await Promise.all([
    getDocPrefix(documentType),
    getDocNumberFormat(),
    getDocNumberPadding(),
  ]);
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
  const paddedNumber = String(lastNumber).padStart(padding, '0');

  // Apply format pattern: {PREFIX}-{YYYY}-{NNNN}
  return format
    .replace('{PREFIX}', prefix)
    .replace('{YYYY}', String(year))
    .replace('{YY}', String(year).slice(-2))
    .replace('{MM}', String(new Date().getMonth() + 1).padStart(2, '0'))
    .replace('{NNNN}', paddedNumber)
    .replace('{N}', String(lastNumber));
}
