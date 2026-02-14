/**
 * AI Schema Context — provides structured schema information to the AI
 * for generating safe, scoped SQL queries.
 *
 * Only exposes an allow-list of tables. AI may only SELECT from these tables.
 */

export interface TableInfo {
  table: string;
  description: string;
  columns: string[];
}

/** Tables the AI is allowed to query (SELECT only) */
export const ALLOWED_TABLES: TableInfo[] = [
  {
    table: 'projects',
    description: 'Projects / job sites',
    columns: ['id', 'project_code', 'project_name', 'client', 'manager', 'status', 'created_at'],
  },
  {
    table: 'items',
    description: 'Material items catalog',
    columns: ['id', 'item_code', 'item_name', 'category', 'uom_id', 'status', 'created_at'],
  },
  {
    table: 'warehouses',
    description: 'Warehouses / storage locations',
    columns: ['id', 'warehouse_code', 'warehouse_name', 'project_id', 'status'],
  },
  {
    table: 'suppliers',
    description: 'Material suppliers',
    columns: ['id', 'supplier_code', 'supplier_name', 'category', 'status'],
  },
  {
    table: 'employees',
    description: 'System users / employees',
    columns: ['id', 'employee_id', 'full_name', 'email', 'system_role', 'status'],
  },
  {
    table: 'mrrv',
    description: 'Goods Receipt Notes (GRN)',
    columns: [
      'id',
      'mrrv_number',
      'status',
      'project_id',
      'supplier_id',
      'warehouse_id',
      'receive_date',
      'rfim_required',
      'created_at',
    ],
  },
  {
    table: 'mrrv_lines',
    description: 'GRN line items',
    columns: ['id', 'mrrv_id', 'item_id', 'qty_received', 'qty_accepted', 'unit_cost'],
  },
  {
    table: 'mirv',
    description: 'Material Issues (MI)',
    columns: ['id', 'mirv_number', 'status', 'project_id', 'warehouse_id', 'request_date', 'issued_date', 'created_at'],
  },
  {
    table: 'mirv_lines',
    description: 'MI line items',
    columns: ['id', 'mirv_id', 'item_id', 'qty_requested', 'qty_issued'],
  },
  {
    table: 'mrv',
    description: 'Material Returns (MRN)',
    columns: ['id', 'mrv_number', 'status', 'project_id', 'warehouse_id', 'return_date', 'created_at'],
  },
  {
    table: 'material_requisitions',
    description: 'Material Requests (MR)',
    columns: ['id', 'mrf_number', 'status', 'project_id', 'created_at'],
  },
  {
    table: 'job_orders',
    description: 'Job Orders (JO)',
    columns: ['id', 'jo_number', 'jo_type', 'status', 'priority', 'project_id', 'request_date', 'created_at'],
  },
  {
    table: 'shipments',
    description: 'Shipments',
    columns: ['id', 'shipment_number', 'status', 'origin', 'destination', 'eta', 'created_at'],
  },
  {
    table: 'inventory_levels',
    description: 'Current inventory levels per item/warehouse',
    columns: ['id', 'item_id', 'warehouse_id', 'qty_on_hand', 'qty_reserved', 'qty_available', 'reorder_point'],
  },
  {
    table: 'inventory_lots',
    description: 'Individual inventory lots (FIFO)',
    columns: ['id', 'item_id', 'warehouse_id', 'lot_number', 'available_qty', 'unit_cost', 'received_date', 'status'],
  },
  {
    table: 'scrap_items',
    description: 'Scrap items',
    columns: ['id', 'scrap_number', 'status', 'item_id', 'qty', 'project_id', 'created_at'],
  },
  {
    table: 'rfim',
    description: 'Quality Control Inspections (QCI)',
    columns: ['id', 'rfim_number', 'status', 'mrrv_id', 'result', 'created_at'],
  },
  {
    table: 'osd_reports',
    description: 'Discrepancy Reports (DR)',
    columns: ['id', 'osd_number', 'status', 'report_type', 'created_at'],
  },
];

const ALLOWED_TABLE_SET = new Set(ALLOWED_TABLES.map(t => t.table));

/** Build a text prompt describing the schema for AI context */
export function buildSchemaPrompt(): string {
  const lines = ['Available database tables (SELECT only):\n'];
  for (const t of ALLOWED_TABLES) {
    lines.push(`Table: ${t.table} — ${t.description}`);
    lines.push(`  Columns: ${t.columns.join(', ')}`);
    lines.push('');
  }
  return lines.join('\n');
}

/** Validate that a SQL query only uses SELECT on allowed tables */
export function validateQuery(sql: string): { valid: boolean; reason?: string } {
  const normalized = sql.trim().toLowerCase();

  // Must start with SELECT
  if (!normalized.startsWith('select')) {
    return { valid: false, reason: 'Only SELECT queries are allowed.' };
  }

  // Reject multi-statement attacks
  if (normalized.includes(';')) {
    return { valid: false, reason: 'Multiple statements are not allowed.' };
  }

  // Must not contain dangerous keywords
  const forbidden = [
    'insert',
    'update',
    'delete',
    'drop',
    'alter',
    'create',
    'truncate',
    'grant',
    'revoke',
    'exec',
    'execute',
    'union',
    'copy',
    'set',
    'pg_read_file',
    'pg_sleep',
    'lo_import',
  ];
  for (const word of forbidden) {
    // Check as whole word
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(sql)) {
      return { valid: false, reason: `Forbidden keyword: ${word}` };
    }
  }

  // Enforce LIMIT clause — reject queries without LIMIT or with LIMIT > 1000
  const limitMatch = normalized.match(/\blimit\s+(\d+)/);
  if (!limitMatch) {
    return { valid: false, reason: 'Query must include a LIMIT clause.' };
  }
  const limitValue = parseInt(limitMatch[1], 10);
  if (limitValue > 1000) {
    return { valid: false, reason: 'LIMIT must not exceed 1000.' };
  }

  // Extract table names from FROM and JOIN clauses
  const fromMatch = sql.match(/\bfrom\s+(\w+)/gi) ?? [];
  const joinMatch = sql.match(/\bjoin\s+(\w+)/gi) ?? [];
  const allTables = [...fromMatch, ...joinMatch].map(m => m.split(/\s+/)[1]?.toLowerCase()).filter(Boolean);

  for (const table of allTables) {
    if (!ALLOWED_TABLE_SET.has(table!)) {
      return { valid: false, reason: `Table not allowed: ${table}` };
    }
  }

  return { valid: true };
}
