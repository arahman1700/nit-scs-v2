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

import { generateMiPdf, generateMrnPdf, generateMrPdf } from './outbound';
import type { MiData, MrnData, MrData } from './outbound';

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

describe('Outbound PDF Generators', () => {
  beforeEach(() => {
    clearMockCalls();
  });

  describe('generateMiPdf', () => {
    const sampleMi: MiData = {
      documentNumber: 'MI-2026-001',
      project: 'NIT Riyadh Phase 2',
      requester: 'Ali Hassan',
      issuedDate: '2026-02-01',
      warehouse: 'WH-Main',
      status: 'Issued',
      items: [
        {
          itemCode: 'ITM-001',
          itemName: 'Steel Pipe 3"',
          unit: 'PCS',
          quantity: 50,
          unitPrice: 25.5,
          totalPrice: 1275,
        },
      ],
    };

    it('creates PDF without throwing', async () => {
      await expect(generateMiPdf(sampleMi)).resolves.toBeUndefined();
    });

    it('includes title "Material Issuance"', async () => {
      await generateMiPdf(sampleMi);
      expectTextContaining('Material Issuance');
    });

    it('includes document number', async () => {
      await generateMiPdf(sampleMi);
      expectTextContaining('MI-2026-001');
    });

    it('includes project name', async () => {
      await generateMiPdf(sampleMi);
      expectTextContaining('NIT Riyadh Phase 2');
    });

    it('includes warehouse name', async () => {
      await generateMiPdf(sampleMi);
      expectTextContaining('WH-Main');
    });

    it('renders line items via autoTable', async () => {
      await generateMiPdf(sampleMi);
      expect(mockAutoTable).toHaveBeenCalled();
    });

    it('triggers PDF download with MI filename', async () => {
      await generateMiPdf(sampleMi);
      expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining('MI_MI-2026-001'));
    });
  });

  describe('generateMrnPdf', () => {
    const sampleMrn: MrnData = {
      documentNumber: 'MRN-2026-001',
      returnType: 'Excess Material',
      project: 'NIT Jeddah Phase 1',
      warehouse: 'WH-South',
      returnedBy: 'Faisal Omar',
      receivedBy: 'Hassan Ali',
      status: 'Completed',
      items: [
        {
          itemCode: 'ITM-003',
          itemName: 'Cement Bags',
          unit: 'BAG',
          quantity: 200,
          condition: 'Good',
        },
      ],
    };

    it('creates PDF without throwing', async () => {
      await expect(generateMrnPdf(sampleMrn)).resolves.toBeUndefined();
    });

    it('includes title "Material Return Note"', async () => {
      await generateMrnPdf(sampleMrn);
      expectTextContaining('Material Return Note');
    });

    it('includes document number', async () => {
      await generateMrnPdf(sampleMrn);
      expectTextContaining('MRN-2026-001');
    });

    it('includes return type', async () => {
      await generateMrnPdf(sampleMrn);
      expectTextContaining('Excess Material');
    });

    it('renders return items via autoTable', async () => {
      await generateMrnPdf(sampleMrn);
      expect(mockAutoTable).toHaveBeenCalled();
    });

    it('triggers PDF download', async () => {
      await generateMrnPdf(sampleMrn);
      expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining('MRN_MRN-2026-001'));
    });
  });

  describe('generateMrPdf', () => {
    const sampleMr: MrData = {
      documentNumber: 'MR-2026-001',
      project: 'NIT Dammam Phase 3',
      requester: 'Khalid Nasser',
      requiredDate: '2026-03-01',
      priority: 'High',
      status: 'Submitted',
      items: [
        {
          itemCode: 'ITM-010',
          itemName: 'Welding Rod',
          unit: 'KG',
          qtyRequested: 500,
        },
      ],
    };

    it('creates PDF without throwing', async () => {
      await expect(generateMrPdf(sampleMr)).resolves.toBeUndefined();
    });

    it('includes title "Material Request"', async () => {
      await generateMrPdf(sampleMr);
      expectTextContaining('Material Request');
    });

    it('includes document number', async () => {
      await generateMrPdf(sampleMr);
      expectTextContaining('MR-2026-001');
    });

    it('includes project name', async () => {
      await generateMrPdf(sampleMr);
      expectTextContaining('NIT Dammam Phase 3');
    });

    it('includes priority', async () => {
      await generateMrPdf(sampleMr);
      expectTextContaining('High');
    });

    it('renders request items via autoTable', async () => {
      await generateMrPdf(sampleMr);
      expect(mockAutoTable).toHaveBeenCalled();
    });

    it('triggers PDF download', async () => {
      await generateMrPdf(sampleMr);
      expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining('MR_MR-2026-001'));
    });
  });
});
