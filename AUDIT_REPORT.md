# NIT Supply Chain V2 — Comprehensive System Audit Report

**Date:** February 22, 2026
**Auditor:** Senior Architect Review (Sessions 1-4)
**Scope:** Full Stack — Backend, Frontend, Database, Security, Mobile UX

---

## Executive Summary

| Dimension               | Score      | Grade  |
| ----------------------- | ---------- | ------ |
| Architecture & Patterns | 82/100     | A-     |
| Feature Completeness    | 71/100     | B-     |
| Code Quality            | 68/100     | C+     |
| Security                | 62/100     | D+     |
| Mobile & UX             | 65/100     | C      |
| Database Design         | 74/100     | B      |
| Test Coverage           | 78/100     | B+     |
| **Overall**             | **71/100** | **B-** |

### Key Strengths

1. Factory patterns (`createCrudRouter`, `createDocumentRouter`) eliminate boilerplate across 49 route definitions
2. Shared state machine (`TRANSITION_MAP`) covers 18 document types with frozen immutable transitions
3. FIFO inventory with optimistic locking (`version` field) prevents race conditions
4. Comprehensive RBAC matrix (10 roles x 43 resources) defined in shared package
5. Redis-backed rate limiting, token blacklist, scheduler locks, and cache-aside pattern
6. 1,800+ passing tests across backend, frontend, and shared packages
7. Well-designed event-driven architecture with SystemEventBus + rule engine

### Critical Issues (Must Fix Before Production)

1. **Auth middleware race condition** — async blacklist check without await (`auth.ts:32-51`)
2. **Employee passwordHash exposed in API** — CRUD factory returns all columns (`master-data.routes.ts:127`)
3. **V1/V2 route mismatch** — 4 V2 routes delegate to V1 services, losing EventBus + features
4. **RBAC matrix defined but not enforced** — `requirePermission` middleware exists but is never used
5. **$queryRawUnsafe with AI-generated SQL** — regex validation bypassable (`ai-chat.service.ts:163`)
6. **surplus.service.ts:145-203** — multi-table writes without transaction

---

## Module Completeness Matrix

| #   | Module        | Backend | Frontend | Tests | State Machine | EventBus | Issues                                                          |
| --- | ------------- | ------- | -------- | ----- | ------------- | -------- | --------------------------------------------------------------- |
| 1   | **GRN**       | YES     | YES      | YES   | YES           | YES      | None                                                            |
| 2   | **MI**        | YES     | YES      | YES   | YES           | PARTIAL  | mirv.service lacks events                                       |
| 3   | **MRN**       | YES     | YES      | YES   | YES           | PARTIAL  | Route uses V1 mrv.service (no events, no blocked lots)          |
| 4   | **MR**        | YES     | YES      | YES   | PARTIAL       | PARTIAL  | Route uses V1 mrf.service; fulfill/reject skip assertTransition |
| 5   | **WT**        | YES     | YES      | YES   | YES           | YES      | Deprecated wt.service.ts still exists                           |
| 6   | **Gate Pass** | YES     | YES      | YES   | YES           | YES      | None                                                            |
| 7   | **Shipment**  | YES     | YES      | YES   | NO            | PARTIAL  | Manual status checks; events only on deliver                    |
| 8   | **QCI**       | YES     | YES      | YES   | YES           | PARTIAL  | Route uses V1 rfim.service (no events, no conditional flow)     |
| 9   | **DR**        | YES     | YES      | YES   | NO            | NO       | Neither service enforces state machine or emits events          |
| 10  | **Job Order** | YES     | YES      | YES   | YES           | YES      | None — most complete module                                     |
| 11  | **Generator** | YES     | YES      | YES   | PARTIAL       | NO       | No standalone form config; no events                            |
| 12  | **Scrap**     | YES     | YES      | YES   | YES           | NO       | 9 status transitions, zero events                               |
| 13  | **Tools**     | YES     | YES      | YES   | PARTIAL       | NO       | No form config; no validateTool validator                       |

### V1/V2 Route Mismatch (Critical)

| V2 Route        | Currently Imports      | Should Import         | Features Lost                                                     |
| --------------- | ---------------------- | --------------------- | ----------------------------------------------------------------- |
| `mrn.routes.ts` | `mrv.service.ts` (V1)  | `mrn.service.ts` (V2) | EventBus events, blocked-lot logic for damaged returns            |
| `qci.routes.ts` | `rfim.service.ts` (V1) | `qci.service.ts` (V2) | EventBus events, conditional completion, PM approval auto-advance |
| `dr.routes.ts`  | `osd.service.ts` (V1)  | `dr.service.ts` (V2)  | Both identical; neither has events                                |
| `mr.routes.ts`  | `mrf.service.ts` (V1)  | `mr.service.ts` (V2)  | Functionally identical                                            |

---

## Critical Issues (Must Fix)

### C1. Auth Middleware Race Condition

**File:** `packages/backend/src/middleware/auth.ts:32-51`
**Problem:** `authenticate()` is synchronous but calls async `isTokenBlacklisted()` via `.then()/.catch()`. Express considers the middleware done when it returns synchronously. The `next()` call fires asynchronously inside the `.then()`.
**Impact:** Timing window where request proceeds without `req.user`; revoked tokens accepted when Redis is down.
**Fix:** Convert to `async/await`.

### C2. Employee passwordHash Exposed in API

**File:** `packages/backend/src/routes/master-data.routes.ts:127` via `packages/backend/src/utils/crud-factory.ts:125-134`
**Problem:** The Employee CRUD factory returns all model columns via `findMany`/`findUnique` — no `select` or `omit` clause. The Employee model contains `passwordHash`.
**Impact:** `GET /api/v1/employees` and `GET /api/v1/employees/:id` expose password hashes to any authenticated user.
**Fix:** Add `omit: { passwordHash: true }` to the CRUD factory config or use a select clause.

### C3. RBAC Matrix Defined but Unenforced

**File:** `packages/shared/src/permissions.ts` defines 10 roles x 43 resources x 6 permissions. `packages/backend/src/middleware/rbac.ts:30` has `requirePermission()` middleware.
**Problem:** `requirePermission` is never imported or used in any route file. All route-level auth uses the coarser `requireRole()`.
**Impact:** Fine-grained permissions (create/read/update/delete/approve/export per resource) are ignored.

### C4. $queryRawUnsafe with AI-Generated SQL

**File:** `packages/backend/src/modules/ai/ai-chat.service.ts:163`
**Problem:** Executes LLM-generated SQL via `$queryRawUnsafe(query)`. Mitigated by read-only transaction + regex validation + feature flag, but regex validation is bypassable.
**Impact:** Potential data exfiltration of sensitive tables (employees, tokens).

### C5. Surplus Service Transaction Gap

**File:** `packages/backend/src/services/surplus.service.ts:145-203`
**Problem:** `action()` creates WT or MRN in one table, then updates surplus status in another — 3 separate non-transactional writes.
**Impact:** If status update fails after WT/MRN creation, orphaned documents.

### C6. ASN Service Data Corruption Bug

**File:** `packages/backend/src/services/asn.service.ts:254`
**Problem:** `uomId: line.itemId` assigns itemId to uomId field.
**Impact:** Wrong UOM on received ASN lines — data corruption.

---

## Security Findings

| #   | Severity | Finding                                                             | File:Line                              |
| --- | -------- | ------------------------------------------------------------------- | -------------------------------------- |
| S1  | CRITICAL | Auth race condition (async without await)                           | `middleware/auth.ts:32-51`             |
| S2  | CRITICAL | Employee passwordHash in API responses                              | `routes/master-data.routes.ts:127`     |
| S3  | HIGH     | `requirePermission` defined but never used — RBAC matrix unenforced | `middleware/rbac.ts:30`                |
| S4  | HIGH     | `$queryRawUnsafe` with AI-generated SQL                             | `modules/ai/ai-chat.service.ts:163`    |
| S5  | MEDIUM   | Swagger docs exposed without auth at `/api/docs`                    | `index.ts:74-84`                       |
| S6  | MEDIUM   | Refresh tokens stored unhashed in database                          | `services/auth.service.ts:88-94`       |
| S7  | MEDIUM   | Webhook endpoint unverified in dev mode                             | `routes/email-webhook.routes.ts:55-62` |
| S8  | LOW      | Revoked tokens accepted when Redis is down                          | `middleware/auth.ts:44-50`             |
| S9  | LOW      | Legacy tokens without `jti` bypass blacklist                        | `middleware/auth.ts:52-57`             |

---

## Performance Bottlenecks

### Missing Database Indexes

Only 2 of 123 models have `deletedAt` (soft delete). 177 indexes exist but several FK columns lack indexes:

| Model          | Missing Index On                                                   | Query Impact                   |
| -------------- | ------------------------------------------------------------------ | ------------------------------ |
| `Mrrv`         | `projectId`, `receivedById`, `qcInspectorId`                       | GRN list by project            |
| `Osd`          | `supplierId`, `warehouseId`, `resolvedById`                        | DR filtering                   |
| `Mrv`          | `fromWarehouseId`, `toWarehouseId`, `returnedById`, `receivedById` | MRN filtering                  |
| `GatePass`     | `mirvId`, `projectId`, `issuedById`                                | Gate pass lookups              |
| `Mrf`          | `warehouseId`, `reviewedById`, `approvedById`                      | MR filtering                   |
| `JobOrder`     | `entityId`, `supplierId`, `assignedToId`, `approvedById`           | JO filtering                   |
| `Shipment`     | `supplierId`, `portOfEntryId`, `forwarderId`                       | Shipment filtering             |
| `InventoryLot` | `warehouseId`, `itemId`, `status`                                  | Stock queries (high frequency) |

### Float vs Decimal

12 fields use `Float` instead of `Decimal` — precision loss risk for inventory quantities:

| Model               | Fields                                                        |
| ------------------- | ------------------------------------------------------------- |
| `CycleCountLine`    | `expectedQty`, `countedQty`, `varianceQty`, `variancePercent` |
| `StagingAssignment` | `quantity`                                                    |
| `PackingLine`       | `qtyPacked`, `weight`, `volume`                               |
| `PackingOrder`      | `totalWeight`, `totalVolume`                                  |
| `PutAwayRule`       | `maxWeight`                                                   |
| `LaborStandard`     | `standardMinutes`                                             |

---

## Mobile & UX Issues

| #   | Severity | Issue                                                                       | File                                                       |
| --- | -------- | --------------------------------------------------------------------------- | ---------------------------------------------------------- |
| U1  | HIGH     | `htmlFor` missing globally — only 2 of 77+ components use it (WCAG failure) | All form components                                        |
| U2  | HIGH     | Icon-only action buttons (View/Edit/Delete) lack `aria-label`               | `AdminResourceList.tsx:618-671`                            |
| U3  | HIGH     | Silent form failures in HandoverForm + ToolForm — no `onError`, no toast    | `HandoverForm.tsx`, `ToolForm.tsx`                         |
| U4  | MEDIUM   | Mobile search button is non-functional (dead `<Search>` icon)               | `Header.tsx:78`                                            |
| U5  | MEDIUM   | No sticky submit buttons on long forms                                      | `ResourceForm.tsx`, `HandoverForm.tsx`, `ToolForm.tsx`     |
| U6  | MEDIUM   | No toast feedback on form create/update in 3 form components                | `HandoverForm.tsx`, `ToolForm.tsx`, `ResourceForm.tsx`     |
| U7  | MEDIUM   | NotificationCenter dropdown overflows on screens < 400px                    | `NotificationCenter.tsx:103`                               |
| U8  | MEDIUM   | Unstyled error states in 3 dashboards                                       | `WarehouseDashboard.tsx:204`, `TransportDashboard.tsx:555` |
| U9  | LOW      | FAB button in SectionLandingPage lacks `aria-label`                         | `SectionLandingPage.tsx:147-153`                           |
| U10 | LOW      | Toast container may overlap header on mobile                                | `Toaster.tsx:108`                                          |

---

## Enterprise Gap Analysis (vs Oracle SCM / SAP MM)

| Feature                      | Oracle SCM | SAP MM | NIT V2  | Gap                                           |
| ---------------------------- | ---------- | ------ | ------- | --------------------------------------------- |
| Multi-level BOM              | YES        | YES    | NO      | No bill of materials                          |
| Lot/Serial tracking          | YES        | YES    | PARTIAL | Lots exist but no serial numbers              |
| Multi-currency               | YES        | YES    | NO      | Single currency only                          |
| Vendor performance scoring   | YES        | YES    | NO      | No supplier KPIs                              |
| Demand planning (MRP)        | YES        | YES    | PARTIAL | Basic forecast, no MRP run                    |
| Quality management (QM)      | YES        | YES    | PARTIAL | QCI exists but no statistical process control |
| Cost center tracking         | YES        | YES    | NO      | No cost center on movements                   |
| Document versioning          | YES        | YES    | NO      | No version history on documents               |
| Batch/serial recall          | YES        | YES    | NO      | No recall workflow                            |
| Physical inventory valuation | YES        | YES    | NO      | No FIFO/LIFO/weighted avg costing             |
| Goods in transit accounting  | YES        | YES    | NO      | No GIT tracking                               |
| Returns management (RMA)     | YES        | YES    | PARTIAL | MRN exists but no RMA workflow                |
| Consignment stock            | YES        | YES    | NO      | No consignment tracking                       |
| Blanket POs / contracts      | YES        | YES    | NO      | POs handled by Oracle externally              |

---

## Architecture Strengths (Detailed)

### Middleware Chain (Correct Order)

1. Sentry instrumentation (must be first)
2. helmet() — security headers
3. CORS — cross-origin
4. express.json() — body parsing (with raw body bypass for webhooks)
5. compression() — gzip
6. cookieParser() — refresh token cookie
7. sanitizeInput() — XSS prevention
8. requestId — correlation
9. requestLogger — structured logging
10. rateLimiter — 200 req/min per IP
11. Routes
12. Sentry error handler
13. Custom error handler (must be last)

### Factory Coverage

- **`createCrudRouter`**: 24 invocations (17 master-data + 7 standalone)
- **`createDocumentRouter`**: 25 invocations (7 V2 primary + 7 V1 compat + 11 new modules)
- **Custom routes**: ~52 files (auth, dashboards, settings — appropriate)

### Event Bus Architecture

- Singleton `SystemEventBus` extending Node.js `EventEmitter`
- Zod validation on every event (warns but publishes on malformed)
- Dual emission: specific type + wildcard `'*'`
- 2 consumers: Rule Engine (wildcard) + Chain Notification Handler (specific types)
- 15 services emit events; 12 services do NOT (gap)

### Redis Usage (4 patterns)

1. Rate limiting — Lua script atomic INCR+EXPIRE (in-memory fallback)
2. Token blacklist — SETEX with JWT TTL (fails open without Redis)
3. Cache-aside — GET/SETEX with configurable TTL per data type
4. Scheduler locks — SET NX EX prevents duplicate cron jobs

---

## Recommendations (Priority Order)

### P0 — Critical (This Sprint)

1. Fix auth.ts race condition (async/await)
2. Exclude passwordHash from employee CRUD responses
3. Switch QCI routes to qci.service.ts (gains conditional flow + PM approval)
4. Switch MRN routes to mrn.service.ts (gains blocked lots + events)
5. Fix ASN uomId bug
6. Wrap surplus.service.ts action() in transaction

### P1 — High (Next Sprint)

7. Add EventBus events to 8 services (MI, DR, Scrap, Generator, Tools, Shipment, Handover, Rental)
8. Add assertTransition to Shipment and DR services
9. Add missing Prisma indexes (30+ FK columns)
10. Convert Float to Decimal in CycleCountLine, Staging, Packing models
11. Add htmlFor/id to FormFieldRenderer (fixes all forms at once)
12. Add aria-label to AdminResourceList action buttons

### P2 — Medium (Backlog)

13. Enforce requirePermission middleware on routes (RBAC matrix)
14. Hash refresh tokens before DB storage
15. Gate Swagger docs behind auth in production
16. Add toast feedback to HandoverForm, ToolForm
17. Fix mobile search button in Header.tsx
18. Add sticky submit bar to forms
19. Remove deprecated wt.service.ts
20. Add form configs for Generator and Tools modules
21. Add validateTool shared validator
