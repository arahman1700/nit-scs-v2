# Domain Pitfalls

**Domain:** Enterprise Supply Chain Management System (WMS/SCM)
**Stack:** Express 5 + Prisma 6 + React 19 + PostgreSQL + Redis + Socket.IO
**Researched:** 2026-03-22

---

## Critical Pitfalls

Mistakes that cause data corruption, production outages, or mandatory rewrites.

---

### Pitfall 1: Approval State Machine Without Transaction Boundaries

**What goes wrong:** The `approval.service.ts` `processApproval()` function executes 6-10 sequential database operations (update step status, find next step, look up workflow, update document SLA, notify approvers, emit events) with zero `$transaction` wrapping. If any step fails mid-way -- database timeout, Redis outage during notification, constraint violation -- the approval is left in a partial state: step marked approved but document status not advanced, or SLA updated but next approver never notified.

**Why it happens:** The approval logic grew incrementally. Each new feature (multi-level chains, SLA tracking, Socket.IO notifications) was added as another sequential await. No one wrapped the whole flow because each individual operation "worked."

**Consequences:**
- Document stuck in limbo: step says "approved" but document says "pending_approval" at old level
- No compensating rollback logic exists -- manual database intervention required
- For high-value MIs (>500K SAR threshold), a partial approval could authorize spending without completing the full chain
- Parallel approval mode (multiple approvers at same level) is completely untested and the race condition window is wider

**Prevention:**
1. Wrap the entire `processApproval` flow (approve path and reject path) in a single `prisma.$transaction()`
2. Move Socket.IO emissions and push notifications OUTSIDE the transaction (fire-and-forget after commit)
3. Add a `lastTransitionAt` timestamp to approval steps for detectability
4. Add an integration test that kills the connection mid-approval and verifies rollback

**Detection:** Query for documents where `approvalStep.status = 'approved'` at level N but no `pending` step exists at level N+1 and the document status is not `approved`. Any results = partial state corruption.

**Phase mapping:** Must be fixed in the earliest hardening phase (security/data-integrity phase).

**Confidence:** HIGH -- verified by reading `approval.service.ts:330-430`, zero `$transaction` calls confirmed via grep.

---

### Pitfall 2: Stock Operations Outside Transaction Scope

**What goes wrong:** Stock-modifying operations (GRN receiving, MI issuing, MRN returns, stock transfers) do not consistently wrap their full flow in a transaction. The CONCERNS.md identifies `grn.service.ts:304`, `mi.service.ts:175-197`, `stock-transfer.service.ts:177,210`, `mrn.service.ts:141`, and `mr.service.ts:186-273` as specific locations. While some services like `grn.service.ts` DO use `$transaction` for the create flow, the approval-triggered stock movements (when a document gets approved and stock should move) may not be wrapped.

**Why it happens:** The inventory service provides `addStockBatch()` and `consumeReservationBatch()` that accept an optional `tx` parameter -- but callers don't always pass one. The pattern assumes the caller manages the transaction, but this is not enforced at the type level.

**Consequences:**
- Ghost inventory: document record committed but stock level not updated (or vice versa)
- Double-counting: if a retry hits after partial commit, stock could be added twice
- Lot consumption records orphaned from their parent MI
- In a supply chain system, inventory inconsistency is the single worst failure mode. Industry data shows 60-70% of WMS implementations experience significant challenges, with data integrity being the #1 cause of operational breakdown (PWC: 55% of companies struggle with poor data quality in warehouse systems)

**Prevention:**
1. Make the `tx` parameter required (not optional) on `addStockBatch`, `consumeReservationBatch`, `updateLevelWithVersion` -- force callers to be explicit about transaction ownership
2. Create a `withInventoryTransaction()` wrapper that opens the transaction and passes `tx` to all sub-operations
3. Add database CHECK constraints (already partially in schema) as a safety net: `qty_on_hand >= 0`, `qty_reserved >= 0`
4. Run a nightly reconciliation job comparing document line quantities against inventory lot consumption totals

**Detection:** Compare sum of all GRN line `qtyReceived` minus all MI line `qtyIssued` against current `InventoryLevel.qtyOnHand` per item/warehouse. Discrepancy = data corruption.

**Phase mapping:** Highest priority in the first hardening phase. Must be fixed before any production data entry.

**Confidence:** HIGH -- verified by reading service files and CONCERNS.md analysis.

---

### Pitfall 3: Prisma Migration Format Breaks `prisma migrate deploy`

**What goes wrong:** The migration directory contains a mix of non-timestamped (`0000_baseline`, `0001_add_constraints`) and timestamped (`20260312000000_...`) migrations. Prisma Migrate expects consistent naming for `prisma migrate deploy` in production. The CONCERNS.md explicitly states: "prisma migrate deploy won't work in production (reports 'No migration found')."

**Why it happens:** The project started with a manual numbering scheme and later switched to Prisma's timestamp format. The existing migrations were never re-baselined.

**Consequences:**
- Cannot use `prisma migrate deploy` in CI/CD pipeline -- the standard production migration command
- Forces use of `prisma db push` which has no rollback capability and no migration history tracking
- Any schema change in production becomes a high-risk manual operation
- If a migration fails partially in production, recovery requires manual SQL and `prisma migrate resolve`

**Prevention:**
1. Re-baseline all migrations: create a single new timestamped migration from the current schema state, mark old migrations as resolved with `prisma migrate resolve`
2. Test the full `prisma migrate deploy` flow in a staging environment before production
3. Add `prisma migrate deploy` to CI/CD pipeline and verify it succeeds on every PR against a fresh database
4. Never use `prisma db push` in production -- it skips migration history entirely

**Detection:** Run `prisma migrate status` against a fresh database. If it reports drift or missing migrations, the format is broken.

**Phase mapping:** Must be resolved in the deployment/infrastructure phase, before first production deployment.

**Confidence:** HIGH -- confirmed by listing migration directory (mix of `0000_` and `20260312` prefixes).

---

### Pitfall 4: AI Module SQL Injection via Dynamic Query Construction

**What goes wrong:** `ai-chat.service.ts:163` uses `Prisma.raw(sanitizedQuery)` to execute AI-generated SQL. Even with the `stripCommentsAndQuotes` sanitizer, read-only transaction mode, table allowlist, and column blocklist, the fundamental pattern -- constructing SQL from LLM output and executing it against the production database -- is a known attack surface. The LLM could be prompt-injected to generate queries that bypass sanitization (e.g., using COPY, function calls, or CTEs that reference disallowed tables indirectly).

**Why it happens:** The AI chat feature was built for convenience: users ask questions in natural language, the LLM generates SQL, the system executes it. This is a powerful feature but inherently dangerous.

**Consequences:**
- Data exfiltration via clever SQL construction that bypasses column blocklist (e.g., `CASE WHEN sensitive_col LIKE 'a%' THEN 1 ELSE 0 END` as a blind exfil technique)
- Denial-of-service via expensive queries (5s timeout helps but certain PostgreSQL functions could still cause issues)
- Read-only mode prevents mutations but information disclosure is still a security incident

**Prevention:**
1. Add an ESLint rule banning `$queryRawUnsafe` and `Prisma.raw` everywhere except the AI module (make it intentional)
2. Replace raw SQL execution with a parameterized query builder (e.g., Kysely or pre-defined view layer) -- the LLM selects from pre-defined query templates rather than generating arbitrary SQL
3. Log every AI-generated query to the audit table with the user ID, timestamp, and result row count
4. Add a SQL AST parser (like `pgsql-ast-parser`) to validate the query structure before execution -- reject anything that isn't a simple SELECT
5. Consider making the AI module query a read replica with a restricted database user (SELECT-only on specific views)

**Detection:** Audit log showing AI queries with unusual patterns: UNION, subqueries on system catalogs (`pg_catalog`, `information_schema`), function calls, or COPY commands.

**Phase mapping:** Security hardening phase. Can be partially mitigated quickly (audit logging) with deeper fix (query builder) in a later phase.

**Confidence:** HIGH -- verified by reading `ai-chat.service.ts:150-176`.

---

### Pitfall 5: localStorage JWT Tokens Vulnerable to XSS

**What goes wrong:** Access tokens stored in `localStorage` are readable by any JavaScript running on the page. A single XSS vulnerability (e.g., unsanitized user input in a dashboard widget, a compromised npm dependency, or HTML injection in email templates) allows an attacker to steal the JWT and impersonate any user.

**Why it happens:** The app uses `localStorage` for the access token to support service worker access in the PWA. Refresh tokens are already in httpOnly cookies, but the access token -- which grants full API access -- remains exposed.

**Consequences:**
- Any XSS = full account takeover for every user who has the page open
- In a supply chain system with financial approvals (MIs worth 500K+ SAR), this is a critical business risk
- The CSP headers in `helmet` config help but allow `'unsafe-inline'` for styles, and any CSP bypass = token theft
- Express security research in 2024 found that 40% of Node.js breaches involved misconfigured Express middleware -- the risk is not theoretical

**Prevention:**
1. Move access tokens to httpOnly cookies with `SameSite=Strict` and `Secure` flags
2. For the service worker use case, pass tokens via `postMessage` from the main thread rather than reading from storage
3. Add CSRF protection (double-submit cookie pattern or Synchronizer Token) since cookie-based auth requires it
4. Remove `'unsafe-inline'` from the CSP `styleSrc` directive -- use nonce-based or hash-based CSP for inline styles
5. As a defense-in-depth measure, keep access token TTL short (15 minutes is already configured and good)

**Detection:** Security audit. Check: does any frontend code render user-supplied HTML without sanitization?

**Phase mapping:** Security hardening phase. The cookie migration is a significant change that touches auth middleware, frontend API client, and service worker.

**Confidence:** HIGH -- confirmed by reading auth middleware (Bearer token from Authorization header) and CONCERNS.md.

---

### Pitfall 6: Redis `allkeys-lru` Silently Destroys BullMQ Jobs

**What goes wrong:** Redis evicts BullMQ job keys under memory pressure. Jobs disappear without errors. Workers get stuck waiting for keys that no longer exist. Scheduled jobs (SLA checks, notifications, cycle counts) stop running with no alerts.

**Why it happens:** Developers configure Redis for caching (LRU eviction) without realizing BullMQ stores critical state in Redis keys, not just cache data.

**Consequences:** Silent job loss. In a supply chain system, this means missed SLA alerts, unprocessed GRN approvals, lost notification deliveries, and failed scheduled reconciliations -- all without any error being logged.

**Prevention:**
1. Set `maxmemory-policy noeviction` on all Redis instances used by BullMQ
2. Monitor Redis memory usage and scale before hitting the limit
3. Consider separate Redis instances for caching (with LRU) and job queues (with noeviction)

**Detection:** Monitor the `bullmq_jobs_total` metric. If completed jobs drop to zero but new jobs are still being added, eviction is likely happening.

**Phase mapping:** Infrastructure/deployment phase.

**Confidence:** MEDIUM -- standard BullMQ production requirement; Redis eviction policy not verified in codebase config.

---

### Pitfall 7: Graceful Shutdown Does Not Drain BullMQ Workers

**What goes wrong:** On deploy, SIGTERM arrives. The `shutdown()` handler in `index.ts` closes the HTTP server and disconnects Redis, but BullMQ workers are not explicitly stopped first. Workers mid-job have their Redis connection cut. The job is left in a "processing" state in Redis and never completes or fails.

**Why it happens:** The shutdown handler calls `stopScheduler()` and `io.close()` but does not call `shutdownQueues()` from `bullmq.config.ts`.

**Consequences:** Stalled jobs accumulate in Redis. Each deploy risks leaving 1-2 jobs stuck. Over weeks, dead-letter queues fill, and workers may hit concurrency limits from "ghost" active jobs.

**Prevention:**
1. Add `await shutdownQueues()` to the shutdown handler BEFORE disconnecting Redis
2. Workers should be closed before queues (already correct in `shutdownQueues()` implementation)
3. Add a startup job that reclaims any stalled jobs from prior unclean shutdowns

**Detection:** Check for jobs with status "active" but no worker processing them via BullMQ dashboard.

**Phase mapping:** Infrastructure/deployment phase.

**Confidence:** HIGH -- confirmed by reading `index.ts:202-235` shutdown handler.

---

## High Pitfalls

Mistakes that cause significant operational issues, performance degradation, or security gaps.

---

### Pitfall 8: Rate Limiter Causes User Logout on Normal Navigation

**What goes wrong:** The global rate limiter at 500 req/60s (in `routes/index.ts:56`) applies per-IP. In an enterprise environment where multiple users share a corporate NAT/proxy IP, their requests are pooled. An SPA like this fires 3-8 API calls per page navigation (auth check, data fetch, notifications, etc.). With 10 users behind one IP navigating actively, the shared pool is exhausted in under a minute. When `/auth/me` gets rate-limited (429), the frontend interprets it as an auth failure and logs the user out.

**Why it happens:** Rate limiting was designed for public-facing APIs with one user per IP. Enterprise environments with shared egress IPs break this assumption. The frontend also lacks 429-aware retry logic.

**Consequences:**
- Users get logged out randomly during normal work
- Frustration leads to workarounds (users stop using the system)
- The rate limiter punishes legitimate use rather than preventing abuse

**Prevention:**
1. Implement per-user rate limiting for authenticated routes (key on `req.user.userId` not `req.ip`)
2. Exempt `/auth/me` and `/auth/refresh` from the global rate limiter entirely -- these are session-maintenance calls, not abuse vectors
3. Add 429-aware retry logic in the frontend API client (respect `Retry-After` header, use exponential backoff via React Query's `retry` config)
4. Set different limits: unauthenticated = 100 req/60s per IP (abuse prevention), authenticated = 1000 req/60s per user (generous for SPA)

**Detection:** Monitor 429 response rates in production. If legitimate users (not bots) trigger 429s, the limits are wrong.

**Phase mapping:** Early hardening phase. This is a UX-breaking bug, not just an optimization.

**Confidence:** HIGH -- confirmed by reading `rate-limiter.ts` (IP-based keying) and `routes/index.ts:56` (500 req limit).

---

### Pitfall 9: Soft Delete Leakage -- Prisma Extension Incomplete

**What goes wrong:** The Prisma extension in `prisma.ts` auto-filters `deletedAt: null` for `findMany`, `findFirst`, and `count` queries. However, it does NOT cover `findUnique`, `findUniqueOrThrow`, `aggregate`, `groupBy`, or relation includes. Any query using these methods will return soft-deleted records.

**Why it happens:** The soft delete extension was implemented for the most common query methods but not exhaustively. `findUnique` was likely skipped because it queries by primary key (where soft-deleted records are rare but not impossible).

**Consequences:**
- Deleted suppliers appearing in dropdown lists (via relation includes)
- Deleted items counted in inventory reports (via `aggregate` or `groupBy`)
- A deleted user's approval still being valid because `findUnique` returns the record

**Prevention:**
1. Extend the Prisma soft-delete middleware to cover ALL read operations: `findUnique`, `findUniqueOrThrow`, `aggregate`, `groupBy`
2. Add a test that creates a record, soft-deletes it, and verifies it's excluded from every query method
3. For relation includes (nested data), consider adding `where: { deletedAt: null }` as a default include filter
4. Audit all `findUnique` calls to check if they could return soft-deleted records

**Detection:** Query the database for records where `deletedAt IS NOT NULL` and check if any API endpoint returns them.

**Phase mapping:** Data integrity phase, alongside transaction safety fixes.

**Confidence:** HIGH -- verified by reading `prisma.ts` (only covers `findMany`, `findFirst`, `count`).

---

### Pitfall 10: Bin Cards Computed Endpoint Causes Timeouts and Potential Self-DoS

**What goes wrong:** The `GET /bin-cards/computed` endpoint runs a complex aggregation query without pagination, query timeout, or result size limits. With production data volumes, this query hangs for 30+ seconds, holding a database connection. Prisma's default pool size is `num_cpus * 2 + 1` (typically 5-9 on a small container). Multiple users hitting this endpoint exhaust the pool and cause cascading timeouts across the entire application.

**Why it happens:** Built for development with small datasets. Never load-tested.

**Consequences:**
- Inventory page unusable
- Self-inflicted DoS from pool exhaustion

**Prevention:**
1. Add mandatory pagination (50 items per page)
2. Add a Prisma-level query timeout: `prisma.$transaction([...], { timeout: 10000 })`
3. Consider a materialized view for bin card summaries
4. Add a global Express response timeout (30s) as a safety net
5. Configure `connection_limit=20` explicitly in DATABASE_URL

**Detection:** Database connection pool utilization alerts. If pool usage spikes above 80%, investigate.

**Phase mapping:** Performance optimization phase. Quick fix (pagination + timeout) can happen early.

**Confidence:** HIGH -- confirmed by CONCERNS.md and Prisma pool documentation.

---

### Pitfall 11: CORS Misconfiguration in Production

**What goes wrong:** The CORS configuration in `cors.ts` defaults to `http://localhost:3000` when `CORS_ORIGIN` is not set. In production, missing env var = frontend completely broken. Wildcard `CORS_ORIGIN=*` = security vulnerability.

**Prevention:**
1. Make `CORS_ORIGIN` required in production with no default -- fail fast on startup
2. Validate that `CORS_ORIGIN` is not `*` in production
3. Log configured CORS origins on startup

**Detection:** Frontend API calls failing with "blocked by CORS policy" or security scanner detecting wildcard CORS.

**Phase mapping:** Deployment configuration phase.

**Confidence:** HIGH -- verified by reading `cors.ts` and `env.ts`.

---

### Pitfall 12: No Zod String Length Limits Enables Payload DoS

**What goes wrong:** All Zod schemas use `z.string()` without `.max()` constraints. Any text field accepts unlimited-length strings within the 2MB body parser limit.

**Prevention:**
1. Add `.max(255)` to short text fields, `.max(2000)` to descriptions, `.max(50)` to codes
2. Create shared helpers: `zName = z.string().min(1).max(255)`, etc.
3. Lint rule: "No bare `z.string()` without `.max()`"

**Detection:** Grep for `z.string()` not followed by `.max(` -- current count is zero `.max()` calls.

**Phase mapping:** Input validation hardening phase.

**Confidence:** HIGH -- confirmed via grep.

---

### Pitfall 13: Float Precision for Financial Quantities

**What goes wrong:** Three models (`CycleCountLine`, `StagingAssignment`, `PackingLine`) use `Float` instead of `Decimal(12,3)` for quantities. IEEE 754 rounding errors accumulate over thousands of transactions.

**Prevention:**
1. Migrate to `Decimal(12,3)` matching the established pattern
2. Schema lint rule: no `Float` on quantity/amount/cost fields
3. Test migration on copy of data first

**Phase mapping:** Data integrity phase.

**Confidence:** HIGH -- confirmed by CONCERNS.md and schema grep.

---

### Pitfall 14: Source Maps Expose Application Logic in Production

**What goes wrong:** If production builds include source map references, full TypeScript source is visible in browser DevTools.

**Prevention:** Use `sourcemap: 'hidden'` in Vite production config. Add CI check that greps built files for `sourceMappingURL`.

**Phase mapping:** Deployment configuration phase.

**Confidence:** MEDIUM -- standard Vite concern; exact config not verified.

---

## Moderate Pitfalls

---

### Pitfall 15: Workflow Rule Engine Cache Staleness

**What goes wrong:** Workflow rules are cached in-memory with a 60-second TTL. Rule updates take up to 60s to take effect. Approvals could be routed incorrectly during the window.

**Prevention:** Event-driven cache invalidation on rule changes. For multi-process, use Redis pub/sub.

**Phase mapping:** Workflow hardening phase.

**Confidence:** MEDIUM -- from CONCERNS.md.

---

### Pitfall 16: Socket.IO Scaling Beyond Single Process

**What goes wrong:** Socket.IO connections are in-memory. Multi-process deployment without Redis adapter means rooms and events don't propagate.

**Prevention:** Add `@socket.io/redis-adapter`. Monitor connection count and memory per process.

**Phase mapping:** Infrastructure/deployment phase. Only relevant when scaling.

**Confidence:** MEDIUM -- standard Socket.IO limitation.

---

### Pitfall 17: Unhandled Concurrent Document Edits

**What goes wrong:** Documents have `version` fields in the schema but may not enforce version checking on updates. Two users editing the same document simultaneously = last-write-wins.

**Prevention:** Add optimistic locking to document update operations. Return 409 Conflict on version mismatch.

**Phase mapping:** Data integrity phase.

**Confidence:** MEDIUM -- version fields exist but update-path checking not verified.

---

### Pitfall 18: No Request Timeout on Express Routes

**What goes wrong:** Express has no built-in request timeout. A hanging handler holds a connection indefinitely.

**Prevention:** Add global 30s timeout middleware. Add Prisma query-level timeouts. Configure reverse proxy timeout.

**Phase mapping:** Infrastructure hardening phase.

**Confidence:** HIGH -- confirmed `index.ts` has no timeout middleware.

---

### Pitfall 19: Error Handler Leaks Internal Details

**What goes wrong:** `error-handler.ts` returns `err.message` when `NODE_ENV` is not `production`. Prisma error messages contain table names and query details.

**Prevention:** Default to production error mode. Never expose Prisma error details. Enforce `NODE_ENV=production` in deployment.

**Phase mapping:** Security hardening phase.

**Confidence:** HIGH -- verified by reading `error-handler.ts`.

---

### Pitfall 20: N+1 Queries on MR Stock Checking and Dashboards

**What goes wrong:** `mr.service.ts:205-265` makes O(n*m) database queries. Dashboard pages make 8+ sequential queries per load.

**Prevention:** Use existing `getStockLevelsBatch()`. Combine dashboard metrics into single queries.

**Phase mapping:** Performance optimization phase.

**Confidence:** HIGH -- from CONCERNS.md.

---

### Pitfall 21: PII in Structured Logs

**What goes wrong:** Pino JSON logging can capture Authorization headers, tokens, and user data in log aggregation services.

**Prevention:** Add Pino `redact` config: `['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token']`. Search logs for "Bearer" and `eyJ` patterns.

**Phase mapping:** Security hardening phase.

**Confidence:** MEDIUM -- standard concern; exact Pino redact config not verified.

---

## Minor Pitfalls

---

### Pitfall 22: Missing Database Indexes on High-Volume Tables

**What goes wrong:** Missing composite indexes on `InventoryLevel(itemId, lastMovementDate)`, `InventoryLot(supplierId, expiryDate)`, `Shipment(freightForwarderId, destinationWarehouseId)`, `JobOrder(entityId)`.

**Prevention:** Run `EXPLAIN ANALYZE`, add indexes with `CREATE INDEX CONCURRENTLY`, monitor slow query log.

**Phase mapping:** Performance optimization phase.

**Confidence:** HIGH -- from CONCERNS.md.

---

### Pitfall 23: AG-Grid Deprecation Warnings

**What goes wrong:** AG-Grid v32.2+ deprecations become breaking changes in v33+.

**Prevention:** Pin AG-Grid version. Update configuration before upgrading.

**Phase mapping:** Dependency maintenance. Deferrable.

**Confidence:** MEDIUM.

---

### Pitfall 24: Oracle PO Sync Module Half-Wired

**What goes wrong:** Uses `console.error` not structured logger, no route registration, no scheduler wiring.

**Prevention:** Wire properly or remove entirely.

**Phase mapping:** Code cleanup phase.

**Confidence:** HIGH.

---

### Pitfall 25: Chart Rendering in Hidden Containers

**What goes wrong:** Recharts reports negative dimensions when charts are in collapsed containers.

**Prevention:** Use `ResizeObserver` to delay rendering until container has positive dimensions.

**Phase mapping:** UI polish phase.

**Confidence:** HIGH.

---

### Pitfall 26: Socket.IO `join:document` Probes All Tables

**What goes wrong:** Joining a document room queries 8 tables sequentially to determine document type.

**Prevention:** Accept document type as client parameter. Validate against type-to-table mapping.

**Phase mapping:** Performance optimization phase.

**Confidence:** MEDIUM.

---

## Supply Chain Domain-Specific Warnings

---

### Domain Pitfall A: Launching Without FIFO/FEFO Enforcement

**What goes wrong:** MI (Material Issue) does not enforce FIFO or FEFO lot selection. Operators manually select lots. Expired goods can be issued, and COGS calculations are incorrect.

**Industry context:** For regulated materials, FEFO is a compliance requirement. Even for construction materials, incorrect costing means financial reports diverge from reality.

**Prevention:**
1. Add `suggestLots()` returning lots in FIFO/FEFO order
2. Make FIFO the default with audited manual override
3. Data model already supports this (`receiptDate`, `expiryDate` fields with `idx_inventory_lots_fifo` index)

**Phase mapping:** Feature completion phase.

**Confidence:** HIGH -- confirmed by CONCERNS.md and schema review.

---

### Domain Pitfall B: No Inventory Reconciliation Job

**What goes wrong:** No automated reconciliation. Discrepancies accumulate: GRNs without lots, transfers without decrements, failed stock movements.

**Industry precedent:** Finish Line lost ~$30M from WMS implementation errors. PWC reports 55% of companies struggle with warehouse data quality.

**Prevention:**
1. Build nightly reconciliation: `sum(GRN qty) - sum(MI qty) +/- sum(transfer qty) = InventoryLevel.qtyOnHand` per item/warehouse
2. Flag discrepancies above configurable threshold
3. Include results in operations dashboard
4. Require sign-off before month-end close

**Phase mapping:** Reporting/compliance phase. Must be in place before production data is trusted financially.

**Confidence:** HIGH -- standard industry requirement; no reconciliation logic in codebase.

---

### Domain Pitfall C: Document Number Generation Under Concurrency

**What goes wrong:** `generateDocumentNumber()` creates sequential numbers. Concurrent requests may produce duplicates, violating unique constraints.

**Prevention:**
1. Verify it uses a database sequence or `SELECT ... FOR UPDATE` inside the transaction
2. Add retry for unique constraint violations
3. Test with 10 parallel requests

**Phase mapping:** Data integrity phase.

**Confidence:** MEDIUM -- function exists but implementation not reviewed in detail.

---

## Phase-Specific Warnings Summary

| Phase Topic | Likely Pitfall | Mitigation | Severity |
|-------------|---------------|------------|----------|
| Security hardening | localStorage JWT theft (P5) | Migrate to httpOnly cookies + CSRF | Critical |
| Security hardening | AI module SQL injection (P4) | SQL AST validation, audit logging | Critical |
| Security hardening | Unbounded string inputs (P12) | Add `.max()` to all Zod schemas | High |
| Security hardening | Error handler info leak (P19) | Default to production error mode | Moderate |
| Security hardening | PII in logs (P21) | Pino redact configuration | Moderate |
| Data integrity | Approval state corruption (P1) | Wrap `processApproval` in `$transaction` | Critical |
| Data integrity | Inventory inconsistency (P2) | Make `tx` required on stock operations | Critical |
| Data integrity | Soft delete leakage (P9) | Extend Prisma middleware to all query methods | High |
| Data integrity | Float precision (P13) | Migrate Float to Decimal | High |
| Data integrity | Concurrent document edits (P17) | Add optimistic locking to document updates | Moderate |
| Performance | Bin cards self-DoS (P10) | Add pagination + query timeout | High |
| Performance | Connection pool exhaustion (P10) | Configure pool size, add query timeouts | High |
| Performance | Missing indexes (P22) | Add composite indexes with CONCURRENTLY | Minor |
| Performance | N+1 queries (P20) | Use existing batch functions | Moderate |
| Performance | No request timeout (P18) | Add global 30s timeout middleware | Moderate |
| Infrastructure | Prisma migration format (P3) | Re-baseline to timestamp format | Critical |
| Infrastructure | BullMQ job drain (P7) | Add `shutdownQueues()` to shutdown | Critical |
| Infrastructure | Redis eviction (P6) | Set `noeviction` policy | Critical |
| Infrastructure | CORS misconfiguration (P11) | Required CORS_ORIGIN in production | High |
| Infrastructure | Source maps (P14) | Use `sourcemap: 'hidden'` | Moderate |
| Infrastructure | Socket.IO scaling (P16) | Add Redis adapter | Moderate |
| UX | Rate limiter logout (P8) | Per-user rate limiting | High |
| Feature completion | No FIFO/FEFO (DA) | Add lot suggestion to MI | High |
| Operations | No reconciliation (DB) | Build nightly reconciliation job | High |

---

## Sources

- [Panorama Consulting: Supply Chain Implementation Failures](https://panorama-consulting.com/supply-chain-implementation-failure/)
- [Hardening Prisma for Production: Resilient Connection Handling](https://dev.to/lcnunes09/hardening-prisma-for-production-resilient-connection-handling-in-nodejs-apis-41dm)
- [Sitepoint: Hardening Node.js Apps in Production](https://www.sitepoint.com/hardening-node-js-apps-in-production/)
- [Prisma Connection Pool Documentation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- [Prisma Development and Production Workflows](https://www.prisma.io/docs/orm/prisma-migrate/workflows/development-and-production)
- [Prisma Production Troubleshooting](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)
- [Express Security Best Practices (Official)](https://expressjs.com/en/advanced/best-practice-security.html)
- [Corgea: Express Security Best Practices 2025](https://hub.corgea.com/articles/express-security-best-practices-2025)
- [NetSuite: 10 Causes of Inventory Discrepancies](https://www.netsuite.com/portal/resource/articles/inventory-management/inventory-discrepancies.shtml)
- [Cadre: 10 Common WMS Implementation Mistakes](https://www.cadretech.com/10-common-wms-implementation-mistakes/)
- [Hopstack: 6 Challenges in WMS Implementation](https://www.hopstack.io/blog/pitfalls-in-wms-implementation)
- [Epicflow: ERP Implementation Failures](https://www.epicflow.com/blog/erp-implementation-failures/)
- [TanStack Query: Rate Limiting Discussion](https://github.com/TanStack/query/discussions/4609)
- [BullMQ Going to Production Guide](https://docs.bullmq.io/guide/going-to-production)
- Codebase analysis: `approval.service.ts`, `prisma.ts`, `rate-limiter.ts`, `cors.ts`, `env.ts`, `error-handler.ts`, `index.ts`, `grn.service.ts`, `ai-chat.service.ts`, `attachment.routes.ts`, inventory Prisma schemas

---

*Pitfalls audit: 2026-03-22*
