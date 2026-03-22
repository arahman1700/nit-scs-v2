# Phase 5: Performance and Stability - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase ensures the system handles realistic data volumes without hanging, excessive query counts, or missing index scans. Covers: bin cards pagination (PERF-01), database indexes (PERF-02), N+1 query fixes (PERF-03), Vite vendor chunks (PERF-04), route shadowing (PERF-05), Prisma relationJoins (PERF-06), and caching layer (PERF-07).

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase:
- Bin cards: add pagination + query timeout to computed endpoint (PERF-01)
- Indexes: add composite indexes on ApprovalStep, AuditLog, Notification, JobOrder, InventoryLevel, InventoryLot (PERF-02)
- N+1: fix mr.service.ts and approval.service.ts using batch lookups (PERF-03)
- Vite: vendor chunk splitting already done in Phase 4 — verify or enhance (PERF-04)
- Routes: reorder static routes before dynamic in route registration (PERF-05)
- Prisma: enable relationJoins preview feature (PERF-06)
- Caching: add Redis cache-aside for master data, approval chains, permission matrix with TTL and invalidation (PERF-07)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/domains/inventory/routes/bin-card.routes.ts` — computed endpoint
- `packages/backend/prisma/schema/` — 16 schema files with existing indexes
- `packages/backend/src/domains/outbound/services/mr.service.ts` — N+1 in stock checking
- `packages/backend/src/domains/workflow/services/approval.service.ts` — N+1 in delegate lookup
- `packages/backend/src/routes/index.ts` — route registration order
- `packages/backend/src/config/redis.ts` — Redis client already configured
- `packages/backend/src/domains/inventory/services/inventory.service.ts` — has getStockLevelsBatch() for batch queries

### Established Patterns
- Existing cache utility pattern in codebase
- Prisma schema uses @@index declarations
- Route mounting in routes/index.ts

### Integration Points
- All Prisma schema files for index additions
- Express route registration in routes/index.ts
- Redis client for caching layer

</code_context>

<specifics>
## Specific Ideas

Note: PERF-04 (Vite vendor chunks) was partially addressed in Phase 4 Plan 04-02 — verify completion status before re-implementing.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
