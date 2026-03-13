/**
 * Oracle PO Sync Service — Read-only mirror of Purchase Orders from Oracle WMS.
 *
 * Fetches PO data from Oracle REST API and upserts into RCV_PO_MIRROR_HEADERS /
 * RCV_PO_MIRROR_LINES. Validation helpers allow GRN creation to do soft checks
 * against PO lines (warnings only — never blocking).
 */

import type { PurchaseOrderLineMirror } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';

// ── Types ──────────────────────────────────────────────────────────────────

interface OraclePoConfig {
  baseUrl: string;
  apiKey: string;
}

interface OraclePoLine {
  lineNumber: number;
  itemCode: string;
  description?: string;
  orderedQty: number;
  receivedQty: number;
  unitPrice?: number;
  uom: string;
}

interface OraclePo {
  poNumber: string;
  supplierCode: string;
  supplierName: string;
  orderDate: string; // ISO date string
  expectedDate?: string;
  status: string;
  totalAmount?: number;
  currency?: string;
  lines: OraclePoLine[];
}

interface OraclePoApiResponse {
  items: OraclePo[];
  hasMore: boolean;
  offset: number;
  limit: number;
  count: number;
}

export interface GrnItemForValidation {
  itemCode: string;
  qtyReceived: number;
}

export interface PoValidationWarning {
  itemCode: string;
  lineNumber: number;
  orderedQty: number;
  receivedQty: number;
  newReceiptQty: number;
  projectedTotal: number;
  message: string;
}

export interface PoValidationResult {
  poFound: boolean;
  warnings: PoValidationWarning[];
}

// ── Config Helper ──────────────────────────────────────────────────────────

function getConfig(): OraclePoConfig | null {
  const baseUrl = process.env['ORACLE_PO_BASE_URL'];
  const apiKey = process.env['ORACLE_PO_API_KEY'];

  if (!baseUrl || !apiKey) {
    return null;
  }

  return { baseUrl, apiKey };
}

// ── Sync Service ───────────────────────────────────────────────────────────

/**
 * Fetches all open/partial POs from the Oracle REST API and upserts them
 * into the local mirror tables. Safe to call repeatedly (idempotent upsert).
 *
 * Returns a summary of the sync operation.
 */
export async function syncPurchaseOrders(): Promise<{ synced: number; failed: number; skipped: number }> {
  const config = getConfig();

  if (!config) {
    // Oracle PO integration not configured — silently skip
    return { synced: 0, failed: 0, skipped: 1 };
  }

  const summary = { synced: 0, failed: 0, skipped: 0 };
  let offset = 0;
  const limit = 100;
  let hasMore = true;

  while (hasMore) {
    let pos: OraclePo[];

    try {
      const url = `${config.baseUrl}/po/purchaseOrders?status=OPEN,PARTIALLY_RECEIVED&offset=${offset}&limit=${limit}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        throw new Error(`Oracle API responded with HTTP ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as OraclePoApiResponse;
      pos = data.items ?? [];
      hasMore = data.hasMore ?? false;
      offset += limit;
    } catch (err) {
      console.error('[OraclePoSync] Fetch failed:', (err as Error).message);
      summary.failed++;
      break;
    }

    for (const po of pos) {
      try {
        await upsertPo(po);
        summary.synced++;
      } catch (err) {
        console.error(`[OraclePoSync] Upsert failed for PO ${po.poNumber}:`, (err as Error).message);
        summary.failed++;
      }
    }
  }

  return summary;
}

async function upsertPo(po: OraclePo): Promise<void> {
  await prisma.$transaction(async tx => {
    const header = await tx.purchaseOrderMirror.upsert({
      where: { poNumber: po.poNumber },
      create: {
        poNumber: po.poNumber,
        supplierCode: po.supplierCode,
        supplierName: po.supplierName,
        orderDate: new Date(po.orderDate),
        expectedDate: po.expectedDate ? new Date(po.expectedDate) : null,
        status: normaliseStatus(po.status),
        totalAmount: po.totalAmount ?? null,
        currency: po.currency ?? 'SAR',
        syncedAt: new Date(),
      },
      update: {
        supplierCode: po.supplierCode,
        supplierName: po.supplierName,
        orderDate: new Date(po.orderDate),
        expectedDate: po.expectedDate ? new Date(po.expectedDate) : null,
        status: normaliseStatus(po.status),
        totalAmount: po.totalAmount ?? null,
        currency: po.currency ?? 'SAR',
        syncedAt: new Date(),
      },
    });

    // Delete stale lines and recreate — simpler than per-line upsert
    await tx.purchaseOrderLineMirror.deleteMany({ where: { poId: header.id } });

    if (po.lines && po.lines.length > 0) {
      await tx.purchaseOrderLineMirror.createMany({
        data: po.lines.map(line => ({
          poId: header.id,
          lineNumber: line.lineNumber,
          itemCode: line.itemCode,
          description: line.description ?? null,
          orderedQty: line.orderedQty,
          receivedQty: line.receivedQty,
          unitPrice: line.unitPrice ?? null,
          uom: line.uom,
        })),
      });
    }
  });
}

function normaliseStatus(oracleStatus: string): string {
  const map: Record<string, string> = {
    OPEN: 'open',
    PARTIALLY_RECEIVED: 'partially_received',
    FULLY_RECEIVED: 'fully_received',
    CLOSED: 'closed',
    CANCELLED: 'cancelled',
  };
  return map[oracleStatus.toUpperCase()] ?? 'open';
}

// ── GRN Validation Helper ──────────────────────────────────────────────────

/**
 * Soft-validates GRN line quantities against Oracle PO mirror data.
 *
 * Never throws — always returns a result with optional warnings.
 * The caller decides whether to surface warnings to the user.
 */
export async function validateGrnAgainstPO(
  poNumber: string,
  items: GrnItemForValidation[],
): Promise<PoValidationResult> {
  const po = await prisma.purchaseOrderMirror.findUnique({
    where: { poNumber },
    include: { lines: true },
  });

  if (!po) {
    return { poFound: false, warnings: [] };
  }

  const warnings: PoValidationWarning[] = [];

  for (const item of items) {
    const line = po.lines.find((l: PurchaseOrderLineMirror) => l.itemCode === item.itemCode);
    if (!line) continue;

    const orderedQty = Number(line.orderedQty);
    const alreadyReceived = Number(line.receivedQty);
    const projectedTotal = alreadyReceived + item.qtyReceived;

    if (projectedTotal > orderedQty) {
      warnings.push({
        itemCode: item.itemCode,
        lineNumber: line.lineNumber,
        orderedQty,
        receivedQty: alreadyReceived,
        newReceiptQty: item.qtyReceived,
        projectedTotal,
        message: `Item ${item.itemCode}: receiving ${item.qtyReceived} would exceed PO quantity (ordered ${orderedQty}, already received ${alreadyReceived}, projected total ${projectedTotal})`,
      });
    }
  }

  return { poFound: true, warnings };
}

// ── Reconciliation Query ───────────────────────────────────────────────────

export interface PoReconciliationLine {
  poNumber: string;
  supplierCode: string;
  supplierName: string;
  itemCode: string;
  description: string | null;
  lineNumber: number;
  orderedQty: number;
  receivedQty: number;
  variance: number;
  status: 'fully_received' | 'partially_received' | 'not_received' | 'over_received';
  uom: string;
  unitPrice: number | null;
}

export interface PaginatedPoReconciliation {
  data: PoReconciliationLine[];
  total: number;
}

export async function getPoReconciliation(params: {
  supplierCode?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedPoReconciliation> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const whereHeader: Record<string, unknown> = {};
  if (params.supplierCode) whereHeader['supplierCode'] = params.supplierCode;
  if (params.status) whereHeader['status'] = params.status;
  if (params.fromDate || params.toDate) {
    whereHeader['orderDate'] = {
      ...(params.fromDate ? { gte: new Date(params.fromDate) } : {}),
      ...(params.toDate ? { lte: new Date(params.toDate) } : {}),
    };
  }

  const headers = await prisma.purchaseOrderMirror.findMany({
    where: whereHeader,
    include: { lines: true },
    orderBy: { orderDate: 'desc' },
  });

  // Flatten into per-line reconciliation rows
  const allLines: PoReconciliationLine[] = [];
  for (const header of headers) {
    for (const line of header.lines) {
      const ordered = Number(line.orderedQty);
      const received = Number(line.receivedQty);
      const variance = received - ordered;

      let lineStatus: PoReconciliationLine['status'];
      if (received === 0) lineStatus = 'not_received';
      else if (received >= ordered) lineStatus = variance > 0 ? 'over_received' : 'fully_received';
      else lineStatus = 'partially_received';

      allLines.push({
        poNumber: header.poNumber,
        supplierCode: header.supplierCode,
        supplierName: header.supplierName,
        itemCode: line.itemCode,
        description: line.description,
        lineNumber: line.lineNumber,
        orderedQty: ordered,
        receivedQty: received,
        variance,
        status: lineStatus,
        uom: line.uom,
        unitPrice: line.unitPrice !== null ? Number(line.unitPrice) : null,
      });
    }
  }

  const total = allLines.length;
  const data = allLines.slice(skip, skip + pageSize);

  return { data, total };
}

export async function listPoMirrors(params: {
  supplierCode?: string;
  status?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (params.supplierCode) where['supplierCode'] = params.supplierCode;
  if (params.status) where['status'] = params.status;
  if (params.search) {
    where['OR'] = [
      { poNumber: { contains: params.search, mode: 'insensitive' } },
      { supplierName: { contains: params.search, mode: 'insensitive' } },
      { supplierCode: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.purchaseOrderMirror.findMany({
      where,
      orderBy: { orderDate: 'desc' },
      skip,
      take: pageSize,
      include: { _count: { select: { lines: true } } },
    }),
    prisma.purchaseOrderMirror.count({ where }),
  ]);

  return { data, total };
}

export async function getPoByNumber(poNumber: string) {
  return prisma.purchaseOrderMirror.findUnique({
    where: { poNumber },
    include: { lines: true },
  });
}
