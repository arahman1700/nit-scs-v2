import type { PrismaMock } from '../test-utils/prisma-mock.js';

// ── Mocks ────────────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() },
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import * as XLSX from 'xlsx';
import { getExpectedFields, parseExcelPreview, executeImport } from './import.service.js';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('import.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    // Add models not present in the default PrismaMock
    (mockPrisma as any).region = { create: vi.fn() };
    (mockPrisma as any).city = { create: vi.fn() };
    (mockPrisma as any).unitOfMeasure = { create: vi.fn() };
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getExpectedFields
  // ---------------------------------------------------------------------------
  describe('getExpectedFields', () => {
    it('returns correct fields for items entity', () => {
      const fields = getExpectedFields('items');

      expect(fields).toHaveLength(8);
      expect(fields[0]).toEqual({ dbField: 'itemCode', label: 'Item Code', required: true });
      expect(fields[1]).toEqual({ dbField: 'itemDescription', label: 'Description', required: true });

      // Verify required flags
      const requiredFields = fields.filter(f => f.required);
      expect(requiredFields).toHaveLength(2);
      expect(requiredFields.map(f => f.dbField)).toEqual(['itemCode', 'itemDescription']);
    });

    it('returns correct fields for suppliers entity', () => {
      const fields = getExpectedFields('suppliers');

      expect(fields).toHaveLength(10);
      expect(fields[0]).toEqual({ dbField: 'supplierCode', label: 'Supplier Code', required: true });
      expect(fields[1]).toEqual({ dbField: 'supplierName', label: 'Supplier Name', required: true });

      const requiredFields = fields.filter(f => f.required);
      expect(requiredFields).toHaveLength(2);
    });

    it('strips transform from returned field objects', () => {
      const fields = getExpectedFields('items');
      // The returned objects should only have dbField, label, required — no transform
      for (const f of fields) {
        expect(Object.keys(f)).toEqual(['dbField', 'label', 'required']);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // parseExcelPreview
  // ---------------------------------------------------------------------------
  describe('parseExcelPreview', () => {
    it('parses Excel buffer and returns preview with headers, sampleRows, totalRows', () => {
      const mockRows = [
        { Code: 'A001', Name: 'Widget' },
        { Code: 'A002', Name: 'Gadget' },
        { Code: 'A003', Name: 'Doohickey' },
      ];

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any);
      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue(mockRows as any);

      const result = parseExcelPreview(Buffer.from('data'), 'items');

      expect(XLSX.read).toHaveBeenCalledWith(
        Buffer.from('data'),
        expect.objectContaining({ type: 'buffer', dense: true, cellFormula: false }),
      );
      expect(result.headers).toEqual(['Code', 'Name']);
      expect(result.sampleRows).toEqual(mockRows);
      expect(result.totalRows).toBe(3);
      expect(result.expectedFields).toEqual(getExpectedFields('items'));
    });

    it('returns at most 5 sample rows', () => {
      const mockRows = Array.from({ length: 20 }, (_, i) => ({ id: `item-${i}` }));

      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any);
      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue(mockRows as any);

      const result = parseExcelPreview(Buffer.from('data'), 'items');

      expect(result.sampleRows).toHaveLength(5);
      expect(result.totalRows).toBe(20);
    });

    it('throws when workbook has no sheets', () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: [],
        Sheets: {},
      } as any);

      expect(() => parseExcelPreview(Buffer.from('data'), 'items')).toThrow('No sheets found in the Excel file');
    });

    it('throws when sheet has no data rows', () => {
      vi.mocked(XLSX.read).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      } as any);
      vi.mocked(XLSX.utils.sheet_to_json).mockReturnValue([]);

      expect(() => parseExcelPreview(Buffer.from('data'), 'items')).toThrow('No data rows found in the Excel file');
    });
  });

  // ---------------------------------------------------------------------------
  // executeImport
  // ---------------------------------------------------------------------------
  describe('executeImport', () => {
    it('imports rows successfully and calls prisma.item.create for each row', async () => {
      mockPrisma.item.create.mockResolvedValue({});

      const mapping = { 'Item Code': 'itemCode', Description: 'itemDescription' };
      const rows = [
        { 'Item Code': 'IC-001', Description: 'Widget A' },
        { 'Item Code': 'IC-002', Description: 'Widget B' },
      ];

      const result = await executeImport('items', mapping, rows);

      expect(mockPrisma.item.create).toHaveBeenCalledTimes(2);
      expect(result.entity).toBe('items');
      expect(result.total).toBe(2);
      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.results).toEqual([
        { row: 1, success: true },
        { row: 2, success: true },
      ]);
    });

    it('applies field mapping correctly (excelHeader → dbField)', async () => {
      mockPrisma.supplier.create.mockResolvedValue({});

      const mapping = {
        'Vendor Code': 'supplierCode',
        'Vendor Name': 'supplierName',
        Email: 'email',
      };
      const rows = [{ 'Vendor Code': 'SUP-1', 'Vendor Name': 'Acme Corp', Email: 'acme@test.com' }];

      await executeImport('suppliers', mapping, rows);

      expect(mockPrisma.supplier.create).toHaveBeenCalledWith({
        data: {
          supplierCode: 'SUP-1',
          supplierName: 'Acme Corp',
          email: 'acme@test.com',
        },
      });
    });

    it('applies toNumber transform for numeric fields', async () => {
      mockPrisma.item.create.mockResolvedValue({});

      const mapping = {
        Code: 'itemCode',
        Desc: 'itemDescription',
        Price: 'unitPrice',
        Reorder: 'reorderLevel',
      };
      const rows = [{ Code: 'IC-1', Desc: 'W', Price: '99.50', Reorder: '25' }];

      await executeImport('items', mapping, rows);

      expect(mockPrisma.item.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          unitPrice: 99.5,
          reorderLevel: 25,
        }),
      });
    });

    it('applies toDate transform for date fields', async () => {
      mockPrisma.project.create.mockResolvedValue({});

      const mapping = {
        Code: 'projectCode',
        Name: 'projectName',
        Start: 'startDate',
      };
      const rows = [{ Code: 'P-1', Name: 'Project X', Start: '2025-06-15' }];

      await executeImport('projects', mapping, rows);

      const createCall = mockPrisma.project.create.mock.calls[0][0];
      expect(createCall.data.startDate).toBeInstanceOf(Date);
      expect(createCall.data.startDate.toISOString()).toContain('2025-06-15');
    });

    it('handles Excel serial date numbers via toDate transform', async () => {
      mockPrisma.project.create.mockResolvedValue({});

      const mapping = { Code: 'projectCode', Name: 'projectName', Start: 'startDate' };
      // Excel serial date 44927 = 2023-01-01
      const rows = [{ Code: 'P-1', Name: 'Test', Start: 44927 }];

      await executeImport('projects', mapping, rows);

      const createCall = mockPrisma.project.create.mock.calls[0][0];
      expect(createCall.data.startDate).toBeInstanceOf(Date);
      // Verify the date is valid
      expect(createCall.data.startDate.getTime()).not.toBeNaN();
    });

    it('throws when required field mapping is missing', async () => {
      // items requires itemCode and itemDescription
      const mapping = { Code: 'itemCode' }; // missing itemDescription
      const rows = [{ Code: 'IC-1' }];

      await expect(executeImport('items', mapping, rows)).rejects.toThrow(
        'Missing required field mapping: Description',
      );
    });

    it('throws when multiple required fields are missing', async () => {
      const mapping = { HSN: 'hsnCode' }; // missing both itemCode and itemDescription
      const rows = [{ HSN: '1234' }];

      await expect(executeImport('items', mapping, rows)).rejects.toThrow(
        'Missing required field mapping: Item Code, Description',
      );
    });

    it('handles row-level errors gracefully and continues processing', async () => {
      mockPrisma.item.create
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Duplicate entry'))
        .mockResolvedValueOnce({});

      const mapping = { Code: 'itemCode', Desc: 'itemDescription' };
      const rows = [
        { Code: 'IC-1', Desc: 'Widget A' },
        { Code: 'IC-1', Desc: 'Widget A duplicate' },
        { Code: 'IC-3', Desc: 'Widget C' },
      ];

      const result = await executeImport('items', mapping, rows);

      expect(result.succeeded).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.total).toBe(3);
      expect(result.results).toEqual([
        { row: 1, success: true },
        { row: 2, success: false, error: 'Duplicate entry' },
        { row: 3, success: true },
      ]);
    });

    it('skips empty optional values in created data', async () => {
      mockPrisma.item.create.mockResolvedValue({});

      const mapping = {
        Code: 'itemCode',
        Desc: 'itemDescription',
        Category: 'itemCategory',
        HSN: 'hsnCode',
      };
      const rows = [{ Code: 'IC-1', Desc: 'Widget', Category: '', HSN: '' }];

      await executeImport('items', mapping, rows);

      const createCall = mockPrisma.item.create.mock.calls[0][0];
      expect(createCall.data).toEqual({
        itemCode: 'IC-1',
        itemDescription: 'Widget',
      });
      // Empty optional fields should NOT be present
      expect(createCall.data).not.toHaveProperty('itemCategory');
      expect(createCall.data).not.toHaveProperty('hsnCode');
    });

    it('throws row error when required field value is empty', async () => {
      mockPrisma.item.create.mockResolvedValue({});

      const mapping = { Code: 'itemCode', Desc: 'itemDescription' };
      const rows = [{ Code: '', Desc: 'Widget' }];

      const result = await executeImport('items', mapping, rows);

      expect(result.failed).toBe(1);
      expect(result.results[0]).toEqual({
        row: 1,
        success: false,
        error: 'Required field "Item Code" is empty',
      });
    });

    it('returns correct ImportResult structure', async () => {
      mockPrisma.item.create.mockResolvedValue({});

      const mapping = { Code: 'itemCode', Desc: 'itemDescription' };
      const rows = [{ Code: 'IC-1', Desc: 'Widget' }];

      const result = await executeImport('items', mapping, rows);

      expect(result).toEqual({
        entity: 'items',
        total: 1,
        succeeded: 1,
        failed: 0,
        results: [{ row: 1, success: true }],
      });
    });

    it('uses prisma.supplier.create for suppliers entity', async () => {
      mockPrisma.supplier.create.mockResolvedValue({});

      const mapping = { Code: 'supplierCode', Name: 'supplierName' };
      const rows = [{ Code: 'S-1', Name: 'Acme' }];

      await executeImport('suppliers', mapping, rows);

      expect(mockPrisma.supplier.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.item.create).not.toHaveBeenCalled();
    });

    it('uses prisma.employee.create for employees entity', async () => {
      mockPrisma.employee.create.mockResolvedValue({});

      const mapping = {
        ID: 'employeeIdNumber',
        Name: 'fullName',
        Email: 'email',
      };
      const rows = [{ ID: 'EMP-001', Name: 'John Doe', Email: 'john@test.com' }];

      await executeImport('employees', mapping, rows);

      expect(mockPrisma.employee.create).toHaveBeenCalledWith({
        data: {
          employeeIdNumber: 'EMP-001',
          fullName: 'John Doe',
          email: 'john@test.com',
        },
      });
    });

    it('uses dynamic prisma model for uoms (unitOfMeasure)', async () => {
      (mockPrisma as any).unitOfMeasure.create.mockResolvedValue({});

      const mapping = { Code: 'uomCode', Name: 'uomName' };
      const rows = [{ Code: 'KG', Name: 'Kilogram' }];

      await executeImport('uoms', mapping, rows);

      expect((mockPrisma as any).unitOfMeasure.create).toHaveBeenCalledWith({
        data: { uomCode: 'KG', uomName: 'Kilogram' },
      });
    });

    it('uses dynamic prisma model for regions', async () => {
      (mockPrisma as any).region.create.mockResolvedValue({});

      const mapping = { Name: 'regionName' };
      const rows = [{ Name: 'Eastern Province' }];

      await executeImport('regions', mapping, rows);

      expect((mockPrisma as any).region.create).toHaveBeenCalledWith({
        data: { regionName: 'Eastern Province' },
      });
    });

    it('applies toNumber transform returning null for non-numeric strings', async () => {
      mockPrisma.item.create.mockResolvedValue({});

      const mapping = {
        Code: 'itemCode',
        Desc: 'itemDescription',
        Price: 'unitPrice',
      };
      const rows = [{ Code: 'IC-1', Desc: 'Widget', Price: 'not-a-number' }];

      await executeImport('items', mapping, rows);

      const createCall = mockPrisma.item.create.mock.calls[0][0];
      // toNumber returns null for NaN, and null optional → skipped
      expect(createCall.data).not.toHaveProperty('unitPrice');
    });
  });
});
