# Project Research Summary

**Project:** NIT Supply Chain V2
**Domain:** Enterprise Supply Chain Management / Warehouse Management System
**Researched:** 2026-03-22
**Confidence:** HIGH

## Executive Summary

NIT Supply Chain V2 is a feature-complete enterprise WMS/SCM system with 19 backend domains, 100+ API routes, 60+ frontend pages, and 13 user roles. The system covers the full supply chain lifecycle -- inbound (GRN, QCI, DR, ASN), outbound (MI, MRN, MR), transfers (WT), logistics (shipments, gate passes, customs), equipment management, job orders, and advanced features like dashboard builders, report generators, workflow rule engines, and AI chat. The existing technology stack (React 19, Vite 6, Express 5, Prisma 6, PostgreSQL 15, Redis 7, Socket.IO 4) is modern and appropriate -- no technology changes are needed.

The critical finding across all four research areas is that the system's foundation has transactional safety gaps that make inventory data unreliable. Stock-modifying operations (GRN receiving, MI issuing, MRN returns, stock transfers) and the approval state machine do not consistently wrap their database mutations in transactions. A failure midway through any of these flows leaves the system in an inconsistent state -- a document marked as approved but stock never moved, or stock added but the document not updated. In a warehouse management system, inventory accuracy is the non-negotiable foundation; every other feature is built on it. This must be the first fix, before any testing, performance work, or deployment preparation.

The recommended approach is a strict hardening-first, fix-first strategy across 6 phases: (1) data integrity and security foundations, (2) infrastructure and deployment readiness, (3) performance and stability, (4) end-to-end verification, (5) production hardening, and (6) polish and deferred features. The key risks are inventory inconsistency from non-transactional operations, approval state corruption, Prisma migration format blocking CI/CD, Redis eviction destroying BullMQ jobs, and localStorage JWT tokens enabling XSS-based account takeover. All have well-documented mitigations. The work ahead is hardening what exists, not building new capabilities.

## Key Findings

### Recommended Stack

The existing stack requires zero technology replacements. Research focused entirely on production configuration hardening. See [STACK.md](STACK.md) for full details.

**Core technologies (all current, all staying):**
- **React 19 + Vite 6:** Frontend framework with PWA support. Needs vendor chunk splitting and hidden source maps for production.
- **Express 5 + TypeScript 5.8:** Backend framework with async error handling built-in. Needs body parser tightening, request timeouts, and BullMQ drain in graceful shutdown.
- **Prisma 6 + PostgreSQL 15:** ORM and database. Needs explicit connection pooling, `relationJoins` preview feature, and comprehensive indexing on FK/status/date columns.
- **Redis 7 + BullMQ 5:** Cache and job queue. Redis eviction policy MUST change from `allkeys-lru` to `noeviction` -- current config will silently destroy BullMQ jobs under memory pressure.
- **Socket.IO 4:** Real-time updates. Single-instance deployment is correct for initial launch. Redis adapter needed only when scaling to 2+ instances.
- **Pino 10 + Sentry 10 + prom-client 15:** Observability stack. Needs PII redaction in Pino, reduced Sentry trace sampling (0.3 to 0.1), and additional Prometheus metrics for connection pool and Socket.IO monitoring.

**Stack priority fixes (P0):**
1. Redis `maxmemory-policy` to `noeviction` (5 min fix, prevents job loss)
2. Add `shutdownQueues()` to graceful shutdown (10 min fix, prevents stalled jobs on deploy)
3. Enforce production env validation -- `REDIS_URL` required, `connection_limit` in `DATABASE_URL` (30 min)

### Expected Features

The system is NOT greenfield -- nearly all features are built. Research categorized them by production criticality. See [FEATURES.md](FEATURES.md) for full details.

**Must have (table stakes -- broken or missing = system is dead on arrival):**
- Transactional stock operations across all document types (BROKEN -- scattered non-transactional operations)
- Transactional approval state machine (BROKEN -- 10+ sequential DB calls without transaction)
- Correct document calculations (BUG -- GRN totalValue always 0)
- Correct data assignment (BUG -- ASN assigns itemId as uomId)
- Full lifecycle for all 7 core document types: GRN, MI, MRN, MR, WT, QCI, DR (BUILT but need transaction safety)
- Authentication without random logouts (BUG -- rate limiter causes 429 on /auth/me)
- Accurate inventory visibility: stock levels, bin cards, expiry alerts, lot tracking, cycle counting (BUILT but depends on transaction fixes)
- RBAC with warehouse/project scoping, audit trail, input validation (BUILT, needs hardening)
- Role-based dashboards, RTL Arabic, PDF export, search/filter, notifications (BUILT)

**Should have (differentiators -- polish, do not rebuild):**
- Drag-drop dashboard builder (BUILT -- impressive, needs polish)
- Report builder with saved templates (BUILT)
- Workflow rule engine with automated actions (BUILT but fragile -- 60s cache with no invalidation)
- Barcode scanning integration (PARTIALLY BUILT -- component exists, not integrated into flows)
- FIFO/FEFO lot enforcement on MI (MISSING -- manual lot selection works as interim)
- Warehouse zone management, wave picking, cross-docking, packing stations (ALL BUILT)
- AI chat assistant (BUILT -- needs SQL injection hardening before production)

**Defer (v2+):**
- Mobile native app (PWA covers 90% of use cases)
- Full ERP integration / Oracle PO sync (batch CSV import sufficient)
- Supplier portal, EDI integration, blockchain, sustainability tracking
- ML-based demand forecasting accuracy (basic version exists, defer validation)
- Full offline mode / PWA sync (partially built, defer completion)
- Automated replenishment rules (manual WT sufficient)

### Architecture Approach

The 19-domain DDD architecture with document router factory, event bus, and transaction client injection is fundamentally sound. The hardening work preserves the existing architecture while systematically closing gaps in transaction safety, soft-delete coverage, and post-commit side effect ordering. See [ARCHITECTURE.md](ARCHITECTURE.md) for full details.

**Major components and their hardening needs:**
1. **Document Router Factory** -- CRUD + status transitions. Solid. Needs consistent transaction wrapping for status changes that trigger stock movements.
2. **Inventory Service** -- Stock mutations via `addStockBatch`/`reserveStockBatch`. Has `externalTx` parameter but callers do not always pass it. Make `tx` required, not optional.
3. **Approval Service** -- Multi-level approval state machine. 10+ sequential DB calls without `$transaction`. Must be wrapped in a single transaction with notifications moved post-commit.
4. **Safe Status Transition** -- Atomic status updates with conflict detection. Already well-implemented. Extend to all document types.
5. **Event Bus** -- In-memory EventEmitter for domain events. Some events publish INSIDE transactions (dangerous -- side effects fire for operations that may roll back). Must publish AFTER transaction commits.
6. **Soft-Delete Extension** -- Auto-filters `deletedAt`. Only covers `findMany`, `findFirst`, `count`. Must extend to `findUnique`, `aggregate`, `groupBy`. Nested includes require explicit `where: { deletedAt: null }` (Prisma limitation).

**Key architectural rule:** The target data flow for any stock-affecting operation is: validate input, check RBAC, open transaction (status update + stock mutation + audit log), commit transaction, THEN publish events and emit Socket.IO updates. Steps 5a-5c must happen AFTER the transaction commits, never inside it.

### Critical Pitfalls

Top 7 pitfalls that cause data corruption, outages, or security breaches. See [PITFALLS.md](PITFALLS.md) for all 26 pitfalls plus domain-specific warnings.

1. **Approval state machine without transaction boundaries** -- Partial approval leaves documents stuck in limbo. Wrap `processApproval()` in `$transaction`, move notifications post-commit. (Phase 1)
2. **Stock operations outside transaction scope** -- Ghost inventory, double-counting, orphaned lot consumption. Make `tx` required on all stock mutation functions. (Phase 1)
3. **Prisma migration format breaks `prisma migrate deploy`** -- Mixed `0000_` and `20260312_` naming. Must re-baseline to timestamp format before CI/CD pipeline works. (Phase 2)
4. **AI module SQL injection via dynamic query construction** -- LLM-generated SQL executed against production DB. Add SQL AST validation, audit logging, restrict to read-only DB user. (Phase 1)
5. **localStorage JWT tokens vulnerable to XSS** -- Any XSS = full account takeover. Migrate access tokens to httpOnly cookies with CSRF protection. (Phase 1)
6. **Redis `allkeys-lru` silently destroys BullMQ jobs** -- Scheduled jobs stop running with no alerts. Change to `noeviction`. (Phase 2)
7. **Rate limiter causes user logout on normal navigation** -- IP-based rate limiting punishes corporate NAT users. Switch to per-user rate limiting for authenticated routes, exempt `/auth/me`. (Phase 1)

## Implications for Roadmap

Based on combined research across stack, features, architecture, and pitfalls, the following 6-phase structure reflects dependency ordering, risk reduction, and logical grouping.

### Phase 1: Data Integrity and Security Foundation

**Rationale:** Everything depends on data consistency. If stock operations are inconsistent, testing is meaningless, caching amplifies errors, indexes speed up bad queries, and monitoring measures wrong data. Security fixes here prevent exploitation during the extended testing/hardening period that follows.

**Delivers:** A system where every stock movement and approval transition is atomic, and basic security holes are closed.

**Addresses (from FEATURES.md):**
- Transaction safety for all stock operations (Tier 1 table stakes)
- Approval state machine transaction wrapping (Tier 1)
- ASN UOM bug fix (Tier 1 -- one-line fix, critical data corruption)
- GRN totalValue calculation fix (Tier 1)
- Auth race condition fix (Tier 4)
- Input validation hardening -- Zod string length limits (Tier 4)
- Soft-delete extension to cover all query methods (Tier 1)
- Float-to-Decimal migration for financial quantities (Tier 1)

**Avoids (from PITFALLS.md):**
- P1: Approval state corruption
- P2: Inventory inconsistency
- P4: AI module SQL injection (audit logging + read-only DB user)
- P5: localStorage JWT theft (httpOnly cookie migration)
- P8: Rate limiter logout (per-user rate limiting)
- P9: Soft delete leakage
- P12: Unbounded string inputs
- P13: Float precision errors
- P19: Error handler info leak
- P21: PII in logs

**Stack work (from STACK.md):**
- Pino redact configuration for PII
- Error handler production mode defaults

### Phase 2: Infrastructure and Deployment Readiness

**Rationale:** The system cannot be deployed to production without fixing the Prisma migration format, Redis eviction policy, graceful shutdown, and CORS configuration. These are deployment blockers that are independent of feature work and can proceed immediately after Phase 1 stabilizes the data layer.

**Delivers:** A system that can be reliably deployed to production with CI/CD, proper shutdown behavior, and correct security headers.

**Addresses (from FEATURES.md):**
- CORS production configuration (Tier 4)
- Auto-numbering concurrency safety verification (Tier 2)

**Avoids (from PITFALLS.md):**
- P3: Prisma migration format breaks `prisma migrate deploy`
- P6: Redis `allkeys-lru` destroys BullMQ jobs
- P7: Graceful shutdown does not drain BullMQ workers
- P11: CORS misconfiguration in production
- P14: Source maps expose application logic
- P18: No request timeout on Express routes

**Stack work (from STACK.md):**
- Redis `maxmemory-policy` to `noeviction`
- `shutdownQueues()` in graceful shutdown, increase drain timeout to 15s
- Production env validation (REDIS_URL required, connection_limit in DATABASE_URL)
- Install `dumb-init` in Dockerfile, pin Node.js version
- Explicit Prisma `$connect()` at startup
- Source maps to `hidden`
- Body parser limit tightening (2MB to 256KB default)

### Phase 3: Performance and Stability

**Rationale:** With data integrity fixed and deployment unblocked, address performance issues that would surface during QA testing and frustrate users. Missing indexes, N+1 queries, and the bin cards endpoint hang are all issues that scale with data volume and would be discovered during end-to-end testing.

**Delivers:** A system that performs well under realistic data volumes and concurrent usage.

**Addresses (from FEATURES.md):**
- Bin card / stock ledger fix -- add pagination, query timeout (Tier 3)
- WT/stock-transfer service unification (Tier 2)
- Route shadowing cleanup (implicit in code quality)

**Avoids (from PITFALLS.md):**
- P10: Bin cards self-DoS from pool exhaustion
- P20: N+1 queries on MR stock checking and dashboards
- P22: Missing database indexes on high-volume tables

**Architecture work (from ARCHITECTURE.md):**
- Add composite indexes: `ApprovalStep(documentType, documentId, status)`, `AuditLog(tableName, recordId, createdAt)`, `Notification(recipientId, read, createdAt)`, `JobOrder(entityId)`
- Enable Prisma `relationJoins` preview feature
- Fix remaining N+1 patterns using existing `getStockLevelsBatch()` pattern
- Add caching layer for master data, approval chains, and permission matrix

**Stack work (from STACK.md):**
- Vite vendor chunk splitting for optimal caching
- PostgreSQL tuning (shared_buffers, work_mem, random_page_cost for SSD)
- Enable `pg_stat_statements` for slow query identification

### Phase 4: End-to-End Verification

**Rationale:** With the foundation solid, performance adequate, and deployment working, systematically verify every user-facing workflow. This is not unit testing -- it is scenario-based verification that the full document lifecycle works for each of the 7 core document types with stock effects, approval chains, and role-based access.

**Delivers:** Verified confidence that all core workflows function correctly end-to-end.

**Addresses (from FEATURES.md):**
- End-to-end verification of GRN, MI, MRN, MR, WT, QCI, DR flows (Tier 2)
- Approval workflow verification -- sequential and parallel paths (Tier 2)
- All 13 role-based navigation paths resolve to working pages (Tier 5)
- RTL Arabic rendering verification across all pages (Tier 5)
- PDF export verification for all document types (Tier 5)
- Notification delivery verification for all workflow triggers (Tier 5)
- Socket.IO real-time updates for all document transitions (Differentiator)

**Avoids (from PITFALLS.md):**
- P17: Unhandled concurrent document edits (verify optimistic locking)
- Domain Pitfall C: Document number generation under concurrency

### Phase 5: Production Hardening

**Rationale:** Final hardening before go-live. Address monitoring, observability, edge cases, and operational tooling. This phase assumes all core workflows are verified.

**Delivers:** Production-ready deployment with monitoring, alerting, and operational runbooks.

**Addresses (from FEATURES.md):**
- Workflow rule engine cache staleness fix (Differentiator)
- File attachment size limit enforcement (Tier 5)

**Avoids (from PITFALLS.md):**
- P15: Workflow rule engine cache staleness
- P16: Socket.IO scaling (document the path, implement only if needed)

**Stack work (from STACK.md):**
- Sentry trace sampling reduction (0.3 to 0.1)
- Add Prisma integration for Sentry traces
- Add Prometheus metrics: connection pool, Socket.IO clients, business document counters
- AsyncLocalStorage for request-scoped correlation IDs
- Bundle visualizer for ongoing monitoring

**Architecture work (from ARCHITECTURE.md):**
- Transaction duration metrics
- Optimistic lock retry metrics
- Nightly inventory reconciliation job (Domain Pitfall B)

### Phase 6: Polish and Deferred Features

**Rationale:** Post-launch improvements that add value but are not required for go-live. Only pursue these after production is stable.

**Delivers:** Enhanced user experience and operational features.

**Addresses (from FEATURES.md -- Differentiators and Phase 2 items):**
- FIFO/FEFO lot enforcement on MI
- Barcode scanning integration into receiving/picking/issuing flows
- Demand forecasting accuracy validation
- Cost allocation accuracy verification
- AI module deeper SQL injection hardening (parameterized query builder)
- Parallel approval load testing
- PWA offline mode completion

### Phase Ordering Rationale

- **Phase 1 must be first** because every feature, test, and metric depends on data integrity. Testing a system with non-transactional stock operations produces false results. Caching inconsistent data amplifies errors.
- **Phase 2 before Phase 3** because deployment infrastructure must work before performance optimization matters. You cannot measure performance improvements without a working CI/CD pipeline.
- **Phase 3 before Phase 4** because end-to-end testing on a system with N+1 queries and missing indexes would be frustrating and produce misleading performance profiles.
- **Phase 4 before Phase 5** because monitoring baselines are meaningless until all workflows are verified. You need to know what "normal" looks like before setting alerts.
- **Phase 5 before Phase 6** because production stability must be achieved before adding new capabilities.
- **Phase 6 is explicitly post-launch** -- none of these features are required for go-live.

### Research Flags

**Phases likely needing deeper research during planning:**
- **Phase 1 (security -- httpOnly cookie migration):** Migrating from localStorage JWT to httpOnly cookies touches auth middleware, frontend API client, service worker, and requires CSRF protection. Needs careful design research to avoid breaking the PWA.
- **Phase 2 (Prisma migration re-baseline):** The mixed migration format requires a specific re-baseline procedure. Test against a fresh database and an existing database to verify both `prisma migrate deploy` and incremental migrations work.
- **Phase 4 (parallel approval edge cases):** The parallel approval workflow (multiple approvers at the same level) is untested for concurrent scenarios. May need research into race conditions and deadlock patterns.
- **Phase 5 (inventory reconciliation job):** No existing reconciliation logic. Needs design research for the reconciliation algorithm, threshold configuration, and dashboard integration.

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (transaction wrapping):** Well-documented Prisma `$transaction` pattern. The `TxClient` type and `externalTx` parameter pattern already exist -- just extend to all services.
- **Phase 3 (indexing and N+1):** Standard PostgreSQL indexing. Use `EXPLAIN ANALYZE` and add indexes with `CREATE INDEX CONCURRENTLY`. The `getStockLevelsBatch` pattern already demonstrates the batch query approach.
- **Phase 3 (caching):** Standard Redis cache-aside with TTL and invalidation. Cache utility already exists in the codebase.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified against official docs (Express, Prisma, BullMQ, Redis, Vite) and codebase inspection. No technology changes needed -- only configuration hardening. |
| Features | HIGH | Cross-referenced with industry WMS/SCM requirements from 11 sources. All features verified to exist (or not) in codebase. Feature dependency graph is well-understood. |
| Architecture | HIGH | Patterns verified against Prisma official docs, Express 5 error handling docs, and codebase inspection. Transaction client injection pattern already partially implemented -- extending it is low-risk. |
| Pitfalls | HIGH | 26 pitfalls identified, 7 critical. All critical pitfalls verified by reading specific source files and line numbers. Industry data (PWC, Panorama Consulting) confirms inventory accuracy is the #1 WMS failure mode. |

**Overall confidence:** HIGH

The research is unusually well-grounded because this is a hardening project, not a greenfield build. The codebase exists, the patterns are established, and the gaps are identified with specific file and line number references. The risk is not in choosing wrong technologies or architectures -- it is in the execution discipline of systematically closing gaps without introducing regressions.

### Gaps to Address

- **Frontend page completeness:** Exact completion state of each of the 60+ frontend pages is unknown. Some may be placeholder or broken. Systematic review needed during Phase 4.
- **Socket.IO event coverage:** Whether Socket.IO events fire correctly for ALL document type transitions is unverified. Needs testing in Phase 4.
- **Parallel approval concurrency:** The parallel approval path (multiple approvers at same level) is completely untested. Needs dedicated testing with concurrent requests in Phase 4.
- **Cost allocation accuracy:** Multi-warehouse cost allocation calculations are untested. Defer validation to Phase 6.
- **Demand forecasting accuracy:** Basic forecasting exists but has not been validated with real data. Defer to Phase 6.
- **Scale testing:** System behavior at 100+ concurrent WebSocket connections is unknown. Needs load testing in Phase 5.
- **Node.js 20 LTS EOL:** Node 20 LTS support ends April 2026. Plan upgrade to Node 22 LTS after production launch stabilizes (Phase 6 timeframe).

## Sources

### Primary (HIGH confidence -- official documentation)
- [Express.js Production Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Prisma Transactions and Batch Queries](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Prisma Connection Pool Documentation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- [Prisma Query Optimization](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance)
- [BullMQ Going to Production](https://docs.bullmq.io/guide/going-to-production)
- [Socket.IO Redis Adapter](https://socket.io/docs/v4/redis-adapter/)
- [Redis Security Best Practices](https://redis.io/docs/latest/operate/oss_and_stack/management/security/)
- [Prisma Migrate Development and Production Workflows](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)

### Secondary (MEDIUM confidence -- verified web sources and industry research)
- [Panorama Consulting: Supply Chain Implementation Failures](https://panorama-consulting.com/supply-chain-implementation-failure/)
- [SelectHub: Top 11 WMS Features](https://www.selecthub.com/warehouse-management/warehouse-management-software-features-requirements/)
- [Addverb: Key Features in WMS](https://addverb.com/blog/key-features-to-look-for-in-warehouse-management-system/)
- [NetSuite: Inventory Accuracy](https://www.netsuite.com/portal/resource/articles/inventory-management/inventory-accuracy.shtml)
- [Cadre: 10 Common WMS Implementation Mistakes](https://www.cadretech.com/10-common-wms-implementation-mistakes/)
- [CAI Software: ERP Go-Live Checklist](https://caisoft.com/resources/erp-go-live-checklist/)
- [PostgreSQL Parameter Tuning Best Practices](https://www.mydbops.com/blog/postgresql-parameter-tuning-best-practices)

### Codebase Verification (HIGH confidence -- direct inspection)
- `packages/backend/src/domains/` -- all 19 domain directories inspected
- `packages/backend/src/infrastructure/queue/bullmq.config.ts` -- BullMQ configuration and shutdown
- `packages/backend/src/config/redis.ts` -- Redis client hardening
- `packages/backend/src/utils/prisma.ts` -- Prisma singleton with soft-delete extension
- `packages/backend/src/index.ts` -- Express setup, middleware chain, graceful shutdown
- `packages/backend/src/config/env.ts` -- Zod environment validation
- `packages/frontend/vite.config.ts` -- Build configuration
- `.planning/codebase/CONCERNS.md` -- Internal codebase analysis with specific file/line references

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
