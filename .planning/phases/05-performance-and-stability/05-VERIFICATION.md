---
phase: 05-performance-and-stability
verified: 2026-03-22T02:15:00Z
status: gaps_found
score: 13/14 must-haves verified
re_verification: false
gaps:
  - truth: "PERF-02: InventoryLot queries by (supplierId, expiryDate) use a composite index scan"
    status: failed
    reason: "REQUIREMENTS.md claims a combined InventoryLot(supplierId, expiryDate) composite index was added, but the schema only has separate (supplierId, receiptDate) and (expiryDate, status) indexes. The plan's must_haves did not include this index, and it was never added in Phase 05."
    artifacts:
      - path: "packages/backend/prisma/schema/06-inventory.prisma"
        issue: "No @@index([supplierId, expiryDate]) exists on InventoryLot model. Phase 05 only added idx_mtl_onhand_movement_date on InventoryLevel."
    missing:
      - "Add @@index([supplierId, expiryDate(sort: Asc)], map: \"idx_mtl_lots_supplier_expiry\") to the InventoryLot model in 06-inventory.prisma"
---

# Phase 05: Performance and Stability Verification Report

**Phase Goal:** The system handles realistic data volumes without hanging, excessive query counts, or missing index scans
**Verified:** 2026-03-22T02:15:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ApprovalStep queries by (documentType, documentId, status) use an index scan | VERIFIED | `@@index([documentType, documentId, status], map: "idx_approval_steps_doc_status")` in 10-email-dashboard.prisma L214 |
| 2 | AuditLog queries by (tableName, recordId, performedAt) use an index scan | VERIFIED | `@@index([tableName, recordId, performedAt(sort: Desc)], map: "idx_audit_log_table_record_time")` in 08-system.prisma L36 (note: field is performedAt, not createdAt — correctly adapted) |
| 3 | Notification queries by (recipientId, isRead, createdAt) use an index scan | VERIFIED | `@@index([recipientId, isRead, createdAt(sort: Desc)], map: "idx_notifications_unread_recent")` in 08-system.prisma L58 |
| 4 | JobOrder queries by entityId use an index scan | VERIFIED | `@@index([entityId], map: "idx_job_orders_entity")` in 05-job-orders.prisma L79 |
| 5 | InventoryLevel queries by (itemId, lastMovementDate) use an index scan | VERIFIED | `@@index([itemId, lastMovementDate(sort: Desc)], map: "idx_mtl_onhand_movement_date")` in 06-inventory.prisma L28 |
| 6 | InventoryLot queries by (supplierId, expiryDate) use a composite index scan | FAILED | REQUIREMENTS.md claims this was added; it was not. Only separate (supplierId, receiptDate) and (expiryDate, status) indexes exist. No combined (supplierId, expiryDate) index on InventoryLot. |
| 7 | Prisma uses lateral JOINs for relation loading instead of separate queries | VERIFIED | `previewFeatures = ["relationJoins"]` in 00-generators.prisma L14 |
| 8 | No route shadowing warnings on server startup | VERIFIED | RouteRegistry imported and instantiated in packages/backend/src/routes/index.ts L14, L94. Static-before-param ordering enforced by registry. |
| 9 | Frontend vendor chunks are correctly split for browser caching | VERIFIED | Function-based manualChunks in vite.config.ts L104-113 produces vendor-react, vendor-data, vendor-forms, vendor-charts, vendor-dnd, vendor-socket chunks |
| 10 | Bin cards computed endpoint does NOT issue N individual queries per inventory level — uses batch queries | VERIFIED | bin-card.routes.ts uses binCard.findMany (batch), lotConsumption.findMany (batch), inventoryLot.groupBy (batch). Old Promise.all(levels.map(async ...)) pattern confirmed absent. |
| 11 | Bin cards computed endpoint has a query timeout so it cannot hang indefinitely | VERIFIED | QUERY_TIMEOUT_MS = 15_000 with Promise.race + timeoutPromise at bin-card.routes.ts L91, L208-221. Returns 504 on timeout. |
| 12 | Bin cards computed endpoint pageSize is capped to prevent abuse | VERIFIED | `Math.min(Math.max(Number(pageSize) \|\| 50, 1), 100)` at bin-card.routes.ts L95 |
| 13 | Master data list endpoints served from Redis cache within TTL | VERIFIED | masterDataCacheMiddleware applied to /items, /suppliers, /warehouses, /uoms in master-data.routes.ts. Redis HIT/MISS via X-Cache header. CacheTTL.MASTER_DATA = 300s in cache.ts L29. |
| 14 | Approval chain lookups served from Redis cache on repeated calls | VERIFIED | getApprovalChain wrapped with cached(cacheKey, CacheTTL.APPROVAL_CHAIN, ...) in approval.service.ts L187. CacheTTL.APPROVAL_CHAIN = 600s in cache.ts L31. invalidateApprovalChainCache exported at L733. |

**Score:** 13/14 truths verified

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/backend/prisma/schema/00-generators.prisma` | relationJoins preview feature enabled | VERIFIED | `previewFeatures = ["relationJoins"]` present at L14 |
| `packages/backend/prisma/schema/10-email-dashboard.prisma` | ApprovalStep @@index([documentType, documentId, status]) | VERIFIED | idx_approval_steps_doc_status at L214 |
| `packages/backend/prisma/schema/08-system.prisma` | AuditLog composite index on (tableName, recordId, performedAt) | VERIFIED | idx_audit_log_table_record_time at L36 |
| `packages/backend/prisma/schema/08-system.prisma` | Notification composite index on (recipientId, isRead, createdAt) | VERIFIED | idx_notifications_unread_recent at L58 |
| `packages/backend/prisma/schema/06-inventory.prisma` | InventoryLevel @@index([itemId, lastMovementDate]) | VERIFIED | idx_mtl_onhand_movement_date at L28 |
| `packages/backend/prisma/schema/06-inventory.prisma` | InventoryLot @@index([supplierId, expiryDate]) | MISSING | Not added in Phase 05. Separate (supplierId, receiptDate) and (expiryDate, status) exist from prior phases but not the combined requirement. |
| `packages/backend/prisma/schema/05-job-orders.prisma` | JobOrder @@index([entityId]) | VERIFIED | idx_job_orders_entity at L79 |
| `packages/backend/src/domains/inventory/routes/bin-card.routes.ts` | Batched bin card computation with timeout | VERIFIED | 3 batch queries, 15s timeout, pageSize cap |
| `packages/backend/src/domains/workflow/services/approval.service.ts` | Cached approval chain lookups | VERIFIED | cached() wrapper + invalidateApprovalChainCache export |
| `packages/backend/src/domains/master-data/routes/master-data.routes.ts` | Redis-cached master data list responses | VERIFIED | masterDataCacheMiddleware on items/suppliers/warehouses/uoms + mutation invalidation |
| `packages/backend/src/utils/cache.ts` | MASTER_DATA and APPROVAL_CHAIN TTL constants | VERIFIED | MASTER_DATA: 300, APPROVAL_CHAIN: 600 at L29, L31 |
| `packages/frontend/vite.config.ts` | Function-based manualChunks for vendor splitting | VERIFIED | Function at L104-113 covering react, data, forms, charts, dnd, socket |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| 00-generators.prisma | Prisma query engine | previewFeatures = ["relationJoins"] | WIRED | Present at L14 |
| 10-email-dashboard.prisma (ApprovalStep) | PostgreSQL index | @@index([documentType, documentId, status]) | WIRED | idx_approval_steps_doc_status L214 |
| 08-system.prisma (AuditLog) | PostgreSQL index | @@index([tableName, recordId, performedAt]) | WIRED | idx_audit_log_table_record_time L36 |
| 08-system.prisma (Notification) | PostgreSQL index | @@index([recipientId, isRead, createdAt]) | WIRED | idx_notifications_unread_recent L58 |
| 06-inventory.prisma (InventoryLevel) | PostgreSQL index | @@index([itemId, lastMovementDate]) | WIRED | idx_mtl_onhand_movement_date L28 |
| 06-inventory.prisma (InventoryLot) | PostgreSQL index | @@index([supplierId, expiryDate]) | NOT WIRED | Index does not exist |
| bin-card.routes.ts | prisma.binCard.findMany + prisma.inventoryLot.groupBy | batch WHERE IN queries | WIRED | binCardMap, txnMap, lotCountMap assembled via Map lookups |
| master-data.routes.ts | cache.ts cached() / invalidateCachePattern() | masterDataCacheMiddleware + res.on('finish') | WIRED | masterDataCacheMiddleware at L25-60; mutation middleware at L68-77 |
| approval.service.ts | cache.ts cached() | cached(cacheKey, CacheTTL.APPROVAL_CHAIN, ...) | WIRED | L187 in getApprovalChain |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PERF-01 | 05-02-PLAN | Bin cards endpoint pagination + query timeout | SATISFIED | 15s timeout, pageSize cap at 100, batch queries in bin-card.routes.ts |
| PERF-02 | 05-01-PLAN | 6 composite database indexes added | PARTIAL | 5 of 6 named indexes added. InventoryLot(supplierId, expiryDate) in requirements description was never added; it is not in the plan's must_haves and no commit added it. |
| PERF-03 | 05-02-PLAN | N+1 queries fixed in mr.service.ts and approval.service.ts | SATISFIED | mr.service.ts batch fix pre-existed (commit b8b6849). approval.service.ts getApprovalChain uses cached() — cached result means no repeated N+1. bin-card.routes.ts fully batched. |
| PERF-04 | 05-01-PLAN | Vite vendor chunk splitting configured | SATISFIED | Function-based manualChunks in vite.config.ts L104-113 |
| PERF-05 | 05-01-PLAN | Route shadowing resolved | SATISFIED | RouteRegistry used in routes/index.ts |
| PERF-06 | 05-01-PLAN | Prisma relationJoins preview feature enabled | SATISFIED | previewFeatures = ["relationJoins"] in 00-generators.prisma |
| PERF-07 | 05-02-PLAN | Caching layer for master data, approval chains, permission matrix | SATISFIED | Redis cache on 4 master data resources, approval chain cached, permission matrix already in-memory cached (unchanged, correct) |

**Orphaned requirements:** None. All 7 PERF requirements are claimed by plans in this phase.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| approval.service.ts | 217 | `return null` | Info | Legitimate nullable return from getRequiredApproval — not a stub |

No blockers or warnings found. TypeScript backend compiles with 0 errors.

---

## Human Verification Required

### 1. Database Indexes Applied to Production

**Test:** Run `prisma db push` or `prisma migrate dev` against a real database, then run `EXPLAIN ANALYZE SELECT * FROM "FND_APPROVAL_STEPS" WHERE document_type = 'mirv' AND document_id = '...' AND status = 'pending'` and check that the query plan shows Index Scan using idx_approval_steps_doc_status.
**Expected:** Query plan shows index scan, not sequential scan.
**Why human:** Cannot run EXPLAIN ANALYZE against the actual database in a code-only verification. The index declarations exist in Prisma schema, but whether `prisma db push` has been run and the indexes actually exist in PostgreSQL requires a live database connection.

### 2. Redis Caching Hit/Miss Behavior

**Test:** Hit `GET /api/v1/master-data/items` twice in sequence; inspect the `X-Cache` response header.
**Expected:** First response has `X-Cache: MISS`, second response (within 5 minutes) has `X-Cache: HIT`.
**Why human:** Requires a running Redis instance and live HTTP requests. Cannot verify at-rest in code.

### 3. Bin Card Endpoint Performance Under Load

**Test:** With 500+ inventory level records in the database, call `GET /api/v1/bin-cards/computed?pageSize=100` and measure response time.
**Expected:** Response within 3 seconds (not 15-second timeout).
**Why human:** Performance benchmarking requires actual data volume and a live backend.

### 4. Frontend Vendor Chunk Filenames in Production Build

**Test:** Run `pnpm --filter frontend build` and inspect `packages/frontend/dist/assets/` for files matching `vendor-react-*.js`, `vendor-data-*.js`, etc.
**Expected:** At least 4 separate vendor chunk files present, each under 500KB.
**Why human:** Requires running the build locally. The vite.config.ts manualChunks function is correctly written, but actual output filenames confirm Rollup honored the chunk assignments.

---

## Gaps Summary

One gap found against the REQUIREMENTS.md claim for PERF-02.

**Root cause:** REQUIREMENTS.md states that `InventoryLot(supplierId, expiryDate)` was added as part of Phase 05. This index was mentioned in the requirements description but was NOT included in the `05-01-PLAN.md` must_haves artifacts list, which only specifies 5 models (ApprovalStep, AuditLog, Notification, InventoryLevel, JobOrder). The plan executor correctly delivered all 5 planned indexes and did not add the InventoryLot composite index. The requirements tracking was marked complete prematurely.

The InventoryLot model currently has `(supplierId, receiptDate)` and `(expiryDate, status)` as separate indexes — queries that filter by BOTH supplierId AND expiryDate together (e.g. expiry alerts per supplier) cannot use either index efficiently and would fall back to sequential scan or partial index use.

**Fix required:** Add `@@index([supplierId, expiryDate(sort: Asc)], map: "idx_mtl_lots_supplier_expiry")` to the InventoryLot model in `packages/backend/prisma/schema/06-inventory.prisma`, then regenerate the Prisma client and push the migration.

---

_Verified: 2026-03-22T02:15:00Z_
_Verifier: Claude (gsd-verifier)_
