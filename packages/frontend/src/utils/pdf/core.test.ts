import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jsPDF doc object that tracks all method calls
const mockDoc = {
  text: vi.fn().mockReturnThis(),
  setFontSize: vi.fn().mockReturnThis(),
  setTextColor: vi.fn().mockReturnThis(),
  setFillColor: vi.fn().mockReturnThis(),
  setDrawColor: vi.fn().mockReturnThis(),
  setLineWidth: vi.fn().mockReturnThis(),
  setFont: vi.fn().mockReturnThis(),
  rect: vi.fn().mockReturnThis(),
  line: vi.fn().mockReturnThis(),
  save: vi.fn(),
  autoPrint: vi.fn(),
  output: vi.fn().mockReturnValue('mock-pdf-data'),
  addPage: vi.fn().mockReturnThis(),
  setPage: vi.fn().mockReturnThis(),
  getCurrentPageInfo: vi.fn().mockReturnValue({ pageNumber: 1 }),
  getNumberOfPages: vi.fn().mockReturnValue(1),
  saveGraphicsState: vi.fn(),
  restoreGraphicsState: vi.fn(),
  splitTextToSize: vi.fn().mockReturnValue(['line1']),
  internal: {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
  },
  lastAutoTable: { finalY: 100 },
};

// Use a stable constructor function that won't be cleared
function MockJsPDF() {
  return mockDoc;
}

vi.mock('jspdf', () => ({
  default: MockJsPDF,
}));

const mockAutoTable = vi.fn();
vi.mock('jspdf-autotable', () => ({
  default: mockAutoTable,
}));

// Import AFTER mocks are set up
import { createNitPdf, addInfoSection, addTable, generateDocumentPdf, downloadPdf } from './core';

/** Clear only mock call history, preserve implementations */
function clearMockCalls() {
  for (const fn of Object.values(mockDoc)) {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as ReturnType<typeof vi.fn>).mockClear();
    }
  }
  mockAutoTable.mockClear();
}

describe('PDF Core', () => {
  beforeEach(() => {
    clearMockCalls();
  });

  describe('createNitPdf', () => {
    it('returns a jsPDF instance with NIT branding header', async () => {
      const doc = await createNitPdf({ title: 'Test Document', documentNumber: 'DOC-001' });

      expect(doc).toBe(mockDoc);
      // Verify NIT company name was rendered
      expect(mockDoc.text).toHaveBeenCalledWith('NIT Supply Chain Management', 14, 18);
      // Verify document title
      expect(mockDoc.text).toHaveBeenCalledWith('Test Document', 14, 26);
      // Verify document number
      expect(mockDoc.text).toHaveBeenCalledWith(
        expect.stringContaining('DOC-001'),
        expect.any(Number),
        expect.any(Number),
        expect.anything(),
      );
    });
  });

  describe('addInfoSection', () => {
    it('renders field labels and values', () => {
      const fields = [
        { label: 'Supplier', value: 'ACME Corp' },
        { label: 'Warehouse', value: 'WH-Main' },
      ];

      const finalY = addInfoSection(mockDoc as unknown as import('jspdf').default, fields, 50);

      // Labels are rendered with colon suffix
      expect(mockDoc.text).toHaveBeenCalledWith('Supplier:', 14, 50);
      expect(mockDoc.text).toHaveBeenCalledWith('ACME Corp', 60, 50);
      expect(mockDoc.text).toHaveBeenCalledWith('Warehouse:', 14, 56);
      expect(mockDoc.text).toHaveBeenCalledWith('WH-Main', 60, 56);
      // Returns Y position after the section
      expect(finalY).toBeGreaterThan(50);
    });
  });

  describe('addTable', () => {
    it('renders column headers and row data via autoTable', async () => {
      const columns = [
        { header: 'Code', dataKey: 'code' },
        { header: 'Description', dataKey: 'desc' },
      ];
      const data = [{ code: 'ITM-001', desc: 'Steel Pipe' }];

      const finalY = await addTable(mockDoc as unknown as import('jspdf').default, columns, data, 80);

      // autoTable should have been called
      expect(mockAutoTable).toHaveBeenCalledWith(
        mockDoc,
        expect.objectContaining({
          startY: 80,
          head: [['Code', 'Description']],
          body: [['ITM-001', 'Steel Pipe']],
        }),
      );
      expect(finalY).toBeGreaterThanOrEqual(80);
    });
  });

  describe('generateDocumentPdf', () => {
    it('produces complete PDF with title, docNumber, fields, and line items', async () => {
      await generateDocumentPdf({
        title: 'Goods Receipt Note',
        docNumber: 'GRN-001',
        status: 'Draft',
        createdAt: '2026-01-15',
        fields: [
          { label: 'Supplier', value: 'ACME Corp' },
          { label: 'Warehouse', value: 'WH-Main' },
        ],
        lineItems: [{ Code: 'ITM-1', Description: 'Steel', Qty: 10 }],
        lineItemColumns: ['Code', 'Description', 'Qty'],
      });

      // Verify NIT branding header
      expect(mockDoc.text).toHaveBeenCalledWith('NIT Logistics & WMS', 14, 18);
      // Verify document number
      expect(mockDoc.text).toHaveBeenCalledWith('GRN-001', 14, 52);
      // Verify title in header
      expect(mockDoc.text).toHaveBeenCalledWith('Goods Receipt Note', 14, 34);
      // Verify autoTable was called for line items
      expect(mockAutoTable).toHaveBeenCalled();
      // Verify PDF was saved
      expect(mockDoc.save).toHaveBeenCalledWith('GRN-001.pdf');
    });
  });

  describe('downloadPdf', () => {
    it('saves PDF with .pdf extension', () => {
      downloadPdf(mockDoc as unknown as import('jspdf').default, 'test-doc');
      expect(mockDoc.save).toHaveBeenCalledWith('test-doc.pdf');
    });

    it('does not double .pdf extension', () => {
      downloadPdf(mockDoc as unknown as import('jspdf').default, 'test-doc.pdf');
      expect(mockDoc.save).toHaveBeenCalledWith('test-doc.pdf');
    });
  });
});
