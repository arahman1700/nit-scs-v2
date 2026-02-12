import { prisma } from '../utils/prisma.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface QueryConfig {
  filters?: Record<string, unknown>;
  dateRange?: { start: string; end: string };
  groupBy?: string;
  limit?: number;
}

export interface DataSourceResult {
  type: 'number' | 'grouped' | 'timeseries' | 'table';
  data: unknown;
  label?: string;
}

type DataSourceFn = (config: QueryConfig) => Promise<DataSourceResult>;

// ── Registry ───────────────────────────────────────────────────────────

const dataSources = new Map<string, DataSourceFn>();

function register(key: string, fn: DataSourceFn) {
  dataSources.set(key, fn);
}

// ── Stats (type: 'number') ─────────────────────────────────────────────

register('stats/projects', async () => {
  const count = await prisma.project.count({ where: { status: 'active' } });
  return { type: 'number', data: count, label: 'Active Projects' };
});

register('stats/items', async () => {
  const count = await prisma.item.count({ where: { status: 'active' } });
  return { type: 'number', data: count, label: 'Items' };
});

register('stats/warehouses', async () => {
  const count = await prisma.warehouse.count({ where: { status: 'active' } });
  return { type: 'number', data: count, label: 'Warehouses' };
});

register('stats/pending_approvals', async () => {
  const [mirvCount, joCount, mrrvCount] = await Promise.all([
    prisma.mirv.count({ where: { status: 'pending_approval' } }),
    prisma.jobOrder.count({ where: { status: 'pending_approval' } }),
    prisma.mrrv.count({ where: { status: 'pending_approval' } }),
  ]);
  return { type: 'number', data: mirvCount + joCount + mrrvCount, label: 'Pending Approvals' };
});

register('stats/low_stock', async () => {
  const result = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM inventory_levels
    WHERE qty_on_hand <= COALESCE(reorder_point, 0)
      AND reorder_point IS NOT NULL
      AND reorder_point > 0
  `;
  return { type: 'number', data: Number(result[0]?.count ?? 0), label: 'Low Stock Items' };
});

register('stats/open_jobs', async () => {
  const count = await prisma.jobOrder.count({
    where: { status: { notIn: ['completed', 'invoiced', 'cancelled', 'rejected'] } },
  });
  return { type: 'number', data: count, label: 'Open Job Orders' };
});

register('stats/active_shipments', async () => {
  const count = await prisma.shipment.count({
    where: { status: { in: ['in_transit', 'at_port', 'customs_clearing', 'in_delivery'] } },
  });
  return { type: 'number', data: count, label: 'Active Shipments' };
});

// ── Grouped (type: 'grouped') ──────────────────────────────────────────

register('grouped/mrrv_by_status', async () => {
  const result = await prisma.mrrv.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  return {
    type: 'grouped',
    data: result.map(r => ({ label: r.status, value: r._count.id })),
  };
});

register('grouped/mirv_by_status', async () => {
  const result = await prisma.mirv.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  return {
    type: 'grouped',
    data: result.map(r => ({ label: r.status, value: r._count.id })),
  };
});

register('grouped/jo_by_type', async () => {
  const result = await prisma.jobOrder.groupBy({
    by: ['joType'],
    _count: { id: true },
  });
  return {
    type: 'grouped',
    data: result.map(r => ({ label: r.joType, value: r._count.id })),
  };
});

register('grouped/jo_by_status', async () => {
  const result = await prisma.jobOrder.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  return {
    type: 'grouped',
    data: result.map(r => ({ label: r.status, value: r._count.id })),
  };
});

register('grouped/inventory_by_warehouse', async () => {
  const result = await prisma.$queryRaw<{ warehouse_name: string; total_qty: number }[]>`
    SELECT w.warehouse_name, COALESCE(SUM(il.qty_on_hand), 0)::float as total_qty
    FROM warehouses w
    LEFT JOIN inventory_levels il ON il.warehouse_id = w.id
    WHERE w.status = 'active'
    GROUP BY w.id, w.warehouse_name
    ORDER BY total_qty DESC
  `;
  return {
    type: 'grouped',
    data: result.map(r => ({ label: r.warehouse_name, value: r.total_qty })),
  };
});

// ── Timeseries (type: 'timeseries') ────────────────────────────────────

register('timeseries/mrrv', async () => {
  const rows = await prisma.$queryRaw<{ month: Date; count: number }[]>`
    SELECT date_trunc('month', created_at) as month, count(*)::int as count
    FROM mrrv
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY month ORDER BY month
  `;
  return {
    type: 'timeseries',
    data: rows.map(r => ({ date: r.month, value: r.count })),
    label: 'MRRVs per Month',
  };
});

register('timeseries/mirv', async () => {
  const rows = await prisma.$queryRaw<{ month: Date; count: number }[]>`
    SELECT date_trunc('month', created_at) as month, count(*)::int as count
    FROM mirv
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY month ORDER BY month
  `;
  return {
    type: 'timeseries',
    data: rows.map(r => ({ date: r.month, value: r.count })),
    label: 'MIRVs per Month',
  };
});

register('timeseries/jo', async () => {
  const rows = await prisma.$queryRaw<{ month: Date; count: number }[]>`
    SELECT date_trunc('month', created_at) as month, count(*)::int as count
    FROM job_orders
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY month ORDER BY month
  `;
  return {
    type: 'timeseries',
    data: rows.map(r => ({ date: r.month, value: r.count })),
    label: 'Job Orders per Month',
  };
});

// ── Table (type: 'table') ──────────────────────────────────────────────

register('table/recent_mrrv', async config => {
  const limit = config.limit ?? 10;
  const rows = await prisma.mrrv.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      mrrvNumber: true,
      status: true,
      receiveDate: true,
      createdAt: true,
      project: { select: { projectCode: true, projectName: true } },
      supplier: { select: { supplierName: true } },
    },
  });
  return { type: 'table', data: rows, label: 'Recent MRRVs' };
});

register('table/recent_mirv', async config => {
  const limit = config.limit ?? 10;
  const rows = await prisma.mirv.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      mirvNumber: true,
      status: true,
      requestDate: true,
      createdAt: true,
      project: { select: { projectCode: true, projectName: true } },
      requestedBy: { select: { fullName: true } },
    },
  });
  return { type: 'table', data: rows, label: 'Recent MIRVs' };
});

register('table/recent_jo', async config => {
  const limit = config.limit ?? 10;
  const rows = await prisma.jobOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      joNumber: true,
      joType: true,
      status: true,
      priority: true,
      requestDate: true,
      project: { select: { projectCode: true, projectName: true } },
      requestedBy: { select: { fullName: true } },
    },
  });
  return { type: 'table', data: rows, label: 'Recent Job Orders' };
});

register('table/recent_activity', async config => {
  const limit = config.limit ?? 20;
  const rows = await prisma.auditLog.findMany({
    orderBy: { performedAt: 'desc' },
    take: limit,
    include: {
      performedBy: { select: { fullName: true, email: true } },
    },
  });
  return { type: 'table', data: rows, label: 'Recent Activity' };
});

// ── SLA Compliance ─────────────────────────────────────────────────────

register('sla/compliance', async () => {
  const now = new Date();

  const [mirvTotal, mirvOnTime, joTotal, joOnTime] = await Promise.all([
    prisma.mirv.count({ where: { slaDueDate: { not: null } } }),
    prisma.mirv.count({
      where: {
        slaDueDate: { not: null },
        status: { in: ['issued', 'completed'] },
        issuedDate: { not: null },
      },
    }),
    prisma.joSlaTracking.count({ where: { slaDueDate: { not: null } } }),
    prisma.joSlaTracking.count({ where: { slaMet: true } }),
  ]);

  const totalTracked = mirvTotal + joTotal;
  const totalOnTime = mirvOnTime + joOnTime;
  const percentage = totalTracked > 0 ? Math.round((totalOnTime / totalTracked) * 100) : 100;

  return {
    type: 'number',
    data: {
      percentage,
      totalTracked,
      onTime: totalOnTime,
      breached: totalTracked - totalOnTime,
      asOf: now.toISOString(),
    },
    label: 'SLA Compliance',
  };
});

// ── Inventory Value ────────────────────────────────────────────────────

register('inventory/value', async () => {
  const result = await prisma.$queryRaw<{ total_value: number }[]>`
    SELECT COALESCE(SUM(available_qty * unit_cost), 0)::float as total_value
    FROM inventory_lots
    WHERE status = 'active'
  `;
  return {
    type: 'number',
    data: result[0]?.total_value ?? 0,
    label: 'Total Inventory Value (SAR)',
  };
});

// ── Cross-Department ──────────────────────────────────────────────────

register('cross-department/inventory_by_warehouse', async () => {
  const result = await prisma.$queryRaw<{ warehouse_name: string; total_value: number; item_count: bigint }[]>`
    SELECT
      w.warehouse_name,
      COALESCE(SUM(lot.available_qty * lot.unit_cost), 0)::float as total_value,
      COUNT(DISTINCT il.item_id)::bigint as item_count
    FROM warehouses w
    LEFT JOIN inventory_levels il ON il.warehouse_id = w.id
    LEFT JOIN inventory_lots lot ON lot.warehouse_id = w.id AND lot.status = 'active'
    WHERE w.status = 'active'
    GROUP BY w.id, w.warehouse_name
    ORDER BY total_value DESC
  `;
  return {
    type: 'grouped',
    data: result.map(r => ({ label: r.warehouse_name, value: r.total_value, itemCount: Number(r.item_count) })),
    label: 'Inventory Value by Warehouse',
  };
});

register('cross-department/document_pipeline', async () => {
  const [grn, mi, mrn, jo, mr] = await Promise.all([
    prisma.mrrv.count({ where: { status: { notIn: ['completed', 'cancelled', 'rejected'] } } }),
    prisma.mirv.count({ where: { status: { notIn: ['completed', 'cancelled', 'rejected', 'issued'] } } }),
    prisma.mrv.count({ where: { status: { notIn: ['completed', 'cancelled'] } } }),
    prisma.jobOrder.count({ where: { status: { notIn: ['completed', 'invoiced', 'cancelled', 'rejected'] } } }),
    prisma.materialRequisition.count({ where: { status: { notIn: ['completed', 'cancelled', 'rejected'] } } }),
  ]);
  return {
    type: 'grouped',
    data: [
      { label: 'GRN', value: grn },
      { label: 'MI', value: mi },
      { label: 'MRN', value: mrn },
      { label: 'JO', value: jo },
      { label: 'MR', value: mr },
    ],
    label: 'Active Documents by Type',
  };
});

register('cross-department/pending_by_department', async () => {
  const [warehouse, logistics, transport, quality] = await Promise.all([
    Promise.all([
      prisma.mrrv.count({ where: { status: 'pending_approval' } }),
      prisma.mirv.count({ where: { status: 'pending_approval' } }),
    ]).then(([a, b]) => a + b),
    Promise.all([
      prisma.materialRequisition.count({ where: { status: { in: ['submitted', 'pending_approval'] } } }),
      prisma.shipment.count({ where: { status: { in: ['pending', 'at_port'] } } }),
    ]).then(([a, b]) => a + b),
    prisma.jobOrder.count({ where: { status: 'pending_approval' } }),
    prisma.rfim.count({ where: { status: 'pending' } }),
  ]);
  return {
    type: 'grouped',
    data: [
      { label: 'Warehouse', value: warehouse },
      { label: 'Logistics', value: logistics },
      { label: 'Transport', value: transport },
      { label: 'Quality', value: quality },
    ],
    label: 'Pending Items by Department',
  };
});

// ── Public API ─────────────────────────────────────────────────────────

export function getDataSource(key: string): DataSourceFn | undefined {
  return dataSources.get(key);
}

export function listDataSources(): string[] {
  return Array.from(dataSources.keys());
}
