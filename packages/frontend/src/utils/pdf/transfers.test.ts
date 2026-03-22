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

import { generateWtPdf, generateImsfPdf } from './transfers';
import type { WtData, ImsfData } from './transfers';

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

describe('Transfer PDF Generators', () => {
  beforeEach(() => {
    clearMockCalls();
  });

  describe('generateWtPdf', () => {
    const sampleWt: WtData = {
      documentNumber: 'WT-2026-001',
      fromWarehouse: 'WH-Main Riyadh',
      toWarehouse: 'WH-Jeddah South',
      transferType: 'Inter-Warehouse',
      requestedBy: 'Ibrahim Saleh',
      status: 'Approved',
      items: [
        {
          itemCode: 'ITM-001',
          itemName: 'Steel Pipe 3"',
          unit: 'PCS',
          qty: 200,
        },
        {
          itemCode: 'ITM-005',
          itemName: 'Cable Tray 6m',
          unit: 'EA',
          qty: 50,
        },
      ],
    };

    it('creates PDF without throwing', async () => {
      await expect(generateWtPdf(sampleWt)).resolves.toBeUndefined();
    });

    it('includes title "Warehouse Transfer"', async () => {
      await generateWtPdf(sampleWt);
      expectTextContaining('Warehouse Transfer');
    });

    it('includes document number', async () => {
      await generateWtPdf(sampleWt);
      expectTextContaining('WT-2026-001');
    });

    it('includes source warehouse name', async () => {
      await generateWtPdf(sampleWt);
      expectTextContaining('WH-Main Riyadh');
    });

    it('includes destination warehouse name', async () => {
      await generateWtPdf(sampleWt);
      expectTextContaining('WH-Jeddah South');
    });

    it('renders transfer items via autoTable', async () => {
      await generateWtPdf(sampleWt);
      expect(mockAutoTable).toHaveBeenCalled();
    });

    it('triggers PDF download with WT filename', async () => {
      await generateWtPdf(sampleWt);
      expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining('WT_WT-2026-001'));
    });
  });

  describe('generateImsfPdf', () => {
    const sampleImsf: ImsfData = {
      documentNumber: 'IMSF-2026-001',
      senderProject: 'NIT Riyadh Phase 2',
      receiverProject: 'NIT Jeddah Phase 1',
      requestedBy: 'Omar Fahad',
      approvedBy: 'Salman Abdul',
      status: 'Confirmed',
      items: [
        {
          itemCode: 'ITM-008',
          itemName: 'Safety Helmet',
          unit: 'EA',
          qty: 100,
        },
      ],
    };

    it('creates PDF without throwing', async () => {
      await expect(generateImsfPdf(sampleImsf)).resolves.toBeUndefined();
    });

    it('includes title with "Inter-project" or "IMSF"', async () => {
      await generateImsfPdf(sampleImsf);
      expectTextContaining('Inter-project');
    });

    it('includes document number', async () => {
      await generateImsfPdf(sampleImsf);
      expectTextContaining('IMSF-2026-001');
    });

    it('includes sender project', async () => {
      await generateImsfPdf(sampleImsf);
      expectTextContaining('NIT Riyadh Phase 2');
    });

    it('includes receiver project', async () => {
      await generateImsfPdf(sampleImsf);
      expectTextContaining('NIT Jeddah Phase 1');
    });

    it('renders items via autoTable', async () => {
      await generateImsfPdf(sampleImsf);
      expect(mockAutoTable).toHaveBeenCalled();
    });

    it('triggers PDF download with IMSF filename', async () => {
      await generateImsfPdf(sampleImsf);
      expect(mockDoc.save).toHaveBeenCalledWith(expect.stringContaining('IMSF_IMSF-2026-001'));
    });
  });
});
