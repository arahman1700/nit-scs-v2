/**
 * ABC Inventory Analysis Service
 *
 * Classifies items into A, B, C categories based on annual consumption value.
 * A = top items covering 80% of total value
 * B = next items covering 15% of total value
 * C = remaining items covering 5% of total value
 */

import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

export interface ABCResult {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  annualConsumptionValue: number;
  cumulativePercent: number;
  abcClass: 'A' | 'B' | 'C';
}

export interface ABCSummary {
  classA: { count: number; totalValue: number; percentOfItems: number; percentOfValue: number };
  classB: { count: number; totalValue: number; percentOfItems: number; percentOfValue: number };
  classC: { count: number; totalValue: number; percentOfItems: number; percentOfValue: number };
  totalItems: number;
  totalValue: number;
  lastCalculatedAt: Date | null;
}

/**
 * Calculate ABC classification based on annual consumption value.
 * Consumption = sum(MirvLine.qtyIssued * MirvLine.unitCost) for last 12 months per item.
 * Falls back to qtyRequested if qtyIssued is null.
 */
export async function calculateABCClassification(warehouseId?: string): Promise<ABCResult[]> {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  // Get annual consumption value per item from MIRV lines (issued materials)
  const consumption = warehouseId
    ? await prisma.$queryRaw<
        Array<{ item_id: string; item_code: string; item_description: string; annual_value: number }>
      >`
        SELECT
          i.id AS item_id,
          i.item_code,
          i.item_description,
          COALESCE(SUM(
            COALESCE(ml.qty_issued, ml.qty_requested)::float *
            COALESCE(ml.unit_cost, 0)::float
          ), 0) AS annual_value
        FROM items i
        LEFT JOIN mirv_lines ml ON ml.item_id = i.id
        LEFT JOIN mirv m ON m.id = ml.mirv_id
          AND m.request_date >= ${twelveMonthsAgo}
          AND m.status NOT IN ('draft', 'cancelled', 'rejected')
          AND m.warehouse_id = ${warehouseId}::uuid
        WHERE i.status = 'active'
        GROUP BY i.id, i.item_code, i.item_description
        HAVING COALESCE(SUM(
          COALESCE(ml.qty_issued, ml.qty_requested)::float *
          COALESCE(ml.unit_cost, 0)::float
        ), 0) > 0
        ORDER BY annual_value DESC
      `
    : await prisma.$queryRaw<
        Array<{ item_id: string; item_code: string; item_description: string; annual_value: number }>
      >`
        SELECT
          i.id AS item_id,
          i.item_code,
          i.item_description,
          COALESCE(SUM(
            COALESCE(ml.qty_issued, ml.qty_requested)::float *
            COALESCE(ml.unit_cost, 0)::float
          ), 0) AS annual_value
        FROM items i
        LEFT JOIN mirv_lines ml ON ml.item_id = i.id
        LEFT JOIN mirv m ON m.id = ml.mirv_id
          AND m.request_date >= ${twelveMonthsAgo}
          AND m.status NOT IN ('draft', 'cancelled', 'rejected')
        WHERE i.status = 'active'
        GROUP BY i.id, i.item_code, i.item_description
        HAVING COALESCE(SUM(
          COALESCE(ml.qty_issued, ml.qty_requested)::float *
          COALESCE(ml.unit_cost, 0)::float
        ), 0) > 0
        ORDER BY annual_value DESC
      `;

  if (consumption.length === 0) {
    return [];
  }

  const totalValue = consumption.reduce((sum, row) => sum + row.annual_value, 0);

  // Assign ABC classes based on cumulative percentage
  let cumulativeValue = 0;
  const results: ABCResult[] = consumption.map(row => {
    cumulativeValue += row.annual_value;
    const cumulativePercent = (cumulativeValue / totalValue) * 100;

    let abcClass: 'A' | 'B' | 'C';
    if (cumulativePercent <= 80) {
      abcClass = 'A';
    } else if (cumulativePercent <= 95) {
      abcClass = 'B';
    } else {
      abcClass = 'C';
    }

    return {
      itemId: row.item_id,
      itemCode: row.item_code,
      itemDescription: row.item_description,
      annualConsumptionValue: row.annual_value,
      cumulativePercent: Math.round(cumulativePercent * 100) / 100,
      abcClass,
    };
  });

  return results;
}

/**
 * Persist ABC classification results to the Item table.
 */
export async function applyABCClassification(results: ABCResult[]): Promise<void> {
  const now = new Date();

  // Batch update in a transaction
  await prisma.$transaction(
    results.map(r =>
      prisma.item.update({
        where: { id: r.itemId },
        data: {
          abcClass: r.abcClass,
          abcUpdatedAt: now,
        },
      }),
    ),
  );

  log('info', `[ABC Analysis] Updated ${results.length} item classifications`);
}

/**
 * Get ABC summary statistics.
 */
export async function getABCSummary(warehouseId?: string): Promise<ABCSummary> {
  // Get the most recent abcUpdatedAt
  const lastUpdated = await prisma.item.findFirst({
    where: { abcUpdatedAt: { not: null } },
    orderBy: { abcUpdatedAt: 'desc' },
    select: { abcUpdatedAt: true },
  });

  // Count items per class
  const classAItems = await prisma.item.count({ where: { abcClass: 'A', status: 'active' } });
  const classBItems = await prisma.item.count({ where: { abcClass: 'B', status: 'active' } });
  const classCItems = await prisma.item.count({ where: { abcClass: 'C', status: 'active' } });
  const totalItems = classAItems + classBItems + classCItems;

  // Get value per class from the live calculation
  const results = await calculateABCClassification(warehouseId);

  const classAValue = results.filter(r => r.abcClass === 'A').reduce((s, r) => s + r.annualConsumptionValue, 0);
  const classBValue = results.filter(r => r.abcClass === 'B').reduce((s, r) => s + r.annualConsumptionValue, 0);
  const classCValue = results.filter(r => r.abcClass === 'C').reduce((s, r) => s + r.annualConsumptionValue, 0);
  const totalValue = classAValue + classBValue + classCValue;

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 10000) / 100 : 0);

  return {
    classA: {
      count: classAItems,
      totalValue: classAValue,
      percentOfItems: pct(classAItems, totalItems),
      percentOfValue: pct(classAValue, totalValue),
    },
    classB: {
      count: classBItems,
      totalValue: classBValue,
      percentOfItems: pct(classBItems, totalItems),
      percentOfValue: pct(classBValue, totalValue),
    },
    classC: {
      count: classCItems,
      totalValue: classCValue,
      percentOfItems: pct(classCItems, totalItems),
      percentOfValue: pct(classCValue, totalValue),
    },
    totalItems,
    totalValue,
    lastCalculatedAt: lastUpdated?.abcUpdatedAt ?? null,
  };
}

/**
 * Get paginated list of items with their ABC classification.
 */
export async function getABCItems(params: {
  page?: number;
  pageSize?: number;
  abcClass?: string;
  search?: string;
}): Promise<{ items: ABCResult[]; total: number }> {
  const { page = 1, pageSize = 25, abcClass, search } = params;

  // Build where clause
  const where: Record<string, unknown> = { status: 'active' };
  if (abcClass && ['A', 'B', 'C'].includes(abcClass)) {
    where.abcClass = abcClass;
  }
  if (search) {
    where.OR = [
      { itemCode: { contains: search, mode: 'insensitive' } },
      { itemDescription: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.item.findMany({
      where,
      select: {
        id: true,
        itemCode: true,
        itemDescription: true,
        abcClass: true,
        abcUpdatedAt: true,
      },
      orderBy: { itemCode: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.item.count({ where }),
  ]);

  // Enrich with consumption values from a fresh calculation
  const allResults = await calculateABCClassification();
  const resultMap = new Map(allResults.map(r => [r.itemId, r]));

  const enriched: ABCResult[] = items.map(item => {
    const result = resultMap.get(item.id);
    return {
      itemId: item.id,
      itemCode: item.itemCode,
      itemDescription: item.itemDescription,
      annualConsumptionValue: result?.annualConsumptionValue ?? 0,
      cumulativePercent: result?.cumulativePercent ?? 0,
      abcClass: (item.abcClass as 'A' | 'B' | 'C') ?? 'C',
    };
  });

  return { items: enriched, total };
}
