import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';

beforeEach(() => {
  const fresh = createPrismaMock();
  Object.assign(mockPrisma, fresh);
  vi.clearAllMocks();
});

// Helper to get a fresh module with a clean dataSources Map
type WidgetModule = typeof import('./widget-data.service.js');
async function freshModule(): Promise<WidgetModule> {
  vi.resetModules();
  return import('./widget-data.service.js');
}

// ---------------------------------------------------------------------------
// Registry: register / getDataSource / listDataSources
// ---------------------------------------------------------------------------
describe('widget-data.service — Registry', () => {
  it('listDataSources returns all built-in keys on import', async () => {
    const mod = await freshModule();
    const keys = mod.listDataSources();
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toContain('stats/projects');
    expect(keys).toContain('stats/items');
    expect(keys).toContain('stats/warehouses');
    expect(keys).toContain('stats/pending_approvals');
    expect(keys).toContain('stats/low_stock');
    expect(keys).toContain('stats/open_jobs');
    expect(keys).toContain('stats/active_shipments');
    expect(keys).toContain('grouped/mrrv_by_status');
    expect(keys).toContain('timeseries/mrrv');
    expect(keys).toContain('table/recent_mrrv');
    expect(keys).toContain('sla/compliance');
    expect(keys).toContain('inventory/value');
    expect(keys).toContain('cross-department/inventory_by_warehouse');
    expect(keys).toContain('cross-department/document_pipeline');
    expect(keys).toContain('cross-department/pending_by_department');
  });

  it('getDataSource returns a function for a registered key', async () => {
    const mod = await freshModule();
    const fn = mod.getDataSource('stats/projects');
    expect(fn).toBeTypeOf('function');
  });

  it('getDataSource returns undefined for an unknown key', async () => {
    const mod = await freshModule();
    expect(mod.getDataSource('does/not/exist')).toBeUndefined();
  });

  it('register adds a custom data source', async () => {
    const mod = await freshModule();
    const customFn = vi.fn().mockResolvedValue({ type: 'number', data: 42, label: 'Custom' });
    mod.register('custom/test', customFn);
    expect(mod.listDataSources()).toContain('custom/test');
    expect(mod.getDataSource('custom/test')).toBe(customFn);
  });

  it('register overwrites an existing key', async () => {
    const mod = await freshModule();
    const replacement = vi.fn().mockResolvedValue({ type: 'number', data: 99, label: 'Replaced' });
    mod.register('stats/projects', replacement);
    expect(mod.getDataSource('stats/projects')).toBe(replacement);
  });
});

// ---------------------------------------------------------------------------
// Built-in Stats Sources (type: 'number')
// ---------------------------------------------------------------------------
describe('widget-data.service — Stats Sources', () => {
  // Use the default import (module-level registrations already ran)
  let getDataSource: WidgetModule['getDataSource'];
  beforeEach(async () => {
    const mod = await freshModule();
    getDataSource = mod.getDataSource;
  });

  it('stats/projects counts active projects', async () => {
    mockPrisma.project.count.mockResolvedValue(7);
    const fn = getDataSource('stats/projects')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'number', data: 7, label: 'Active Projects' });
    expect(mockPrisma.project.count).toHaveBeenCalledWith({ where: { status: 'active' } });
  });

  it('stats/items counts active items', async () => {
    mockPrisma.item.count.mockResolvedValue(120);
    const fn = getDataSource('stats/items')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'number', data: 120, label: 'Items' });
    expect(mockPrisma.item.count).toHaveBeenCalledWith({ where: { status: 'active' } });
  });

  it('stats/warehouses counts active warehouses', async () => {
    mockPrisma.warehouse.count.mockResolvedValue(5);
    const fn = getDataSource('stats/warehouses')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'number', data: 5, label: 'Warehouses' });
    expect(mockPrisma.warehouse.count).toHaveBeenCalledWith({ where: { status: 'active' } });
  });

  it('stats/pending_approvals sums 3 parallel counts', async () => {
    mockPrisma.mirv.count.mockResolvedValue(3);
    mockPrisma.jobOrder.count.mockResolvedValue(5);
    mockPrisma.mrrv.count.mockResolvedValue(2);
    const fn = getDataSource('stats/pending_approvals')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'number', data: 10, label: 'Pending Approvals' });
    expect(mockPrisma.mirv.count).toHaveBeenCalledWith({ where: { status: 'pending_approval' } });
    expect(mockPrisma.jobOrder.count).toHaveBeenCalledWith({ where: { status: 'pending_approval' } });
    expect(mockPrisma.mrrv.count).toHaveBeenCalledWith({ where: { status: 'pending_approval' } });
  });

  it('stats/low_stock uses $queryRaw and converts bigint', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: BigInt(15) }]);
    const fn = getDataSource('stats/low_stock')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'number', data: 15, label: 'Low Stock Items' });
  });

  it('stats/low_stock returns 0 when query returns empty', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const fn = getDataSource('stats/low_stock')!;
    const result = await fn({});
    expect(result.data).toBe(0);
  });

  it('stats/open_jobs counts non-terminal job orders', async () => {
    mockPrisma.jobOrder.count.mockResolvedValue(12);
    const fn = getDataSource('stats/open_jobs')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'number', data: 12, label: 'Open Job Orders' });
    expect(mockPrisma.jobOrder.count).toHaveBeenCalledWith({
      where: { status: { notIn: ['completed', 'invoiced', 'cancelled', 'rejected'] } },
    });
  });

  it('stats/active_shipments counts in-transit statuses', async () => {
    mockPrisma.shipment.count.mockResolvedValue(8);
    const fn = getDataSource('stats/active_shipments')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'number', data: 8, label: 'Active Shipments' });
    expect(mockPrisma.shipment.count).toHaveBeenCalledWith({
      where: { status: { in: ['in_transit', 'at_port', 'customs_clearing', 'in_delivery'] } },
    });
  });
});

// ---------------------------------------------------------------------------
// Grouped Sources (type: 'grouped')
// ---------------------------------------------------------------------------
describe('widget-data.service — Grouped Sources', () => {
  let getDataSource: WidgetModule['getDataSource'];
  beforeEach(async () => {
    const mod = await freshModule();
    getDataSource = mod.getDataSource;
  });

  it('grouped/mrrv_by_status maps groupBy results', async () => {
    mockPrisma.mrrv.groupBy.mockResolvedValue([
      { status: 'draft', _count: { id: 4 } },
      { status: 'completed', _count: { id: 10 } },
    ]);
    const fn = getDataSource('grouped/mrrv_by_status')!;
    const result = await fn({});
    expect(result.type).toBe('grouped');
    expect(result.data).toEqual([
      { label: 'draft', value: 4 },
      { label: 'completed', value: 10 },
    ]);
  });

  it('grouped/mirv_by_status maps groupBy results', async () => {
    mockPrisma.mirv.groupBy.mockResolvedValue([{ status: 'pending_approval', _count: { id: 6 } }]);
    const fn = getDataSource('grouped/mirv_by_status')!;
    const result = await fn({});
    expect(result.type).toBe('grouped');
    expect(result.data).toEqual([{ label: 'pending_approval', value: 6 }]);
  });

  it('grouped/jo_by_type groups job orders by type', async () => {
    mockPrisma.jobOrder.groupBy.mockResolvedValue([
      { joType: 'transport', _count: { id: 3 } },
      { joType: 'rental', _count: { id: 2 } },
    ]);
    const fn = getDataSource('grouped/jo_by_type')!;
    const result = await fn({});
    expect(result.type).toBe('grouped');
    expect(result.data).toEqual([
      { label: 'transport', value: 3 },
      { label: 'rental', value: 2 },
    ]);
    expect(mockPrisma.jobOrder.groupBy).toHaveBeenCalledWith({
      by: ['joType'],
      _count: { id: true },
    });
  });

  it('grouped/jo_by_status groups job orders by status', async () => {
    mockPrisma.jobOrder.groupBy.mockResolvedValue([{ status: 'draft', _count: { id: 1 } }]);
    const fn = getDataSource('grouped/jo_by_status')!;
    const result = await fn({});
    expect(result.data).toEqual([{ label: 'draft', value: 1 }]);
  });

  it('grouped/inventory_by_warehouse uses $queryRaw', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { warehouse_name: 'Main', total_qty: 500 },
      { warehouse_name: 'Annex', total_qty: 200 },
    ]);
    const fn = getDataSource('grouped/inventory_by_warehouse')!;
    const result = await fn({});
    expect(result.type).toBe('grouped');
    expect(result.data).toEqual([
      { label: 'Main', value: 500 },
      { label: 'Annex', value: 200 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// Timeseries Sources (type: 'timeseries')
// ---------------------------------------------------------------------------
describe('widget-data.service — Timeseries Sources', () => {
  let getDataSource: WidgetModule['getDataSource'];
  beforeEach(async () => {
    const mod = await freshModule();
    getDataSource = mod.getDataSource;
  });

  it('timeseries/mrrv maps $queryRaw rows to date/value pairs', async () => {
    const jan = new Date('2025-01-01');
    const feb = new Date('2025-02-01');
    mockPrisma.$queryRaw.mockResolvedValue([
      { month: jan, count: 5 },
      { month: feb, count: 8 },
    ]);
    const fn = getDataSource('timeseries/mrrv')!;
    const result = await fn({});
    expect(result.type).toBe('timeseries');
    expect(result.label).toBe('MRRVs per Month');
    expect(result.data).toEqual([
      { date: jan, value: 5 },
      { date: feb, value: 8 },
    ]);
  });

  it('timeseries/mirv maps $queryRaw rows', async () => {
    const mar = new Date('2025-03-01');
    mockPrisma.$queryRaw.mockResolvedValue([{ month: mar, count: 12 }]);
    const fn = getDataSource('timeseries/mirv')!;
    const result = await fn({});
    expect(result.type).toBe('timeseries');
    expect(result.label).toBe('MIRVs per Month');
    expect(result.data).toEqual([{ date: mar, value: 12 }]);
  });

  it('timeseries/jo maps $queryRaw rows', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const fn = getDataSource('timeseries/jo')!;
    const result = await fn({});
    expect(result.type).toBe('timeseries');
    expect(result.label).toBe('Job Orders per Month');
    expect(result.data).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Table Sources (type: 'table')
// ---------------------------------------------------------------------------
describe('widget-data.service — Table Sources', () => {
  let getDataSource: WidgetModule['getDataSource'];
  beforeEach(async () => {
    const mod = await freshModule();
    getDataSource = mod.getDataSource;
  });

  it('table/recent_mrrv returns rows with default limit 10', async () => {
    const rows = [{ id: '1', mrrvNumber: 'GRN-001', status: 'draft' }];
    mockPrisma.mrrv.findMany.mockResolvedValue(rows);
    const fn = getDataSource('table/recent_mrrv')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'table', data: rows, label: 'Recent MRRVs' });
    expect(mockPrisma.mrrv.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, orderBy: { createdAt: 'desc' } }),
    );
  });

  it('table/recent_mrrv respects config.limit', async () => {
    mockPrisma.mrrv.findMany.mockResolvedValue([]);
    const fn = getDataSource('table/recent_mrrv')!;
    await fn({ limit: 5 });
    expect(mockPrisma.mrrv.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5 }));
  });

  it('table/recent_mirv returns rows with select fields', async () => {
    const rows = [{ id: '2', mirvNumber: 'MI-001', status: 'issued' }];
    mockPrisma.mirv.findMany.mockResolvedValue(rows);
    const fn = getDataSource('table/recent_mirv')!;
    const result = await fn({});
    expect(result.type).toBe('table');
    expect(result.label).toBe('Recent MIRVs');
    expect(result.data).toEqual(rows);
  });

  it('table/recent_jo returns recent job orders', async () => {
    mockPrisma.jobOrder.findMany.mockResolvedValue([]);
    const fn = getDataSource('table/recent_jo')!;
    const result = await fn({ limit: 3 });
    expect(result.type).toBe('table');
    expect(result.label).toBe('Recent Job Orders');
    expect(mockPrisma.jobOrder.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  });

  it('table/recent_activity returns audit log rows', async () => {
    const rows = [{ id: 'a1', action: 'create', performedBy: { fullName: 'Ahmed', email: 'a@x.com' } }];
    mockPrisma.auditLog.findMany.mockResolvedValue(rows);
    const fn = getDataSource('table/recent_activity')!;
    const result = await fn({});
    expect(result.type).toBe('table');
    expect(result.label).toBe('Recent Activity');
    expect(result.data).toEqual(rows);
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, orderBy: { performedAt: 'desc' } }),
    );
  });

  it('table/recent_activity respects config.limit', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([]);
    const fn = getDataSource('table/recent_activity')!;
    await fn({ limit: 50 });
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });
});

// ---------------------------------------------------------------------------
// SLA Compliance (sla/compliance)
// ---------------------------------------------------------------------------
describe('widget-data.service — SLA Compliance', () => {
  let getDataSource: WidgetModule['getDataSource'];
  beforeEach(async () => {
    const mod = await freshModule();
    getDataSource = mod.getDataSource;
  });

  it('calculates SLA percentage from mirv + joSlaTracking counts', async () => {
    mockPrisma.mirv.count
      .mockResolvedValueOnce(20) // mirvTotal (slaDueDate not null)
      .mockResolvedValueOnce(15); // mirvOnTime (issued/completed + issuedDate not null)
    mockPrisma.joSlaTracking.count
      .mockResolvedValueOnce(10) // joTotal
      .mockResolvedValueOnce(8); // joOnTime (slaMet: true)

    const fn = getDataSource('sla/compliance')!;
    const result = await fn({});
    expect(result.type).toBe('number');
    expect(result.label).toBe('SLA Compliance');
    const data = result.data as {
      percentage: number;
      totalTracked: number;
      onTime: number;
      breached: number;
      asOf: string;
    };
    // (15 + 8) / (20 + 10) = 23/30 = 76.67 → round to 77
    expect(data.percentage).toBe(77);
    expect(data.totalTracked).toBe(30);
    expect(data.onTime).toBe(23);
    expect(data.breached).toBe(7);
    expect(data.asOf).toBeDefined();
  });

  it('returns 100% when no SLA-tracked items exist', async () => {
    mockPrisma.mirv.count.mockResolvedValue(0);
    mockPrisma.joSlaTracking.count.mockResolvedValue(0);

    const fn = getDataSource('sla/compliance')!;
    const result = await fn({});
    const data = result.data as { percentage: number; totalTracked: number };
    expect(data.percentage).toBe(100);
    expect(data.totalTracked).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Inventory Value (inventory/value)
// ---------------------------------------------------------------------------
describe('widget-data.service — Inventory Value', () => {
  let getDataSource: WidgetModule['getDataSource'];
  beforeEach(async () => {
    const mod = await freshModule();
    getDataSource = mod.getDataSource;
  });

  it('returns total inventory value from $queryRaw', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ total_value: 123456.78 }]);
    const fn = getDataSource('inventory/value')!;
    const result = await fn({});
    expect(result).toEqual({
      type: 'number',
      data: 123456.78,
      label: 'Total Inventory Value (SAR)',
    });
  });

  it('returns 0 when query returns null total_value', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ total_value: null }]);
    const fn = getDataSource('inventory/value')!;
    const result = await fn({});
    expect(result.data).toBe(0);
  });

  it('returns 0 when query returns empty array', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const fn = getDataSource('inventory/value')!;
    const result = await fn({});
    expect(result.data).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Cross-Department Sources
// ---------------------------------------------------------------------------
describe('widget-data.service — Cross-Department Sources', () => {
  let getDataSource: WidgetModule['getDataSource'];
  beforeEach(async () => {
    const mod = await freshModule();
    getDataSource = mod.getDataSource;
  });

  it('cross-department/inventory_by_warehouse maps raw results with item_count', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([
      { warehouse_name: 'WH-A', total_value: 50000, item_count: BigInt(25) },
      { warehouse_name: 'WH-B', total_value: 30000, item_count: BigInt(12) },
    ]);
    const fn = getDataSource('cross-department/inventory_by_warehouse')!;
    const result = await fn({});
    expect(result.type).toBe('grouped');
    expect(result.label).toBe('Inventory Value by Warehouse');
    expect(result.data).toEqual([
      { label: 'WH-A', value: 50000, itemCount: 25 },
      { label: 'WH-B', value: 30000, itemCount: 12 },
    ]);
  });

  it('cross-department/document_pipeline counts active docs in 5 models', async () => {
    mockPrisma.mrrv.count.mockResolvedValue(4);
    mockPrisma.mirv.count.mockResolvedValue(3);
    mockPrisma.mrv.count.mockResolvedValue(2);
    mockPrisma.jobOrder.count.mockResolvedValue(6);
    mockPrisma.materialRequisition.count.mockResolvedValue(1);

    const fn = getDataSource('cross-department/document_pipeline')!;
    const result = await fn({});
    expect(result.type).toBe('grouped');
    expect(result.label).toBe('Active Documents by Type');
    expect(result.data).toEqual([
      { label: 'GRN', value: 4 },
      { label: 'MI', value: 3 },
      { label: 'MRN', value: 2 },
      { label: 'JO', value: 6 },
      { label: 'MR', value: 1 },
    ]);
  });

  it('cross-department/pending_by_department sums nested parallel counts', async () => {
    // Warehouse: mrrv.count + mirv.count (pending_approval)
    mockPrisma.mrrv.count.mockResolvedValue(2);
    mockPrisma.mirv.count.mockResolvedValue(3);
    // Logistics: materialRequisition.count + shipment.count
    mockPrisma.materialRequisition.count.mockResolvedValue(4);
    mockPrisma.shipment.count.mockResolvedValue(1);
    // Transport: jobOrder.count (pending_approval)
    mockPrisma.jobOrder.count.mockResolvedValue(7);
    // Quality: rfim.count (pending)
    mockPrisma.rfim.count.mockResolvedValue(2);

    const fn = getDataSource('cross-department/pending_by_department')!;
    const result = await fn({});
    expect(result.type).toBe('grouped');
    expect(result.label).toBe('Pending Items by Department');
    expect(result.data).toEqual([
      { label: 'Warehouse', value: 5 },
      { label: 'Logistics', value: 5 },
      { label: 'Transport', value: 7 },
      { label: 'Quality', value: 2 },
    ]);
  });
});

// ---------------------------------------------------------------------------
// registerDynamicDataSources
// ---------------------------------------------------------------------------
describe('widget-data.service — registerDynamicDataSources', () => {
  it('registers 3 sources per active dynamic document type', async () => {
    const mod = await freshModule();

    mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([
      { id: 'dt1', code: 'WO', name: 'Work Order', statusFlow: ['draft', 'approved'] },
      { id: 'dt2', code: 'INV', name: 'Invoice', statusFlow: ['draft', 'sent'] },
    ]);

    await mod.registerDynamicDataSources();

    const keys = mod.listDataSources();
    // Type 1
    expect(keys).toContain('dyn/WO/stats');
    expect(keys).toContain('dyn/WO/by_status');
    expect(keys).toContain('dyn/WO/recent');
    // Type 2
    expect(keys).toContain('dyn/INV/stats');
    expect(keys).toContain('dyn/INV/by_status');
    expect(keys).toContain('dyn/INV/recent');
  });

  it('registers nothing when no active types exist', async () => {
    const mod = await freshModule();
    const keysBefore = mod.listDataSources().length;

    mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([]);
    await mod.registerDynamicDataSources();

    expect(mod.listDataSources().length).toBe(keysBefore);
  });

  it('dyn/CODE/stats counts documents for the type', async () => {
    const mod = await freshModule();

    mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([
      { id: 'dt1', code: 'WO', name: 'Work Order', statusFlow: [] },
    ]);
    await mod.registerDynamicDataSources();

    mockPrisma.dynamicDocument.count.mockResolvedValue(42);
    const fn = mod.getDataSource('dyn/WO/stats')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'number', data: 42, label: 'Work Order \u2014 Total' });
    expect(mockPrisma.dynamicDocument.count).toHaveBeenCalledWith({ where: { documentTypeId: 'dt1' } });
  });

  it('dyn/CODE/by_status groups documents by status', async () => {
    const mod = await freshModule();

    mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([
      { id: 'dt1', code: 'WO', name: 'Work Order', statusFlow: [] },
    ]);
    await mod.registerDynamicDataSources();

    mockPrisma.dynamicDocument.groupBy.mockResolvedValue([
      { status: 'draft', _count: { id: 5 } },
      { status: 'approved', _count: { id: 10 } },
    ]);
    const fn = mod.getDataSource('dyn/WO/by_status')!;
    const result = await fn({});
    expect(result.type).toBe('grouped');
    expect(result.label).toBe('Work Order by Status');
    expect(result.data).toEqual([
      { label: 'draft', value: 5 },
      { label: 'approved', value: 10 },
    ]);
    expect(mockPrisma.dynamicDocument.groupBy).toHaveBeenCalledWith({
      by: ['status'],
      where: { documentTypeId: 'dt1' },
      _count: { id: true },
    });
  });

  it('dyn/CODE/recent returns recent documents with default limit 10', async () => {
    const mod = await freshModule();

    mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([
      { id: 'dt1', code: 'WO', name: 'Work Order', statusFlow: [] },
    ]);
    await mod.registerDynamicDataSources();

    const rows = [{ id: 'd1', documentNumber: 'WO-001', status: 'draft' }];
    mockPrisma.dynamicDocument.findMany.mockResolvedValue(rows);
    const fn = mod.getDataSource('dyn/WO/recent')!;
    const result = await fn({});
    expect(result).toEqual({ type: 'table', data: rows, label: 'Recent Work Order' });
    expect(mockPrisma.dynamicDocument.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { documentTypeId: 'dt1' },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
    );
  });

  it('dyn/CODE/recent respects config.limit', async () => {
    const mod = await freshModule();

    mockPrisma.dynamicDocumentType.findMany.mockResolvedValue([
      { id: 'dt1', code: 'WO', name: 'Work Order', statusFlow: [] },
    ]);
    await mod.registerDynamicDataSources();

    mockPrisma.dynamicDocument.findMany.mockResolvedValue([]);
    const fn = mod.getDataSource('dyn/WO/recent')!;
    await fn({ limit: 3 });
    expect(mockPrisma.dynamicDocument.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  });
});
