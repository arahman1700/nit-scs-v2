# Requirements: NIT Supply Chain V2 -- Production Readiness

**Defined:** 2026-03-22
**Core Value:** Reliable inventory tracking -- every material movement must be atomic, accurate, and audited

## v1 Requirements

Requirements for production launch. Each maps to roadmap phases.

### Data Integrity

- [x] **DINT-01**: All stock-modifying operations (GRN, MI, MRN, MR, WT) wrap stock mutations + document updates in a single Prisma $transaction
- [x] **DINT-02**: Approval state machine (processApproval) wraps all DB calls in a single $transaction with notifications moved post-commit
- [x] **DINT-03**: ASN UOM assignment bug fixed -- line.uomId used instead of line.itemId
- [x] **DINT-04**: GRN totalValue calculated from line items during create transaction, returned in initial response
- [x] **DINT-05**: Soft-delete Prisma extension covers findUnique, aggregate, and groupBy in addition to findMany/findFirst/count
- [x] **DINT-06**: Float-to-Decimal migration for CycleCountLine, StagingAssignment, PackingLine quantity fields
- [x] **DINT-07**: Domain events published AFTER transaction commits, never inside transaction boundaries
- [x] **DINT-08**: WT/stock-transfer service duplication eliminated -- V1 wt.service.ts wraps V2 stock-transfer.service.ts
- [x] **DINT-09**: totalValue calculation extracted to shared utility, used by all document services

### Security

- [x] **SECR-01**: Rate limiter exempts /auth/me endpoint OR switches to per-user rate limiting for authenticated routes
- [x] **SECR-02**: Zod schema string length limits added to all text input fields (max 255 for names, max 500 for descriptions/notes)
- [x] **SECR-03**: AI module SQL injection hardening -- audit logging, read-only DB user, SQL AST validation
- [x] **SECR-04**: CORS configured per-environment with explicit origin allowlist for production
- [x] **SECR-05**: Auth middleware race condition fixed -- explicit return after sendError
- [x] **SECR-06**: Error handler production mode hides stack traces and internal details
- [x] **SECR-07**: Pino PII redaction configured for passwords, tokens, emails in log output

### Infrastructure

- [x] **INFR-01**: Redis maxmemory-policy changed from allkeys-lru to noeviction
- [x] **INFR-02**: BullMQ shutdownQueues() wired into graceful shutdown handler with 15s drain timeout
- [x] **INFR-03**: Prisma migration format re-baselined to consistent timestamp naming for CI/CD compatibility
- [x] **INFR-04**: Production environment validation -- REDIS_URL required, connection_limit in DATABASE_URL enforced
- [x] **INFR-05**: Vite source maps set to 'hidden' for production builds
- [x] **INFR-06**: Dockerfile hardened -- dumb-init installed, Node.js version pinned
- [x] **INFR-07**: Express body parser limit tightened (256KB default instead of unlimited)
- [x] **INFR-08**: Request timeouts added to all Express routes (30s default)
- [x] **INFR-09**: Explicit Prisma $connect() at startup with connection pool configured

### Performance

- [x] **PERF-01**: Bin cards computed endpoint fixed -- pagination added, query timeout enforced
- [x] **PERF-02**: Missing database indexes added: ApprovalStep(documentType, documentId, status), AuditLog(tableName, recordId, createdAt), Notification(recipientId, read, createdAt), JobOrder(entityId), InventoryLevel(itemId, lastMovementDate), InventoryLot(supplierId, expiryDate)
- [x] **PERF-03**: N+1 queries fixed in mr.service.ts and approval.service.ts using batch lookups
- [x] **PERF-04**: Vite vendor chunk splitting configured for optimal browser caching
- [x] **PERF-05**: Route shadowing warnings resolved -- static routes mounted before dynamic ones
- [x] **PERF-06**: Prisma relationJoins preview feature enabled and tested
- [x] **PERF-07**: Caching layer added for master data, approval chains, and permission matrix with TTL and invalidation

### Code Quality

- [x] **QUAL-01**: Large frontend components (800+ LOC) refactored -- sub-components extracted for YardDashboard, NotificationRulesPage, DynamicTypeBuilderPage
- [ ] **QUAL-02**: Test reliability fixed -- socket hang failures in cycle-count and dashboard-builder tests resolved
- [ ] **QUAL-03**: Workflow rule engine cache invalidation added on rule CRUD operations
- [ ] **QUAL-04**: Dynamic document type status flow validated with Zod schema before saving

### Verification

- [ ] **VERF-01**: All 7 core document types (GRN, MI, MRN, MR, WT, QCI, DR) verified end-to-end with stock effects
- [ ] **VERF-02**: Approval workflow verified -- sequential and parallel paths with concurrent scenario testing
- [ ] **VERF-03**: All 13 role-based navigation paths resolve to working pages
- [ ] **VERF-04**: RTL Arabic rendering verified across all pages
- [ ] **VERF-05**: PDF export verified for all document types
- [ ] **VERF-06**: Notification delivery verified for all workflow triggers
- [ ] **VERF-07**: Socket.IO real-time updates verified for all document transitions

### Production Hardening

- [ ] **PROD-01**: Sentry trace sampling reduced to 0.1, Prisma integration added
- [ ] **PROD-02**: Prometheus metrics added: connection pool, Socket.IO clients, business document counters
- [ ] **PROD-03**: AsyncLocalStorage configured for request-scoped correlation IDs
- [ ] **PROD-04**: Transaction duration and optimistic lock retry metrics added
- [ ] **PROD-05**: Nightly inventory reconciliation job implemented

## v2 Requirements

Deferred to post-launch. Tracked but not in current roadmap.

### Enhanced Features

- **FIFO-01**: FIFO/FEFO lot enforcement on MI (automatic lot selection)
- **BARC-01**: Barcode scanning integrated into receiving, picking, and issuing flows
- **OFFL-01**: PWA offline mode completed with full sync
- **FCST-01**: Demand forecasting validated with real data
- **COST-01**: Cost allocation accuracy verified for multi-warehouse scenarios
- **APRL-01**: Parallel approval load tested under concurrent scenarios
- **NODE-01**: Node.js upgraded from 20 LTS to 22 LTS (20 LTS EOL April 2026)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Mobile native app | PWA covers 90% of warehouse floor use cases |
| Full ERP / Oracle PO integration | Batch CSV import sufficient for v1 |
| Supplier portal | Internal-only system for v1 |
| EDI integration | Manual document entry sufficient for v1 |
| Blockchain tracking | No regulatory requirement, high complexity |
| Sustainability/carbon reporting | Not a priority for initial launch |
| ML-based demand forecasting improvements | Basic version exists, defer validation |
| Automated replenishment rules | Manual WT creation sufficient |
| Real-time chat/messaging | Not core to supply chain operations |
| New feature development | Fix-first approach -- stabilize existing code |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| DINT-01 | Phase 1 | Complete |
| DINT-02 | Phase 1 | Complete |
| DINT-03 | Phase 1 | Complete |
| DINT-04 | Phase 1 | Complete |
| DINT-05 | Phase 2 | Complete |
| DINT-06 | Phase 2 | Complete |
| DINT-07 | Phase 1 | Complete |
| DINT-08 | Phase 2 | Complete |
| DINT-09 | Phase 2 | Complete |
| SECR-01 | Phase 3 | Complete |
| SECR-02 | Phase 3 | Complete |
| SECR-03 | Phase 3 | Complete |
| SECR-04 | Phase 3 | Complete |
| SECR-05 | Phase 3 | Complete |
| SECR-06 | Phase 3 | Complete |
| SECR-07 | Phase 3 | Complete |
| INFR-01 | Phase 4 | Complete |
| INFR-02 | Phase 4 | Complete |
| INFR-03 | Phase 4 | Complete |
| INFR-04 | Phase 4 | Complete |
| INFR-05 | Phase 4 | Complete |
| INFR-06 | Phase 4 | Complete |
| INFR-07 | Phase 4 | Complete |
| INFR-08 | Phase 4 | Complete |
| INFR-09 | Phase 4 | Complete |
| PERF-01 | Phase 5 | Complete |
| PERF-02 | Phase 5 | Complete |
| PERF-03 | Phase 5 | Complete |
| PERF-04 | Phase 5 | Complete |
| PERF-05 | Phase 5 | Complete |
| PERF-06 | Phase 5 | Complete |
| PERF-07 | Phase 5 | Complete |
| QUAL-01 | Phase 6 | Complete |
| QUAL-02 | Phase 6 | Pending |
| QUAL-03 | Phase 6 | Pending |
| QUAL-04 | Phase 6 | Pending |
| VERF-01 | Phase 7 | Pending |
| VERF-02 | Phase 7 | Pending |
| VERF-03 | Phase 7 | Pending |
| VERF-04 | Phase 7 | Pending |
| VERF-05 | Phase 7 | Pending |
| VERF-06 | Phase 7 | Pending |
| VERF-07 | Phase 7 | Pending |
| PROD-01 | Phase 8 | Pending |
| PROD-02 | Phase 8 | Pending |
| PROD-03 | Phase 8 | Pending |
| PROD-04 | Phase 8 | Pending |
| PROD-05 | Phase 8 | Pending |

**Coverage:**
- v1 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
