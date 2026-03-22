/**
 * AI Schema Context — provides structured schema information to the AI
 * for generating safe, scoped SQL queries.
 *
 * Only exposes an allow-list of tables. AI may only SELECT from these tables.
 * Table names use Oracle WMS standard (matching Prisma @@map values).
 */

export interface TableInfo {
  table: string;
  description: string;
  columns: string[];
}

/** Tables the AI is allowed to query (SELECT only) — Oracle WMS naming */
export const ALLOWED_TABLES: TableInfo[] = [
  {
    table: 'FND_PROJECTS',
    description: 'Projects / job sites',
    columns: ['id', 'project_code', 'project_name', 'client', 'manager', 'status', 'created_at'],
  },
  {
    table: 'MTL_SYSTEM_ITEMS',
    description: 'Material items catalog',
    columns: ['id', 'item_code', 'item_name', 'category', 'uom_id', 'status', 'created_at'],
  },
  {
    table: 'WMS_WAREHOUSES',
    description: 'Warehouses / storage locations',
    columns: ['id', 'warehouse_code', 'warehouse_name', 'project_id', 'status'],
  },
  {
    table: 'FND_SUPPLIERS',
    description: 'Material suppliers',
    columns: ['id', 'supplier_code', 'supplier_name', 'category', 'status'],
  },
  {
    table: 'FND_EMPLOYEES',
    description: 'System users / employees',
    columns: ['id', 'employee_id', 'full_name', 'email', 'system_role', 'status'],
  },
  {
    table: 'RCV_RECEIPT_HEADERS',
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
    table: 'RCV_RECEIPT_LINES',
    description: 'GRN line items',
    columns: ['id', 'mrrv_id', 'item_id', 'qty_received', 'qty_accepted', 'unit_cost'],
  },
  {
    table: 'ONT_ISSUE_HEADERS',
    description: 'Material Issues (MI)',
    columns: ['id', 'mirv_number', 'status', 'project_id', 'warehouse_id', 'request_date', 'issued_date', 'created_at'],
  },
  {
    table: 'ONT_ISSUE_LINES',
    description: 'MI line items',
    columns: ['id', 'mirv_id', 'item_id', 'qty_requested', 'qty_issued'],
  },
  {
    table: 'ONT_RETURN_HEADERS',
    description: 'Material Returns (MRN)',
    columns: ['id', 'mrv_number', 'status', 'project_id', 'warehouse_id', 'return_date', 'created_at'],
  },
  {
    table: 'ONT_REQUISITION_HEADERS',
    description: 'Material Requests (MR)',
    columns: ['id', 'mrf_number', 'status', 'project_id', 'created_at'],
  },
  {
    table: 'WMS_JOB_ORDERS',
    description: 'Job Orders (JO)',
    columns: ['id', 'jo_number', 'jo_type', 'status', 'priority', 'project_id', 'request_date', 'created_at'],
  },
  {
    table: 'WSH_DELIVERY_HEADERS',
    description: 'Shipments',
    columns: [
      'id',
      'shipment_number',
      'status',
      'origin_country',
      'destination_warehouse_id',
      'eta_port',
      'created_at',
    ],
  },
  {
    table: 'MTL_ONHAND_QUANTITIES',
    description: 'Current inventory levels per item/warehouse',
    columns: ['id', 'item_id', 'warehouse_id', 'qty_on_hand', 'qty_reserved', 'qty_available', 'reorder_point'],
  },
  {
    table: 'MTL_LOT_NUMBERS',
    description: 'Individual inventory lots (FIFO)',
    columns: ['id', 'item_id', 'warehouse_id', 'lot_number', 'available_qty', 'unit_cost', 'received_date', 'status'],
  },
  {
    table: 'MTL_SCRAP_ITEMS',
    description: 'Scrap items',
    columns: ['id', 'scrap_number', 'status', 'item_id', 'qty', 'project_id', 'created_at'],
  },
  {
    table: 'RCV_INSPECTION_HEADERS',
    description: 'Quality Control Inspections (QCI)',
    columns: ['id', 'rfim_number', 'status', 'mrrv_id', 'result', 'created_at'],
  },
  {
    table: 'RCV_DISCREPANCY_HEADERS',
    description: 'Discrepancy Reports (DR)',
    columns: ['id', 'osd_number', 'status', 'report_types', 'created_at'],
  },
  {
    table: 'MTL_TRANSFER_HEADERS',
    description: 'Stock transfer / WT documents',
    columns: ['id', 'transfer_number', 'status', 'from_warehouse_id', 'to_warehouse_id', 'transfer_date', 'created_at'],
  },
  {
    table: 'WMS_GATE_PASSES',
    description: 'Gate pass documents',
    columns: ['id', 'gate_pass_number', 'status', 'mirv_id', 'project_id', 'created_at'],
  },
  {
    table: 'MTL_INTERNAL_TRANSFERS',
    description: 'Inter-site material supply forms (IMSF)',
    columns: ['id', 'imsf_number', 'status', 'sender_project_id', 'receiver_project_id', 'created_at'],
  },
  {
    table: 'MTL_SURPLUS_ITEMS',
    description: 'Surplus inventory',
    columns: ['id', 'surplus_number', 'status', 'item_id', 'qty', 'project_id', 'created_at'],
  },
];

const ALLOWED_TABLE_SET = new Set(ALLOWED_TABLES.map(t => t.table));

/** System catalog and internal PostgreSQL tables — always blocked (defense-in-depth) */
export const BLOCKED_TABLES = new Set([
  'information_schema',
  'pg_catalog',
  'pg_tables',
  'pg_stat_user_tables',
  'pg_roles',
  'pg_user',
  'pg_shadow',
  'pg_stat_activity',
  'pg_settings',
  'pg_authid',
]);

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

/** Build a map of allowed table → allowed columns for column-level validation */
const ALLOWED_COLUMNS_MAP = new Map<string, Set<string>>();
for (const t of ALLOWED_TABLES) {
  ALLOWED_COLUMNS_MAP.set(t.table, new Set(t.columns));
}

/**
 * Strip SQL comments and quoted identifiers that could bypass validation.
 * Returns cleaned SQL for safe regex-based validation.
 */
export function stripCommentsAndQuotes(sql: string): string {
  let cleaned = sql;
  // Strip block comments (/* ... */) — non-greedy, handles nested-ish
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, ' ');
  // Strip line comments (-- to end of line)
  cleaned = cleaned.replace(/--[^\n]*/g, ' ');
  // Strip double-quoted identifiers ("table_name" → table_name)
  cleaned = cleaned.replace(/"([^"]+)"/g, '$1');
  // Strip backtick-quoted identifiers (`table_name` → table_name)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  // Collapse multiple whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/** Validate that a SQL query only uses SELECT on allowed tables */
export function validateQuery(sql: string): { valid: boolean; reason?: string } {
  // Block backslash escapes that could bypass validation
  if (/\\/.test(sql)) {
    return { valid: false, reason: 'Backslash escapes are not allowed.' };
  }

  // Strip comments and quoted identifiers BEFORE any validation
  const cleaned = stripCommentsAndQuotes(sql);
  const normalized = cleaned.trim().toLowerCase();

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
    'with',
    'into',
    'call',
    'do',
    'handler',
    'load',
    'replace',
    'lock',
    'unlock',
  ];
  for (const word of forbidden) {
    // Check as whole word against cleaned SQL
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    if (regex.test(cleaned)) {
      return { valid: false, reason: `Forbidden keyword: ${word}` };
    }
  }

  // Block dangerous PostgreSQL function calls that could be used for
  // data exfiltration, DoS, or server-side operations (SECR-03)
  const dangerousFunctions = [
    'pg_read_file', 'pg_read_binary_file', 'pg_stat_file',
    'pg_ls_dir', 'pg_sleep', 'pg_terminate_backend',
    'pg_cancel_backend', 'pg_reload_conf',
    'lo_import', 'lo_export', 'lo_get',
    'current_setting', 'set_config',
    'dblink', 'dblink_exec', 'dblink_connect',
    'query_to_xml', 'query_to_json',
    'txid_current', 'inet_server_addr', 'inet_server_port',
    'version',
  ];
  for (const fn of dangerousFunctions) {
    const fnRegex = new RegExp(`\\b${fn}\\s*\\(`, 'i');
    if (fnRegex.test(cleaned)) {
      return { valid: false, reason: `Dangerous function not allowed: ${fn}` };
    }
  }

  // Block subqueries in FROM clause — pattern: FROM (SELECT or FROM\s*\(SELECT
  if (/\bfrom\s*\(\s*select\b/i.test(cleaned)) {
    return { valid: false, reason: 'Subqueries in FROM clause are not allowed.' };
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

  // Block access to sensitive columns (password hashes, tokens, secrets)
  const sensitiveColumns = [
    'password_hash',
    'passwordhash',
    'refresh_token',
    'refreshtoken',
    'secret',
    'api_key',
    'apikey',
    'access_token',
    'accesstoken',
    'hashed_password',
    'hashedpassword',
    'token',
    'salt',
  ];
  for (const col of sensitiveColumns) {
    const colRegex = new RegExp(`\\b${col}\\b`, 'i');
    if (colRegex.test(cleaned)) {
      return { valid: false, reason: `Access to sensitive column not allowed: ${col}` };
    }
  }

  // Block access to blocked tables even as quoted identifiers (already stripped above,
  // but also check the original for patterns like information_schema.xxx)
  for (const blocked of BLOCKED_TABLES) {
    const blockedRegex = new RegExp(`\\b${blocked}\\b`, 'i');
    if (blockedRegex.test(cleaned)) {
      return { valid: false, reason: `System catalog table not allowed: ${blocked}` };
    }
  }
  // Also block _prisma_migrations (internal Prisma table)
  if (/\b_prisma_migrations\b/i.test(cleaned)) {
    return { valid: false, reason: 'System table not allowed: _prisma_migrations' };
  }

  // Extract table names from FROM and JOIN clauses (using cleaned SQL)
  const fromMatch = cleaned.match(/\bfrom\s+(\w+)/gi) ?? [];
  const joinMatch = cleaned.match(/\bjoin\s+(\w+)/gi) ?? [];
  const allTables = [...fromMatch, ...joinMatch].map(m => m.split(/\s+/)[1]?.toUpperCase()).filter(Boolean);

  for (const table of allTables) {
    // Block any pg_ prefixed tables (system catalogs)
    if (table!.toLowerCase().startsWith('pg_')) {
      return { valid: false, reason: `System catalog table not allowed: ${table}` };
    }
    // Block known system catalog schemas/tables
    if (BLOCKED_TABLES.has(table!.toLowerCase())) {
      return { valid: false, reason: `System catalog table not allowed: ${table}` };
    }
    // Check against allowlist (case-insensitive)
    if (!ALLOWED_TABLE_SET.has(table!)) {
      return { valid: false, reason: `Table not allowed: ${table}` };
    }
  }

  // Validate extracted column names against allowed columns per table
  // Extract SELECT column references and validate against table schema
  for (const table of allTables) {
    const allowedCols = ALLOWED_COLUMNS_MAP.get(table!);
    if (!allowedCols) continue;

    // Extract column names from <table>.<column> references
    const qualifiedColRegex = new RegExp(`\\b${table}\\.(\\w+)`, 'gi');
    let colMatch: RegExpExecArray | null;
    while ((colMatch = qualifiedColRegex.exec(cleaned)) !== null) {
      const col = colMatch[1]!.toLowerCase();
      if (!allowedCols.has(col)) {
        return { valid: false, reason: `Column '${col}' not allowed on table '${table}'` };
      }
    }
  }

  return { valid: true };
}
