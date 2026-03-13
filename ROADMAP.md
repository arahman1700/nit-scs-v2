# NIT Supply Chain V2 — Roadmap

> System baseline: 123 Prisma models, 250+ API endpoints, 105+ frontend pages, 10 user roles, 1,812+ tests.
> Audit score: **100/100** — All items complete.

---

## Phase 1 — Security Hardening

**Priority: Critical | Status: Complete**

- [x] **Enforce `requirePermission` middleware on all routes.** Permissions are defined in `shared/permissions.ts` (10 roles x 43 resources) and wired into every router via `requirePermission`. Document-factory routes use resource-based RBAC; non-factory routes migrated from `requireRole`. Fail-closed fallback returns 403.
- [x] **Add Redis connection monitoring with graceful degradation.** Health checks, reconnection logic, and fallback strategy implemented.
- [x] **Add rate limiting to authentication endpoints.** Per-endpoint rate limits on `/auth/login`, `/auth/refresh`, `/auth/forgot-password`.
- [x] **Add CSRF protection for state-changing operations.** Double-submit cookie pattern on POST/PUT/DELETE routes.
- [x] **Security audit of `$queryRawUnsafe` in AI-generated SQL.** Parameterized query enforcement and read-only DB user for AI queries.

---

## Phase 2 — Data Integrity & Consistency

**Priority: High | Status: Complete**

- [x] **Wire remaining V1 to V2 route aliases.** All routes migrated to V2 services with EventBus integration.
- [x] **Add database-level CHECK constraints.** Migrations with CHECK constraints on status, condition, and type columns.
- [x] **Add optimistic locking for concurrent document edits.** `version Int @default(0)` on 8 document tables (GRN, MI, MRN, QCI, DR, MR, WT, JO). Phase A: columns added. Phase B: `current.version` threaded through all `safeStatusUpdate` calls. Phase C: `version` required on document-factory PUT. Frontend 409 conflict handling in `useFormSubmit`.
- [x] **Complete Decimal migration for remaining Float fields.** All monetary/quantity fields use `Decimal`.

---

## Phase 3 — Observability & Monitoring

**Priority: High | Status: Complete**

- [x] **Add structured logging with correlation IDs.** JSON-structured logs with correlation ID propagation through EventBus and async handlers.
- [x] **Add performance metrics collection.** Prometheus metrics at `/metrics` — HTTP response times, DB query durations, EventBus processing latency, BullMQ queue depths.
- [x] **Add EventBus monitoring dashboard.** Real-time view at `/api/v1/system/monitor` with queue stats, consumer lag, and DLQ visibility.
- [x] **Add SLA tracking automation.** Scheduled job checks pending documents against SLA thresholds, triggers escalation notifications.
- [x] **Add dead-letter queue for failed EventBus handlers.** BullMQ DLQ with retry capability and alerting.

---

## Phase 4 — Mobile & UX Improvements

**Priority: Medium | Status: Complete**

- [x] **Complete mobile-optimized views for all document forms.** 6 mobile forms added: MRN, QCI, DR, MR, JO, Scrap — all with offline support via `useOfflineQueue`.
- [x] **Integrate offline form submission queue.** `useOfflineQueue` wired into all mobile document forms with `OfflineQueueBanner` and `SyncStatusIndicator`.
- [x] **Add barcode scanning for inventory operations.** `BarcodeScanner` integrated into receiving, picking, stock count, and transfer workflows.
- [x] **Implement progressive loading for large data tables.** SmartGrid enhanced with `@tanstack/react-virtual` for virtual scrolling (500+ rows) and `serverPagination` prop for server-side pagination/sorting/filtering.
- [x] **Add keyboard shortcuts for power users.** `?` opens shortcut overlay, `/` focuses search. `useKeyboardShortcuts` hook + `KeyboardShortcutOverlay` component in MainLayout.

---

## Phase 5 — Feature Completion

**Priority: Medium | Status: Complete**

- [x] **Add form configs for remaining standalone modules.** Generator registration and Tool Issue added to `formConfigs.ts`.
- [x] **Add document attachment/file upload for QCI, DR, and Scrap modules.** `FileUploadZone` component with drag-and-drop, multi-file, preview — wired into ScrapForm, MobileQciInspect, MobileDrReport, MobileScrapDispose.
- [x] **Add bulk operations UI.** Selection checkboxes in SmartGrid with floating action bar for bulk approve/status/export.
- [x] **Expand dashboard builder widget library.** 4 new widgets: Gantt chart, Calendar Heatmap, Pivot Table, Zone Map — registered in `WidgetWrapper` and `WidgetPalette`.
- [x] **Add report builder template sharing.** `sharedWithRoles` field on SavedReport, share/unshare API endpoints, `ShareTemplateModal` component, `/shared` reports listing.
- [x] **Complete customs tracking workflow.** EventBus publishing on customs status changes, `customs_expiry` scheduled job (24h interval, 7/3/1 day warnings), `CustomsTimeline` component.

---

## Phase 6 — Integration & Automation

**Priority: Medium | Status: Complete**

- [x] **Oracle PO integration (read-only).** `PurchaseOrderMirror`/`PurchaseOrderLineMirror` Prisma models, `oracle-po-sync.service.ts` with 15-minute sync job, PO validation in GRN creation (`validateGrnAgainstPO`), PO routes (list/detail/reconciliation/sync), `PurchaseOrderReconciliation` frontend page.
- [x] **Email notification templates for all document workflows.** 5 Nesma-branded HTML email templates (submission, approval, rejection, SLA breach, escalation) with variable rendering via `email-renderer.service.ts`.
- [x] **Automated reorder point calculations.** `reorder-suggestions` API endpoints, `ReorderSuggestionsWidget` dashboard widget, `useReorderSuggestions` hook.
- [x] **Scheduled reports via cron.** `PATCH /:id/schedule` endpoint with frequency picker (daily/weekly/monthly/quarterly), `ReportScheduleModal` component, `useScheduleReport` mutation hook.
- [x] **API documentation generation.** OpenAPI/Swagger specs auto-generated at `/api-docs` via `swagger-jsdoc` + `swagger-ui-express`.

---

## Phase 7 — Performance & Scale

**Priority: Low | Status: Complete**

- [x] **Add read replicas for reporting queries.** `prismaRead` client in `prisma.ts` pointing to `DATABASE_READ_URL` with soft-delete extension. All 8 reporting services use `prismaRead` for read-only queries.
- [x] **Implement materialized views for dashboard KPIs.** Pre-computed aggregations for stock valuations, pending counts, SLA compliance rates.
- [x] **Add WebSocket room-based subscriptions.** Socket.IO room subscriptions so clients only receive events for their active page/document.
- [x] **Complete lazy-loaded route code splitting.** All page-level components use `React.lazy` with dynamic imports.
- [x] **Add CDN for static assets and document exports.** `VITE_CDN_URL` base URL config, immutable cache headers for `/assets` (1 year), no-cache for `index.html`.

---

## Tracking

| Phase                  | Status   | Score Impact |
| ---------------------- | -------- | ------------ |
| 1 — Security Hardening | Complete | +10          |
| 2 — Data Integrity     | Complete | +6           |
| 3 — Observability      | Complete | +5           |
| 4 — Mobile & UX        | Complete | +3           |
| 5 — Feature Completion | Complete | +2           |
| 6 — Integration        | Complete | +2           |
| 7 — Performance        | Complete | +1           |

**Total: 100/100** — All 35 roadmap items implemented across 7 phases.
