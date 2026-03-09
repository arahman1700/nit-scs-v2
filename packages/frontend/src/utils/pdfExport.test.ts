import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock jsPDF and jspdf-autotable before importing the module under test
// ---------------------------------------------------------------------------

const mockSave = vi.fn();
const mockText = vi.fn();
const mockRect = vi.fn();
const mockLine = vi.fn();
const mockSetFillColor = vi.fn();
const mockSetTextColor = vi.fn();
const mockSetFontSize = vi.fn();
const mockSetFont = vi.fn();
const mockSetDrawColor = vi.fn();
const mockSetLineWidth = vi.fn();
const mockAddPage = vi.fn();
const mockSetPage = vi.fn();
const mockAutoPrint = vi.fn();
const mockOutput = vi.fn().mockReturnValue('blob:mock-url');
const mockSaveGraphicsState = vi.fn();
const mockRestoreGraphicsState = vi.fn();
const mockGetNumberOfPages = vi.fn().mockReturnValue(1);
const mockGetCurrentPageInfo = vi.fn().mockReturnValue({ pageNumber: 1 });

const mockJsPdfInstance = {
  save: mockSave,
  text: mockText,
  rect: mockRect,
  line: mockLine,
  setFillColor: mockSetFillColor,
  setTextColor: mockSetTextColor,
  setFontSize: mockSetFontSize,
  setFont: mockSetFont,
  setDrawColor: mockSetDrawColor,
  setLineWidth: mockSetLineWidth,
  addPage: mockAddPage,
  setPage: mockSetPage,
  autoPrint: mockAutoPrint,
  output: mockOutput,
  saveGraphicsState: mockSaveGraphicsState,
  restoreGraphicsState: mockRestoreGraphicsState,
  getNumberOfPages: mockGetNumberOfPages,
  getCurrentPageInfo: mockGetCurrentPageInfo,
  internal: {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
  },
};

vi.mock('jspdf', () => {
  // Use a real function constructor so `new jsPDF()` works
  function MockJsPDF() {
    return mockJsPdfInstance;
  }
  return { default: MockJsPDF };
});

vi.mock('jspdf-autotable', () => ({
  default: vi.fn(),
}));

// Mock window.open for printMode tests
const mockWindowOpen = vi.fn();
vi.stubGlobal('open', mockWindowOpen);

// Now import after mocks are set up
import {
  generateDocumentPdf,
  generateReportPdf,
  createNitPdf,
  getStartY,
  addTable,
  addInfoSection,
  downloadPdf,
  buildPdfOptions,
  addWatermark,
  addPageBreakIfNeeded,
  PRIMARY_BLUE,
} from './pdfExport';
import autoTable from 'jspdf-autotable';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset any dynamic properties on the mock instance
  delete (mockJsPdfInstance as Record<string, unknown>).lastAutoTable;
  delete (mockJsPdfInstance as Record<string, unknown>).__nitStartY;
  delete (mockJsPdfInstance as Record<string, unknown>).__nitTotalPlaceholder;
  delete (mockJsPdfInstance as Record<string, unknown>).__nitCurrentY;
});

// ── PRIMARY_BLUE constant ───────────────────────────────────────────────

describe('PRIMARY_BLUE', () => {
  it('is the expected hex color', () => {
    expect(PRIMARY_BLUE).toBe('#1e3a5f');
  });
});

// ── generateDocumentPdf ─────────────────────────────────────────────────

describe('generateDocumentPdf', () => {
  const baseOptions = {
    title: 'Goods Receipt Note',
    docNumber: 'GRN-2026-0001',
    status: 'Approved',
    createdAt: '2026-01-15',
    fields: [
      { label: 'Supplier', value: 'ACME Corp' },
      { label: 'Warehouse', value: 'Main WH' },
    ],
  };

  it('creates a PDF and saves it with the docNumber as filename', async () => {
    await generateDocumentPdf(baseOptions);
    expect(mockSave).toHaveBeenCalledWith('GRN-2026-0001.pdf');
  });

  it('renders the NIT branding header', async () => {
    await generateDocumentPdf(baseOptions);
    expect(mockText).toHaveBeenCalledWith('NIT Logistics & WMS', 14, 18);
    expect(mockText).toHaveBeenCalledWith('Nesma Infrastructure & Technology', 14, 26);
  });

  it('renders the document title in the header', async () => {
    await generateDocumentPdf(baseOptions);
    expect(mockText).toHaveBeenCalledWith('Goods Receipt Note', 14, 34);
  });

  it('renders the document number on the page', async () => {
    await generateDocumentPdf(baseOptions);
    expect(mockText).toHaveBeenCalledWith('GRN-2026-0001', 14, 52);
  });

  it('renders status and date right-aligned', async () => {
    await generateDocumentPdf(baseOptions);
    expect(mockText).toHaveBeenCalledWith('Status: Approved', expect.any(Number), 52, { align: 'right' });
    expect(mockText).toHaveBeenCalledWith('Date: 2026-01-15', expect.any(Number), 58, { align: 'right' });
  });

  it('renders field labels and values', async () => {
    await generateDocumentPdf(baseOptions);
    expect(mockText).toHaveBeenCalledWith('Supplier:', 14, expect.any(Number));
    expect(mockText).toHaveBeenCalledWith('ACME Corp', 70, expect.any(Number));
  });

  it('calls autoTable when lineItems are provided', async () => {
    await generateDocumentPdf({
      ...baseOptions,
      lineItems: [{ Item: 'Pipe', Qty: 10 }],
      lineItemColumns: ['Item', 'Qty'],
    });
    expect(autoTable).toHaveBeenCalled();
  });

  it('does not call autoTable when no lineItems provided', async () => {
    await generateDocumentPdf(baseOptions);
    expect(autoTable).not.toHaveBeenCalled();
  });

  it('opens print dialog in printMode instead of saving', async () => {
    await generateDocumentPdf({ ...baseOptions, printMode: true });
    expect(mockAutoPrint).toHaveBeenCalled();
    expect(mockWindowOpen).toHaveBeenCalledWith('blob:mock-url', '_blank');
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('uses custom signatures when provided', async () => {
    await generateDocumentPdf({
      ...baseOptions,
      signatures: ['Inspector', 'Manager'],
    });
    expect(mockText).toHaveBeenCalledWith('Inspector', expect.any(Number), expect.any(Number));
    expect(mockText).toHaveBeenCalledWith('Manager', expect.any(Number), expect.any(Number));
  });

  it('handles odd number of fields (last field without pair)', async () => {
    await generateDocumentPdf({
      ...baseOptions,
      fields: [
        { label: 'Supplier', value: 'ACME Corp' },
        { label: 'Warehouse', value: 'Main WH' },
        { label: 'Notes', value: 'Urgent delivery' },
      ],
    });
    expect(mockText).toHaveBeenCalledWith('Notes:', 14, expect.any(Number));
    expect(mockText).toHaveBeenCalledWith('Urgent delivery', 70, expect.any(Number));
  });
});

// ── generateReportPdf ───────────────────────────────────────────────────

describe('generateReportPdf', () => {
  const baseReportOptions = {
    title: 'Inventory Report',
    columns: ['Item', 'Qty', 'Value'],
    rows: [{ Item: 'Pipe', Qty: 100, Value: 5000 }],
  };

  it('creates a PDF and saves with title-based filename', async () => {
    await generateReportPdf(baseReportOptions);
    expect(mockSave).toHaveBeenCalledWith('Inventory_Report_Report.pdf');
  });

  it('replaces spaces with underscores in filename', async () => {
    await generateReportPdf({ ...baseReportOptions, title: 'My Custom  Report' });
    // \s+ collapses multiple spaces into a single underscore
    expect(mockSave).toHaveBeenCalledWith('My_Custom_Report_Report.pdf');
  });

  it('renders subtitle when provided', async () => {
    await generateReportPdf({ ...baseReportOptions, subtitle: 'Q1 2026' });
    expect(mockText).toHaveBeenCalledWith('Q1 2026', 14, expect.any(Number));
  });

  it('renders filters when provided', async () => {
    await generateReportPdf({
      ...baseReportOptions,
      filters: [{ label: 'Warehouse', value: 'WH-01' }],
    });
    expect(mockText).toHaveBeenCalledWith('Warehouse: WH-01', 14, expect.any(Number));
  });

  it('renders summary cards when provided', async () => {
    await generateReportPdf({
      ...baseReportOptions,
      summary: [{ label: 'Total Items', value: 500 }],
    });
    expect(mockText).toHaveBeenCalledWith('Total Items', expect.any(Number), expect.any(Number));
    expect(mockText).toHaveBeenCalledWith('500', expect.any(Number), expect.any(Number));
  });

  it('calls autoTable for the data table', async () => {
    await generateReportPdf(baseReportOptions);
    expect(autoTable).toHaveBeenCalled();
  });
});

// ── createNitPdf ────────────────────────────────────────────────────────

describe('createNitPdf', () => {
  it('returns a jsPDF instance', async () => {
    const doc = await createNitPdf({ title: 'Test Document' });
    expect(doc).toBeDefined();
    expect(doc.text).toBeDefined();
  });

  it('renders the company name in the header', async () => {
    await createNitPdf({ title: 'Test Document' });
    expect(mockText).toHaveBeenCalledWith('NIT Supply Chain Management', 14, 18);
  });

  it('renders the document title', async () => {
    await createNitPdf({ title: 'My Title' });
    expect(mockText).toHaveBeenCalledWith('My Title', 14, 26);
  });

  it('renders subtitle when provided', async () => {
    await createNitPdf({ title: 'Test', subtitle: 'Sub Info' });
    expect(mockText).toHaveBeenCalledWith('Sub Info', 14, 32);
  });

  it('renders document number when provided', async () => {
    await createNitPdf({ title: 'Test', documentNumber: 'DOC-001' });
    expect(mockText).toHaveBeenCalledWith('Doc #: DOC-001', expect.any(Number), 24, { align: 'right' });
  });

  it('stores __nitStartY on the doc instance', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    const record = doc as unknown as Record<string, unknown>;
    expect(record.__nitStartY).toBeDefined();
    expect(typeof record.__nitStartY).toBe('number');
  });
});

// ── getStartY ───────────────────────────────────────────────────────────

describe('getStartY', () => {
  it('returns the stored __nitStartY value', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    const y = getStartY(doc);
    expect(typeof y).toBe('number');
    expect(y).toBeGreaterThan(30);
  });

  it('returns 40 as fallback when __nitStartY is not set', () => {
    // Use the raw mock instance without createNitPdf
    delete (mockJsPdfInstance as Record<string, unknown>).__nitStartY;
    const y = getStartY(mockJsPdfInstance as any);
    expect(y).toBe(40);
  });
});

// ── addInfoSection ──────────────────────────────────────────────────────

describe('addInfoSection', () => {
  it('returns a Y position greater than the startY', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    const finalY = addInfoSection(doc, [{ label: 'Name', value: 'Test' }], 50);
    expect(finalY).toBeGreaterThan(50);
  });

  it('renders label and value text', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    addInfoSection(doc, [{ label: 'Supplier', value: 'ACME' }], 50);
    expect(mockText).toHaveBeenCalledWith('Supplier:', 14, 50);
    expect(mockText).toHaveBeenCalledWith('ACME', 60, 50);
  });

  it('increments Y for each field', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    const fields = [
      { label: 'A', value: '1' },
      { label: 'B', value: '2' },
      { label: 'C', value: '3' },
    ];
    const finalY = addInfoSection(doc, fields, 50);
    // 3 fields * 6 lineHeight + 2 padding = 50 + 18 + 2 = 70
    expect(finalY).toBe(70);
  });
});

// ── addTable ────────────────────────────────────────────────────────────

describe('addTable', () => {
  it('calls autoTable with the provided columns and data', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    const columns = [
      { header: 'Name', dataKey: 'name' },
      { header: 'Qty', dataKey: 'qty' },
    ];
    const data = [{ name: 'Pipe', qty: 10 }];
    await addTable(doc, columns, data, 50);
    expect(autoTable).toHaveBeenCalled();
  });

  it('returns a numeric Y position', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    const y = await addTable(doc, [{ header: 'H', dataKey: 'h' }], [{ h: 'val' }], 50);
    expect(typeof y).toBe('number');
  });

  it('uses getStartY when no startY is provided', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    await addTable(doc, [{ header: 'H', dataKey: 'h' }], [{ h: 'val' }]);
    const callArgs = (autoTable as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(callArgs.startY).toBeDefined();
    expect(typeof callArgs.startY).toBe('number');
  });
});

// ── downloadPdf ─────────────────────────────────────────────────────────

describe('downloadPdf', () => {
  it('calls doc.save with .pdf extension', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    downloadPdf(doc, 'my-report');
    expect(mockSave).toHaveBeenCalledWith('my-report.pdf');
  });

  it('does not double the .pdf extension', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    downloadPdf(doc, 'my-report.pdf');
    expect(mockSave).toHaveBeenCalledWith('my-report.pdf');
  });

  it('adds footers to all pages before saving', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    mockGetNumberOfPages.mockReturnValue(3);
    vi.clearAllMocks();
    mockGetNumberOfPages.mockReturnValue(3);
    downloadPdf(doc, 'report');
    // setPage should be called for each page
    expect(mockSetPage).toHaveBeenCalledWith(1);
    expect(mockSetPage).toHaveBeenCalledWith(2);
    expect(mockSetPage).toHaveBeenCalledWith(3);
  });
});

// ── addWatermark ────────────────────────────────────────────────────────

describe('addWatermark', () => {
  it('draws default "DRAFT" watermark text', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    addWatermark(doc);
    expect(mockText).toHaveBeenCalledWith(
      'DRAFT',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'center', angle: 45 }),
    );
  });

  it('draws custom watermark text', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    addWatermark(doc, 'CONFIDENTIAL');
    expect(mockText).toHaveBeenCalledWith(
      'CONFIDENTIAL',
      expect.any(Number),
      expect.any(Number),
      expect.objectContaining({ align: 'center', angle: 45 }),
    );
  });

  it('saves and restores graphics state', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    vi.clearAllMocks();
    addWatermark(doc);
    expect(mockSaveGraphicsState).toHaveBeenCalledOnce();
    expect(mockRestoreGraphicsState).toHaveBeenCalledOnce();
  });
});

// ── addPageBreakIfNeeded ────────────────────────────────────────────────

describe('addPageBreakIfNeeded', () => {
  it('adds a new page when space is insufficient', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    // Simulate being near the bottom of the page
    (mockJsPdfInstance as Record<string, unknown>).__nitCurrentY = 280;
    vi.clearAllMocks();
    const newY = addPageBreakIfNeeded(doc, 50);
    expect(mockAddPage).toHaveBeenCalled();
    expect(typeof newY).toBe('number');
  });

  it('does not add a page when sufficient space exists', async () => {
    const doc = await createNitPdf({ title: 'Test' });
    (mockJsPdfInstance as Record<string, unknown>).__nitCurrentY = 50;
    vi.clearAllMocks();
    const y = addPageBreakIfNeeded(doc, 30);
    expect(mockAddPage).not.toHaveBeenCalled();
    expect(y).toBe(50);
  });
});

// ── buildPdfOptions ─────────────────────────────────────────────────────

describe('buildPdfOptions', () => {
  it('maps mrrv resource to Goods Receipt Note', () => {
    const record = { mrrvNumber: 'GRN-2026-0001', status: 'Approved', createdAt: '2026-01-15T00:00:00Z' };
    const result = buildPdfOptions('mrrv', record);
    expect(result.title).toBe('Goods Receipt Note');
    expect(result.docNumber).toBe('GRN-2026-0001');
    expect(result.status).toBe('Approved');
  });

  it('maps mirv resource to Material Issuance', () => {
    const record = { mirvNumber: 'MI-2026-0001', status: 'Pending' };
    const result = buildPdfOptions('mirv', record);
    expect(result.title).toBe('Material Issuance');
    expect(result.docNumber).toBe('MI-2026-0001');
  });

  it('maps mrv resource to Material Return Note', () => {
    const record = { mrvNumber: 'MRN-2026-0001', status: 'Draft' };
    const result = buildPdfOptions('mrv', record);
    expect(result.title).toBe('Material Return Note');
  });

  it('maps job-orders resource to Job Order', () => {
    const record = { joNumber: 'JO-001', status: 'Active' };
    const result = buildPdfOptions('job-orders', record);
    expect(result.title).toBe('Job Order');
  });

  it('maps rfim resource to Quality Control Inspection', () => {
    const record = { rfimNumber: 'QCI-001', status: 'Completed' };
    const result = buildPdfOptions('rfim', record);
    expect(result.title).toBe('Quality Control Inspection');
  });

  it('maps osd resource to Discrepancy Report', () => {
    const record = { osdNumber: 'DR-001', status: 'Open' };
    const result = buildPdfOptions('osd', record);
    expect(result.title).toBe('Discrepancy Report');
  });

  it('maps gate-pass resource to Gate Pass', () => {
    const record = { gatePassNumber: 'GP-001', status: 'Active' };
    const result = buildPdfOptions('gate-pass', record);
    expect(result.title).toBe('Gate Pass');
  });

  it('maps stock-transfer resource to Stock Transfer', () => {
    const record = { transferNumber: 'ST-001', status: 'InTransit' };
    const result = buildPdfOptions('stock-transfer', record);
    expect(result.title).toBe('Stock Transfer');
  });

  it('maps shipments resource to Shipment', () => {
    const record = { shipmentNumber: 'SH-001', status: 'Shipped' };
    const result = buildPdfOptions('shipments', record);
    expect(result.title).toBe('Shipment');
  });

  it('uses uppercase resource type for unknown types', () => {
    const record = { id: '123', status: 'Active', customField: 'value' };
    const result = buildPdfOptions('custom-thing', record);
    expect(result.title).toBe('CUSTOM-THING');
  });

  it('defaults to id for docNumber when no specific number field exists', () => {
    const record = { id: 'abc-123', status: 'Draft' };
    const result = buildPdfOptions('unknown', record);
    expect(result.docNumber).toBe('abc-123');
  });

  it('returns empty docNumber when no identifiers exist', () => {
    const record = { status: 'Draft' };
    const result = buildPdfOptions('unknown', record);
    expect(result.docNumber).toBe('');
  });

  it('formats createdAt date for display', () => {
    const record = { id: '1', status: 'Draft', createdAt: '2026-03-09T10:30:00Z' };
    const result = buildPdfOptions('unknown', record);
    expect(result.createdAt).toBeTruthy();
    // Should be a localized date string
    expect(result.createdAt).not.toBe('2026-03-09T10:30:00Z');
  });

  it('uses record.date as fallback when createdAt is missing', () => {
    const record = { id: '1', status: 'Draft', date: '2026-03-09' };
    const result = buildPdfOptions('unknown', record);
    expect(result.createdAt).toBe('2026-03-09');
  });

  it('excludes id, createdAt, updatedAt from default type fields', () => {
    const record = { id: '1', createdAt: 'x', updatedAt: 'y', status: 'Draft', name: 'Test' };
    const result = buildPdfOptions('some-unknown', record);
    const labels = result.fields.map(f => f.label);
    expect(labels).not.toContain('id');
    expect(labels).not.toContain('createdAt');
    expect(labels).not.toContain('updatedAt');
  });

  it('limits default type fields to 10 entries', () => {
    const record: Record<string, unknown> = { status: 'Draft' };
    for (let i = 0; i < 20; i++) {
      record[`field${i}`] = `value${i}`;
    }
    const result = buildPdfOptions('unknown', record);
    expect(result.fields.length).toBeLessThanOrEqual(10);
  });
});
