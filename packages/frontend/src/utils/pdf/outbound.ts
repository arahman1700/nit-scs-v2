import { createNitPdf, addInfoSection, addTable, downloadPdf, getStartY, PRIMARY_BLUE } from './core';
import type { GrnLineItem } from './inbound';
import type { TableColumn } from './core';

// ---------------------------------------------------------------------------
// MI (Material Issuance)
// ---------------------------------------------------------------------------

export interface MiData {
  documentNumber: string;
  project: string;
  requester: string;
  issuedDate: string;
  warehouse: string;
  status: string;
  items: GrnLineItem[];
  notes?: string;
}

export function generateMiPdf(mi: MiData): void {
  const doc = createNitPdf({
    title: 'Material Issuance (MI)',
    documentNumber: mi.documentNumber,
    subtitle: `Project: ${mi.project}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: mi.documentNumber },
      { label: 'Project', value: mi.project },
      { label: 'Requester', value: mi.requester },
      { label: 'Issued Date', value: mi.issuedDate },
      { label: 'Warehouse', value: mi.warehouse },
      { label: 'Status', value: mi.status },
    ],
    getStartY(doc),
  );

  y = addTable(
    doc,
    [
      { header: '#', dataKey: '_index', width: 10 },
      { header: 'Code', dataKey: 'itemCode', width: 30 },
      { header: 'Description', dataKey: 'itemName' },
      { header: 'Unit', dataKey: 'unit', width: 15 },
      { header: 'Qty', dataKey: 'quantity', width: 15 },
      { header: 'Price', dataKey: 'unitPrice', width: 20 },
      { header: 'Total', dataKey: 'totalPrice', width: 25 },
    ],
    mi.items.map((item, i) => ({
      ...item,
      _index: String(i + 1),
      unitPrice: item.unitPrice.toLocaleString(),
      totalPrice: item.totalPrice.toLocaleString(),
    })),
    y + 4,
  );

  const grandTotal = mi.items.reduce((s, i) => s + i.totalPrice, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(PRIMARY_BLUE);
  doc.text(`Grand Total: ${grandTotal.toLocaleString()} SAR`, doc.internal.pageSize.getWidth() - 14, y + 8, {
    align: 'right',
  });

  downloadPdf(doc, `MI_${mi.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}

// ---------------------------------------------------------------------------
// MRN (Material Return Note)
// ---------------------------------------------------------------------------

export interface MrnLineItem {
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
  condition: string;
}

export interface MrnData {
  documentNumber: string;
  returnType: string;
  project: string;
  warehouse: string;
  returnedBy: string;
  receivedBy: string;
  status: string;
  items: MrnLineItem[];
  notes?: string;
}

export function generateMrnPdf(mrn: MrnData): void {
  const doc = createNitPdf({
    title: 'Material Return Note (MRN)',
    documentNumber: mrn.documentNumber,
    subtitle: `Return Type: ${mrn.returnType}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: mrn.documentNumber },
      { label: 'Return Type', value: mrn.returnType },
      { label: 'Project', value: mrn.project },
      { label: 'Warehouse', value: mrn.warehouse },
      { label: 'Returned By', value: mrn.returnedBy },
      { label: 'Received By', value: mrn.receivedBy },
      { label: 'Status', value: mrn.status },
    ],
    getStartY(doc),
  );

  y = addTable(
    doc,
    [
      { header: '#', dataKey: '_index', width: 10 },
      { header: 'Code', dataKey: 'itemCode', width: 30 },
      { header: 'Description', dataKey: 'itemName' },
      { header: 'Unit', dataKey: 'unit', width: 15 },
      { header: 'Qty', dataKey: 'quantity', width: 15 },
      { header: 'Condition', dataKey: 'condition', width: 25 },
    ],
    mrn.items.map((item, i) => ({ ...item, _index: String(i + 1) })),
    y + 4,
  );

  if (mrn.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text(`Notes: ${mrn.notes}`, 14, y + 8);
  }

  downloadPdf(doc, `MRN_${mrn.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}

// ---------------------------------------------------------------------------
// MR (Material Request)
// ---------------------------------------------------------------------------

export interface MrLineItem {
  itemCode: string;
  itemName: string;
  unit: string;
  qtyRequested: number;
}

export interface MrData {
  documentNumber: string;
  project: string;
  requester: string;
  requiredDate: string;
  priority: string;
  status: string;
  items: MrLineItem[];
  notes?: string;
}

export function generateMrPdf(mr: MrData): void {
  const doc = createNitPdf({
    title: 'Material Request (MR)',
    documentNumber: mr.documentNumber,
    subtitle: `Project: ${mr.project}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: mr.documentNumber },
      { label: 'Project', value: mr.project },
      { label: 'Requester', value: mr.requester },
      { label: 'Required Date', value: mr.requiredDate },
      { label: 'Priority', value: mr.priority },
      { label: 'Status', value: mr.status },
    ],
    getStartY(doc),
  );

  y = addTable(
    doc,
    [
      { header: '#', dataKey: '_index', width: 10 },
      { header: 'Code', dataKey: 'itemCode', width: 30 },
      { header: 'Description', dataKey: 'itemName' },
      { header: 'Unit', dataKey: 'unit', width: 15 },
      { header: 'Qty Requested', dataKey: 'qtyRequested', width: 25 },
    ],
    mr.items.map((item, i) => ({ ...item, _index: String(i + 1) })),
    y + 4,
  );

  if (mr.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text(`Notes: ${mr.notes}`, 14, y + 8);
  }

  downloadPdf(doc, `MR_${mr.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}
