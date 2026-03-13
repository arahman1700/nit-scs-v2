# Wave 2: Metrics, OpenAPI, EventBus Dashboard, Mobile Forms, Widgets, Email — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Prometheus metrics, OpenAPI docs, EventBus monitoring dashboard, 6 mobile forms, 4 dashboard widgets, and HTML email templates.

**Architecture:** 6 independent tasks that can all run in parallel. Backend tasks (metrics, OpenAPI, EventBus dashboard, email templates) and frontend tasks (mobile forms, widgets) have no cross-dependencies.

**Tech Stack:** prom-client, swagger-jsdoc, swagger-ui-express, zod-to-openapi, React, TanStack, Handlebars templates

---

## Task 1: Prometheus Metrics Endpoint

**Files:**
- Create: `packages/backend/src/infrastructure/metrics/prometheus.ts`
- Modify: `packages/backend/src/routes/index.ts`
- Modify: `packages/backend/src/infrastructure/queue/bullmq.config.ts`

- [ ] **Step 1: Install prom-client**

```bash
cd packages/backend && pnpm add prom-client
```

- [ ] **Step 2: Create metrics module**

Create `packages/backend/src/infrastructure/metrics/prometheus.ts`:
```typescript
import { Registry, Counter, Histogram, collectDefaultMetrics } from 'prom-client';

export const register = new Registry();

collectDefaultMetrics({ register });

export const httpRequestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register],
});

export const dbQueryDuration = new Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries',
  labelNames: ['model', 'operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register],
});

export const eventBusEventsTotal = new Counter({
  name: 'eventbus_events_total',
  help: 'Total EventBus events',
  labelNames: ['event_type'],
  registers: [register],
});

export const bullmqJobsTotal = new Counter({
  name: 'bullmq_jobs_total',
  help: 'Total BullMQ jobs',
  labelNames: ['queue', 'status'],
  registers: [register],
});

export const cacheOpsTotal = new Counter({
  name: 'cache_ops_total',
  help: 'Cache operations',
  labelNames: ['operation'],
  registers: [register],
});
```

- [ ] **Step 3: Create metrics middleware**

Add to same file or create `packages/backend/src/middleware/metrics.ts`:
```typescript
import { Request, Response, NextFunction } from 'express';
import { httpRequestDuration, httpRequestsTotal } from '../infrastructure/metrics/prometheus.js';

export function metricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    end(labels);
    httpRequestsTotal.inc(labels);
  });
  next();
}
```

- [ ] **Step 4: Mount /metrics endpoint and middleware**

In `packages/backend/src/routes/index.ts`:
```typescript
import { register } from '../infrastructure/metrics/prometheus.js';
import { metricsMiddleware } from '../middleware/metrics.js';

// Before domain routes
router.use(metricsMiddleware);

// Metrics endpoint (no auth — internal network)
router.get('/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});
```

- [ ] **Step 5: Instrument EventBus**

In `packages/backend/src/events/event-bus.ts`, add after publish:
```typescript
import { eventBusEventsTotal } from '../infrastructure/metrics/prometheus.js';
// In publish method:
eventBusEventsTotal.inc({ event_type: event.type });
```

- [ ] **Step 6: Run tests and commit**

```bash
cd packages/backend && npx vitest run 2>&1 | tail -5
git add packages/backend/src/infrastructure/metrics/ packages/backend/src/middleware/metrics.ts packages/backend/src/routes/index.ts packages/backend/src/events/event-bus.ts
git commit -m "feat: add Prometheus metrics endpoint with HTTP, DB, EventBus, and BullMQ counters"
```

---

## Task 2: OpenAPI/Swagger Documentation

**Files:**
- Create: `packages/backend/src/config/swagger.ts`
- Modify: `packages/backend/src/routes/index.ts`

- [ ] **Step 1: Install dependencies**

```bash
cd packages/backend && pnpm add swagger-jsdoc swagger-ui-express && pnpm add -D @types/swagger-jsdoc @types/swagger-ui-express
```

- [ ] **Step 2: Create Swagger config**

Create `packages/backend/src/config/swagger.ts`:
```typescript
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'NIT Supply Chain V2 API',
      version: '2.0.0',
      description: 'Enterprise supply chain management API',
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/domains/*/routes/*.ts', './src/utils/document-factory.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

- [ ] **Step 3: Mount Swagger UI**

In `packages/backend/src/routes/index.ts`:
```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../config/swagger.js';

// After health checks, before domain routes
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'NIT SCS V2 API Docs',
}));
router.get('/api-docs.json', (_req, res) => res.json(swaggerSpec));
```

- [ ] **Step 4: Add JSDoc annotations to document-factory**

In `packages/backend/src/utils/document-factory.ts`, add before the list route:
```typescript
/**
 * @openapi
 * /{prefix}:
 *   get:
 *     summary: List documents
 *     tags: [Documents]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: pageSize
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list
 */
```

Add similar annotations for GET /:id, POST /, PUT /:id, and action routes.

- [ ] **Step 5: Verify and commit**

```bash
cd packages/backend && npx tsc --noEmit 2>&1 | tail -10
git add packages/backend/src/config/swagger.ts packages/backend/src/routes/index.ts packages/backend/src/utils/document-factory.ts
git commit -m "feat: add OpenAPI/Swagger documentation at /api-docs"
```

---

## Task 3: EventBus Monitoring Dashboard

**Files:**
- Create: `packages/backend/src/domains/system/routes/eventbus-monitor.routes.ts`
- Create: `packages/backend/src/domains/system/services/eventbus-monitor.service.ts`
- Create: `packages/frontend/src/pages/dashboards/EventBusMonitorDashboard.tsx`
- Modify: `packages/backend/src/domains/system/index.ts`
- Modify: `packages/backend/src/events/event-bus.ts`

- [ ] **Step 1: Add instrumentation to EventBus**

In `packages/backend/src/events/event-bus.ts`, add event counters:
```typescript
interface EventStats {
  totalPublished: number;
  publishedByType: Record<string, number>;
  errors: Array<{ timestamp: string; type: string; error: string }>;
  lastPublished?: string;
}

const stats: EventStats = {
  totalPublished: 0,
  publishedByType: {},
  errors: [],
};

// In publish method, after emit:
stats.totalPublished++;
stats.publishedByType[event.type] = (stats.publishedByType[event.type] || 0) + 1;
stats.lastPublished = new Date().toISOString();

// Export for monitoring
export function getEventBusStats(): EventStats {
  return { ...stats, errors: stats.errors.slice(-50) };
}

export function recordEventError(type: string, error: string) {
  stats.errors.push({ timestamp: new Date().toISOString(), type, error });
  if (stats.errors.length > 100) stats.errors.shift();
}
```

- [ ] **Step 2: Create monitoring service**

Create `packages/backend/src/domains/system/services/eventbus-monitor.service.ts`:
```typescript
import { getEventBusStats } from '../../../events/event-bus.js';
import { getAllQueues, getDeadLetterQueue, QUEUE_NAMES } from '../../../infrastructure/queue/bullmq.config.js';

export async function getEventBusMonitorStats() {
  return getEventBusStats();
}

export async function getQueueStats() {
  const queues = getAllQueues();
  const results: Record<string, unknown>[] = [];

  for (const [name, queue] of Object.entries(queues)) {
    const counts = await queue.getJobCounts();
    results.push({ name, ...counts });
  }

  return results;
}

export async function getDlqJobs(page = 1, pageSize = 20) {
  const dlq = getDeadLetterQueue();
  if (!dlq) return { data: [], total: 0 };

  const failed = await dlq.getFailed((page - 1) * pageSize, page * pageSize - 1);
  const total = await dlq.getJobCounts();

  return {
    data: failed.map(j => ({
      id: j.id,
      name: j.name,
      data: j.data,
      failedReason: j.failedReason,
      timestamp: j.timestamp,
      attemptsMade: j.attemptsMade,
    })),
    total: total.failed,
  };
}

export async function retryDlqJob(jobId: string) {
  const dlq = getDeadLetterQueue();
  if (!dlq) throw new Error('DLQ not available');
  const job = await dlq.getJob(jobId);
  if (!job) throw new Error('Job not found');
  await job.retry();
  return { success: true };
}
```

- [ ] **Step 3: Create monitoring routes**

Create `packages/backend/src/domains/system/routes/eventbus-monitor.routes.ts`:
```typescript
import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { sendSuccess } from '../../../utils/response.js';
import * as monitorService from '../services/eventbus-monitor.service.js';

const router = Router();

router.get('/eventbus/stats', authenticate, requirePermission('settings', 'read'), async (_req, res, next) => {
  try {
    const stats = await monitorService.getEventBusMonitorStats();
    sendSuccess(res, stats);
  } catch (err) { next(err); }
});

router.get('/queues/stats', authenticate, requirePermission('settings', 'read'), async (_req, res, next) => {
  try {
    const stats = await monitorService.getQueueStats();
    sendSuccess(res, stats);
  } catch (err) { next(err); }
});

router.get('/queues/dlq', authenticate, requirePermission('settings', 'read'), async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const data = await monitorService.getDlqJobs(page);
    sendSuccess(res, data);
  } catch (err) { next(err); }
});

router.post('/queues/dlq/:jobId/retry', authenticate, requirePermission('settings', 'update'), async (req, res, next) => {
  try {
    const result = await monitorService.retryDlqJob(req.params.jobId);
    sendSuccess(res, result);
  } catch (err) { next(err); }
});

export default router;
```

- [ ] **Step 4: Register routes in system domain**

In `packages/backend/src/domains/system/index.ts`, add:
```typescript
import eventbusMonitorRoutes from './routes/eventbus-monitor.routes.js';
// In registerSystemRoutes:
router.use('/monitor', eventbusMonitorRoutes);
```

- [ ] **Step 5: Create frontend dashboard page**

Create `packages/frontend/src/pages/dashboards/EventBusMonitorDashboard.tsx` — admin-only dashboard showing:
- Event flow stats (events/type counts)
- Queue health cards (waiting/active/completed/failed per queue)
- DLQ table with retry buttons
- Auto-refresh every 10 seconds

Use glass-card styling, `useQuery` for data fetching, and `useMutation` for DLQ retry.

- [ ] **Step 6: Add route and commit**

Add lazy-loaded route for the dashboard page. Commit all files:
```bash
git commit -m "feat: add EventBus monitoring dashboard with queue stats and DLQ management"
```

---

## Task 4: Mobile Forms (6 forms)

**Pattern reference:** `packages/frontend/src/pages/warehouse/MobileGrnReceive.tsx`

**Shared components:** SwipeableSteps, OfflineQueueBanner, BarcodeScanner, useOfflineQueue

- [ ] **Step 1: Add new transaction types to offline queue**

In `packages/frontend/src/lib/offlineQueue.ts`, add to `TransactionType`:
```typescript
type TransactionType = 'grn-receive' | 'mi-issue' | 'wt-transfer'
  | 'mrn-request' | 'qci-inspect' | 'dr-report' | 'mr-return' | 'jo-execute' | 'scrap-dispose';
```

Register sync handlers for each new type.

- [ ] **Step 2: Create MobileMrnRequest.tsx**

Create `packages/frontend/src/pages/warehouse/MobileMrnRequest.tsx`:
- Step 1: Scan item barcode → lookup item details
- Step 2: Enter quantity + reason for request
- Step 3: Review summary
- Step 4: Submit (online) or enqueue (offline)
Follow MobileGrnReceive pattern exactly.

- [ ] **Step 3: Create MobileQciInspect.tsx**

Create `packages/frontend/src/pages/warehouse/MobileQciInspect.tsx`:
- Step 1: Scan GRN barcode → load GRN lines
- Step 2: Inspection checklist per line item (pass/fail + notes)
- Step 3: Photo capture for evidence
- Step 4: Submit inspection result

- [ ] **Step 4: Create MobileDrReport.tsx**

Create `packages/frontend/src/pages/warehouse/MobileDrReport.tsx`:
- Step 1: Scan GRN barcode → load received items
- Step 2: Select discrepancy type (over/short/damage) + qty
- Step 3: Photo evidence
- Step 4: Submit report

- [ ] **Step 5: Create MobileMrReturn.tsx**

Create `packages/frontend/src/pages/warehouse/MobileMrReturn.tsx`:
- Step 1: Scan item barcode → lookup
- Step 2: Select return reason + condition + qty
- Step 3: Review and submit

- [ ] **Step 6: Create MobileJoExecute.tsx**

Create `packages/frontend/src/pages/warehouse/MobileJoExecute.tsx`:
- Step 1: Scan JO barcode → load job order tasks
- Step 2: Task checklist (check off completed tasks)
- Step 3: Enter labor hours
- Step 4: Mark complete

- [ ] **Step 7: Create MobileScrapDispose.tsx**

Create `packages/frontend/src/pages/warehouse/MobileScrapDispose.tsx`:
- Step 1: Scan item barcode → lookup
- Step 2: Select condition + qty
- Step 3: Photo evidence of condition
- Step 4: Submit for disposal

- [ ] **Step 8: Add routes for all mobile forms**

Add lazy-loaded routes in the appropriate routes file. Each should be accessible at `/mobile/{form-type}`.

- [ ] **Step 9: Build check and commit**

```bash
cd packages/frontend && npx tsc --noEmit 2>&1 | tail -20
git commit -m "feat: add 6 mobile forms (MRN, QCI, DR, MR, JO, Scrap) with offline support"
```

---

## Task 5: Dashboard Widgets (+4)

**Pattern reference:** `packages/frontend/src/components/dashboard-builder/KpiWidget.tsx`

**Registry:** `packages/frontend/src/components/dashboard-builder/WidgetPalette.tsx` (WIDGET_TYPES array) and `WidgetWrapper.tsx` (WIDGET_RENDERERS map)

- [ ] **Step 1: Create GanttWidget**

Create `packages/frontend/src/components/dashboard-builder/widgets/GanttWidget.tsx`:
- SVG-based horizontal bar chart with timeline axis
- Props: `widget: DashboardWidget` (same pattern as KpiWidget)
- Data: `useWidgetData(widget.dataSource)` returns `{ data: { tasks: Array<{name, start, end, progress, color}> } }`
- Render: SVG with date axis, colored bars per task, progress indicators

- [ ] **Step 2: Create CalendarHeatmapWidget**

Create `packages/frontend/src/components/dashboard-builder/widgets/CalendarHeatmapWidget.tsx`:
- 52-week grid layout (7 rows x 52 cols)
- Props: same widget pattern
- Data: `{ data: { days: Array<{date, count}>, maxCount } }`
- Color scale: white/5 → nesma-secondary (intensity based on count/maxCount)

- [ ] **Step 3: Create PivotTableWidget**

Create `packages/frontend/src/components/dashboard-builder/widgets/PivotTableWidget.tsx`:
- Row/column grouping with aggregation
- Data: `{ data: { rows: Array<Record<string,unknown>>, columns: string[], measures: string[] } }`
- Render: nested table with group headers, sum/count/avg in cells
- Glass-card table styling

- [ ] **Step 4: Create MapWidget**

Create `packages/frontend/src/components/dashboard-builder/widgets/MapWidget.tsx`:
- SVG-based warehouse zone visualization
- Data: `{ data: { zones: Array<{id, name, path, fill, value, label}> } }`
- Render: SVG with zone paths, color-coded by metric, tooltips on hover

- [ ] **Step 5: Register in widget palette and renderer**

In `WidgetPalette.tsx`, add to WIDGET_TYPES:
```typescript
{ type: 'gantt', label: 'Gantt Chart', icon: GanttChart, defaultWidth: 2, defaultHeight: 1 },
{ type: 'calendar_heatmap', label: 'Calendar Heatmap', icon: Calendar, defaultWidth: 2, defaultHeight: 1 },
{ type: 'pivot', label: 'Pivot Table', icon: Table, defaultWidth: 2, defaultHeight: 1 },
{ type: 'map', label: 'Zone Map', icon: Map, defaultWidth: 2, defaultHeight: 1 },
```

In `WidgetWrapper.tsx`, add to WIDGET_RENDERERS:
```typescript
gantt: GanttWidget,
calendar_heatmap: CalendarHeatmapWidget,
pivot: PivotTableWidget,
map: MapWidget,
```

- [ ] **Step 6: Commit**

```bash
git commit -m "feat: add 4 dashboard widgets (Gantt, Calendar Heatmap, Pivot Table, Zone Map)"
```

---

## Task 6: HTML Email Templates

**Existing system:** `EmailTemplate` model with `code`, `bodyHtml`, `variables` fields. CRUD routes at `email-template.routes.ts`. `chain-notification-handler.ts` dispatches notifications on document events.

- [ ] **Step 1: Create email renderer service**

Create `packages/backend/src/domains/notifications/services/email-renderer.service.ts`:
```typescript
import { prisma } from '../../../utils/prisma.js';

export async function renderEmailTemplate(
  templateCode: string,
  variables: Record<string, string>,
): Promise<{ subject: string; html: string } | null> {
  const template = await prisma.emailTemplate.findUnique({
    where: { code: templateCode },
  });

  if (!template || !template.isActive) return null;

  let subject = template.subject;
  let html = template.bodyHtml;

  for (const [key, value] of Object.entries(variables)) {
    const placeholder = `{{${key}}}`;
    subject = subject.replaceAll(placeholder, value);
    html = html.replaceAll(placeholder, value);
  }

  return { subject, html };
}
```

- [ ] **Step 2: Create seed migration with 5 default templates**

Create a seed script or migration that inserts:
```sql
INSERT INTO "FND_EMAIL_TEMPLATES" (id, code, name, subject, body_html, variables, is_active) VALUES
  (gen_random_uuid(), 'document_submission', 'Document Submission', '{{documentType}} #{{documentNumber}} Submitted for Review', '<html>...submission template HTML...</html>', '["documentType","documentNumber","submittedBy","date"]', true),
  (gen_random_uuid(), 'document_approval', 'Document Approval', '{{documentType}} #{{documentNumber}} Approved', '<html>...approval template HTML...</html>', '["documentType","documentNumber","approvedBy","date"]', true),
  (gen_random_uuid(), 'document_rejection', 'Document Rejection', '{{documentType}} #{{documentNumber}} Rejected', '<html>...rejection template HTML...</html>', '["documentType","documentNumber","rejectedBy","reason","date"]', true),
  (gen_random_uuid(), 'sla_breach', 'SLA Breach Alert', 'SLA Breach: {{documentType}} #{{documentNumber}}', '<html>...SLA breach template HTML...</html>', '["documentType","documentNumber","slaType","hoursOverdue"]', true),
  (gen_random_uuid(), 'escalation', 'Escalation Notice', '{{documentType}} #{{documentNumber}} Escalated', '<html>...escalation template HTML...</html>', '["documentType","documentNumber","escalatedTo","reason"]', true);
```

Each template should have a responsive HTML layout with `{{orgLogo}}`, `{{orgName}}` variables for branding.

- [ ] **Step 3: Wire renderer into chain-notification-handler**

In `packages/backend/src/events/chain-notification-handler.ts`, update the notification dispatch to use templates:
```typescript
import { renderEmailTemplate } from '../domains/notifications/services/email-renderer.service.js';

// In handleDocumentStatusChange, when sending email:
const rendered = await renderEmailTemplate(rule.emailTemplateCode, {
  documentType: event.entityType,
  documentNumber: event.entityId,
  // ... other variables from event payload
});

if (rendered) {
  await sendEmail(recipientEmail, rendered.subject, rendered.html);
}
```

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add HTML email templates with variable rendering for document workflows"
```
