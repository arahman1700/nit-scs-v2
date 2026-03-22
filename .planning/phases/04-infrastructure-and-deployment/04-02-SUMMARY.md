---
phase: 04-infrastructure-and-deployment
plan: 02
subsystem: infra
tags: [docker, redis, vite, prisma, dumb-init, source-maps, bullmq]

# Dependency graph
requires:
  - phase: 01-transaction-safety
    provides: stable stock operations that depend on BullMQ job processing
provides:
  - Redis noeviction policy preventing silent BullMQ job key loss
  - Dockerfile with dumb-init for proper SIGTERM forwarding
  - Pinned Node.js 20.18 for reproducible builds
  - Hidden Vite source maps (generate for Sentry, not served to browsers)
  - Expanded vendor chunk splitting for optimal browser caching
  - All Prisma migrations using consistent timestamp naming format
  - start.sh migration rename for existing database compatibility
affects: [05-performance-and-stability, 08-production-observability]

# Tech tracking
tech-stack:
  added: [dumb-init]
  patterns: [noeviction-redis-for-bullmq, hidden-source-maps, vendor-chunk-splitting, timestamp-migration-naming]

key-files:
  created: []
  modified:
    - docker-compose.yml
    - packages/backend/Dockerfile
    - packages/frontend/vite.config.ts
    - packages/backend/start.sh
    - packages/backend/prisma/migrations/20260101000000_baseline/migration.sql
    - packages/backend/prisma/migrations/20260101000001_add_check_constraints/migration.sql

key-decisions:
  - "Redis noeviction over allkeys-lru -- BullMQ requires keys persist; returning errors on full is safer than silent eviction"
  - "Node.js pinned to 20.18 not 20-latest -- reproducible builds across CI and production"
  - "dumb-init for PID 1 signal forwarding -- Node.js misses SIGTERM without it in Docker"
  - "Hidden source maps -- generate .map files for Sentry upload, but Vite marks them so dev servers don't serve them to browsers"
  - "Migration rename to 20260101* timestamps -- consistent with Prisma's expected format, start.sh handles existing databases"

patterns-established:
  - "noeviction Redis policy: all BullMQ-backed services must use noeviction to prevent silent job loss"
  - "dumb-init in Docker: all Node.js containers use dumb-init for proper signal handling"
  - "Vendor chunk naming: vendor-{category} prefix for all manual chunks in Vite"
  - "Timestamp migration naming: all Prisma migrations use YYYYMMDDHHMMSS_name format"

requirements-completed: [INFR-01, INFR-03, INFR-05, INFR-06]

# Metrics
duration: 2min
completed: 2026-03-22
---

# Phase 4 Plan 2: Build and Container Hardening Summary

**Redis noeviction for BullMQ safety, Dockerfile with dumb-init + pinned Node 20.18, hidden Vite source maps with vendor chunk splitting, and Prisma migration re-baseline to timestamp format**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-22T01:11:03Z
- **Completed:** 2026-03-22T01:13:23Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Redis maxmemory-policy changed from allkeys-lru to noeviction, preventing silent BullMQ job key eviction under memory pressure
- Dockerfile hardened with dumb-init (proper SIGTERM forwarding), pinned Node.js 20.18-alpine, and NODE_OPTIONS memory limit
- Vite source maps set to hidden (generated for error tracking tools but not served to browsers) with expanded vendor chunk splitting for better caching
- All Prisma migration directories renamed from non-standard (0000_, 0001_) to timestamp format, with start.sh handling existing database migration table updates

## Task Commits

Each task was committed atomically:

1. **Task 1: Fix Redis eviction, harden Dockerfile, and set hidden source maps** - `adcb602` (feat)
2. **Task 2: Re-baseline Prisma migrations to timestamp format** - `fb9f38c` (chore)

## Files Created/Modified
- `docker-compose.yml` - Redis maxmemory-policy changed to noeviction
- `packages/backend/Dockerfile` - Pinned Node 20.18-alpine, added dumb-init, NODE_OPTIONS, updated CMD
- `packages/frontend/vite.config.ts` - Source maps set to hidden, vendor chunks expanded (react, data, forms, charts, dnd, socket)
- `packages/backend/start.sh` - Added SQL to rename legacy migration entries in _prisma_migrations table
- `packages/backend/prisma/migrations/20260101000000_baseline/` - Renamed from 0000_baseline
- `packages/backend/prisma/migrations/20260101000001_add_check_constraints/` - Renamed from 0001_add_check_constraints

## Decisions Made
- Redis noeviction over allkeys-lru: BullMQ requires keys to persist; returning errors on memory full is safer than silently evicting job keys
- Node.js pinned to 20.18 (not floating 20-latest): ensures reproducible builds across CI and production environments
- dumb-init for PID 1: Node.js does not properly handle SIGTERM as PID 1 in containers; dumb-init forwards signals correctly
- Hidden source maps: .map files are generated (for Sentry/error tracking upload) but marked hidden so Vite-based dev servers don't serve them
- Migration timestamps use 20260101 as base date: safely sorts before the actual development migrations (20260312+) while being clearly a "re-baseline" date

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 4 is complete (both plans executed): backend runtime hardening (04-01) and build/container hardening (04-02)
- System is ready for Phase 5 (Performance and Stability) which depends on Phase 2 and Phase 4
- Vendor chunk splitting in Vite prepares the frontend for Phase 5 caching optimization
- Timestamp migration format ensures prisma migrate deploy works cleanly in CI/CD

## Self-Check: PASSED

All 6 claimed files exist. Both task commits (adcb602, fb9f38c) verified in git log.

---
*Phase: 04-infrastructure-and-deployment*
*Completed: 2026-03-22*
