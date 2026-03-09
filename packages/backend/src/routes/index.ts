// ---------------------------------------------------------------------------
// Route Aggregation — V2 (Domain-Driven)
// ---------------------------------------------------------------------------
// Each domain barrel (domains/xxx/index.ts) registers its own routes.
// This file composes all domains under /api/v1.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { healthCheck, detailedHealthCheck, detailedHealthMiddleware } from '../domains/system/routes/health.routes.js';

// ── Domain Barrels ──────────────────────────────────────────────────────
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

/**
 * Create a fresh API router with all domain routes registered.
 *
 * Returns a new Router instance each call — critical for test isolation.
 * In production, called once at startup. In tests, called per test-app
 * so that module-level middleware state (rate limiter, etc.) is not shared.
 */
export function createApiRouter() {
  const router = Router();

  // ── Rate limiter (applied to all /api/v1 routes) ───────────────────────
  router.use(rateLimiter(500, 60_000));

  // ── Health Check (public: minimal status only) ───────────────────────
  router.get('/health', healthCheck);

  // ── Detailed Health Check (authenticated admin only) ─────────────────
  router.get('/health/details', ...detailedHealthMiddleware, detailedHealthCheck);

  // ── Register all domains ───────────────────────────────────────────────
  registerAuthRoutes(router);
  // Inventory MUST be registered before master-data so that specific routes
  // (e.g. GET /inventory/expiring) match before master-data's CRUD /inventory/:id
  registerInventoryRoutes(router);
  registerMasterDataRoutes(router);
  registerInboundRoutes(router);
  registerOutboundRoutes(router);
  registerWarehouseOpsRoutes(router);
  registerTransferRoutes(router);
  registerLogisticsRoutes(router);
  registerJobOrderRoutes(router);
  registerEquipmentRoutes(router);
  registerWorkflowRoutes(router);
  registerComplianceRoutes(router);
  registerReportingRoutes(router);
  registerSystemRoutes(router);

  return router;
}

// Default export for production use (backward compat with `import apiRoutes`)
export default createApiRouter();
