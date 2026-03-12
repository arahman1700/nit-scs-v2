import { createNitPdf, addInfoSection, addTable, downloadPdf, getStartY } from './core';

// ---------------------------------------------------------------------------
// Gate Pass
// ---------------------------------------------------------------------------

export interface GatePassData {
  documentNumber: string;
  type: string;
  date: string;
  warehouse: string;
  vehiclePlate: string;
  driverName: string;
  driverIdNumber?: string;
  linkedDocument?: string;
  status: string;
  notes?: string;
}

export async function generateGatePassPdf(gatePass: GatePassData): Promise<void> {
  const doc = await createNitPdf({
    title: 'Gate Pass',
    documentNumber: gatePass.documentNumber,
    subtitle: `Type: ${gatePass.type}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: gatePass.documentNumber },
      { label: 'Type', value: gatePass.type },
      { label: 'Date', value: gatePass.date },
      { label: 'Warehouse', value: gatePass.warehouse },
      { label: 'Vehicle Plate', value: gatePass.vehiclePlate },
      { label: 'Driver Name', value: gatePass.driverName },
      { label: 'Driver ID', value: gatePass.driverIdNumber ?? 'N/A' },
      { label: 'Linked Document', value: gatePass.linkedDocument ?? 'None' },
      { label: 'Status', value: gatePass.status },
    ],
    getStartY(doc),
  );

  if (gatePass.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text(`Notes: ${gatePass.notes}`, 14, y + 4);
    y += 10;
  }

  // Signature line
  y += 16;
  doc.setDrawColor('#333333');
  doc.setLineWidth(0.3);
  doc.line(14, y, 80, y);
  doc.line(110, y, 196, y);

  doc.setFontSize(8);
  doc.setTextColor('#666666');
  doc.text('Security Guard Signature', 14, y + 5);
  doc.text('Authorized By', 110, y + 5);

  downloadPdf(doc, `GatePass_${gatePass.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}

// ---------------------------------------------------------------------------
// Shipment
// ---------------------------------------------------------------------------

export interface ShipmentLineItem {
  itemCode: string;
  itemName: string;
  unit: string;
  qty: number;
  weight: number;
}

export interface ShipmentPdfData {
  documentNumber: string;
  supplier: string;
  poNumber: string;
  carrier: string;
  etd: string;
  eta: string;
  port: string;
  status: string;
  items: ShipmentLineItem[];
  notes?: string;
}

export async function generateShipmentPdf(shipment: ShipmentPdfData): Promise<void> {
  const doc = await createNitPdf({
    title: 'Shipment',
    documentNumber: shipment.documentNumber,
    subtitle: `Supplier: ${shipment.supplier}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: shipment.documentNumber },
      { label: 'Supplier', value: shipment.supplier },
      { label: 'PO Number', value: shipment.poNumber },
      { label: 'Carrier', value: shipment.carrier },
      { label: 'ETD', value: shipment.etd },
      { label: 'ETA', value: shipment.eta },
      { label: 'Port', value: shipment.port },
      { label: 'Status', value: shipment.status },
    ],
    getStartY(doc),
  );

  y = await addTable(
    doc,
    [
      { header: '#', dataKey: '_index', width: 10 },
      { header: 'Code', dataKey: 'itemCode', width: 25 },
      { header: 'Description', dataKey: 'itemName' },
      { header: 'Unit', dataKey: 'unit', width: 15 },
      { header: 'Qty', dataKey: 'qty', width: 15 },
      { header: 'Weight', dataKey: 'weight', width: 20 },
    ],
    shipment.items.map((item, i) => ({ ...item, _index: String(i + 1) })),
    y + 4,
  );

  if (shipment.notes) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text(`Notes: ${shipment.notes}`, 14, y + 8);
  }

  downloadPdf(doc, `SHIPMENT_${shipment.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}
