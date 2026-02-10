/**
 * Barcode Service — GS1 formatting, bin location QR, and item label generation
 */

export interface LabelData {
  barcodeValue: string;
  barcodeType: 'code128' | 'datamatrix' | 'qrcode';
  lines: string[];
}

/**
 * Format a GS1-128 barcode string using Application Identifiers.
 * AI (01) = GTIN, AI (10) = Batch/Lot, AI (17) = Expiry (YYMMDD), AI (30) = Qty
 */
export function formatGS1Barcode(params: { itemCode: string; lot?: string; expiry?: Date; qty?: number }): string {
  // Pad itemCode to 14 digits for GTIN-14 format (AI 01)
  const gtin = params.itemCode.replace(/\D/g, '').padStart(14, '0').slice(0, 14);
  let gs1 = `(01)${gtin}`;

  if (params.lot) {
    // AI (10) — Batch/Lot number, max 20 alphanumeric chars
    const lot = params.lot.slice(0, 20);
    gs1 += `(10)${lot}`;
  }

  if (params.expiry) {
    // AI (17) — Expiry date in YYMMDD format
    const yy = String(params.expiry.getFullYear()).slice(-2);
    const mm = String(params.expiry.getMonth() + 1).padStart(2, '0');
    const dd = String(params.expiry.getDate()).padStart(2, '0');
    gs1 += `(17)${yy}${mm}${dd}`;
  }

  if (params.qty != null && params.qty > 0) {
    // AI (30) — Variable count of items
    gs1 += `(30)${params.qty}`;
  }

  return gs1;
}

/**
 * Generate a JSON-encoded string for a bin location QR code.
 */
export function generateBinLocationQR(params: { warehouseId: string; zoneCode: string; binCode: string }): string {
  return JSON.stringify({
    type: 'bin',
    wh: params.warehouseId,
    zone: params.zoneCode,
    bin: params.binCode,
  });
}

/**
 * Generate structured label data for an item.
 */
export function generateItemLabel(item: {
  itemCode: string;
  itemDescription: string;
  barcode?: string;
  uom?: string;
}): LabelData {
  const barcodeValue = item.barcode || item.itemCode;
  const lines = [item.itemDescription];

  if (item.itemCode) {
    lines.push(`Code: ${item.itemCode}`);
  }
  if (item.uom) {
    lines.push(`UOM: ${item.uom}`);
  }

  return {
    barcodeValue,
    barcodeType: 'code128',
    lines,
  };
}
