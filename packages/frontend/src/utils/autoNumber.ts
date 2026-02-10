// ============================================================================
// Document Number Preview Utility
// Shows a placeholder format in the form header before submission.
// Actual document numbers are generated server-side by the backend service.
// ============================================================================

const DOC_PREFIXES: Record<string, string> = {
  mrrv: 'GRN',
  mirv: 'MI',
  mrv: 'MRN',
  rfim: 'QCI',
  osd: 'DR',
  jo: 'JO-NIT',
  gatepass: 'GP',
  'stock-transfer': 'ST',
  mrf: 'MR',
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
