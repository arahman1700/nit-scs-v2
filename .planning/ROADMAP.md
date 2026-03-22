# Roadmap: NIT Supply Chain V2 -- Production Readiness

## Overview

This roadmap takes the NIT Supply Chain V2 system from its current feature-complete-but-fragile state to production readiness. The work is entirely hardening and stabilization -- no new features. The critical path starts with transaction safety (the foundation everything depends on), progresses through security, infrastructure, and performance fixes, then systematically verifies all workflows before adding production monitoring. Every phase delivers a specific, verifiable improvement to system reliability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Transaction Safety** - All stock-modifying operations and approval workflows wrapped in atomic transactions
- [ ] **Phase 2: Data Layer Cleanup** - Soft-delete, precision, and code duplication issues resolved at the data layer
- [ ] **Phase 3: Security Hardening** - Authentication, input validation, and attack surface reduced to production-safe levels
- [ ] **Phase 4: Infrastructure and Deployment** - System can be reliably deployed to production with CI/CD, graceful shutdown, and correct configuration
- [ ] **Phase 5: Performance and Stability** - System performs well under realistic data volumes with proper indexing, caching, and query optimization
- [ ] **Phase 6: Code Quality** - Large components refactored, tests reliable, workflow engine stable, schema validation enforced
- [ ] **Phase 7: End-to-End Verification** - Every core workflow verified to function correctly across all document types, roles, and languages
- [ ] **Phase 8: Production Observability** - Monitoring, metrics, correlation IDs, and reconciliation jobs ready for production operations

## Phase Details

### Phase 1: Transaction Safety
**Goal**: Every stock-modifying operation and approval transition is atomic -- no partial commits, no ghost inventory, no stuck documents
**Depends on**: Nothing (first phase)
**Requirements**: DINT-01, DINT-02, DINT-03, DINT-04, DINT-07
**Success Criteria** (what must be TRUE):
  1. Creating a GRN with 5 line items either fully commits (document + all stock movements + audit log) or fully rolls back -- never partial
  2. Approving a document updates the approval step, advances the document status, and triggers stock effects in a single atomic operation -- a crash mid-approval leaves no orphaned state
  3. ASN line items correctly reference their UOM (not itemId) and GRN totalValue reflects actual line item calculations in the initial response
  4. Domain events (Socket.IO notifications, email triggers) fire only after the database transaction commits -- never for rolled-back operations
**Plans**: 2 plans

Plans:
- [x] 01-01-PLAN.md -- Transaction foundation: P2034 error handling, tx-aware audit, ASN UOM fix, GRN totalValue verification, post-commit low-stock alerts
- [x] 01-02-PLAN.md -- Approval state machine: wrap processApproval/submitForApproval in $transaction, fix MI approve split-transaction

### Phase 2: Data Layer Cleanup
**Goal**: Data layer is precise, consistent, and free of duplication -- soft deletes are reliable, quantities are exact, and redundant services are unified
**Depends on**: Phase 1
**Requirements**: DINT-05, DINT-06, DINT-08, DINT-09
**Success Criteria** (what must be TRUE):
  1. Querying any table with soft-deleted records via findUnique, aggregate, or groupBy automatically excludes deleted records without explicit where clauses
  2. Cycle count quantities, staging assignments, and packing line amounts use Decimal types -- no floating-point rounding errors on financial/quantity calculations
  3. The WT (stock transfer) endpoint uses a single service implementation -- no duplicated logic between wt.service.ts and stock-transfer.service.ts
  4. totalValue calculation is consistent across all document types, computed by a single shared utility function
**Plans**: 1 plan

Plans:
- [ ] 02-01-PLAN.md -- Extend soft-delete to findUnique/aggregate/groupBy, extract shared totalValue utility, verify DINT-06 and DINT-08 pre-resolved

### Phase 3: Security Hardening
**Goal**: Authentication is stable, all user input is bounded, and known attack vectors (SQL injection, XSS, info leakage) are closed
**Depends on**: Phase 1
**Requirements**: SECR-01, SECR-02, SECR-03, SECR-04, SECR-05, SECR-06, SECR-07
**Success Criteria** (what must be TRUE):
  1. A user navigating rapidly between pages (10+ route changes in 5 seconds) is not logged out by the rate limiter
  2. Submitting a 10,000-character string in any text field is rejected by server-side validation before reaching the database
  3. The AI chat module cannot execute arbitrary SQL -- all generated queries are validated, logged, and run against a read-only database connection
  4. Production error responses contain no stack traces, internal paths, or implementation details
  5. Log output contains no passwords, tokens, or email addresses in any log level
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD

### Phase 4: Infrastructure and Deployment
**Goal**: The system can be deployed to production via CI/CD with proper configuration, graceful shutdown, and environment validation
**Depends on**: Phase 1
**Requirements**: INFR-01, INFR-02, INFR-03, INFR-04, INFR-05, INFR-06, INFR-07, INFR-08, INFR-09
**Success Criteria** (what must be TRUE):
  1. Running `prisma migrate deploy` against a fresh database succeeds without manual intervention -- all migrations apply in order
  2. Deploying a new version drains all in-progress BullMQ jobs (up to 15 seconds) before the process exits -- no stalled or lost jobs
  3. Starting the application without REDIS_URL or without connection_limit in DATABASE_URL fails immediately with a clear error message
  4. The Docker container runs with dumb-init, a pinned Node.js version, 256KB body parser limit, and 30-second request timeouts
  5. Production source maps are hidden (not served to browsers) and Prisma connects with explicit pool configuration at startup
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

### Phase 5: Performance and Stability
**Goal**: The system handles realistic data volumes without hanging, excessive query counts, or missing index scans
**Depends on**: Phase 2, Phase 4
**Requirements**: PERF-01, PERF-02, PERF-03, PERF-04, PERF-05, PERF-06, PERF-07
**Success Criteria** (what must be TRUE):
  1. The bin cards / stock ledger page loads within 3 seconds for items with 1000+ movements -- paginated results, no browser hang
  2. Loading the MR creation form with 50 line items does not trigger N+1 queries -- stock levels are fetched in a single batch query
  3. Master data lists (items, suppliers, warehouses) are served from cache on repeated requests within the TTL window, with cache invalidated on mutations
  4. The frontend production bundle uses vendor chunk splitting -- React, Prisma client, and other large libraries load from separate cached chunks
  5. No route shadowing warnings appear on server startup -- all static routes are mounted before dynamic parameter routes
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

### Phase 6: Code Quality
**Goal**: Large components are maintainable, tests are reliable, and dynamic configuration is validated before saving
**Depends on**: Phase 1
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04
**Success Criteria** (what must be TRUE):
  1. YardDashboard, NotificationRulesPage, and DynamicTypeBuilderPage are each under 400 lines with logic extracted into sub-components
  2. Running the full test suite 5 times in a row produces zero socket hang failures in cycle-count or dashboard-builder tests
  3. Modifying a workflow rule immediately reflects in the next rule evaluation -- no stale cache serving outdated rules
  4. Saving a dynamic document type with an invalid status flow (e.g., circular transitions) is rejected with a validation error
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: End-to-End Verification
**Goal**: Every core user workflow is verified to function correctly -- documents flow from creation through approval to stock effects, across all roles and in both languages
**Depends on**: Phase 3, Phase 5, Phase 6
**Requirements**: VERF-01, VERF-02, VERF-03, VERF-04, VERF-05, VERF-06, VERF-07
**Success Criteria** (what must be TRUE):
  1. Each of the 7 core document types (GRN, MI, MRN, MR, WT, QCI, DR) can be created, submitted, approved, and completed -- with correct stock level changes visible in inventory after each transition
  2. A multi-level approval chain (3 levels, sequential) and a parallel approval (2 approvers at same level) both resolve correctly, including when one approver is slow
  3. Logging in as each of the 13 roles navigates to a working dashboard with appropriate menu items -- no broken pages or 404s
  4. Switching to Arabic (RTL) renders all pages correctly -- no overlapping text, reversed layouts function properly, and switching back to English restores LTR
  5. Exporting any document type to PDF produces a correctly formatted file with all line items and header data
**Plans**: TBD

Plans:
- [ ] 07-01: TBD
- [ ] 07-02: TBD
- [ ] 07-03: TBD

### Phase 8: Production Observability
**Goal**: The production system has monitoring, alerting, request tracing, and automated reconciliation to detect and diagnose issues before users report them
**Depends on**: Phase 7
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05
**Success Criteria** (what must be TRUE):
  1. Sentry captures errors with Prisma query spans visible in trace waterfall, sampling at 10% to control costs
  2. Prometheus /metrics endpoint exposes connection pool utilization, active Socket.IO client count, and document creation/approval counters per type
  3. Every log line and Sentry event within a single HTTP request shares the same correlation ID, set via AsyncLocalStorage
  4. A nightly reconciliation job compares computed inventory levels against the stock ledger and flags discrepancies above a configurable threshold
**Plans**: TBD

Plans:
- [ ] 08-01: TBD
- [ ] 08-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Transaction Safety | 0/2 | Planning complete | - |
| 2. Data Layer Cleanup | 0/1 | Planning complete | - |
| 3. Security Hardening | 0/2 | Not started | - |
| 4. Infrastructure and Deployment | 0/2 | Not started | - |
| 5. Performance and Stability | 0/2 | Not started | - |
| 6. Code Quality | 0/1 | Not started | - |
| 7. End-to-End Verification | 0/3 | Not started | - |
| 8. Production Observability | 0/2 | Not started | - |
