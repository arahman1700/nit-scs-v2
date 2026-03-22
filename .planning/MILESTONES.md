# Milestones

## v1.0 Production Readiness (Shipped: 2026-03-22)

**Phases completed:** 8 phases, 16 plans, 33 tasks

**Key accomplishments:**

- P2034 conflict handling, tx-aware audit logging, ASN UOM bug fix, and post-commit low-stock alert pattern across error-handler, audit, inbound, and inventory services
- Atomic approval state machine with $transaction wrapping, post-commit side effects, and MI approve two-phase sequencing with timeout configuration
- Extended Prisma soft-delete filter to cover findUnique/aggregate/groupBy, extracted shared calculateDocumentTotalValue utility used by GRN/MI/MR services, verified Decimal fields and WT non-duplication
- Zod .max() on all 200+ backend string fields, production-safe error handler hiding internals, Pino PII redaction for passwords/tokens/emails, and auth middleware defense-in-depth
- Per-user rate limiter with /auth/me exemption, production CORS validation rejecting wildcards, and audit-logged AI SQL execution with 20+ dangerous function blocks
- Production env validation for REDIS_URL/connection_limit, BullMQ graceful shutdown, 256kb body limit, 30s request timeout, and Prisma eager connect at startup
- Redis noeviction for BullMQ safety, Dockerfile with dumb-init + pinned Node 20.18, hidden Vite source maps with vendor chunk splitting, and Prisma migration re-baseline to timestamp format
- 6 composite Prisma indexes for ApprovalStep/AuditLog/Notification/InventoryLevel/JobOrder, relationJoins enabled, vendor chunk splitting fixed for pnpm
- Batched bin card N+1 fix (3 queries vs 3N), Redis caching for master data lists and approval chains with mutation invalidation
- Stable test suite verified (247 files, 4954 tests), statusFlow Zod validation with DFS circular detection, rule cache invalidation tested
- Three 1000+ LOC frontend components split into slim orchestrators (63-360 LOC) with 17 co-located sub-component files across 3 subdirectories
- End-to-end lifecycle tests for all 7 core document types verifying stock mutations (addStockBatch, reserveStockBatch, deductStockBatch) and eventBus events at correct transition points
- Sequential/parallel approval chains, N-01/N-06 notification dispatch, and Socket.IO auth + room-based emission verified end-to-end
- 87 tests verifying role-based navigation coverage for all 17 roles, RTL direction toggle with localStorage persistence, and PDF export for 8 document types (GRN, QCI, DR, MI, MRN, MR, WT, IMSF)
- AsyncLocalStorage-based correlationId propagation with Sentry Prisma tracing at 10% sampling and Prometheus transaction/lock metrics
- Prometheus business metrics (Socket.IO clients, document counters, DB pool) with configurable nightly reconciliation threshold and audit trail

---
