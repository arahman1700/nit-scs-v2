import ExcelJS from 'exceljs';
import { prisma } from '../utils/prisma.js';
import type { ImportableEntity } from '../schemas/import.schema.js';

const MAX_IMPORT_ROWS = 5000;

// ── Column Mapping Definitions ──────────────────────────────────────────

interface FieldDef {
  /** Database column name */
  dbField: string;
  /** Human-readable label */
  label: string;
  /** Whether field is required */
  required: boolean;
  /** Optional transform for the value */
  transform?: (val: unknown) => unknown;
}

/** Expected columns per importable entity */
const ENTITY_FIELDS: Record<ImportableEntity, FieldDef[]> = {
  items: [
    { dbField: 'itemCode', label: 'Item Code', required: true },
    { dbField: 'itemDescription', label: 'Description', required: true },
    { dbField: 'itemCategory', label: 'Category', required: false },
    { dbField: 'defaultUomId', label: 'UOM ID', required: false },
    { dbField: 'reorderLevel', label: 'Reorder Level', required: false, transform: toNumber },
    { dbField: 'unitPrice', label: 'Unit Price', required: false, transform: toNumber },
    { dbField: 'hsnCode', label: 'HSN Code', required: false },
  ],
  suppliers: [
    { dbField: 'supplierCode', label: 'Supplier Code', required: true },
    { dbField: 'supplierName', label: 'Supplier Name', required: true },
    { dbField: 'contactPerson', label: 'Contact Person', required: false },
    { dbField: 'phone', label: 'Phone', required: false },
    { dbField: 'email', label: 'Email', required: false },
    { dbField: 'address', label: 'Address', required: false },
    { dbField: 'country', label: 'Country', required: false },
    { dbField: 'crNumber', label: 'CR Number', required: false },
    { dbField: 'vatNumber', label: 'VAT Number', required: false },
  ],
  projects: [
    { dbField: 'projectCode', label: 'Project Code', required: true },
    { dbField: 'projectName', label: 'Project Name', required: true },
    { dbField: 'client', label: 'Client', required: false },
    { dbField: 'status', label: 'Status', required: false },
    { dbField: 'startDate', label: 'Start Date', required: false, transform: toDate },
    { dbField: 'endDate', label: 'End Date', required: false, transform: toDate },
  ],
  employees: [
    { dbField: 'employeeIdNumber', label: 'Employee ID', required: true },
    { dbField: 'fullName', label: 'Full Name', required: true },
    { dbField: 'email', label: 'Email', required: true },
    { dbField: 'phone', label: 'Phone', required: false },
    { dbField: 'department', label: 'Department', required: false },
    { dbField: 'role', label: 'Role', required: false },
    { dbField: 'systemRole', label: 'System Role', required: false },
  ],
  warehouses: [
    { dbField: 'warehouseCode', label: 'Warehouse Code', required: true },
    { dbField: 'warehouseName', label: 'Warehouse Name', required: true },
    { dbField: 'location', label: 'Location', required: false },
    { dbField: 'capacity', label: 'Capacity', required: false, transform: toNumber },
  ],
  regions: [{ dbField: 'regionName', label: 'Region Name', required: true }],
  cities: [
    { dbField: 'cityName', label: 'City Name', required: true },
    { dbField: 'regionId', label: 'Region ID', required: false },
  ],
  uoms: [
    { dbField: 'uomCode', label: 'UOM Code', required: true },
    { dbField: 'uomName', label: 'UOM Name', required: true },
  ],
};

function toNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toDate(val: unknown): Date | null {
  if (val === null || val === undefined || val === '') return null;
  // Handle Excel serial dates
  if (typeof val === 'number') {
    const date = new Date((val - 25569) * 86400 * 1000);
    return isNaN(date.getTime()) ? null : date;
  }
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

// ── Prisma delegate mapping ─────────────────────────────────────────────
// Data is dynamically constructed from Excel rows, so we use a bounded cast
// at the delegate boundary rather than `(prisma as any)[name]`.

type CreateDelegate = { create(args: { data: Record<string, unknown> }): Promise<unknown> };

function getCreateDelegate(entity: ImportableEntity): CreateDelegate {
  const map: Record<ImportableEntity, unknown> = {
    items: prisma.item,
    suppliers: prisma.supplier,
    projects: prisma.project,
    employees: prisma.employee,
    warehouses: prisma.warehouse,
    regions: prisma.region,
    cities: prisma.city,
    uoms: prisma.unitOfMeasure,
  };
  return map[entity] as CreateDelegate;
}

// ── Public API ──────────────────────────────────────────────────────────

export interface ImportPreviewResult {
  headers: string[];
  sampleRows: Record<string, unknown>[];
  totalRows: number;
  expectedFields: { dbField: string; label: string; required: boolean }[];
}

export interface ImportRowResult {
  row: number;
  success: boolean;
  error?: string;
}

export interface ImportResult {
  entity: string;
  total: number;
  succeeded: number;
  failed: number;
  results: ImportRowResult[];
}

/**
 * Get expected fields for an entity (for the mapping dialog).
 */
export function getExpectedFields(entity: ImportableEntity) {
  return ENTITY_FIELDS[entity].map(({ dbField, label, required }) => ({
    dbField,
    label,
    required,
  }));
}

/**
 * Parse an Excel file and return a preview.
 */
export async function parseExcelPreview(buffer: Buffer, entity: ImportableEntity): Promise<ImportPreviewResult> {
  if (!buffer.length) {
    throw new Error('Uploaded file is empty');
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('No sheets found in the Excel file');

  const headers: string[] = [];
  const rows: Record<string, unknown>[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      // Header row
      row.eachCell((cell, colNumber) => {
        headers[colNumber - 1] = String(cell.value ?? '');
      });
      return;
    }

    const rowData: Record<string, unknown> = {};
    row.eachCell((cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header) {
        rowData[header] = cell.value;
      }
    });
    rows.push(rowData);
  });

  if (rows.length === 0) throw new Error('No data rows found in the Excel file');
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import file exceeds the maximum supported rows (${MAX_IMPORT_ROWS})`);
  }

  return {
    headers,
    sampleRows: rows.slice(0, 5),
    totalRows: rows.length,
    expectedFields: getExpectedFields(entity),
  };
}

/**
 * Execute the import with column mapping.
 */
export async function executeImport(
  entity: ImportableEntity,
  mapping: Record<string, string>,
  rows: Record<string, unknown>[],
): Promise<ImportResult> {
  if (rows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Import request exceeds the maximum supported rows (${MAX_IMPORT_ROWS})`);
  }

  const fields = ENTITY_FIELDS[entity];
  const delegate = getCreateDelegate(entity);

  // Validate mapping covers required fields
  const mappedDbFields = new Set(Object.values(mapping));
  const missingRequired = fields.filter(f => f.required && !mappedDbFields.has(f.dbField)).map(f => f.label);

  if (missingRequired.length > 0) {
    throw new Error(`Missing required field mapping: ${missingRequired.join(', ')}`);
  }

  // Build reverse mapping: dbField -> excelHeader
  const reverseMap: Record<string, string> = {};
  for (const [excelHeader, dbField] of Object.entries(mapping)) {
    reverseMap[dbField] = excelHeader;
  }

  // Build field lookup
  const fieldLookup: Record<string, FieldDef> = {};
  for (const f of fields) {
    fieldLookup[f.dbField] = f;
  }

  const results: ImportRowResult[] = [];
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const data: Record<string, unknown> = {};

      for (const [dbField, excelHeader] of Object.entries(reverseMap)) {
        let value = row[excelHeader];
        const fieldDef = fieldLookup[dbField];

        // Apply transform
        if (fieldDef?.transform) {
          value = fieldDef.transform(value);
        }

        // Skip empty optional values
        if ((value === '' || value === null || value === undefined) && !fieldDef?.required) {
          continue;
        }

        // Validate required non-empty
        if (fieldDef?.required && (value === '' || value === null || value === undefined)) {
          throw new Error(`Required field "${fieldDef.label}" is empty`);
        }

        data[dbField] = value;
      }

      await delegate.create({ data });

      results.push({ row: i + 1, success: true });
      succeeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.push({ row: i + 1, success: false, error: message });
      failed++;
    }
  }

  return {
    entity,
    total: rows.length,
    succeeded,
    failed,
    results,
  };
}
