---
phase: 07-end-to-end-verification
plan: 01
subsystem: testing
tags: [vitest, service-tests, lifecycle, stock-effects, eventBus, prisma-mock]

# Dependency graph
requires:
  - phase: 01-transaction-safety
    provides: "Safe status transitions, addStockBatch, reserveStockBatch, deductStockBatch transactional patterns"
  - phase: 02-data-layer
    provides: "Soft delete filters, document value utility"
provides:
  - "End-to-end lifecycle tests for all 7 core document types (GRN, QCI, DR, MI, MRN, MR, WT)"
  - "Stock effect verification: addStockBatch, reserveStockBatch, deductStockBatch assertions at correct lifecycle points"
  - "EventBus publish assertions for document:status_changed events"
affects: [07-end-to-end-verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "describe('end-to-end lifecycle') block appended to existing service test files"
    - "eventBus mock pattern: vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }))"
    - "safeStatusUpdate functional mock: delegates to delegate.updateMany for test compatibility"

key-files:
  created: []
  modified:
    - "packages/backend/src/domains/inbound/services/grn.service.test.ts"
    - "packages/backend/src/domains/inbound/services/qci.service.test.ts"
    - "packages/backend/src/domains/inbound/services/dr.service.test.ts"
    - "packages/backend/src/domains/outbound/services/mi.service.test.ts"
    - "packages/backend/src/domains/outbound/services/mrn.service.test.ts"
    - "packages/backend/src/domains/outbound/services/mr.service.test.ts"
    - "packages/backend/src/domains/transfers/services/stock-transfer.service.test.ts"

key-decisions:
  - "WT stock effects verified across ship() and receive() instead of complete() -- actual implementation splits deduct/add across ship and receive, not complete"
  - "Added eventBus and safeStatusUpdate mocks to GRN and WT test files that previously lacked them, enabling both assertion and isolation"

patterns-established:
  - "Lifecycle test block pattern: describe('end-to-end lifecycle') appended at end of each service test file"
  - "Stock effect assertion pattern: verify addStockBatch/reserveStockBatch/deductStockBatch called with correct items, quantities, and warehouse IDs"

requirements-completed: [VERF-01]

# Metrics
duration: 13min
completed: 2026-03-22
---

# Phase 07 Plan 01: Core Document Lifecycle Tests Summary

**End-to-end lifecycle tests for all 7 core document types verifying stock mutations (addStockBatch, reserveStockBatch, deductStockBatch) and eventBus events at correct transition points**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-22T03:34:01Z
- **Completed:** 2026-03-22T03:47:08Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- All 7 core document types (GRN, QCI, DR, MI, MRN, MR, WT) now have `describe('end-to-end lifecycle')` test blocks
- GRN store() verified: addStockBatch called with qty = qtyReceived - qtyDamaged per line
- MI approve() verified: reserveStockBatch called with correct items mapped from mirvLines
- WT ship()/receive() verified: deductStockBatch from source warehouse, addStockBatch to destination warehouse
- eventBus.publish assertions verify correct entityType and payload.to for status transitions
- Full backend test suite: 5007 tests pass, zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Inbound document lifecycle tests (GRN, QCI, DR)** - `90282a2` (test)
2. **Task 2: Outbound and transfer document lifecycle tests (MI, MRN, MR, WT)** - `a3ac167` (test)

## Files Created/Modified
- `packages/backend/src/domains/inbound/services/grn.service.test.ts` - Added 7 lifecycle tests: create, submit (QCI auto-create, DR auto-create), approveQc, receive, store (addStockBatch), store (eventBus)
- `packages/backend/src/domains/inbound/services/qci.service.test.ts` - Added 3 lifecycle tests: create linked to GRN, start (inspect), complete with pass result
- `packages/backend/src/domains/inbound/services/dr.service.test.ts` - Added 2 lifecycle tests: create with damaged items, resolve with resolution data
- `packages/backend/src/domains/outbound/services/mi.service.test.ts` - Added 5 lifecycle tests: create, submit, approve (reserveStockBatch), approve (eventBus), issue
- `packages/backend/src/domains/outbound/services/mrn.service.test.ts` - Added 2 lifecycle tests: create, complete (addStockBatch for good + blocked items)
- `packages/backend/src/domains/outbound/services/mr.service.test.ts` - Added 3 lifecycle tests: create, submit, approve
- `packages/backend/src/domains/transfers/services/stock-transfer.service.test.ts` - Added 4 lifecycle tests: create, submit, ship+receive (dual-warehouse stock), complete (eventBus)

## Decisions Made
- **WT stock flow differs from plan assumption:** The plan expected `complete()` to handle both deductStock and addStockBatch. In reality, `ship()` deducts from source and `receive()` adds to destination. Tests were written to match actual implementation while still verifying the complete dual-warehouse stock flow.
- **Added missing mocks to GRN and WT test files:** GRN test lacked eventBus and safeStatusUpdate mocks; WT test lacked eventBus and safeStatusUpdate mocks. These were added to enable proper assertion and isolation without affecting existing tests.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WT complete() does not perform stock operations**
- **Found during:** Task 2 (stock-transfer lifecycle tests)
- **Issue:** Plan stated "complete() deducts from source warehouse and adds to destination warehouse in one transaction" but actual implementation splits stock operations across ship() (deduct) and receive() (add). complete() only transitions status.
- **Fix:** Wrote lifecycle test to verify ship() calls deductStockBatch and receive() calls addStockBatch, then complete() publishes the eventBus event. This correctly tests the actual stock flow.
- **Files modified:** packages/backend/src/domains/transfers/services/stock-transfer.service.test.ts
- **Verification:** All tests pass, stock operations verified at correct lifecycle points
- **Committed in:** a3ac167 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug in plan specification)
**Impact on plan:** Test correctly verifies dual-warehouse stock effects at their actual lifecycle points. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All 7 core document lifecycle flows verified with stock effect assertions
- Ready for Phase 07 Plan 02 (approval workflow verification) and Plan 03 (frontend integration verification)
- Full backend test suite healthy at 5007 tests passing

## Self-Check: PASSED

All 7 modified files exist. Both task commits (90282a2, a3ac167) verified in git history.

---
*Phase: 07-end-to-end-verification*
*Completed: 2026-03-22*
