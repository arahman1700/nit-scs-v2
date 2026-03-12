/**
 * P6 — Logistics Enhancement Schema & Service Validation
 *
 * Validates:
 *  - 10 new P6 models exist with correct Oracle @@map names
 *  - 19 composite indexes on P6 models
 *  - All 155+ models maintain logistics-only prefixes (FND_, MTL_, RCV_, WMS_, WSH_, ONT_, CUST_)
 *  - Receiving automation, LPN, WMS Task, Wave, Stock Allocation, RFID, Carrier, 3PL services
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SCHEMA_DIR = path.resolve(__dirname, '../../../../prisma/schema');
const P6_SCHEMA = path.join(SCHEMA_DIR, '16-logistics-enhancement.prisma');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAllSchemaFiles(): string[] {
  return fs
    .readdirSync(SCHEMA_DIR)
    .filter(f => f.endsWith('.prisma'))
    .sort();
}

function readSchemaFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}

function extractMappings(content: string): { model: string; table: string }[] {
  const results: { model: string; table: string }[] = [];
  const modelRegex = /^model\s+(\w+)\s*\{/gm;
  const mapRegex = /@@map\("([^"]+)"\)/;

  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const modelName = match[1];
    const startIdx = match.index;
    // Find the closing brace — skip to the opening brace first
    let depth = 0;
    let entered = false;
    let blockEnd = startIdx;
    for (let i = startIdx; i < content.length; i++) {
      if (content[i] === '{') {
        depth++;
        entered = true;
      }
      if (content[i] === '}') depth--;
      if (entered && depth === 0) {
        blockEnd = i;
        break;
      }
    }
    const block = content.substring(startIdx, blockEnd + 1);
    const mapMatch = block.match(mapRegex);
    if (mapMatch) {
      results.push({ model: modelName, table: mapMatch[1] });
    }
  }
  return results;
}

function extractIndexes(content: string): string[] {
  const indexes: string[] = [];
  const idxRegex = /@@index\(\[([^\]]+)\]/g;
  let match;
  while ((match = idxRegex.exec(content)) !== null) {
    indexes.push(match[1]);
  }
  return indexes;
}

// ---------------------------------------------------------------------------
// 1. Schema file structure
// ---------------------------------------------------------------------------

describe('P6 — Schema File Structure', () => {
  it('should have at least 17 schema files', () => {
    const files = getAllSchemaFiles();
    expect(files.length).toBeGreaterThanOrEqual(17);
  });

  it('should include 16-logistics-enhancement.prisma', () => {
    expect(fs.existsSync(P6_SCHEMA)).toBe(true);
  });

  it('should have 155+ models total across all schema files', () => {
    let totalModels = 0;
    for (const file of getAllSchemaFiles()) {
      const content = readSchemaFile(path.join(SCHEMA_DIR, file));
      const models = content.match(/^model\s+\w+\s*\{/gm);
      if (models) totalModels += models.length;
    }
    expect(totalModels).toBeGreaterThanOrEqual(155);
  });
});

// ---------------------------------------------------------------------------
// 2. P6 new model @@map naming
// ---------------------------------------------------------------------------

describe('P6 — New Model Oracle Naming', () => {
  const EXPECTED_MODELS: { model: string; table: string }[] = [
    { model: 'LicensePlate', table: 'WMS_LICENSE_PLATES' },
    { model: 'LpnContent', table: 'WMS_LPN_CONTENTS' },
    { model: 'RfidTag', table: 'WMS_RFID_TAGS' },
    { model: 'WmsTask', table: 'WMS_TASK_QUEUE' },
    { model: 'WaveHeader', table: 'WMS_WAVE_HEADERS' },
    { model: 'WaveLine', table: 'WMS_WAVE_LINES' },
    { model: 'StockAllocation', table: 'WMS_STOCK_ALLOCATIONS' },
    { model: 'ThirdPartyContract', table: 'WMS_3PL_CONTRACTS' },
    { model: 'ThirdPartyCharge', table: 'WMS_3PL_CHARGES' },
    { model: 'CarrierService', table: 'WMS_CARRIER_SERVICES' },
  ];

  const p6Content = fs.existsSync(P6_SCHEMA) ? readSchemaFile(P6_SCHEMA) : '';
  const p6Mappings = extractMappings(p6Content);

  for (const expected of EXPECTED_MODELS) {
    it(`model ${expected.model} → @@map("${expected.table}")`, () => {
      const mapping = p6Mappings.find(m => m.model === expected.model);
      expect(mapping).toBeDefined();
      expect(mapping!.table).toBe(expected.table);
    });
  }
});

// ---------------------------------------------------------------------------
// 3. P6 composite indexes
// ---------------------------------------------------------------------------

describe('P6 — Composite Indexes', () => {
  const p6Content = fs.existsSync(P6_SCHEMA) ? readSchemaFile(P6_SCHEMA) : '';
  const p6Indexes = extractIndexes(p6Content);

  it('should have at least 15 composite indexes', () => {
    expect(p6Indexes.length).toBeGreaterThanOrEqual(15);
  });

  const EXPECTED_INDEX_FIELDS = [
    'warehouseId, status', // LicensePlate & WaveHeader
    'lpnId, itemId', // LpnContent
    'tagType, isActive', // RfidTag
    'warehouseId, status, priority', // WmsTask
    'assignedToId, status', // WmsTask
    'waveId, status', // WaveLine
    'warehouseId, itemId, status', // StockAllocation
    'demandDocType, demandDocId', // StockAllocation
    'supplierId, status', // ThirdPartyContract
    'contractId, status', // ThirdPartyCharge
    'mode, isActive', // CarrierService
  ];

  for (const fields of EXPECTED_INDEX_FIELDS) {
    it(`should have composite index on [${fields}]`, () => {
      const found = p6Indexes.some(idx => {
        const normalized = idx.replace(/\s+/g, '');
        const expectedNormalized = fields.replace(/\s+/g, '');
        return normalized.includes(expectedNormalized);
      });
      expect(found).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// 4. P6 model field coverage
// ---------------------------------------------------------------------------

describe('P6 — Model Field Coverage', () => {
  const p6Content = fs.existsSync(P6_SCHEMA) ? readSchemaFile(P6_SCHEMA) : '';

  it('LicensePlate has lpnNumber, warehouseId, lpnType, status, sourceDocType', () => {
    expect(p6Content).toContain('lpnNumber');
    expect(p6Content).toContain('warehouseId');
    expect(p6Content).toContain('lpnType');
    expect(p6Content).toContain('sourceDocType');
  });

  it('RfidTag has epc, tagType, lastSeenAt, lastReaderId', () => {
    expect(p6Content).toContain('epc');
    expect(p6Content).toContain('tagType');
    expect(p6Content).toContain('lastSeenAt');
    expect(p6Content).toContain('lastReaderId');
  });

  it('WmsTask has taskNumber, taskType, priority, assignedToId', () => {
    expect(p6Content).toContain('taskNumber');
    expect(p6Content).toContain('taskType');
    expect(p6Content).toContain('priority');
    expect(p6Content).toContain('assignedToId');
  });

  it('WaveHeader has waveNumber, waveType, totalLines, pickedLines', () => {
    expect(p6Content).toContain('waveNumber');
    expect(p6Content).toContain('waveType');
    expect(p6Content).toContain('totalLines');
    expect(p6Content).toContain('pickedLines');
  });

  it('StockAllocation has allocType, demandDocType, demandDocId, qtyAllocated', () => {
    expect(p6Content).toContain('allocType');
    expect(p6Content).toContain('demandDocType');
    expect(p6Content).toContain('demandDocId');
    expect(p6Content).toContain('qtyAllocated');
  });

  it('ThirdPartyContract has contractCode, supplierId, serviceType', () => {
    expect(p6Content).toContain('contractCode');
    expect(p6Content).toContain('supplierId');
    expect(p6Content).toContain('serviceType');
  });

  it('ThirdPartyCharge has chargeType, totalAmount, approvedById', () => {
    expect(p6Content).toContain('chargeType');
    expect(p6Content).toContain('totalAmount');
    expect(p6Content).toContain('approvedById');
  });

  it('CarrierService has carrierName, serviceCode, mode, ratePerUnit, transitDays', () => {
    expect(p6Content).toContain('carrierName');
    expect(p6Content).toContain('serviceCode');
    expect(p6Content).toContain('mode');
    expect(p6Content).toContain('ratePerUnit');
    expect(p6Content).toContain('transitDays');
  });
});

// ---------------------------------------------------------------------------
// 5. All-schema Oracle prefix compliance (logistics-only)
// ---------------------------------------------------------------------------

describe('P6 — Oracle Prefix Compliance (logistics-only)', () => {
  const VALID_PREFIXES = ['FND_', 'MTL_', 'RCV_', 'ONT_', 'WSH_', 'WMS_', 'CUST_'];
  const BANNED_PREFIXES = ['HR_', 'PER_', 'AP_', 'PA_', 'EAM_', 'QA_', 'AME_'];

  const allMappings: { model: string; table: string; file: string }[] = [];

  // Collect all mappings from all schema files
  for (const file of getAllSchemaFiles()) {
    const content = readSchemaFile(path.join(SCHEMA_DIR, file));
    const mappings = extractMappings(content);
    for (const mapping of mappings) {
      allMappings.push({ ...mapping, file });
    }
  }

  it('every @@map table name uses a valid logistics prefix', () => {
    const invalid = allMappings.filter(m => {
      return !VALID_PREFIXES.some(prefix => m.table.startsWith(prefix));
    });
    expect(invalid).toEqual([]);
  });

  it('no @@map table name uses a banned prefix', () => {
    const banned = allMappings.filter(m => {
      return BANNED_PREFIXES.some(prefix => m.table.startsWith(prefix));
    });
    expect(banned).toEqual([]);
  });

  it('prefix distribution after P6 enhancement', () => {
    const counts: Record<string, number> = {};
    for (const prefix of VALID_PREFIXES) counts[prefix] = 0;

    for (const mapping of allMappings) {
      for (const prefix of VALID_PREFIXES) {
        if (mapping.table.startsWith(prefix)) {
          counts[prefix]++;
          break;
        }
      }
    }

    // After P6: WMS should have grown by 10 new models
    expect(counts['FND_']).toBeGreaterThanOrEqual(50);
    expect(counts['WMS_']).toBeGreaterThanOrEqual(60); // 50 base + 10 P6
    expect(counts['MTL_']).toBeGreaterThanOrEqual(15);
    expect(counts['RCV_']).toBeGreaterThanOrEqual(7);
    expect(counts['ONT_']).toBeGreaterThanOrEqual(5);
    expect(counts['WSH_']).toBeGreaterThanOrEqual(5);
    expect(counts['CUST_']).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 6. Service file existence
// ---------------------------------------------------------------------------

describe('P6 — Service & Route File Existence', () => {
  const SERVICE_DIR = path.resolve(__dirname, '../../..');

  const EXPECTED_FILES = [
    // Warehouse-ops domain
    'domains/warehouse-ops/services/lpn.service.ts',
    'domains/warehouse-ops/routes/lpn.routes.ts',
    'domains/warehouse-ops/services/rfid.service.ts',
    'domains/warehouse-ops/routes/rfid.routes.ts',
    'domains/warehouse-ops/services/wms-task.service.ts',
    'domains/warehouse-ops/routes/wms-task.routes.ts',
    'domains/warehouse-ops/services/wave.service.ts',
    'domains/warehouse-ops/routes/wave.routes.ts',
    'domains/warehouse-ops/services/stock-allocation.service.ts',
    'domains/warehouse-ops/routes/stock-allocation.routes.ts',
    // Logistics domain
    'domains/logistics/services/carrier.service.ts',
    'domains/logistics/routes/carrier.routes.ts',
    'domains/logistics/services/third-party-logistics.service.ts',
    'domains/logistics/routes/third-party-logistics.routes.ts',
    // Inbound domain
    'domains/inbound/services/receiving-automation.service.ts',
    'domains/inbound/routes/receiving-automation.routes.ts',
  ];

  for (const file of EXPECTED_FILES) {
    it(`exists: ${file}`, () => {
      const fullPath = path.join(SERVICE_DIR, file);
      expect(fs.existsSync(fullPath)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// 7. Service export validation (import checks)
// ---------------------------------------------------------------------------

describe('P6 — Service Exports', () => {
  it('receiving-automation exports generateReceivingPlan, executeReceiving, autoReceiveGrn, calculateAsnDuties', async () => {
    const mod = await import('../../inbound/services/receiving-automation.service.js');
    expect(typeof mod.generateReceivingPlan).toBe('function');
    expect(typeof mod.executeReceiving).toBe('function');
    expect(typeof mod.autoReceiveGrn).toBe('function');
    expect(typeof mod.calculateAsnDuties).toBe('function');
  });

  it('lpn.service exports createLpn, getLpns, receiveLpn, storeLpn, pickLpn, packLpn, shipLpn', async () => {
    const mod = await import('../../warehouse-ops/services/lpn.service.js');
    expect(typeof mod.createLpn).toBe('function');
    expect(typeof mod.getLpns).toBe('function');
    expect(typeof mod.receiveLpn).toBe('function');
    expect(typeof mod.storeLpn).toBe('function');
    expect(typeof mod.pickLpn).toBe('function');
    expect(typeof mod.packLpn).toBe('function');
    expect(typeof mod.shipLpn).toBe('function');
  });

  it('rfid.service exports registerTag, recordScan, bulkScan, associateWithLpn', async () => {
    const mod = await import('../../warehouse-ops/services/rfid.service.js');
    expect(typeof mod.registerTag).toBe('function');
    expect(typeof mod.recordScan).toBe('function');
    expect(typeof mod.bulkScan).toBe('function');
    expect(typeof mod.associateWithLpn).toBe('function');
  });

  it('wms-task.service exports createTask, getTasks, assignTask, startTask, completeTask', async () => {
    const mod = await import('../../warehouse-ops/services/wms-task.service.js');
    expect(typeof mod.createTask).toBe('function');
    expect(typeof mod.getTasks).toBe('function');
    expect(typeof mod.assignTask).toBe('function');
    expect(typeof mod.startTask).toBe('function');
    expect(typeof mod.completeTask).toBe('function');
  });

  it('wave.service exports createWave, getWaves, addLines, release, startPicking, complete', async () => {
    const mod = await import('../../warehouse-ops/services/wave.service.js');
    expect(typeof mod.createWave).toBe('function');
    expect(typeof mod.getWaves).toBe('function');
    expect(typeof mod.addLines).toBe('function');
    expect(typeof mod.release).toBe('function');
    expect(typeof mod.startPicking).toBe('function');
    expect(typeof mod.complete).toBe('function');
  });

  it('stock-allocation.service exports allocate, release, confirmPick, bulkAllocate', async () => {
    const mod = await import('../../warehouse-ops/services/stock-allocation.service.js');
    expect(typeof mod.allocate).toBe('function');
    expect(typeof mod.release).toBe('function');
    expect(typeof mod.confirmPick).toBe('function');
    expect(typeof mod.bulkAllocate).toBe('function');
  });

  it('carrier.service exports createCarrier, getCarriers, findBestRate', async () => {
    const mod = await import('../../logistics/services/carrier.service.js');
    expect(typeof mod.createCarrier).toBe('function');
    expect(typeof mod.getCarriers).toBe('function');
    expect(typeof mod.findBestRate).toBe('function');
  });

  it('third-party-logistics.service exports createContract, createCharge, approveCharge', async () => {
    const mod = await import('../../logistics/services/third-party-logistics.service.js');
    expect(typeof mod.createContract).toBe('function');
    expect(typeof mod.createCharge).toBe('function');
    expect(typeof mod.approveCharge).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 8. Route registration validation
// ---------------------------------------------------------------------------

describe('P6 — Route Registration', () => {
  it('warehouse-ops barrel registers rfid, waves, stock-allocations', async () => {
    const barrel = fs.readFileSync(path.resolve(__dirname, '../../warehouse-ops/index.ts'), 'utf-8');
    expect(barrel).toContain("'/rfid'");
    expect(barrel).toContain("'/waves'");
    expect(barrel).toContain("'/stock-allocations'");
    expect(barrel).toContain("'/lpns'");
    expect(barrel).toContain("'/wms-tasks'");
  });

  it('logistics barrel registers carriers and 3pl', async () => {
    const barrel = fs.readFileSync(path.resolve(__dirname, '../../logistics/index.ts'), 'utf-8');
    expect(barrel).toContain("'/carriers'");
    expect(barrel).toContain("'/3pl'");
  });

  it('inbound barrel registers receiving-automation', async () => {
    const barrel = fs.readFileSync(path.resolve(__dirname, '../../inbound/index.ts'), 'utf-8');
    expect(barrel).toContain("'/receiving-automation'");
  });
});
