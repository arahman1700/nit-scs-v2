import { createNitPdf, addInfoSection, addTable, downloadPdf, getStartY, PRIMARY_BLUE } from './core';
import type { TableColumn } from './core';

// ---------------------------------------------------------------------------
// IMSF (Inter-project Material Shifting Form)
// ---------------------------------------------------------------------------

export interface ImsfLineItem {
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number;
}

export interface ImsfData {
  documentNumber: string;
  senderProject: string;
  receiverProject: string;
  requestedBy: string;
  approvedBy: string;
  status: string;
  items: ImsfLineItem[];
  notes?: string;
}

export function generateImsfPdf(imsf: ImsfData): void {
  const doc = createNitPdf({
    title: 'Inter-project Material Shifting Form (IMSF)',
    documentNumber: imsf.documentNumber,
    subtitle: `${imsf.senderProject} → ${imsf.receiverProject}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: imsf.documentNumber },
      { label: 'Sender Project', value: imsf.senderProject },
      { label: 'Receiver Project', value: imsf.receiverProject },
      { label: 'Requested By', value: imsf.requestedBy },
      { label: 'Approved By', value: imsf.approvedBy },
      { label: 'Status', value: imsf.status },
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
      { header: 'Qty', dataKey: 'qty', width: 15 },
    ],
    imsf.items.map((item, i) => ({ ...item, _index: String(i + 1) })),
    y + 4,
  );

  if (imsf.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text(`Notes: ${imsf.notes}`, 14, y + 8);
  }

  downloadPdf(doc, `IMSF_${imsf.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}

// ---------------------------------------------------------------------------
// WT (Warehouse Transfer)
// ---------------------------------------------------------------------------

export interface WtLineItem {
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number;
}

export interface WtData {
  documentNumber: string;
  fromWarehouse: string;
  toWarehouse: string;
  transferType: string;
  requestedBy: string;
  status: string;
  items: WtLineItem[];
  notes?: string;
}

export function generateWtPdf(wt: WtData): void {
  const doc = createNitPdf({
    title: 'Warehouse Transfer (WT)',
    documentNumber: wt.documentNumber,
    subtitle: `${wt.fromWarehouse} → ${wt.toWarehouse}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: wt.documentNumber },
      { label: 'From Warehouse', value: wt.fromWarehouse },
      { label: 'To Warehouse', value: wt.toWarehouse },
      { label: 'Transfer Type', value: wt.transferType },
      { label: 'Requested By', value: wt.requestedBy },
      { label: 'Status', value: wt.status },
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
      { header: 'Qty', dataKey: 'qty', width: 15 },
    ],
    wt.items.map((item, i) => ({ ...item, _index: String(i + 1) })),
    y + 4,
  );

  if (wt.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text(`Notes: ${wt.notes}`, 14, y + 8);
  }

  downloadPdf(doc, `WT_${wt.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}

// ---------------------------------------------------------------------------
// Handover (Storekeeper Handover)
// ---------------------------------------------------------------------------

export interface HandoverPdfData {
  documentNumber: string;
  warehouse: string;
  outgoingEmployee: string;
  incomingEmployee: string;
  handoverDate: string;
  inventoryVerified: boolean;
  discrepanciesFound: string;
  status: string;
  notes?: string;
}

export function generateHandoverPdf(handover: HandoverPdfData): void {
  const doc = createNitPdf({
    title: 'Storekeeper Handover',
    documentNumber: handover.documentNumber,
    subtitle: `Warehouse: ${handover.warehouse}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: handover.documentNumber },
      { label: 'Warehouse', value: handover.warehouse },
      { label: 'Outgoing Employee', value: handover.outgoingEmployee },
      { label: 'Incoming Employee', value: handover.incomingEmployee },
      { label: 'Handover Date', value: handover.handoverDate },
      { label: 'Inventory Verified', value: handover.inventoryVerified ? 'Yes' : 'No' },
      { label: 'Discrepancies Found', value: handover.discrepanciesFound || 'None' },
      { label: 'Status', value: handover.status },
    ],
    getStartY(doc),
  );

  if (handover.notes) {
    y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PRIMARY_BLUE);
    doc.text('Notes:', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#333333');
    const noteLines = doc.splitTextToSize(handover.notes, doc.internal.pageSize.getWidth() - 28);
    doc.setFontSize(8);
    doc.text(noteLines, 14, y);
    y += noteLines.length * 4 + 4;
  } else {
    y += 8;
  }

  // Signature lines for both employees
  y += 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setDrawColor('#333333');
  doc.setLineWidth(0.3);

  // Outgoing employee signature
  doc.line(14, y, 90, y);
  doc.setFontSize(8);
  doc.setTextColor('#666666');
  doc.text('Outgoing Employee Signature', 14, y + 5);
  doc.text('Date: _______________', 14, y + 11);

  // Incoming employee signature
  doc.line(pageWidth / 2 + 10, y, pageWidth - 14, y);
  doc.text('Incoming Employee Signature', pageWidth / 2 + 10, y + 5);
  doc.text('Date: _______________', pageWidth / 2 + 10, y + 11);

  downloadPdf(doc, `HANDOVER_${handover.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}
