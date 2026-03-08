// ---------------------------------------------------------------------------
// Route Aggregation — V2 (Domain-Driven)
// ---------------------------------------------------------------------------
// Each domain barrel (domains/xxx/index.ts) registers its own routes.
// This file composes all domains under /api/v1.
// ---------------------------------------------------------------------------

import { Router } from 'express';
import { rateLimiter } from '../middleware/rate-limiter.js';
import { healthCheck } from '../domains/system/routes/health.routes.js';

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

const router = Router();

// ── Rate limiter (applied to all /api/v1 routes) ───────────────────────
router.use(rateLimiter(500, 60_000));

// ── Health Check (no auth required) ────────────────────────────────────
router.get('/health', healthCheck);

// ── Register all domains ───────────────────────────────────────────────
registerAuthRoutes(router);
registerMasterDataRoutes(router);
registerInboundRoutes(router);
registerOutboundRoutes(router);
registerInventoryRoutes(router);
registerWarehouseOpsRoutes(router);
registerTransferRoutes(router);
registerLogisticsRoutes(router);
registerJobOrderRoutes(router);
registerEquipmentRoutes(router);
registerWorkflowRoutes(router);
registerComplianceRoutes(router);
registerReportingRoutes(router);
registerSystemRoutes(router);

export default router;
