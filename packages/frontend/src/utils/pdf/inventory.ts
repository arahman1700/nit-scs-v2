import { createNitPdf, addInfoSection, addTable, downloadPdf, getStartY, PRIMARY_BLUE } from './core';

// ---------------------------------------------------------------------------
// Inventory Report
// ---------------------------------------------------------------------------

export interface InventoryItem {
  sn: number;
  project: string;
  itemCode: string;
  description: string;
  size: string;
  unit: string;
  location: string;
  subLocation: string;
  balance: number;
}

export async function generateInventoryReportPdf(items: InventoryItem[], warehouseName: string): Promise<void> {
  const doc = await createNitPdf({
    title: 'Inventory Report',
    subtitle: `Warehouse: ${warehouseName}`,
    orientation: items.length > 0 ? 'landscape' : 'portrait',
  });

  const totalBalance = items.reduce((s, i) => s + i.balance, 0);

  const y = addInfoSection(
    doc,
    [
      { label: 'Warehouse', value: warehouseName },
      { label: 'Total Items', value: String(items.length) },
      { label: 'Total Balance', value: totalBalance.toLocaleString() },
      {
        label: 'Report Date',
        value: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      },
    ],
    getStartY(doc),
  );

  await addTable(
    doc,
    [
      { header: '#', dataKey: 'sn', width: 10 },
      { header: 'Project', dataKey: 'project', width: 35 },
      { header: 'Code', dataKey: 'itemCode', width: 40 },
      { header: 'Description', dataKey: 'description' },
      { header: 'Size', dataKey: 'size', width: 25 },
      { header: 'Unit', dataKey: 'unit', width: 12 },
      { header: 'Location', dataKey: 'locationFull', width: 30 },
      { header: 'Balance', dataKey: 'balance', width: 20 },
    ],
    items.map(item => ({
      ...item,
      locationFull: `${item.location} - ${item.subLocation}`,
      balance: item.balance.toLocaleString(),
    })),
    y + 4,
  );

  downloadPdf(doc, `Inventory_${warehouseName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`);
}

// ---------------------------------------------------------------------------
// Scrap Report
// ---------------------------------------------------------------------------

export interface ScrapPdfData {
  documentNumber: string;
  project: string;
  warehouse: string;
  itemDescription: string;
  category: string;
  estimatedValue: string;
  disposalMethod: string;
  condition: string;
  status: string;
  notes?: string;
}

export async function generateScrapPdf(scrap: ScrapPdfData): Promise<void> {
  const doc = await createNitPdf({
    title: 'Scrap Report',
    documentNumber: scrap.documentNumber,
    subtitle: `Category: ${scrap.category}`,
  });

  let y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: scrap.documentNumber },
      { label: 'Project', value: scrap.project },
      { label: 'Warehouse', value: scrap.warehouse },
      { label: 'Item', value: scrap.itemDescription },
      { label: 'Category', value: scrap.category },
      { label: 'Estimated Value', value: scrap.estimatedValue },
      { label: 'Disposal Method', value: scrap.disposalMethod },
      { label: 'Condition', value: scrap.condition },
      { label: 'Status', value: scrap.status },
    ],
    getStartY(doc),
  );

  if (scrap.notes) {
    y += 4;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(PRIMARY_BLUE);
    doc.text('Notes:', 14, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#333333');
    const noteLines = doc.splitTextToSize(scrap.notes, doc.internal.pageSize.getWidth() - 28);
    doc.setFontSize(8);
    doc.text(noteLines, 14, y);
  }

  downloadPdf(doc, `SCRAP_${scrap.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}
