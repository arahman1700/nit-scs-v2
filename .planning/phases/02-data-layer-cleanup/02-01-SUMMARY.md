---
phase: 02-data-layer-cleanup
plan: 01
subsystem: database
tags: [prisma, soft-delete, refactoring, document-value, data-integrity]

# Dependency graph
requires:
  - phase: 01-transaction-safety
    provides: transaction-wrapped stock operations and safe status transitions
provides:
  - Soft-delete extension covering findUnique, aggregate, groupBy (in addition to existing findMany, findFirst, count)
  - Shared calculateDocumentTotalValue utility for GRN, MI, MR services
  - Verification evidence that DINT-06 (Decimal fields) and DINT-08 (WT duplication) are pre-resolved
affects: [security, reporting, inventory]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shared value calculation utility extracted from duplicated service logic"
    - "Prisma $extends query middleware pattern for all read-type operations"

key-files:
  created:
    - packages/backend/src/utils/document-value.ts
    - packages/backend/src/utils/document-value.test.ts
  modified:
    - packages/backend/src/utils/prisma.ts
    - packages/backend/src/utils/prisma.test.ts
    - packages/backend/src/domains/inbound/services/grn.service.ts
    - packages/backend/src/domains/outbound/services/mi.service.ts
    - packages/backend/src/domains/outbound/services/mr.service.ts

key-decisions:
  - "findUnique gets soft-delete filter added via $extends (Prisma 5+ supports extra where fields in extension middleware)"
  - "calculateDocumentTotalValue skips lines with cost <= 0 (matches existing behavior across all three services)"
  - "MR service preserves itemId null-check via .filter() before .map() to maintain behavioral parity"

patterns-established:
  - "Shared utility pattern: extract common calculations to packages/backend/src/utils/ with dedicated test file"
  - "Prisma soft-delete extension covers all read methods: findMany, findFirst, findUnique, count, aggregate, groupBy"

requirements-completed: [DINT-05, DINT-06, DINT-08, DINT-09]

# Metrics
duration: 6min
completed: 2026-03-22
---

# Phase 02 Plan 01: Data Layer Cleanup Summary

**Extended Prisma soft-delete filter to cover findUnique/aggregate/groupBy, extracted shared calculateDocumentTotalValue utility used by GRN/MI/MR services, verified Decimal fields and WT non-duplication**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-22T00:14:53Z
- **Completed:** 2026-03-22T00:20:33Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments
- Soft-delete Prisma extension now covers all 6 query methods (findMany, findFirst, findUnique, count, aggregate, groupBy) preventing deleted records from leaking through any read path
- Shared `calculateDocumentTotalValue` utility created with 8 test cases covering all edge cases (null, undefined, zero, Decimal coercion)
- GRN, MI, MR services refactored to use shared utility -- eliminated 17 lines of duplicated calculation logic
- DINT-06 verified: CycleCountLine, StagingAssignment, PackingLine all use Decimal(12,3)
- DINT-08 verified: No wt.service.ts exists, wt.routes.ts delegates to stock-transfer.service.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend soft-delete Prisma extension and verify DINT-06/DINT-08** - `ab3a259` (feat)
2. **Task 2: Extract shared calculateDocumentTotalValue utility** - `0ed20bd` (feat)
3. **Task 3: Refactor GRN, MI, MR services to use shared calculateDocumentTotalValue** - `fe072aa` (refactor)

## Files Created/Modified
- `packages/backend/src/utils/prisma.ts` - Added findUnique, aggregate, groupBy handlers to soft-delete extension
- `packages/backend/src/utils/prisma.test.ts` - Added 4 test cases for new query method coverage
- `packages/backend/src/utils/document-value.ts` - New shared utility with ValueLine interface and calculateDocumentTotalValue function
- `packages/backend/src/utils/document-value.test.ts` - 8 test cases covering all edge cases
- `packages/backend/src/domains/inbound/services/grn.service.ts` - Replaced inline totalValue loop with shared utility
- `packages/backend/src/domains/outbound/services/mi.service.ts` - Replaced inline estimatedValue loop with shared utility
- `packages/backend/src/domains/outbound/services/mr.service.ts` - Replaced inline totalEstimatedValue loop with shared utility

## Decisions Made
- Added soft-delete filter to findUnique via Prisma $extends query middleware -- Prisma 5+ supports additional where fields in extension middleware, so adding deletedAt: null works correctly
- calculateDocumentTotalValue uses Number() coercion for Prisma Decimal compatibility, skips lines where cost <= 0 (matching existing behavior in all three services)
- MR service filter-before-map pattern preserves the itemId null check from the original inline loop

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Data layer hardened: soft-delete extension is comprehensive, document value calculation is centralized
- Ready for Phase 03 (security hardening) -- data integrity foundations are solid
- All 119 existing service tests pass unchanged, confirming zero behavioral regression

## Self-Check: PASSED

All 7 files verified present. All 3 task commits verified in git log.

---
*Phase: 02-data-layer-cleanup*
*Completed: 2026-03-22*
