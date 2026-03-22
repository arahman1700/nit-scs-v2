---
phase: 04-infrastructure-and-deployment
plan: 01
subsystem: infra
tags: [express, bullmq, prisma, env-validation, timeout, graceful-shutdown]

# Dependency graph
requires:
  - phase: 03-security-and-input-validation
    provides: CORS validation, rate limiter, sanitization middleware
provides:
  - Production env validation (REDIS_URL, connection_limit)
  - BullMQ graceful shutdown in server lifecycle
  - Configurable body parser limit (256kb default)
  - Request timeout middleware (30s default)
  - Prisma eager connect at startup
  - Configurable shutdown/drain timeouts
affects: [04-02, deployment, monitoring]

# Tech tracking
tech-stack:
  added: []
  patterns: [production-conditional-validation, configurable-infrastructure-defaults, fail-fast-startup]

key-files:
  created:
    - packages/backend/src/middleware/request-timeout.ts
  modified:
    - packages/backend/src/config/env.ts
    - packages/backend/src/index.ts
    - packages/backend/src/utils/prisma.ts

key-decisions:
  - "Production-conditional env validation via Zod .refine() -- dev/test unaffected"
  - "BullMQ shutdown before HTTP drain -- workers finish current jobs before connections close"
  - "256kb body limit default (down from 2mb) -- configurable via BODY_SIZE_LIMIT env var"

patterns-established:
  - "Production-conditional validation: use .refine() with process.env.NODE_ENV check for prod-only requirements"
  - "Infrastructure env defaults: SHUTDOWN_TIMEOUT_MS, BODY_SIZE_LIMIT, REQUEST_TIMEOUT_MS with sane defaults"

requirements-completed: [INFR-02, INFR-04, INFR-07, INFR-08, INFR-09]

# Metrics
duration: 3min
completed: 2026-03-22
---

# Phase 04 Plan 01: Production Runtime Hardening Summary

**Production env validation for REDIS_URL/connection_limit, BullMQ graceful shutdown, 256kb body limit, 30s request timeout, and Prisma eager connect at startup**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-22T01:11:03Z
- **Completed:** 2026-03-22T01:14:09Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Production env validation rejects missing REDIS_URL and DATABASE_URL without connection_limit at startup
- BullMQ workers drain gracefully before HTTP connections close on SIGTERM/SIGINT
- Body parser limit reduced from 2mb to configurable 256kb (DoS protection)
- All requests have a 30s timeout via middleware returning 408
- Prisma connects eagerly at startup and exits if database is unreachable
- Shutdown/drain/force-exit timeouts are all configurable via env vars

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden env validation and add request timeout middleware** - `072cd91` (feat)
2. **Task 2: Wire BullMQ shutdown, body parser limit, request timeout, and Prisma eager connect into index.ts** - `e3e99b8` (feat)

## Files Created/Modified
- `packages/backend/src/config/env.ts` - Added production-conditional REDIS_URL/connection_limit validation, SHUTDOWN_TIMEOUT_MS/BODY_SIZE_LIMIT/REQUEST_TIMEOUT_MS env vars
- `packages/backend/src/middleware/request-timeout.ts` - New middleware returning 408 after configurable timeout
- `packages/backend/src/index.ts` - Wired shutdownQueues, requestTimeout, configurable body limit, Prisma eager connect, configurable drain/force-exit timeouts
- `packages/backend/src/utils/prisma.ts` - Added PRISMA_DEBUG env var for query logging

## Decisions Made
- Production-conditional env validation via Zod `.refine()` keeps dev/test environments unaffected
- BullMQ shutdown is called before HTTP drain loop so workers finish current jobs before connections close
- Body limit reduced from 2mb to 256kb (configurable) to reduce DoS attack surface
- Prisma static import replaces dynamic import in shutdown for consistency

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required. All new env vars have sensible defaults. Production deployments should verify REDIS_URL and DATABASE_URL (with connection_limit) are set.

## Next Phase Readiness
- Backend runtime is hardened for production deployment
- Ready for 04-02 (remaining infrastructure tasks)
- All infrastructure env vars are configurable with production-safe defaults

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 04-infrastructure-and-deployment*
*Completed: 2026-03-22*
