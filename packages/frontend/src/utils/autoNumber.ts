// ============================================================================
// Document Number Preview Utility
// Shows a placeholder format in the form header before submission.
// Actual document numbers are generated server-side by the backend service.
// ============================================================================

const DOC_PREFIXES: Record<string, string> = {
  mrrv: 'MRRV',
  mirv: 'MIRV',
  mrv: 'MRV',
  rfim: 'RFIM',
  osd: 'OSD',
  jo: 'JO-NIT',
  gatepass: 'GP',
  'stock-transfer': 'ST',
  mrf: 'MRF',
  shipment: 'SH',
  customs: 'CC',
};

/**
 * Preview-only: returns a placeholder document number format.
 * This is displayed before the form is submitted. The real number
 * comes from the server response after creation.
 */
export function previewNextNumber(documentType: string): string {
  const prefix = DOC_PREFIXES[documentType] || documentType.toUpperCase();
  const year = new Date().getFullYear();
  return `${prefix}-${year}-XXXX`;
}

/**
 * @deprecated Document numbers are now generated server-side.
 * This function is kept only for backward compatibility during migration.
 */
export function generateDocumentNumber(documentType: string): string {
  return previewNextNumber(documentType);
}
