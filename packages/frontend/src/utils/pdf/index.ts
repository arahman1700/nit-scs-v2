// Core PDF utilities and NIT letterhead
export {
  // Types
  type DocumentPdfOptions,
  type PdfOptions,
  type TableColumn,
  type ReportPdfOptions,
  // Generic PDF generators
  generateDocumentPdf,
  generateReportPdf,
  // NIT letterhead core
  createNitPdf,
  getStartY,
  addTable,
  addInfoSection,
  downloadPdf,
  // Resource-to-PDF mapper
  buildPdfOptions,
  // Utilities
  addWatermark,
  addPageBreakIfNeeded,
  // Constants
  PRIMARY_BLUE,
} from './core';

// Inbound PDFs (GRN, QCI, DR)
export {
  type GrnLineItem,
  type GrnData,
  generateGrnPdf,
  type QciLineItem,
  type QciData,
  generateQciPdf,
  type DrLineItem,
  type DrData,
  generateDrPdf,
} from './inbound';

// Outbound PDFs (MI, MRN, MR)
export {
  type MiData,
  generateMiPdf,
  type MrnLineItem,
  type MrnData,
  generateMrnPdf,
  type MrLineItem,
  type MrData,
  generateMrPdf,
} from './outbound';

// Logistics PDFs (Gate Pass, Shipment)
export {
  type GatePassData,
  generateGatePassPdf,
  type ShipmentLineItem,
  type ShipmentPdfData,
  generateShipmentPdf,
} from './logistics';

// Job Orders PDF
export { type JobOrderData, generateJobOrderPdf } from './job-orders';

// Inventory PDFs (Inventory Report, Scrap)
export { type InventoryItem, generateInventoryReportPdf, type ScrapPdfData, generateScrapPdf } from './inventory';

// Transfer PDFs (IMSF, WT, Handover)
export {
  type ImsfLineItem,
  type ImsfData,
  generateImsfPdf,
  type WtLineItem,
  type WtData,
  generateWtPdf,
  type HandoverPdfData,
  generateHandoverPdf,
} from './transfers';
