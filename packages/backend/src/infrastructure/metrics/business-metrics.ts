// ---------------------------------------------------------------------------
// Business Metrics — Socket.IO clients, document operations, connection pool
// ---------------------------------------------------------------------------
// Domain-level Prometheus metrics for operational monitoring.
// Wired into EventBus (document counters) and Socket.IO (client gauge).
// ---------------------------------------------------------------------------

import { Gauge, Counter } from 'prom-client';
import { register } from './prometheus.js';

// ── V1 → V2 Entity Name Mapping ───────────────────────────────────────────

const ENTITY_TYPE_MAP: Record<string, string> = {
  mrrv: 'grn',
  mirv: 'mi',
  mrv: 'mrn',
  mrf: 'mr',
  stockTransfer: 'wt',
  materialRequisition: 'mr',
};

// ── Socket.IO Connected Clients ────────────────────────────────────────────

export const socketioConnectedClients = new Gauge({
  name: 'nit_socketio_connected_clients',
  help: 'Number of currently connected Socket.IO clients',
  registers: [register],
});

// ── Document Operations Counter ────────────────────────────────────────────

export const documentOperationsTotal = new Counter({
  name: 'nit_document_operations_total',
  help: 'Total document operations by type and action',
  labelNames: ['doc_type', 'operation'],
  registers: [register],
});

// ── Prisma Connection Pool Gauge ───────────────────────────────────────────

export const prismaPoolActiveConnections = new Gauge({
  name: 'prisma_pool_active_connections',
  help: 'Number of active Prisma connection pool connections',
  registers: [register],
});

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Track a document-level business operation (create, approve, status_change).
 * Maps V1 internal entity names (mrrv, mirv, etc.) to V2 display names (grn, mi, etc.)
 * for consistent metric labels.
 */
export function trackDocumentOperation(entityType: string, action: string): void {
  const docType = ENTITY_TYPE_MAP[entityType] || entityType;
  documentOperationsTotal.inc({ doc_type: docType, operation: action });
}

/**
 * Update the Socket.IO connected clients gauge with the current count.
 * Called on every connection and disconnection event.
 */
export function updateSocketClients(count: number): void {
  socketioConnectedClients.set(count);
}

/**
 * Collect Prisma connection pool metrics using the Prisma metrics API.
 * Requires `previewFeatures = ["metrics"]` in the Prisma schema generator block.
 * Falls back gracefully if the metrics API is not available.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- PrismaClient extended type is incompatible with $metrics duck-typing
export async function collectPoolMetrics(prisma: any): Promise<void> {
  try {
    if (!prisma.$metrics) return;

    const raw = (await prisma.$metrics.json()) as {
      gauges?: Array<{ key: string; value: number }>;
    };

    const activeGauge = raw.gauges?.find(
      (g: { key: string; value: number }) => g.key === 'prisma_client_queries_active',
    );
    if (activeGauge != null) {
      prismaPoolActiveConnections.set(activeGauge.value);
    }
  } catch {
    // Metrics API not available or failed — skip silently
  }
}
