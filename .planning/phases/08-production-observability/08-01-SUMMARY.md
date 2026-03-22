---
phase: 08-production-observability
plan: 01
subsystem: observability
tags: [asynclocalstorage, sentry, prisma, prometheus, pino, correlation-id, tracing]

# Dependency graph
requires:
  - phase: 04-infrastructure-hardening
    provides: Sentry config, Prometheus metrics registry, Prisma client extensions
provides:
  - AsyncLocalStorage-based request context middleware with correlationId propagation
  - Pino logger mixin for automatic correlationId in every log line
  - Sentry correlationId tag and Prisma tracing integration at 10% sampling
  - prisma_transaction_duration_seconds Prometheus histogram for slow queries
  - optimistic_lock_retries_total Prometheus counter for version conflict retries
affects: [08-production-observability, monitoring, debugging, incident-response]

# Tech tracking
tech-stack:
  added: []
  patterns: [AsyncLocalStorage request context, pino mixin for auto-injection, chained Prisma $extends]

key-files:
  created:
    - packages/backend/src/middleware/request-context.ts
    - packages/backend/src/middleware/request-context.test.ts
  modified:
    - packages/backend/src/middleware/request-logger.ts
    - packages/backend/src/config/logger.ts
    - packages/backend/src/config/sentry.ts
    - packages/backend/src/index.ts
    - packages/backend/src/infrastructure/metrics/prometheus.ts
    - packages/backend/src/utils/prisma.ts
    - packages/backend/src/domains/inventory/services/inventory.service.ts

key-decisions:
  - "AsyncLocalStorage for request context -- zero-arg correlationId propagation across entire async call chain without parameter threading"
  - "Pino mixin over child logger -- auto-injects correlationId globally instead of requiring per-callsite child loggers"
  - "Only observe Prisma queries >100ms -- avoids flooding histogram with trivial operations, keeps metric focused on actionable slow queries"

patterns-established:
  - "AsyncLocalStorage request context: getCorrelationId() and getRequestContext() available anywhere in async scope"
  - "Chained Prisma $extends: soft-delete extension + metrics extension as separate layers"

requirements-completed: [PROD-01, PROD-03, PROD-04]

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 08 Plan 01: Request Context and Observability Metrics Summary

**AsyncLocalStorage-based correlationId propagation with Sentry Prisma tracing at 10% sampling and Prometheus transaction/lock metrics**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-22T17:34:57Z
- **Completed:** 2026-03-22T17:42:25Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- AsyncLocalStorage request context middleware providing zero-argument correlationId access across the entire async call chain
- Every pino log line automatically includes correlationId via mixin; Sentry events tagged with correlationId for cross-service tracing
- Sentry tracesSampleRate reduced from 30% to 10% in production with Prisma query span integration enabled
- prisma_transaction_duration_seconds histogram and optimistic_lock_retries_total counter registered in Prometheus
- Prisma client extended with query timing layer (chained $extends) that observes slow queries above 100ms threshold
- 6 passing unit tests covering request context propagation, header setting, and metric registration

## Task Commits

Each task was committed atomically:

1. **Task 1: Create AsyncLocalStorage request context and wire into middleware chain, logger, and Sentry** - `647b1b8` (feat)
2. **Task 2 RED: Failing tests for metrics** - `fbeb52a` (test)
3. **Task 2 GREEN: Add transaction duration histogram and optimistic lock retry counter** - `df3c8dc` (feat)

## Files Created/Modified
- `packages/backend/src/middleware/request-context.ts` - AsyncLocalStorage-based request context with correlationId, requestId, userId
- `packages/backend/src/middleware/request-context.test.ts` - 6 unit tests for context propagation and metric registration
- `packages/backend/src/middleware/request-logger.ts` - Reads correlationId from AsyncLocalStorage instead of generating its own
- `packages/backend/src/config/logger.ts` - Pino mixin auto-injects correlationId into every log line
- `packages/backend/src/config/sentry.ts` - 10% sampling, Prisma integration, correlationId tag in beforeSend
- `packages/backend/src/index.ts` - requestContext middleware mounted between requestId and requestLogger
- `packages/backend/src/infrastructure/metrics/prometheus.ts` - Transaction duration histogram and lock retry counter
- `packages/backend/src/utils/prisma.ts` - Chained $extends with query timing for slow queries (>100ms)
- `packages/backend/src/domains/inventory/services/inventory.service.ts` - Increments optimistic lock retry counter

## Decisions Made
- AsyncLocalStorage for request context -- provides zero-argument correlationId propagation across the entire async call chain without needing to thread a context parameter through every function
- Pino mixin over child logger approach -- auto-injects correlationId globally without requiring each callsite to create a child logger
- Only observe Prisma queries exceeding 100ms -- keeps the histogram focused on actionable slow queries rather than flooding it with trivial sub-millisecond operations

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Request context infrastructure is in place for all downstream observability features
- Plan 08-02 can build on correlationId propagation for distributed tracing headers
- Prometheus metrics endpoint already exposes the new histogram and counter

## Self-Check: PASSED

All 9 files verified present. All 3 commits (647b1b8, fbeb52a, df3c8dc) verified in git log.

---
*Phase: 08-production-observability*
*Completed: 2026-03-22*
