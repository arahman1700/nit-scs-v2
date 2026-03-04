import { prisma } from '../utils/prisma.js';

const SIGNER_SELECT = { id: true, fullName: true, email: true, department: true, role: true } as const;

const VALID_PURPOSES = new Set(['approval', 'delivery_confirmation', 'receipt', 'inspection', 'handover']);

/**
 * Validate that signatureData is a valid base64 PNG string.
 * Accepts both data-URI format and raw base64.
 */
function validateSignatureData(signatureData: string): void {
  if (signatureData.startsWith('data:image/png;base64,')) {
    const base64Part = signatureData.slice('data:image/png;base64,'.length);
    if (base64Part.length === 0) {
      throw new Error('Signature data is empty');
    }
    return;
  }

  // Check for raw base64 — must be non-empty and valid base64 chars
  if (/^[A-Za-z0-9+/=]+$/.test(signatureData) && signatureData.length > 0) {
    return;
  }

  throw new Error('Invalid signature data: must be a base64 encoded PNG (data URI or raw base64)');
}

function validatePurpose(purpose: string): void {
  if (!VALID_PURPOSES.has(purpose)) {
    throw new Error(`Invalid purpose: ${purpose}. Must be one of: ${[...VALID_PURPOSES].join(', ')}`);
  }
}

export interface CreateSignatureDto {
  documentType: string;
  documentId: string;
  signedById: string;
  signatureData: string;
  purpose: string;
  ipAddress?: string;
  notes?: string;
}

/**
 * Create a new digital signature for a document.
 */
export async function createSignature(dto: CreateSignatureDto) {
  validateSignatureData(dto.signatureData);
  validatePurpose(dto.purpose);

  return prisma.digitalSignature.create({
    data: {
      documentType: dto.documentType,
      documentId: dto.documentId,
      signedById: dto.signedById,
      signatureData: dto.signatureData,
      purpose: dto.purpose,
      ipAddress: dto.ipAddress ?? null,
      notes: dto.notes ?? null,
    },
    include: { signedBy: { select: SIGNER_SELECT } },
  });
}

/**
 * Get all signatures for a specific document.
 */
export async function getByDocument(documentType: string, documentId: string) {
  return prisma.digitalSignature.findMany({
    where: { documentType, documentId },
    include: { signedBy: { select: SIGNER_SELECT } },
    orderBy: { signedAt: 'desc' },
  });
}

/**
 * Get a single signature by ID.
 */
export async function getById(id: string) {
  return prisma.digitalSignature.findUnique({
    where: { id },
    include: { signedBy: { select: SIGNER_SELECT } },
  });
}
