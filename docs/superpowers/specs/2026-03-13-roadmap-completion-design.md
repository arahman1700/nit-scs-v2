# NIT Supply Chain V2 — Roadmap Completion Design

> **Date:** 2026-03-13
> **Scope:** All 7 ROADMAP phases — 18 remaining items (17 were already complete)
> **Approach:** Parallel Streams by Layer (4 concurrent streams)
> **Target:** Audit score 71 → 100

---

## Current State Analysis

After thorough codebase exploration, many ROADMAP items marked "Not started" are already implemented. This spec covers only the actual remaining work.

### Already Complete (no action needed)
- Auth rate limiting (5/15min login, 3/15min forgot-password)
- Redis monitoring (health checks, reconnection, memory alerts, dual-layer fallback)
- CSRF — Bearer token auth is inherently CSRF-immune (tokens are not auto-attached by the browser). Refresh token uses httpOnly + SameSite=strict cookies. This is a deliberate architectural choice over csurf/double-submit, as modern SPA + JWT architecture provides equivalent protection.
- AI SQL protection (multi-layer allowlist, read-only txn, admin-only)
- V1→V2 route migration (MR + DR use V2 services)
- CHECK constraints (564 lines SQL migration)
- Float→Decimal migration (all monetary/qty fields)
- Structured logging + correlation IDs (Pino + JSON + UUID)
- SLA tracking (17 scheduled jobs, breach/warning checks)
- Dead-letter queue (BullMQ DLQ with retry)
- Offline queue (IndexedDB + polling)
- Barcode scanning (lazy-loaded, 5 integration points)
- Form configs (15 configs including Tool + Generator)
- Bulk operations (BulkActionBar + CSV export)
- Materialized views (P5 migration)
- WebSocket rooms (role/user/document with permission checks)
- Code splitting (~105 React.lazy instances, ~90% coverage)

---

## Stream 1: Backend Infrastructure

### 1.1 Wire `requirePermission` to All Routes

**Problem:** ~60% of routes use `requireRole` fallback instead of `requirePermission`.

**Current state:** `document-factory.ts` L114-121 has `rbac()` function that uses `requirePermission` only when `config.resource` is set. Routes without it fall back to `requireRole` or pass-through.

**Implementation:**
1. Map every domain route config to its corresponding `resource` from `shared/permissions.ts` (43 resources)
2. Update document-factory configs for: inbound (grn, qci, dr, asn, inspection), outbound (mi, mrn, mr, pick-optimizer, wave), inventory (bin-card, cycle-count, surplus, scrap, expiry, abc), warehouse-ops (zone, put-away, slotting, staging, cross-dock, yard), logistics (shipment, gate-pass, transport-order, customs, tariff), transfers (wt, handover, imsf), compliance (supplier-eval, compliance-audit, visitor), equipment (tool, generator, vehicle, asset, amc, rental), workflow (approval, delegation, comment, signature)
3. Fail-closed: any route without explicit resource rejects with 403
4. Update tests to verify permission checks

**Files to modify:**
- `packages/backend/src/utils/document-factory.ts` — ensure all configs have `resource`
- All domain route files that use `requireRole` instead of `requirePermission`
- `packages/backend/src/middleware/rbac.ts` — no changes needed (already correct)

### 1.2 Prometheus Metrics Endpoint

**Problem:** Health checks exist but no time-series metrics for monitoring.

**Implementation:**
1. Install `prom-client`
2. Create `packages/backend/src/middleware/metrics.ts`:
   - `http_request_duration_seconds` histogram (method, route, status_code)
   - `http_requests_total` counter (method, route, status_code)
   - `db_query_duration_seconds` histogram (model, operation)
   - `eventbus_events_total` counter (event_type)
   - `bullmq_jobs_total` counter (queue, status)
   - `bullmq_job_duration_seconds` histogram (queue)
   - `cache_hits_total` / `cache_misses_total` counter
   - Default Node.js metrics (memory, CPU, event loop lag)
3. Add Prisma middleware for query duration tracking
4. Endpoint: `GET /metrics` — Prometheus text format, no auth (internal network)
5. Add to health routes as an alternative detailed view

**Files to create:**
- `packages/backend/src/middleware/metrics.ts`
- `packages/backend/src/infrastructure/metrics/prometheus.ts`

**Files to modify:**
- `packages/backend/src/routes/index.ts` — mount metrics endpoint
- `packages/backend/src/infrastructure/queue/bullmq.config.ts` — add job metrics hooks

### 1.3 Optimistic Locking for Document Tables

**Problem:** Only 4 models have `version` column (InventoryLevel, InventoryLot, DynamicDocumentType, DynamicDocument). Core document tables lack it.

**Implementation:**
1. Prisma migration: add `version Int @default(0)` to 8 models:
   - MRRV (GRN), MIRV (MI), MRV (MRN), RFIM (QCI), OSD (DR), MRF (MR), StockTransfer (WT), JobOrder (JO)
2. Data migration: `UPDATE mrrv SET version = 0 WHERE version IS NULL` for all 8 tables (ensures existing rows have a version)
3. Update `safeStatusUpdate()` in `safe-status-transition.ts`:
   - Add `version` to WHERE clause
   - Increment `version` in data
   - Return new version in response
4. **Rollout strategy (backward-compatible):**
   - Phase A: Add `version` column + data migration. API accepts `version` optionally — if omitted, skip version check (backward compat).
   - Phase B: Frontend updated to send `version` on all updates.
   - Phase C: API enforces `version` as required on PUT/PATCH (409 Conflict on mismatch).
5. ~47 service files reference `safeStatusUpdate` — each needs review to thread `version` parameter.
6. Frontend form hooks: store `version` from GET response, send it back on updates.

**Files to modify:**
- `packages/backend/prisma/schema/` — 4-5 schema files for the 8 models
- New migration file (schema + data migration)
- `packages/backend/src/utils/safe-status-transition.ts`
- All ~47 service files that call `safeStatusUpdate()`
- Frontend form hooks that submit updates

### 1.4 OpenAPI/Swagger Auto-generation

**Implementation:**
1. Install `swagger-jsdoc`, `swagger-ui-express`, `zod-to-openapi`
2. Create `packages/backend/src/config/swagger.ts`:
   - Base spec with server info, auth scheme (Bearer JWT)
   - Auto-register Zod schemas as OpenAPI components
3. Add JSDoc `@openapi` annotations to route handlers
4. Document-factory routes: auto-generate CRUD specs from config
5. Serve at `GET /api-docs` (HTML) and `GET /api-docs.json` (spec)

**Files to create:**
- `packages/backend/src/config/swagger.ts`

**Files to modify:**
- `packages/backend/src/routes/index.ts` — mount swagger UI
- `packages/backend/src/utils/document-factory.ts` — auto-generate OpenAPI annotations

### 1.5 Read Replica Routing

**Implementation:**
1. Create `packages/backend/src/config/database.ts`:
   - `prismaWrite` — primary `PrismaClient` instance (`DATABASE_URL`)
   - `prismaRead` — separate `PrismaClient` instance (`DATABASE_READ_URL`)
   - **Note:** Two separate `PrismaClient` instances are needed (not `$extends`) because `$extends` cannot change the connection URL.
   - Fallback: if no `DATABASE_READ_URL`, `prismaRead = prismaWrite`
2. Route reporting/dashboard/KPI queries through `prismaRead`
3. Keep all mutations on `prismaWrite`

**Files to create:**
- `packages/backend/src/config/database.ts`

**Files to modify:**
- All reporting/dashboard service files — use `prismaRead`
- `packages/backend/src/domains/reporting/services/`

### 1.6 EventBus Monitoring Dashboard

**Problem:** ROADMAP item 3.3 — no real-time view of event flow, consumer lag, processing errors, or retry counts.

**Implementation:**
1. Backend API endpoints (admin-only):
   - `GET /api/v1/system/eventbus/stats` — live stats: events published (last 1h/24h), events per type, error count
   - `GET /api/v1/system/eventbus/errors` — recent failed events with stack traces
   - `GET /api/v1/system/queues/stats` — BullMQ queue stats: waiting, active, completed, failed, delayed per queue
   - `GET /api/v1/system/queues/dlq` — dead-letter queue entries with retry capability
   - `POST /api/v1/system/queues/dlq/:jobId/retry` — retry a DLQ job
2. EventBus instrumentation: add counters in `event-bus.ts` for publish/consume/error tracking (in-memory rolling window)
3. BullMQ: use built-in `Queue.getJobCounts()` and `Queue.getFailed()` for queue stats
4. Frontend: admin-only dashboard page with:
   - Event flow chart (events/minute over time)
   - Queue health cards (one per queue: waiting/active/failed counts)
   - DLQ table with retry buttons
   - Error log with search/filter

**Files to create:**
- `packages/backend/src/domains/system/routes/eventbus-monitor.routes.ts`
- `packages/backend/src/domains/system/services/eventbus-monitor.service.ts`
- `packages/frontend/src/pages/dashboards/EventBusMonitorDashboard.tsx`

**Files to modify:**
- `packages/backend/src/events/event-bus.ts` — add instrumentation counters
- `packages/backend/src/domains/system/index.ts` — register new routes

---

## Stream 2: Frontend Features

### 2.1 Mobile Forms (6 new forms)

**Pattern:** Follow existing MobileGrnReceive/MobileMiIssue/MobileWtTransfer pattern — SwipeableSteps + useOfflineQueue + OfflineQueueBanner.

**New forms:**

| Form | File | Steps |
|------|------|-------|
| MobileMrnRequest | `pages/warehouse/MobileMrnRequest.tsx` | Scan item → Enter qty + reason → Review → Submit |
| MobileQciInspect | `pages/warehouse/MobileQciInspect.tsx` | Scan GRN → Checklist → Pass/Fail per line → Photos → Submit |
| MobileDrReport | `pages/warehouse/MobileDrReport.tsx` | Scan GRN → Select discrepancy type → Qty + photos → Submit |
| MobileMrReturn | `pages/warehouse/MobileMrReturn.tsx` | Scan item → Return reason → Qty → Condition → Submit |
| MobileJoExecute | `pages/warehouse/MobileJoExecute.tsx` | Scan JO → Task checklist → Labor hours → Complete |
| MobileScrapDispose | `pages/warehouse/MobileScrapDispose.tsx` | Scan item → Condition select → Qty → Photos → Submit |

**Shared components:** SwipeableSteps, OfflineQueueBanner, BarcodeScanner (all existing)

### 2.2 SmartGrid Virtual Scrolling + Server-Side Pagination

**Implementation:**
1. Install `@tanstack/react-virtual`
2. Add `serverPagination` prop to SmartGrid:
   - When enabled: sends `page`, `pageSize`, `sortBy`, `sortOrder`, `filters` as query params
   - Receives `{ data, total, page, pageSize }` response
3. Virtual scrolling: auto-enable when `totalRows > 500`
4. Backend: existing `paginate` middleware (already imported in `document-factory.ts`) handles basic pagination. Extend it to support `sortBy`, `sortOrder`, and `filters` query params for server-side sorting/filtering.

**Files to modify:**
- `packages/frontend/src/components/smart-grid/SmartGrid.tsx` — add virtual + server mode
- `packages/frontend/src/components/smart-grid/Pagination.tsx` — server-aware pagination
- `packages/backend/src/middleware/pagination.ts` (or wherever existing `paginate` middleware lives) — extend with sort/filter support

### 2.3 Keyboard Shortcuts System

**Implementation:**
1. `useKeyboardShortcuts` hook — global registry with context scoping
2. Default shortcuts:
   - `Ctrl+N` → New document
   - `Ctrl+S` → Save draft
   - `Ctrl+Enter` → Submit/Approve
   - `/` → Focus search bar
   - `?` → Show shortcut overlay
   - `Escape` → Close modal/panel (existing)
3. `KeyboardShortcutOverlay` component — grouped by context
4. Page-level registration: each page registers its own shortcuts
5. Conflict detection: warn if two shortcuts collide in same context

**Files to create:**
- `packages/frontend/src/hooks/useKeyboardShortcuts.ts`
- `packages/frontend/src/components/KeyboardShortcutOverlay.tsx`

**Files to modify:**
- `packages/frontend/src/layouts/MainLayout.tsx` — mount global shortcuts + overlay trigger

### 2.4 Dashboard Widgets (+4)

| Widget | Implementation |
|--------|---------------|
| GanttWidget | SVG-based horizontal bars on timeline axis. Props: tasks[], dateRange |
| CalendarHeatmapWidget | 52-week grid of day cells, intensity coloring. Props: data[], colorScale |
| PivotTableWidget | Row/column field selectors + aggregation (sum/count/avg). Props: data[], dimensions[], measures[] |
| MapWidget | SVG warehouse zone map with color-coded areas + tooltips. Props: zones[], metrics[] |

**Files to create:**
- `packages/frontend/src/components/dashboard-builder/widgets/GanttWidget.tsx`
- `packages/frontend/src/components/dashboard-builder/widgets/CalendarHeatmapWidget.tsx`
- `packages/frontend/src/components/dashboard-builder/widgets/PivotTableWidget.tsx`
- `packages/frontend/src/components/dashboard-builder/widgets/MapWidget.tsx`

**Files to modify:**
- Dashboard builder widget registry — register new types

### 2.5 Report Template Sharing

**Implementation:**
1. Prisma model: `ReportTemplateShare` — `templateId`, `sharedWithRole`, `sharedById`, `isPublic`
2. API endpoints:
   - `POST /reports/templates/:id/share` — share with roles or make public
   - `GET /reports/templates/shared` — list templates shared with current user's role
   - `DELETE /reports/templates/:id/share` — revoke sharing
3. UI: Share button in ReportTemplateGallery → ShareModal with role selector + public toggle

**Files to create:**
- `packages/frontend/src/components/report-builder/ShareTemplateModal.tsx`

**Files to modify:**
- Prisma schema — add ReportTemplateShare model
- `packages/backend/src/domains/reporting/` — share routes/service
- `packages/frontend/src/components/report-builder/ReportTemplateGallery.tsx`

### 2.6 File Upload for QCI/DR/Scrap

**Implementation:**
1. `FileUploadZone` component — drag & drop, multi-file, preview (images + PDF thumbnails)
2. Props: `entityType`, `entityId`, `maxFiles`, `acceptedTypes`
3. Wire into form configs for QCI (inspection photos), DR (evidence), Scrap (condition photos)
4. Backend: uploads domain already exists — add entity association endpoints
5. Storage: local disk (default) + S3/MinIO adapter via env config

**Files to create:**
- `packages/frontend/src/components/FileUploadZone.tsx`

**Files to modify:**
- QCI form, DR form, Scrap form — add FileUploadZone
- `packages/backend/src/domains/uploads/` — entity association

### 2.7 Customs Tracking Notifications

**Implementation:**
1. EventBus listeners for customs milestones:
   - `customs:clearance_received`
   - `customs:hold_placed`
   - `customs:hold_released`
   - `customs:document_expiring` (7-day, 3-day, 1-day warnings)
2. Scheduled job: check customs document expiry dates daily
3. UI: timeline component in customs detail page showing milestone history

**Files to modify:**
- `packages/backend/src/domains/logistics/` — customs event publishing
- `packages/backend/src/domains/scheduler/jobs/` — customs expiry check job
- `packages/frontend/src/pages/logistics/` — customs timeline UI

---

## Stream 3: Integration & Email

### 3.1 Oracle PO Integration (Read-Only)

**Implementation:**
1. `OraclePOSyncService` — configurable connector:
   - **Option A (recommended):** REST API if Oracle exposes one — simpler deployment, no native driver dependencies
   - Option B: Oracle DB link via `oracledb` driver — requires Oracle Instant Client on the host (platform-specific, deployment prerequisite)
   - Configured via `ORACLE_PO_*` env vars
2. Sync job: every 15 min via BullMQ `RCV_QUEUE`
3. Local mirror table: `PurchaseOrderMirror` (headers) + `PurchaseOrderLineMirror` (lines)
4. GRN creation: validate received qty vs PO qty, warn on over-receipt
5. Reconciliation dashboard: PO vs received vs pending

**Files to create:**
- `packages/backend/src/domains/inbound/services/oracle-po-sync.service.ts`
- Prisma migration for mirror tables

**Files to modify:**
- `packages/backend/src/domains/inbound/services/` — GRN validation against PO
- `packages/backend/src/domains/reporting/` — reconciliation report

### 3.2 HTML Email Templates

**Existing system:** The codebase already has an `EmailTemplate` model with `bodyHtml`, `subject`, and `variables` fields, plus CRUD routes at `email-template.routes.ts`. This implementation builds ON TOP of that system, not replacing it.

**Implementation:**
1. Create 5 default `EmailTemplate` records (seeded via migration or startup script):
   - `document_submission` — document submitted for review
   - `document_approval` — document approved
   - `document_rejection` — document rejected with reason
   - `sla_breach` — SLA deadline missed
   - `escalation` — auto-escalated to higher authority
2. Each template uses the existing `bodyHtml` field with Handlebars-style `{{variable}}` placeholders
3. Add template rendering service that resolves variables from event payload
4. Per-organization customization: add `orgLogoUrl`, `orgPrimaryColor`, `orgFooterText` to Settings model
5. Preview API: `GET /api/v1/email-templates/:name/preview` — render with sample data
6. Wire into existing chain-notification-handler: on document events, look up template by name, render, and send

**Files to create:**
- `packages/backend/src/domains/notifications/services/email-renderer.service.ts` — template variable resolution + HTML rendering

**Files to modify:**
- `packages/backend/src/events/chain-notification-handler.ts` — use email renderer
- `packages/backend/src/domains/system/` — org settings for template customization
- Prisma seed/migration — insert 5 default templates

### 3.3 Reorder Point UI

**Implementation:**
1. Backend: `reorder_update` job already calculates — expose via API
   - `GET /api/v1/inventory/reorder-suggestions` — list items needing reorder
   - `POST /api/v1/inventory/reorder-suggestions/:itemId/apply` — apply suggestion
2. Frontend: Reorder dashboard widget + settings page
   - Widget: items below reorder point, suggested order qty
   - Settings: safety stock multiplier, lead time per item/category

**Files to modify:**
- `packages/backend/src/domains/inventory/` — reorder suggestion endpoints
- `packages/frontend/src/pages/warehouse/` or dashboard — reorder widget

### 3.4 Scheduled Reports UI

**Existing system:** The `SavedReport` model already has `scheduleFrequency`, `lastRunAt`, and `nextRunAt` fields. The `runScheduledReports` function in maintenance-jobs.ts already processes scheduled reports. This implementation adds the user-facing UI on top.

**Implementation:**
1. Backend: extend existing `SavedReport` endpoints:
   - `PATCH /api/v1/reports/:id/schedule` — set schedule (frequency, recipients, format)
   - `GET /api/v1/reports/:id/schedule/history` — past runs + download links
   - Add `recipientEmails` and `exportFormat` fields to `SavedReport` model (if not already present)
2. Frontend: `ReportScheduleModal` — frequency picker (daily/weekly/monthly) + recipient list + format (PDF/Excel)
3. Enhance `runScheduledReports` job: generate report + send via email to recipients

**Files to create:**
- `packages/frontend/src/components/report-builder/ReportScheduleModal.tsx`

**Files to modify:**
- Prisma schema — extend `SavedReport` with `recipientEmails`, `exportFormat` if needed
- `packages/backend/src/domains/reporting/` — schedule endpoints on existing report routes
- `packages/backend/src/domains/scheduler/jobs/maintenance-jobs.ts` — enhance runScheduledReports
- `packages/frontend/src/components/report-builder/` — schedule button

---

## Stream 4: DevOps & Config

### 4.1 CDN Configuration

**Implementation:**
1. Vite config: `base` URL from `VITE_CDN_URL` env var (default: `/`)
2. Build output: already uses content hashing (`[name].[hash].js`)
3. Express static middleware: add cache headers for hashed assets:
   - `Cache-Control: public, max-age=31536000, immutable` for `*.js`, `*.css` with hash
   - `Cache-Control: no-cache` for `index.html`
4. Document exports: add `Content-Disposition` + CDN-friendly headers to download endpoints

**Files to modify:**
- `packages/frontend/vite.config.ts` — dynamic base URL
- `packages/backend/src/` — static file serving headers

---

## Execution Order

```
Wave 1 (parallel — no dependencies):
  Stream 1.1: requirePermission wiring
  Stream 1.3: Optimistic locking migration (Phase A only — add column + data migration)
  Stream 2.3: Keyboard shortcuts
  Stream 4.1: CDN config

Wave 2 (parallel — after Stream 1.3 migration completes):
  Stream 1.2: Prometheus metrics
  Stream 1.4: OpenAPI/Swagger
  Stream 1.6: EventBus monitoring dashboard
  Stream 2.1: 6 mobile forms
  Stream 2.4: 4 dashboard widgets
  Stream 3.2: HTML email templates (build on existing EmailTemplate model)

Wave 3 (parallel):
  Stream 1.3 Phase B+C: Optimistic locking enforcement (frontend + API)
  Stream 2.2: SmartGrid virtual scrolling + server pagination
  Stream 2.5: Report template sharing
  Stream 2.6: File upload QCI/DR/Scrap
  Stream 2.7: Customs tracking
  Stream 3.3: Reorder point UI
  Stream 3.4: Scheduled reports UI (build on existing SavedReport model)

Wave 4 (depends on external infra):
  Stream 1.5: Read replica routing
  Stream 3.1: Oracle PO integration
