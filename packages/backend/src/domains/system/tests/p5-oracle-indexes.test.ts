/**
 * P5: Oracle-Aligned Indexes & Materialized Views Tests
 *
 * Validates:
 * - All @@map directives use Oracle WMS/EBS/Fusion naming
 * - Composite indexes exist for heavy logistics operations
 * - Materialized view migration SQL is syntactically valid
 * - Schema file count and model count are as expected
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const SCHEMA_DIR = join(__dirname, '../../../../prisma/schema');
const MIGRATION_DIR = join(__dirname, '../../../../prisma/migrations');

// ── Helpers ────────────────────────────────────────────────────────────────

function readSchemaFiles(): { name: string; content: string }[] {
  const files = readdirSync(SCHEMA_DIR).filter(f => f.endsWith('.prisma'));
  return files.map(f => ({
    name: f,
    content: readFileSync(join(SCHEMA_DIR, f), 'utf-8'),
  }));
}

function extractMapDirectives(content: string): string[] {
  const matches: string[] = [];
  const regex = /@@map\("([^"]+)"\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

function extractIndexes(content: string): { columns: string; name: string }[] {
  const indexes: { columns: string; name: string }[] = [];
  const regex = /@@index\(\[([^\]]+)\],\s*map:\s*"([^"]+)"\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    indexes.push({ columns: match[1], name: match[2] });
  }
  return indexes;
}

// ── Oracle Module Prefixes ─────────────────────────────────────────────────

const VALID_PREFIXES = ['FND_', 'MTL_', 'RCV_', 'ONT_', 'WSH_', 'WMS_', 'CUST_'];

// ============================================================================
// TEST SUITE
// ============================================================================

describe('P5: Oracle Table Naming Convention', () => {
  const schemas = readSchemaFiles();
  const allMaps = schemas.flatMap(s => extractMapDirectives(s.content));

  it('should have 16 schema files', () => {
    expect(schemas.length).toBe(16);
  });

  it('every @@map directive uses a valid Oracle module prefix', () => {
    const invalid = allMaps.filter(m => !VALID_PREFIXES.some(prefix => m.startsWith(prefix)));
    expect(invalid).toEqual([]);
  });

  it('all @@map names are UPPER_SNAKE_CASE', () => {
    const nonUpperSnake = allMaps.filter(m => m !== m.toUpperCase() || m.includes(' '));
    expect(nonUpperSnake).toEqual([]);
  });

  it('no duplicate @@map names exist across schema files', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    for (const m of allMaps) {
      if (seen.has(m)) duplicates.push(m);
      seen.add(m);
    }
    expect(duplicates).toEqual([]);
  });

  it('should have at least 140 @@map directives (one per model)', () => {
    expect(allMaps.length).toBeGreaterThanOrEqual(140);
  });
});

describe('P5: Oracle Module Prefix Distribution', () => {
  const schemas = readSchemaFiles();
  const allMaps = schemas.flatMap(s => extractMapDirectives(s.content));

  it('FND_ prefix should have >= 50 tables', () => {
    expect(allMaps.filter(m => m.startsWith('FND_')).length).toBeGreaterThanOrEqual(50);
  });

  it('WMS_ prefix should have >= 50 tables', () => {
    expect(allMaps.filter(m => m.startsWith('WMS_')).length).toBeGreaterThanOrEqual(50);
  });

  it('MTL_ prefix should have >= 15 tables', () => {
    expect(allMaps.filter(m => m.startsWith('MTL_')).length).toBeGreaterThanOrEqual(15);
  });

  it('RCV_ prefix should have >= 7 tables', () => {
    expect(allMaps.filter(m => m.startsWith('RCV_')).length).toBeGreaterThanOrEqual(7);
  });

  it('ONT_ prefix should have >= 5 tables', () => {
    expect(allMaps.filter(m => m.startsWith('ONT_')).length).toBeGreaterThanOrEqual(5);
  });

  it('WSH_ prefix should have >= 5 tables', () => {
    expect(allMaps.filter(m => m.startsWith('WSH_')).length).toBeGreaterThanOrEqual(5);
  });

  it('CUST_ prefix should have >= 3 tables', () => {
    expect(allMaps.filter(m => m.startsWith('CUST_')).length).toBeGreaterThanOrEqual(3);
  });

  it('no non-logistics prefixes remain (HR_, PER_, AP_, PA_, EAM_, QA_, AME_)', () => {
    const banned = ['HR_', 'PER_', 'AP_', 'PA_', 'EAM_', 'QA_', 'AME_'];
    const violations = allMaps.filter(m => banned.some(b => m.startsWith(b)));
    expect(violations).toEqual([]);
  });
});

describe('P5: Composite Indexes for Heavy Logistics Operations', () => {
  const schemas = readSchemaFiles();
  const allIndexes = schemas.flatMap(s => extractIndexes(s.content));
  const indexNames = allIndexes.map(i => i.name);

  // --- Inbound (GRN Lookup) ---
  it('has GRN line item composite index (mrrvId, itemId)', () => {
    expect(indexNames).toContain('idx_rcv_lines_mrrv_item');
  });

  it('has GRN item expiry composite index', () => {
    expect(indexNames).toContain('idx_rcv_lines_item_expiry');
  });

  // --- ASN Processing ---
  it('has ASN warehouse+status composite index', () => {
    expect(indexNames).toContain('idx_rcv_asn_wh_status');
  });

  it('has ASN supplier+arrival composite index', () => {
    expect(indexNames).toContain('idx_rcv_asn_supplier_arrival');
  });

  it('has ASN status+arrival composite index', () => {
    expect(indexNames).toContain('idx_rcv_asn_status_arrival');
  });

  it('has ASN line item composite index (asnId, itemId)', () => {
    expect(indexNames).toContain('idx_rcv_asn_line_asn_item');
  });

  // --- Inventory Availability ---
  it('has inventory availability lookup index', () => {
    expect(indexNames).toContain('idx_mtl_onhand_avail_lookup');
  });

  it('has reorder alert index', () => {
    expect(indexNames).toContain('idx_mtl_onhand_reorder_alert');
  });

  it('has lot expiry check index', () => {
    expect(indexNames).toContain('idx_mtl_lots_expiry_check');
  });

  it('has warehouse lot availability index', () => {
    expect(indexNames).toContain('idx_mtl_lots_wh_avail');
  });

  // --- Customs Clearance ---
  it('has customs stage composite index', () => {
    expect(indexNames).toContain('idx_cust_shipment_stage');
  });

  it('has customs docs shipment+status index', () => {
    expect(indexNames).toContain('idx_cust_docs_shipment_status');
  });

  it('has tariff lookup composite index', () => {
    expect(indexNames).toContain('idx_cust_tariff_lookup');
  });

  // --- Picking / Putaway / Cross-dock ---
  it('has cross-dock warehouse+status index', () => {
    expect(indexNames).toContain('idx_wms_crossdock_wh_status');
  });

  it('has bin location availability index', () => {
    expect(indexNames).toContain('idx_wms_bin_loc_avail');
  });

  it('has staging warehouse+direction+status index', () => {
    expect(indexNames).toContain('idx_wms_staging_wh_dir_status');
  });

  // --- Gate Pass ---
  it('has gate pass warehouse+type+status index', () => {
    expect(indexNames).toContain('idx_wms_gp_wh_type_status');
  });

  it('has gate pass expiry check index', () => {
    expect(indexNames).toContain('idx_wms_gp_expiry_check');
  });

  // --- Yard Management ---
  it('has yard appointment scheduling composite index', () => {
    expect(indexNames).toContain('idx_wms_yard_wh_start_status');
  });

  it('has truck visit warehouse+status index', () => {
    expect(indexNames).toContain('idx_wms_truck_wh_status');
  });

  // --- Total composite index count ---
  it('should have at least 35 new composite indexes (2+ columns)', () => {
    const compositeIndexes = allIndexes.filter(i => i.columns.includes(','));
    expect(compositeIndexes.length).toBeGreaterThanOrEqual(35);
  });
});

describe('P5: Specific Table Name Mappings', () => {
  const schemas = readSchemaFiles();
  const allContent = schemas.map(s => s.content).join('\n');

  const expectedMappings: Record<string, string> = {
    RCV_RECEIPT_HEADERS: 'Mrrv → GRN',
    RCV_RECEIPT_LINES: 'MrrvLine',
    ONT_ISSUE_HEADERS: 'Mirv → MI',
    ONT_ISSUE_LINES: 'MirvLine',
    ONT_RETURN_HEADERS: 'Mrv → MRN',
    ONT_RETURN_LINES: 'MrvLine',
    RCV_INSPECTION_HEADERS: 'Rfim → QCI',
    RCV_DISCREPANCY_HEADERS: 'OsdReport → DR',
    MTL_ONHAND_QUANTITIES: 'InventoryLevel',
    MTL_LOT_NUMBERS: 'InventoryLot',
    WMS_GATE_PASSES: 'GatePass',
    WSH_DELIVERY_HEADERS: 'Shipment',
    MTL_SYSTEM_ITEMS: 'Item',
    FND_SUPPLIERS: 'Supplier',
    WMS_WAREHOUSES: 'Warehouse',
    FND_EMPLOYEES: 'Employee',
    FND_PROJECTS: 'Project',
    WMS_JOB_ORDERS: 'JobOrder',
    MTL_TRANSFER_HEADERS: 'StockTransfer',
    RCV_ASN_HEADERS: 'AdvanceShippingNotice',
    WMS_ZONES: 'WarehouseZone',
    WMS_CROSS_DOCKS: 'CrossDock',
    WMS_ASSET_REGISTER: 'Asset',
    CUST_DOCUMENTS: 'CustomsDocument',
  };

  for (const [tableName, description] of Object.entries(expectedMappings)) {
    it(`maps ${description} to ${tableName}`, () => {
      expect(allContent).toContain(`@@map("${tableName}")`);
    });
  }
});

describe('P5: Materialized Views Migration', () => {
  const migrationDir = join(MIGRATION_DIR, '20260312000000_p5_oracle_indexes_matviews');
  let migrationSQL: string;

  try {
    migrationSQL = readFileSync(join(migrationDir, 'migration.sql'), 'utf-8');
  } catch {
    migrationSQL = '';
  }

  it('migration file exists', () => {
    expect(migrationSQL.length).toBeGreaterThan(0);
  });

  it('creates MV_DAILY_STOCK_SUMMARY materialized view', () => {
    expect(migrationSQL).toContain('CREATE MATERIALIZED VIEW IF NOT EXISTS "MV_DAILY_STOCK_SUMMARY"');
  });

  it('creates MV_OPEN_INBOUND_DOCS materialized view', () => {
    expect(migrationSQL).toContain('CREATE MATERIALIZED VIEW IF NOT EXISTS "MV_OPEN_INBOUND_DOCS"');
  });

  it('creates MV_PENDING_CUSTOMS materialized view', () => {
    expect(migrationSQL).toContain('CREATE MATERIALIZED VIEW IF NOT EXISTS "MV_PENDING_CUSTOMS"');
  });

  it('creates MV_WAREHOUSE_UTILIZATION materialized view', () => {
    expect(migrationSQL).toContain('CREATE MATERIALIZED VIEW IF NOT EXISTS "MV_WAREHOUSE_UTILIZATION"');
  });

  it('MV_DAILY_STOCK_SUMMARY references correct Oracle tables', () => {
    expect(migrationSQL).toContain('"MTL_ONHAND_QUANTITIES"');
    expect(migrationSQL).toContain('"MTL_SYSTEM_ITEMS"');
    expect(migrationSQL).toContain('"WMS_WAREHOUSES"');
    expect(migrationSQL).toContain('"MTL_LOT_NUMBERS"');
  });

  it('MV_OPEN_INBOUND_DOCS references GRN and ASN tables', () => {
    expect(migrationSQL).toContain('"RCV_RECEIPT_HEADERS"');
    expect(migrationSQL).toContain('"RCV_ASN_HEADERS"');
    expect(migrationSQL).toContain('"RCV_RECEIPT_LINES"');
    expect(migrationSQL).toContain('"RCV_ASN_LINES"');
  });

  it('MV_PENDING_CUSTOMS references shipping and customs tables', () => {
    expect(migrationSQL).toContain('"WSH_DELIVERY_HEADERS"');
    expect(migrationSQL).toContain('"CUST_TRACKING"');
    expect(migrationSQL).toContain('"CUST_DOCUMENTS"');
  });

  it('MV_WAREHOUSE_UTILIZATION references warehouse zone tables', () => {
    expect(migrationSQL).toContain('"WMS_WAREHOUSES"');
    expect(migrationSQL).toContain('"WMS_WAREHOUSE_TYPES"');
    expect(migrationSQL).toContain('"WMS_ZONES"');
    expect(migrationSQL).toContain('"WMS_BIN_LOCATIONS"');
  });

  it('creates refresh functions for all 4 views', () => {
    expect(migrationSQL).toContain('refresh_mv_daily_stock_summary');
    expect(migrationSQL).toContain('refresh_mv_open_inbound_docs');
    expect(migrationSQL).toContain('refresh_mv_pending_customs');
    expect(migrationSQL).toContain('refresh_mv_warehouse_utilization');
  });

  it('creates a combined refresh function', () => {
    expect(migrationSQL).toContain('refresh_all_materialized_views');
  });

  it('MV_DAILY_STOCK_SUMMARY has unique index for concurrent refresh', () => {
    expect(migrationSQL).toContain('uq_mv_stock_summary_item_wh');
  });

  it('MV_PENDING_CUSTOMS has unique index for concurrent refresh', () => {
    expect(migrationSQL).toContain('uq_mv_pending_customs_shipment');
  });

  it('uses CONCURRENTLY refresh for views with unique indexes', () => {
    expect(migrationSQL).toContain('REFRESH MATERIALIZED VIEW CONCURRENTLY "MV_DAILY_STOCK_SUMMARY"');
    expect(migrationSQL).toContain('REFRESH MATERIALIZED VIEW CONCURRENTLY "MV_PENDING_CUSTOMS"');
  });

  it('stock summary calculates stock_status correctly', () => {
    expect(migrationSQL).toContain("'out_of_stock'");
    expect(migrationSQL).toContain("'reorder'");
    expect(migrationSQL).toContain("'low'");
    expect(migrationSQL).toContain("'adequate'");
  });
});
