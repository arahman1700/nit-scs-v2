import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock jsPDF doc object
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
  output: vi.fn().mockReturnValue('mock-pdf-data'),
  addPage: vi.fn().mockReturnThis(),
  setPage: vi.fn().mockReturnThis(),
  getCurrentPageInfo: vi.fn().mockReturnValue({ pageNumber: 1 }),
  getNumberOfPages: vi.fn().mockReturnValue(1),
  splitTextToSize: vi.fn().mockReturnValue(['line1']),
  internal: {
    pageSize: {
      getWidth: () => 210,
      getHeight: () => 297,
    },
  },
  lastAutoTable: { finalY: 100 },
};

// Stable constructor function
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

import { generateGrnPdf, generateQciPdf, generateDrPdf } from './inbound';
import type { GrnData, QciData, DrData } from './inbound';

/** Clear only mock call history, preserve implementations */
function clearMockCalls() {
  for (const fn of Object.values(mockDoc)) {
    if (typeof fn === 'function' && 'mockClear' in fn) {
      (fn as ReturnType<typeof vi.fn>).mockClear();
    }
  }
  mockAutoTable.mockClear();
}

/** Helper to check if mockDoc.text was called with a string containing the given substring */
function expectTextContaining(substring: string) {
  const calls = mockDoc.text.mock.calls;
  const found = calls.some((call: unknown[]) => typeof call[0] === 'string' && call[0].includes(substring));
  expect(found, `Expected mockDoc.text to be called with string containing "${substring}"`).toBe(true);
}

describe('Inbound PDF Generators', () => {
  beforeEach(() => {
    clearMockCalls();
  });

  describe('generateGrnPdf', () => {
    const sampleGrn: GrnData = {
      documentNumber: 'GRN-2026-001',
      supplier: 'ACME Corp',
      warehouse: 'WH-Main',
      receivedDate: '2026-01-15',
      poNumber: 'PO-100',
      status: 'Received',
      items: [
        {
          itemCode: 'ITM-001',
          itemName: 'Steel Pipe 3"',
          unit: 'PCS',
          quantity: 100,
          unitPrice: 25.5,
          totalPrice: 2550,
          condition: 'Good',
        },
        {
          itemCode: 'ITM-002',
          itemName: 'Valve Assembly',
          unit: 'EA',
          quantity: 50,
          unitPrice: 120,
          totalPrice: 6000,
          condition: 'New',
        },
      ],
    };

    it('creates PDF without throwing', async () => {
      await expect(generateGrnPdf(sampleGrn)).resolves.toBeUndefined();
    });

    it('includes document title "Goods Receipt Note"', async () => {
      await generateGrnPdf(sampleGrn);
      expectTextContaining('Goods Receipt Note');
    });

    it('includes document number in the PDF', async () => {
      await generateGrnPdf(sampleGrn);
      expectTextContaining('GRN-2026-001');
    });

    it('includes supplier name in info section', async () => {
      await generateGrnPdf(sampleGrn);
      expectTextContaining('ACME Corp');
    });

    it('renders line items via autoTable', async () => {
      await generateGrnPdf(sampleGrn);
      expect(mockAutoTable).toHaveBeenCalled();
      // Verify table head includes expected columns
      const tableCall = mockAutoTable.mock.calls[0];
      const tableConfig = tableCall[1];
      const headers = tableConfig.head[0];
      expect(headers).toContain('Code');
      expect(headers).toContain('Qty');
    });

    it('triggers PDF download with GRN filename', async () => {
      await generateGrnPdf(sampleGrn);
      expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining('GRN_GRN-2026-001'));
    });
  });

  describe('generateQciPdf', () => {
    const sampleQci: QciData = {
      documentNumber: 'QCI-2026-001',
      linkedGrn: 'GRN-2026-001',
      inspector: 'Ahmed Al-Rashid',
      inspectionDate: '2026-01-16',
      result: 'Passed',
      status: 'Completed',
      items: [
        {
          itemCode: 'ITM-001',
          itemName: 'Steel Pipe 3"',
          inspectedQty: 100,
          passedQty: 98,
          failedQty: 2,
          remarks: 'Minor surface defects on 2 units',
        },
      ],
    };

    it('creates PDF without throwing', async () => {
      await expect(generateQciPdf(sampleQci)).resolves.toBeUndefined();
    });

    it('includes title "Quality Control Inspection"', async () => {
      await generateQciPdf(sampleQci);
      expectTextContaining('Quality Control Inspection');
    });

    it('includes document number', async () => {
      await generateQciPdf(sampleQci);
      expectTextContaining('QCI-2026-001');
    });

    it('includes inspector name', async () => {
      await generateQciPdf(sampleQci);
      expectTextContaining('Ahmed Al-Rashid');
    });

    it('renders inspection items via autoTable', async () => {
      await generateQciPdf(sampleQci);
      expect(mockAutoTable).toHaveBeenCalled();
    });

    it('triggers PDF download', async () => {
      await generateQciPdf(sampleQci);
      expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining('QCI_QCI-2026-001'));
    });
  });

  describe('generateDrPdf', () => {
    const sampleDr: DrData = {
      documentNumber: 'DR-2026-001',
      linkedGrn: 'GRN-2026-001',
      discrepancyType: 'Shortage',
      reportedBy: 'Mohammed Khalid',
      reportedDate: '2026-01-17',
      status: 'Under Review',
      items: [
        {
          itemCode: 'ITM-001',
          itemName: 'Steel Pipe 3"',
          expectedQty: 100,
          receivedQty: 95,
          discrepancyQty: 5,
          remarks: 'Short by 5 units',
        },
      ],
    };

    it('creates PDF without throwing', async () => {
      await expect(generateDrPdf(sampleDr)).resolves.toBeUndefined();
    });

    it('includes title "Discrepancy Report"', async () => {
      await generateDrPdf(sampleDr);
      expectTextContaining('Discrepancy Report');
    });

    it('includes document number', async () => {
      await generateDrPdf(sampleDr);
      expectTextContaining('DR-2026-001');
    });

    it('includes discrepancy type', async () => {
      await generateDrPdf(sampleDr);
      expectTextContaining('Shortage');
    });

    it('renders discrepancy items via autoTable with expected/received columns', async () => {
      await generateDrPdf(sampleDr);
      expect(mockAutoTable).toHaveBeenCalled();
      const tableConfig = mockAutoTable.mock.calls[0][1];
      const headers = tableConfig.head[0];
      expect(headers).toContain('Expected');
      expect(headers).toContain('Received');
      expect(headers).toContain('Discrepancy');
    });

    it('triggers PDF download', async () => {
      await generateDrPdf(sampleDr);
      expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining('DR_DR-2026-001'));
    });
  });
});
