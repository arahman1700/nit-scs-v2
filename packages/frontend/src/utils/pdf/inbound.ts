import { createNitPdf, addInfoSection, addTable, downloadPdf, getStartY, PRIMARY_BLUE } from './core';
import type { TableColumn } from './core';

// ---------------------------------------------------------------------------
// GRN (Goods Receipt Note)
// ---------------------------------------------------------------------------

export interface GrnLineItem {
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  condition?: string;
}

export interface GrnData {
  documentNumber: string;
  supplier: string;
  warehouse: string;
  receivedDate: string;
  poNumber?: string;
  status: string;
  items: GrnLineItem[];
  notes?: string;
}

export async function generateGrnPdf(grn: GrnData): Promise<void> {
  const doc = await createNitPdf({
    title: 'Goods Receipt Note (GRN)',
    documentNumber: grn.documentNumber,
    subtitle: `Supplier: ${grn.supplier}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: grn.documentNumber },
      { label: 'Supplier', value: grn.supplier },
      { label: 'Warehouse', value: grn.warehouse },
      { label: 'Received Date', value: grn.receivedDate },
      { label: 'PO Number', value: grn.poNumber ?? 'N/A' },
      { label: 'Status', value: grn.status },
    ],
    getStartY(doc),
  );

  y = await addTable(
    doc,
    [
      { header: '#', dataKey: '_index', width: 10 },
      { header: 'Code', dataKey: 'itemCode', width: 30 },
      { header: 'Description', dataKey: 'itemName' },
      { header: 'Unit', dataKey: 'unit', width: 15 },
      { header: 'Qty', dataKey: 'quantity', width: 15 },
      { header: 'Price', dataKey: 'unitPrice', width: 20 },
      { header: 'Total', dataKey: 'totalPrice', width: 25 },
      { header: 'Condition', dataKey: 'condition', width: 20 },
    ],
    grn.items.map((item, i) => ({
      ...item,
      _index: String(i + 1),
      unitPrice: item.unitPrice.toLocaleString(),
      totalPrice: item.totalPrice.toLocaleString(),
      condition: item.condition ?? 'New',
    })),
    y + 4,
  );

  // Grand total
  const grandTotal = grn.items.reduce((s, i) => s + i.totalPrice, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY_BLUE);
  doc.text(`Grand Total: ${grandTotal.toLocaleString()} SAR`, doc.internal.pageSize.getWidth() - 14, y + 8, {
    align: 'right',
  });

  if (grn.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text(`Notes: ${grn.notes}`, 14, y + 16);
  }

  downloadPdf(doc, `GRN_${grn.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}

// ---------------------------------------------------------------------------
// QCI (Quality Control Inspection)
// ---------------------------------------------------------------------------

export interface QciLineItem {
  itemCode: string;
  itemName: string;
  inspectedQty: number;
  passedQty: number;
  failedQty: number;
  remarks: string;
}

export interface QciData {
  documentNumber: string;
  linkedGrn: string;
  inspector: string;
  inspectionDate: string;
  result: string;
  status: string;
  items: QciLineItem[];
}

export async function generateQciPdf(qci: QciData): Promise<void> {
  const doc = await createNitPdf({
    title: 'Quality Control Inspection (QCI)',
    documentNumber: qci.documentNumber,
    subtitle: `Result: ${qci.result}`,
  });

  const y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: qci.documentNumber },
      { label: 'Linked GRN', value: qci.linkedGrn },
      { label: 'Inspector', value: qci.inspector },
      { label: 'Inspection Date', value: qci.inspectionDate },
      { label: 'Result', value: qci.result },
      { label: 'Status', value: qci.status },
    ],
    getStartY(doc),
  );

  await addTable(
    doc,
    [
      { header: '#', dataKey: '_index', width: 10 },
      { header: 'Code', dataKey: 'itemCode', width: 25 },
      { header: 'Description', dataKey: 'itemName' },
      { header: 'Inspected', dataKey: 'inspectedQty', width: 20 },
      { header: 'Passed', dataKey: 'passedQty', width: 18 },
      { header: 'Failed', dataKey: 'failedQty', width: 18 },
      { header: 'Remarks', dataKey: 'remarks', width: 30 },
    ],
    qci.items.map((item, i) => ({ ...item, _index: String(i + 1) })),
    y + 4,
  );

  downloadPdf(doc, `QCI_${qci.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}

// ---------------------------------------------------------------------------
// DR (Discrepancy Report)
// ---------------------------------------------------------------------------

export interface DrLineItem {
  itemCode: string;
  itemName: string;
  expectedQty: number;
  receivedQty: number;
  discrepancyQty: number;
  remarks: string;
}

export interface DrData {
  documentNumber: string;
  linkedGrn: string;
  discrepancyType: string;
  reportedBy: string;
  reportedDate: string;
  status: string;
  items: DrLineItem[];
}

export async function generateDrPdf(dr: DrData): Promise<void> {
  const doc = await createNitPdf({
    title: 'Discrepancy Report (DR)',
    documentNumber: dr.documentNumber,
    subtitle: `Type: ${dr.discrepancyType}`,
  });

  const y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: dr.documentNumber },
      { label: 'Linked GRN', value: dr.linkedGrn },
      { label: 'Type', value: dr.discrepancyType },
      { label: 'Reported By', value: dr.reportedBy },
      { label: 'Date', value: dr.reportedDate },
      { label: 'Status', value: dr.status },
    ],
    getStartY(doc),
  );

  await addTable(
    doc,
    [
      { header: '#', dataKey: '_index', width: 10 },
      { header: 'Code', dataKey: 'itemCode', width: 25 },
      { header: 'Description', dataKey: 'itemName' },
      { header: 'Expected', dataKey: 'expectedQty', width: 20 },
      { header: 'Received', dataKey: 'receivedQty', width: 20 },
      { header: 'Discrepancy', dataKey: 'discrepancyQty', width: 22 },
      { header: 'Remarks', dataKey: 'remarks', width: 30 },
    ],
    dr.items.map((item, i) => ({ ...item, _index: String(i + 1) })),
    y + 4,
  );

  downloadPdf(doc, `DR_${dr.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}
