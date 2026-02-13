/**
 * Semantic Analytics Layer Service
 *
 * Provides a business-friendly query interface over the supply chain data model.
 * Users pick measures (what to calculate) and dimensions (how to slice),
 * and the service translates that into Prisma queries.
 */
import { prisma } from '../utils/prisma.js';

// ── Entity → Prisma Model Map (shared with custom-data-source.service) ──

const ENTITY_MODEL_MAP: Record<string, string> = {
  mrrv: 'mrrv',
  mirv: 'mirv',
  mrv: 'mrv',
  rfim: 'rfim',
  osd: 'osdReport',
  jo: 'jobOrder',
  gate_pass: 'gatePass',
  stock_transfer: 'stockTransfer',
  mrf: 'materialRequisition',
  shipment: 'shipment',
  imsf: 'imsf',
  scrap_item: 'scrapItem',
  surplus: 'surplusDeclaration',
  rental_contract: 'rentalContract',
  tool_issue: 'toolIssue',
  generator_fuel: 'generatorFuelLog',
  generator_maintenance: 'generatorMaintenance',
  storekeeper_handover: 'storekeeperHandover',
  inventory_level: 'inventoryLevel',
  inventory_lot: 'inventoryLot',
  project: 'project',
  warehouse: 'warehouse',
  employee: 'employee',
  item: 'item',
  supplier: 'supplier',
};

// ── Types ──────────────────────────────────────────────────────────────

export interface SemanticQueryParams {
  measure: string;
  dimensions?: string[];
  filters?: Array<{ field: string; op: string; value: unknown }>;
  dateRange?: { start: string; end: string };
}

interface PrismaDelegate {
  count: (args?: unknown) => Promise<number>;
  groupBy: (args: unknown) => Promise<unknown[]>;
  findMany: (args: unknown) => Promise<unknown[]>;
  aggregate: (args: unknown) => Promise<unknown>;
}

// ── Measure CRUD ──────────────────────────────────────────────────────

export async function listMeasures(category?: string) {
  return prisma.semanticMeasure.findMany({
    where: {
      isActive: true,
      ...(category ? { category } : {}),
    },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
}

export async function listDimensions(entityType?: string) {
  if (!entityType) {
    return prisma.semanticDimension.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  // Filter dimensions whose entityTypes JSON array contains the given entityType
  const all = await prisma.semanticDimension.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  });

  return all.filter(d => {
    const types = d.entityTypes as string[];
    return Array.isArray(types) && (types.includes(entityType) || types.includes('*'));
  });
}

export async function getMeasureCatalog() {
  const measures = await prisma.semanticMeasure.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  const catalog: Record<string, typeof measures> = {};
  for (const m of measures) {
    if (!catalog[m.category]) catalog[m.category] = [];
    catalog[m.category].push(m);
  }
  return catalog;
}

export async function getCompatibleDimensions(measureKey: string) {
  const measure = await prisma.semanticMeasure.findUnique({ where: { key: measureKey } });
  if (!measure) throw new Error(`Measure not found: ${measureKey}`);

  return listDimensions(measure.entityType);
}

// ── Query Execution ──────────────────────────────────────────────────

function buildFilterWhere(
  filters?: Array<{ field: string; op: string; value: unknown }>,
  dateRange?: { start: string; end: string },
  defaultFilters?: unknown,
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  // Apply default filters from measure definition
  if (defaultFilters && typeof defaultFilters === 'object' && !Array.isArray(defaultFilters)) {
    Object.assign(where, defaultFilters);
  } else if (Array.isArray(defaultFilters)) {
    for (const f of defaultFilters as Array<{ field: string; op: string; value: unknown }>) {
      applyFilter(where, f);
    }
  }

  // Apply user-provided filters
  if (filters) {
    for (const f of filters) {
      applyFilter(where, f);
    }
  }

  // Apply date range on createdAt
  if (dateRange) {
    where.createdAt = {
      ...((where.createdAt as Record<string, unknown>) || {}),
      gte: new Date(dateRange.start),
      lte: new Date(dateRange.end),
    };
  }

  return where;
}

function applyFilter(where: Record<string, unknown>, f: { field: string; op: string; value: unknown }) {
  switch (f.op) {
    case 'eq':
      where[f.field] = f.value;
      break;
    case 'ne':
      where[f.field] = { not: f.value };
      break;
    case 'gt':
      where[f.field] = { gt: f.value };
      break;
    case 'gte':
      where[f.field] = { gte: f.value };
      break;
    case 'lt':
      where[f.field] = { lt: f.value };
      break;
    case 'lte':
      where[f.field] = { lte: f.value };
      break;
    case 'in':
      where[f.field] = { in: f.value };
      break;
    case 'contains':
      where[f.field] = { contains: f.value, mode: 'insensitive' };
      break;
  }
}

export async function executeSemanticQuery(params: SemanticQueryParams) {
  const { measure: measureKey, dimensions: dimensionKeys, filters, dateRange } = params;

  // 1. Look up measure
  const measure = await prisma.semanticMeasure.findUnique({ where: { key: measureKey } });
  if (!measure) throw new Error(`Measure not found: ${measureKey}`);

  const modelName = ENTITY_MODEL_MAP[measure.entityType];
  if (!modelName) {
    throw new Error(
      `Unknown entity type: ${measure.entityType}. Available: ${Object.keys(ENTITY_MODEL_MAP).join(', ')}`,
    );
  }

  const delegate = (prisma as unknown as Record<string, unknown>)[modelName] as PrismaDelegate;

  // 2. Look up dimensions
  let dimensionFields: Array<{ key: string; field: string }> = [];
  if (dimensionKeys && dimensionKeys.length > 0) {
    const dims = await prisma.semanticDimension.findMany({
      where: { key: { in: dimensionKeys }, isActive: true },
    });
    dimensionFields = dims.map(d => ({ key: d.key, field: d.field }));
  }

  // 3. Build where clause
  const where = buildFilterWhere(filters, dateRange, measure.defaultFilters);

  // 4. Execute query
  if (dimensionFields.length > 0) {
    // GroupBy query
    const groupByFields = dimensionFields.map(d => d.field);

    if (measure.aggregation === 'count') {
      const result = await delegate.groupBy({
        by: groupByFields,
        where,
        _count: { id: true },
        orderBy: groupByFields.reduce((acc, f) => ({ ...acc, [f]: 'asc' }), {}),
      });

      return {
        measure: { key: measure.key, name: measure.name, aggregation: measure.aggregation },
        dimensions: dimensionFields,
        data: (result as Array<Record<string, unknown>>).map(r => ({
          ...groupByFields.reduce((acc, f) => ({ ...acc, [f]: r[f] }), {}),
          value: (r._count as Record<string, number>).id,
        })),
      };
    }

    if (measure.aggregation === 'sum' || measure.aggregation === 'avg') {
      const aggField = measure.field || 'id';
      const result = await delegate.groupBy({
        by: groupByFields,
        where,
        ...(measure.aggregation === 'sum' ? { _sum: { [aggField]: true } } : {}),
        ...(measure.aggregation === 'avg' ? { _avg: { [aggField]: true } } : {}),
        orderBy: groupByFields.reduce((acc, f) => ({ ...acc, [f]: 'asc' }), {}),
      });

      return {
        measure: { key: measure.key, name: measure.name, aggregation: measure.aggregation },
        dimensions: dimensionFields,
        data: (result as Array<Record<string, unknown>>).map(r => {
          const agg =
            measure.aggregation === 'sum'
              ? (r._sum as Record<string, unknown>)?.[aggField]
              : (r._avg as Record<string, unknown>)?.[aggField];
          return {
            ...groupByFields.reduce((acc, f) => ({ ...acc, [f]: r[f] }), {}),
            value: agg ?? 0,
          };
        }),
      };
    }
  }

  // No dimensions — return aggregate scalar
  switch (measure.aggregation) {
    case 'count': {
      const count = await delegate.count({ where });
      return {
        measure: { key: measure.key, name: measure.name, aggregation: measure.aggregation },
        dimensions: [],
        data: count,
      };
    }

    case 'sum':
    case 'avg': {
      const aggField = measure.field || 'id';
      const result = await delegate.aggregate({
        where,
        ...(measure.aggregation === 'sum' ? { _sum: { [aggField]: true } } : {}),
        ...(measure.aggregation === 'avg' ? { _avg: { [aggField]: true } } : {}),
      });
      const aggregated =
        measure.aggregation === 'sum'
          ? (result as Record<string, unknown>)._sum
          : (result as Record<string, unknown>)._avg;
      return {
        measure: { key: measure.key, name: measure.name, aggregation: measure.aggregation },
        dimensions: [],
        data: (aggregated as Record<string, unknown>)?.[aggField] ?? 0,
      };
    }

    default:
      throw new Error(`Unsupported aggregation: ${measure.aggregation}`);
  }
}
