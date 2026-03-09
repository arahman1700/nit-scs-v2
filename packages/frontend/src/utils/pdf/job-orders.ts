import { createNitPdf, addInfoSection, downloadPdf, getStartY } from './core';

// ---------------------------------------------------------------------------
// Job Order
// ---------------------------------------------------------------------------

export interface JobOrderData {
  documentNumber: string;
  project: string;
  requester: string;
  requestDate: string;
  joType: string;
  priority: string;
  driverName?: string;
  vehiclePlate?: string;
  status: string;
  notes?: string;
}

export async function generateJobOrderPdf(jobOrder: JobOrderData): Promise<void> {
  const doc = await createNitPdf({
    title: 'Job Order',
    documentNumber: jobOrder.documentNumber,
    subtitle: `Type: ${jobOrder.joType} | Priority: ${jobOrder.priority}`,
  });

  const y = addInfoSection(
    doc,
    [
      { label: 'Document #', value: jobOrder.documentNumber },
      { label: 'Project', value: jobOrder.project },
      { label: 'Requester', value: jobOrder.requester },
      { label: 'Request Date', value: jobOrder.requestDate },
      { label: 'Type', value: jobOrder.joType },
      { label: 'Priority', value: jobOrder.priority },
      { label: 'Driver', value: jobOrder.driverName ?? 'N/A' },
      { label: 'Vehicle Plate', value: jobOrder.vehiclePlate ?? 'N/A' },
      { label: 'Status', value: jobOrder.status },
    ],
    getStartY(doc),
  );

  if (jobOrder.notes) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text(`Notes: ${jobOrder.notes}`, 14, y + 4);
  }

  downloadPdf(doc, `JO_${jobOrder.documentNumber}_${new Date().toISOString().slice(0, 10)}`);
}
