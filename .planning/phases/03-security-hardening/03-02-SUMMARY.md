---
phase: 03-security-hardening
plan: 02
subsystem: security
tags: [rate-limiter, cors, ai-sql, audit-logging, sql-injection, express]

# Dependency graph
requires:
  - phase: 01-transaction-safety
    provides: createAuditLog with tx-aware param and audit service action types
provides:
  - Per-user rate limiter with exemptPaths for session-maintenance endpoints
  - Production-validated CORS config rejecting wildcard and localhost origins
  - AI SQL query audit logging to AuditLog table
  - Dangerous PostgreSQL function detection in SQL validator (20+ functions blocked)
affects: [04-data-layer-cleanup, 06-production-readiness]

# Tech tracking
tech-stack:
  added: []
  patterns: [exempt-paths rate limiter pattern, production env validation with Zod refine]

key-files:
  created: []
  modified:
    - packages/backend/src/middleware/rate-limiter.ts
    - packages/backend/src/routes/index.ts
    - packages/backend/src/config/cors.ts
    - packages/backend/src/config/env.ts
    - packages/backend/src/domains/ai-services/services/ai-chat.service.ts
    - packages/backend/src/domains/ai-services/services/ai-schema-context.ts
    - packages/backend/src/domains/audit/services/audit.service.ts

key-decisions:
  - "exemptPaths set-based lookup for rate limiter -- O(1) per request, no regex overhead"
  - "AI audit uses existing AuditLog table with new ai_query/ai_block actions -- no schema migration needed"
  - "Dangerous function detection uses function_name( pattern (not just keyword) to avoid false positives on column names"

patterns-established:
  - "Exempt-paths pattern: rateLimiter(limit, window, exemptPaths[]) for skipping specific paths"
  - "Production env validation: Zod .refine() for environment-specific constraints"

requirements-completed: [SECR-01, SECR-03, SECR-04]

# Metrics
duration: 5min
completed: 2026-03-22
---

# Phase 03 Plan 02: Rate Limiter, CORS Hardening, AI SQL Audit Summary

**Per-user rate limiter with /auth/me exemption, production CORS validation rejecting wildcards, and audit-logged AI SQL execution with 20+ dangerous function blocks**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-22T00:34:33Z
- **Completed:** 2026-03-22T00:39:19Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- Rate limiter exempts /auth/me and /auth/refresh so rapid SPA navigation (10+ pages in 5s) no longer triggers 429 on session-check calls
- CORS rejects wildcard '*' and localhost origins in production mode with startup throw and Zod env validation
- Every AI-generated SQL query is audit-logged to AuditLog table with userId, query text, and validation result
- SQL validator blocks 20+ dangerous PostgreSQL functions (pg_terminate_backend, dblink, version, inet_server_addr, etc.)

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix rate limiter for authenticated SPA usage** - `a94c1d0` (fix)
2. **Task 2: Harden CORS config and AI SQL audit logging** - `3b151ff` (feat)

## Files Created/Modified
- `packages/backend/src/middleware/rate-limiter.ts` - Added exemptPaths param and authenticatedRateLimiter() per-user function
- `packages/backend/src/routes/index.ts` - Pass ['/auth/me', '/auth/refresh'] as exempt paths
- `packages/backend/src/config/cors.ts` - Production validation: reject wildcard, warn on localhost, log origins at startup
- `packages/backend/src/config/env.ts` - Zod refine() for CORS_ORIGIN production validation
- `packages/backend/src/domains/ai-services/services/ai-chat.service.ts` - Audit log every AI query attempt, post-execution info log
- `packages/backend/src/domains/ai-services/services/ai-schema-context.ts` - Block 20+ dangerous PostgreSQL functions
- `packages/backend/src/domains/audit/services/audit.service.ts` - Added ai_query and ai_block action types

## Decisions Made
- Used exemptPaths Set-based lookup for O(1) path check per request rather than regex matching
- AI audit uses existing AuditLog table with new ai_query/ai_block actions to avoid schema migration
- Dangerous function detection checks for `function_name(` pattern (not just keyword) to avoid false positives on column names like "version"
- CORS throws on startup in production with wildcard (fail-fast) rather than silently allowing bad config

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added logger import to cors.ts**
- **Found during:** Task 2 (CORS hardening)
- **Issue:** Plan showed using console.warn but project uses structured logger
- **Fix:** Imported logger from config/logger.js and used logger.warn/info instead of console
- **Files modified:** packages/backend/src/config/cors.ts
- **Verification:** Build passes, consistent with project logging patterns
- **Committed in:** 3b151ff (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Minor improvement to use structured logging instead of console. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Security hardening phase complete (plans 01 and 02)
- Rate limiter, CORS, and AI SQL validation are hardened for production
- Ready for Phase 04 (data-layer-cleanup)

## Self-Check: PASSED

All 7 modified files verified on disk. Both task commits (a94c1d0, 3b151ff) verified in git log. SUMMARY.md exists.

---
*Phase: 03-security-hardening*
*Completed: 2026-03-22*
