// ---------------------------------------------------------------------------
// Route Aggregation — V2 (Domain-Driven + Route Registry)
// ---------------------------------------------------------------------------
// Each domain barrel (domains/xxx/index.ts) registers its own routes.
// The RouteRegistry handles safe ordering to prevent route shadowing.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { metricsMiddleware } from '../middleware/metrics.js';
import { register } from '../infrastructure/metrics/prometheus.js';
import { RouteRegistry } from '../utils/route-registry.js';
import {
  healthCheck,
  detailedHealthCheck,
  detailedHealthMiddleware,
  livenessProbe,
  readinessProbe,
} from '../domains/system/routes/health.routes.js';

// ── Domain Barrels (19 domains) ───────────────────────────────────────────
import { registerAuthRoutes } from '../domains/auth/index.js';
import { registerMasterDataRoutes } from '../domains/master-data/index.js';
import { registerInboundRoutes } from '../domains/inbound/index.js';
import { registerOutboundRoutes } from '../domains/outbound/index.js';
import { registerInventoryRoutes } from '../domains/inventory/index.js';
import { registerWarehouseOpsRoutes } from '../domains/warehouse-ops/index.js';
import { registerTransferRoutes } from '../domains/transfers/index.js';
import { registerLogisticsRoutes } from '../domains/logistics/index.js';
import { registerJobOrderRoutes } from '../domains/job-orders/index.js';
import { registerEquipmentRoutes } from '../domains/equipment/index.js';
import { registerWorkflowRoutes } from '../domains/workflow/index.js';
import { registerComplianceRoutes } from '../domains/compliance/index.js';
import { registerReportingRoutes } from '../domains/reporting/index.js';
import { registerSystemRoutes } from '../domains/system/index.js';
// ── New domains (split from system) ───────────────────────────────────────
import { registerNotificationRoutes } from '../domains/notifications/index.js';
import { registerAuditRoutes } from '../domains/audit/index.js';
import { registerUploadRoutes } from '../domains/uploads/index.js';

/**
 * Create a fresh API router with all domain routes registered.
 *
 * Uses RouteRegistry for automatic safe ordering — no more manual
 * "inventory MUST be before master-data" comments.
 *
 * Returns a new Router instance each call — critical for test isolation.
 */
export function createApiRouter() {
  const router = Router();

  // ── Rate limiter (applied to all /api/v1 routes) ───────────────────────
  router.use(rateLimiter(500, 60_000));

  // ── Health Check (public: minimal status only) ───────────────────────
  router.get('/health', healthCheck);

  // ── Detailed Health Check (authenticated admin only) ─────────────────
  router.get('/health/details', ...detailedHealthMiddleware, detailedHealthCheck);

  // ── Kubernetes-style probes (public, lightweight) ─────────────────────
  router.get('/live', livenessProbe);
  router.get('/ready', readinessProbe);

  // ── Prometheus metrics (public, no auth) ────────────────────────────
  router.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // ── HTTP metrics collection (before domain routes) ──────────────────
  router.use(metricsMiddleware);

  // ── Register all domains via RouteRegistry ────────────────────────────
  // Order no longer matters — the registry handles safe ordering
  // to prevent route shadowing (static paths before param paths).
  const registry = new RouteRegistry();

  registry.register('auth', registerAuthRoutes);
  registry.register('inventory', registerInventoryRoutes);
  registry.register('master-data', registerMasterDataRoutes);
  registry.register('inbound', registerInboundRoutes);
  registry.register('outbound', registerOutboundRoutes);
  registry.register('warehouse-ops', registerWarehouseOpsRoutes);
  registry.register('transfers', registerTransferRoutes);
  registry.register('logistics', registerLogisticsRoutes);
  registry.register('job-orders', registerJobOrderRoutes);
  registry.register('equipment', registerEquipmentRoutes);
  registry.register('workflow', registerWorkflowRoutes);
  registry.register('compliance', registerComplianceRoutes);
  registry.register('reporting', registerReportingRoutes);
  registry.register('system', registerSystemRoutes);
  // New domains (split from system)
  registry.register('notifications', registerNotificationRoutes);
  registry.register('audit', registerAuditRoutes);
  registry.register('uploads', registerUploadRoutes);

  registry.mount(router);

  return router;
}

// Default export for production use (backward compat with `import apiRoutes`)
export default createApiRouter();
