# NIT Supply Chain V2 — Roadmap

> System baseline: 123 Prisma models, 250+ API endpoints, 105+ frontend pages, 10 user roles, 1,812+ tests.
> Audit score: **71/100**. This roadmap addresses the remaining 29 points.

---

## Phase 1 — Security Hardening

**Priority: Critical | Target: Sprint 1-2**

- [ ] **Enforce `requirePermission` middleware on all routes.** Permissions are defined in `shared/permissions.ts` (10 roles x 43 resources) but never applied at the route level. Wire the middleware into every router — no route should be accessible without an explicit permission check.
- [ ] **Add Redis connection monitoring with graceful degradation.** The token blacklist currently fails open when Redis is unavailable. Add health checks, reconnection logic, and a fallback strategy (e.g., short-lived JWT expiry) so auth doesn't silently degrade.
- [ ] **Add rate limiting to authentication endpoints.** There's a global rate limit but nothing specific to `/auth/login`, `/auth/refresh`, or `/auth/forgot-password`. Add per-endpoint limits to prevent brute-force attacks.
- [ ] **Add CSRF protection for state-changing operations.** All POST/PUT/DELETE routes need CSRF tokens. Implement via `csurf` or double-submit cookie pattern.
- [ ] **Security audit of `$queryRawUnsafe` in AI-generated SQL.** Currently feature-flagged and admin-only, but raw SQL from LLM output is a high-risk surface. Add parameterized query enforcement, query allowlisting, or a read-only DB user for AI queries.

**Done when:** Every route has permission checks, Redis failure doesn't bypass auth, and auth endpoints resist brute-force.

---

## Phase 2 — Data Integrity & Consistency

**Priority: High | Target: Sprint 3-4**

- [ ] **Wire remaining V1 to V2 route aliases.** `mr.routes.ts` and `dr.routes.ts` still call V1 services directly. Migrate to `mr.service` and `dr.service` respectively — the V2 services are functionally identical but include EventBus integration for real-time updates.
- [ ] **Add database-level CHECK constraints.** The Prisma schema has comments indicating valid status and condition enums, but no actual DB constraints enforce them. Add migrations for CHECK constraints on status, condition, and type columns.
- [ ] **Add optimistic locking for concurrent document edits.** Add a `version` column to all document tables (GRN, MI, MRN, QCI, DR, MR, WT, JO). Reject updates where the version doesn't match, return a conflict response to the client.
- [ ] **Complete Decimal migration for remaining Float fields.** Audit all Prisma models for `Float` fields that represent monetary values or quantities. Migrate any remaining ones to `Decimal` to avoid floating-point rounding errors.

**Done when:** All services use V2 EventBus-integrated code, enum values are enforced at the DB level, and concurrent edits are safely handled.

---

## Phase 3 — Observability & Monitoring

**Priority: High | Target: Sprint 5-6**

- [ ] **Add structured logging with correlation IDs.** Generate a correlation ID per request, propagate it through EventBus consumers and async handlers. Use JSON-structured log output for machine parsing.
- [ ] **Add performance metrics collection.** Track response times, DB query durations, cache hit/miss rates, and EventBus processing latency. Expose via `/metrics` endpoint (Prometheus-compatible).
- [ ] **Add EventBus monitoring dashboard.** Build a real-time view of event flow: published events, consumer lag, processing errors, and retry counts.
- [ ] **Add SLA tracking automation.** `SLA_HOURS` constants are defined but nothing enforces them. Add a scheduled job that checks pending documents against SLA thresholds and triggers escalation notifications.
- [ ] **Add dead-letter queue for failed EventBus handlers.** Failed events currently log and disappear. Persist them to a dead-letter table with retry capability and alerting.

**Done when:** Every request is traceable end-to-end, performance bottlenecks are visible, and failed events don't silently vanish.

---

## Phase 4 — Mobile & UX Improvements

**Priority: Medium | Target: Sprint 7-9**

- [ ] **Complete mobile-optimized views for all document forms.** Currently only GRN, MI, and WT have mobile layouts. Add responsive form layouts for MRN, QCI, DR, MR, JO, and Scrap forms.
- [ ] **Integrate offline form submission queue.** The `useOfflineQueue` hook exists but isn't connected to most forms. Wire it into all document creation/edit flows so field users can work without connectivity.
- [ ] **Add barcode scanning for inventory operations.** Integrate the `BarcodeScanner` component (already lazy-loadable) into receiving, picking, stock count, and transfer workflows.
- [ ] **Implement progressive loading for large data tables.** Enable AG Grid virtual row model for tables with 1,000+ rows. Add server-side pagination, sorting, and filtering for all SmartGrid instances.
- [ ] **Add keyboard shortcuts for power users.** Common actions: `Ctrl+N` (new document), `Ctrl+S` (save), `Ctrl+Enter` (submit/approve), `/` (focus search). Add a shortcut help overlay.

**Done when:** All forms work on mobile, offline submission is reliable, and warehouse staff can scan barcodes natively.

---

## Phase 5 — Feature Completion

**Priority: Medium | Target: Sprint 10-12**

- [ ] **Add form configs for remaining standalone modules.** Generator registration and Tool Issue are missing from `formConfigs.ts`. Add configs so they use the standard `useDocumentForm` pattern.
- [ ] **Add document attachment/file upload for QCI, DR, and Scrap modules.** These workflows require supporting evidence (photos, inspection reports). Add file upload with preview, stored in object storage.
- [ ] **Add bulk operations UI.** Bulk approve, bulk status change, and bulk export for document lists. Add selection checkboxes to SmartGrid with a floating action bar.
- [ ] **Expand dashboard builder widget library.** Currently 8 widget types. Add: Gantt chart, calendar heatmap, pivot table, and map/location widgets.
- [ ] **Add report builder template sharing.** Allow users to save report configurations and share them with team members or roles.
- [ ] **Complete customs tracking workflow.** Add automated notifications for customs clearance milestones, document expiry warnings, and hold/release status changes.

**Done when:** All modules have full form support, users can attach files to inspections, and bulk operations reduce repetitive work.

---

## Phase 6 — Integration & Automation

**Priority: Medium | Target: Sprint 13-15**

- [ ] **Oracle PO integration (read-only).** Sync purchase order data for validation during GRN creation. Read-only — no writes back to Oracle. Add reconciliation reports for PO vs. received quantities.
- [ ] **Email notification templates for all document workflows.** Create HTML email templates for: submission, approval, rejection, SLA breach, and escalation. Make templates configurable per organization.
- [ ] **Automated reorder point calculations.** Analyze consumption history to suggest min/max stock levels and reorder points. Surface recommendations in the warehouse dashboard.
- [ ] **Scheduled reports via cron.** Allow users to schedule daily, weekly, or monthly report generation. Deliver via email or store in the reports archive.
- [ ] **API documentation generation.** Auto-generate OpenAPI/Swagger specs from Express route definitions. Serve interactive docs at `/api-docs`.

**Done when:** PO data flows in from Oracle, stakeholders get email notifications without manual follow-up, and the API is self-documenting.

---

## Phase 7 — Performance & Scale

**Priority: Low (until load demands it) | Target: Sprint 16-18**

- [ ] **Add read replicas for reporting queries.** Route dashboard KPI queries and report generation to read replicas. Keep transactional writes on the primary.
- [ ] **Implement materialized views for dashboard KPIs.** Pre-compute expensive aggregations (stock valuations, pending counts, SLA compliance rates) on a schedule instead of computing on every page load.
- [ ] **Add WebSocket room-based subscriptions.** Currently Socket.IO broadcasts to all connected clients. Implement room subscriptions so clients only receive events for their active page/document.
- [ ] **Complete lazy-loaded route code splitting.** Partially done with `React.lazy`. Audit all routes and ensure every page-level component is dynamically imported. Target initial bundle under 200KB gzipped.
- [ ] **Add CDN for static assets and document exports.** Serve JS/CSS bundles, images, and generated PDFs/Excel files from a CDN. Add cache headers and content hashing.

**Done when:** Dashboard loads are under 500ms at scale, WebSocket traffic is proportional to what users actually view, and the frontend bundle is lean.

---

## Tracking

| Phase                  | Status      | Score Impact (est.) |
| ---------------------- | ----------- | ------------------- |
| 1 — Security Hardening | Not started | +10                 |
| 2 — Data Integrity     | Not started | +6                  |
| 3 — Observability      | Not started | +5                  |
| 4 — Mobile & UX        | Not started | +3                  |
| 5 — Feature Completion | Not started | +2                  |
| 6 — Integration        | Not started | +2                  |
| 7 — Performance        | Not started | +1                  |

Phases 1-2 are blockers for production. Phases 3-5 are required for operational readiness. Phases 6-7 are scaling concerns.
