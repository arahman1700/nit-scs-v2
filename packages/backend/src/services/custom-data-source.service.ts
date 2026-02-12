/**
 * Custom Data Source Service
 *
 * Allows users to create KPI data sources without code.
 * Each source defines an entity type + aggregation + filters
 * and gets registered in the widget-data registry at startup.
 */
import { prisma } from '../utils/prisma.js';
import { Prisma } from '@prisma/client';
import { log } from '../config/logger.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface QueryTemplate {
  entityType: string;
  filters?: Array<{ field: string; op: string; value: unknown }>;
  groupBy?: string;
  dateField?: string;
  dateRange?: 'last_7d' | 'last_30d' | 'last_90d' | 'this_month' | 'this_year' | 'custom';
}

export type AggregationType = 'count' | 'sum' | 'avg' | 'group_by' | 'timeseries';
export type OutputType = 'number' | 'grouped' | 'timeseries' | 'table';

// Map entity types to Prisma model names
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

// ── CRUD ──────────────────────────────────────────────────────────────

export async function listCustomDataSources(userId?: string) {
  return prisma.customDataSource.findMany({
    where: userId ? { OR: [{ isPublic: true }, { createdById: userId }] } : undefined,
    orderBy: { name: 'asc' },
  });
}

export async function getCustomDataSource(id: string) {
  return prisma.customDataSource.findUniqueOrThrow({ where: { id } });
}

export async function createCustomDataSource(data: {
  name: string;
  sourceKey: string;
  entityType: string;
  aggregation: AggregationType;
  queryTemplate: QueryTemplate;
  outputType: OutputType;
  isPublic?: boolean;
  createdById: string;
}) {
  return prisma.customDataSource.create({
    data: {
      name: data.name,
      sourceKey: data.sourceKey,
      entityType: data.entityType,
      aggregation: data.aggregation,
      queryTemplate: data.queryTemplate as unknown as Prisma.InputJsonValue,
      outputType: data.outputType,
      isPublic: data.isPublic ?? false,
      createdById: data.createdById,
    },
  });
}

export async function updateCustomDataSource(
  id: string,
  data: {
    name?: string;
    entityType?: string;
    aggregation?: string;
    queryTemplate?: QueryTemplate;
    outputType?: string;
    isPublic?: boolean;
  },
) {
  return prisma.customDataSource.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.entityType !== undefined && { entityType: data.entityType }),
      ...(data.aggregation !== undefined && { aggregation: data.aggregation }),
      ...(data.queryTemplate !== undefined && {
        queryTemplate: data.queryTemplate as unknown as Prisma.InputJsonValue,
      }),
      ...(data.outputType !== undefined && { outputType: data.outputType }),
      ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
    },
  });
}

export async function deleteCustomDataSource(id: string) {
  return prisma.customDataSource.delete({ where: { id } });
}

// ── Query Execution ──────────────────────────────────────────────────

function buildDateFilter(dateField: string, dateRange: string): Record<string, unknown> {
  const now = new Date();
  let start: Date;

  switch (dateRange) {
    case 'last_7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'last_30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case 'last_90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'this_month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'this_year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      return {};
  }

  return { [dateField]: { gte: start } };
}

function buildWhereClause(template: QueryTemplate): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  // Apply field filters
  if (template.filters) {
    for (const filter of template.filters) {
      switch (filter.op) {
        case 'eq':
          where[filter.field] = filter.value;
          break;
        case 'ne':
          where[filter.field] = { not: filter.value };
          break;
        case 'gt':
          where[filter.field] = { gt: filter.value };
          break;
        case 'gte':
          where[filter.field] = { gte: filter.value };
          break;
        case 'lt':
          where[filter.field] = { lt: filter.value };
          break;
        case 'lte':
          where[filter.field] = { lte: filter.value };
          break;
        case 'in':
          where[filter.field] = { in: filter.value };
          break;
        case 'contains':
          where[filter.field] = { contains: filter.value, mode: 'insensitive' };
          break;
      }
    }
  }

  // Apply date range
  if (template.dateField && template.dateRange) {
    Object.assign(where, buildDateFilter(template.dateField, template.dateRange));
  }

  return where;
}

/**
 * Execute a custom data source query and return the result.
 * Used for preview/test and for runtime widget data.
 */
export async function executeCustomDataSource(source: {
  entityType: string;
  aggregation: string;
  queryTemplate: unknown;
  outputType: string;
  name: string;
}): Promise<{ type: string; data: unknown; label: string }> {
  const template = source.queryTemplate as QueryTemplate;
  const modelName = ENTITY_MODEL_MAP[source.entityType];

  if (!modelName) {
    throw new Error(
      `Unknown entity type: ${source.entityType}. Available: ${Object.keys(ENTITY_MODEL_MAP).join(', ')}`,
    );
  }

  const delegate = (prisma as unknown as Record<string, unknown>)[modelName] as {
    count: (args?: unknown) => Promise<number>;
    groupBy: (args: unknown) => Promise<unknown[]>;
    findMany: (args: unknown) => Promise<unknown[]>;
    aggregate: (args: unknown) => Promise<unknown>;
  };

  const where = buildWhereClause(template);

  switch (source.aggregation) {
    case 'count': {
      const count = await delegate.count({ where });
      return { type: 'number', data: count, label: source.name };
    }

    case 'sum':
    case 'avg': {
      const field = template.groupBy || 'id';
      const result = await delegate.aggregate({
        where,
        _sum: source.aggregation === 'sum' ? { [field]: true } : undefined,
        _avg: source.aggregation === 'avg' ? { [field]: true } : undefined,
      });
      const aggregated =
        source.aggregation === 'sum'
          ? (result as Record<string, unknown>)._sum
          : (result as Record<string, unknown>)._avg;
      return {
        type: 'number',
        data: (aggregated as Record<string, unknown>)?.[field] ?? 0,
        label: source.name,
      };
    }

    case 'group_by': {
      const groupField = template.groupBy || 'status';
      const result = await delegate.groupBy({
        by: [groupField],
        where,
        _count: { id: true },
      });
      return {
        type: 'grouped',
        data: (result as Array<Record<string, unknown>>).map(r => ({
          label: String(r[groupField]),
          value: (r._count as Record<string, number>).id,
        })),
        label: source.name,
      };
    }

    case 'timeseries': {
      const dateField = template.dateField || 'createdAt';
      const result = await delegate.findMany({
        where,
        orderBy: { [dateField]: 'asc' },
        take: 365,
        select: { [dateField]: true, id: true },
      });
      // Group by day
      const byDay = new Map<string, number>();
      for (const row of result as Array<Record<string, unknown>>) {
        const date = new Date(row[dateField] as string);
        const key = date.toISOString().slice(0, 10);
        byDay.set(key, (byDay.get(key) ?? 0) + 1);
      }
      return {
        type: 'timeseries',
        data: Array.from(byDay.entries()).map(([date, count]) => ({ date, value: count })),
        label: source.name,
      };
    }

    default:
      throw new Error(`Unknown aggregation: ${source.aggregation}`);
  }
}

// ── Registry Integration ─────────────────────────────────────────────

/**
 * Load all custom data sources from DB and register them
 * in the widget data source registry.
 */
export async function loadCustomDataSources(
  registerFn: (key: string, fn: (config: unknown) => Promise<unknown>) => void,
): Promise<void> {
  const sources = await prisma.customDataSource.findMany();

  for (const source of sources) {
    registerFn(`custom/${source.sourceKey}`, async () => {
      try {
        return await executeCustomDataSource(source);
      } catch (err) {
        log('error', `[CustomDataSource] Failed to execute '${source.sourceKey}': ${err}`);
        return { type: 'number', data: 0, label: `${source.name} (error)` };
      }
    });
  }

  if (sources.length > 0) {
    log('info', `[CustomDataSource] Registered ${sources.length} custom data source(s)`);
  }
}
