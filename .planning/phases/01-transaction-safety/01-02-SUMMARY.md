---
phase: 01-transaction-safety
plan: 02
subsystem: database
tags: [prisma, transactions, approval-workflow, event-bus, socket-io, atomicity]

# Dependency graph
requires:
  - phase: 01-01
    provides: Transaction-aware audit logging (createAuditLog with optional tx parameter)
provides:
  - Transactional approval state machine (processApproval wraps all DB writes in $transaction)
  - Transactional submit for approval (submitForApproval wraps all DB writes in $transaction)
  - getDelegateTx helper for tx-aware Prisma model access inside transactions
  - Post-commit side effect pattern for approval events, notifications, and socket emissions
  - MI approve with correct two-phase transaction sequencing and timeout config
affects: [workflow-consumers, mi-service, approval-callers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Three-phase approval pattern: READ (outside tx), MUTATE ($transaction), NOTIFY (post-commit)"
    - "getDelegateTx for tx-bound Prisma model access (not global prisma)"
    - "ApprovalOutcome discriminated union for typed post-commit branching"
    - "Explicit transaction timeouts: 10000ms for approval, 15000ms for stock reservation"

key-files:
  created: []
  modified:
    - packages/backend/src/domains/workflow/services/approval.service.ts
    - packages/backend/src/domains/workflow/services/approval.service.test.ts
    - packages/backend/src/domains/outbound/services/mi.service.ts
    - packages/backend/src/domains/outbound/services/mi.service.test.ts

key-decisions:
  - "getDelegateTx uses tx[modelName] instead of getPrismaDelegate(prisma, modelName) to ensure writes go through the transaction client"
  - "processApproval returns a typed ApprovalOutcome discriminated union from $transaction to drive post-commit notifications"
  - "MI approve keeps two separate transactions (processApproval + stock reservation) per research recommendation -- approval is idempotent, stock is recoverable"
  - "Stock reservation timeout set to 15000ms (vs 10000ms for approval) because stock operations may involve optimistic lock retries"

patterns-established:
  - "Three-phase pattern for transactional services: READ outside tx, MUTATE inside $transaction, NOTIFY after commit"
  - "getDelegateTx helper for tx-aware Prisma delegate access inside interactive transactions"
  - "Typed outcome return from $transaction for safe post-commit branching"

requirements-completed: [DINT-01, DINT-02, DINT-07]

# Metrics
duration: 7min
completed: 2026-03-22
---

# Phase 01 Plan 02: Approval Transaction Wrapping Summary

**Atomic approval state machine with $transaction wrapping, post-commit side effects, and MI approve two-phase sequencing with timeout configuration**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-21T23:51:36Z
- **Completed:** 2026-03-21T23:59:15Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- processApproval wraps all 6-8 DB writes (step update, next step lookup, document status, audit log, submitter lookup) in a single $transaction -- a crash mid-approval can no longer leave orphaned state
- submitForApproval wraps its 3 DB writes (delegate.update, approvalStep.createMany, createAuditLog) in a single $transaction
- All side effects (eventBus.publish, emitToRole, emitToDocument, createNotification, notifyRoleUsers) fire only after $transaction commits -- no phantom notifications on rollback
- MI approve uses two-phase approach: processApproval (atomic) then stock reservation (separate atomic transaction with timeout: 15000ms)
- Added getDelegateTx helper to access Prisma models through the transaction client instead of the global prisma singleton

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap processApproval and submitForApproval in $transaction** - `07e12d4` (test) + `8cc8fe5` (feat)
2. **Task 2: Fix MI approve split-transaction issue** - `e233ee5` (test) + `7bb2cb9` (feat)

_Note: TDD tasks have two commits each (test then feat)_

## Files Created/Modified
- `packages/backend/src/domains/workflow/services/approval.service.ts` - Refactored processApproval and submitForApproval into three-phase pattern (READ, MUTATE in $transaction, NOTIFY post-commit); added getDelegateTx helper and TxClient import
- `packages/backend/src/domains/workflow/services/approval.service.test.ts` - Added 11 new tests for transaction wrapping, post-commit ordering, rollback safety, and tx-aware audit logging; updated 4 existing tests for tx parameter on createAuditLog
- `packages/backend/src/domains/outbound/services/mi.service.ts` - Added timeout: 15000ms and maxWait: 10000ms to stock reservation transaction
- `packages/backend/src/domains/outbound/services/mi.service.test.ts` - Added 5 new tests for MI approve transaction sequencing, processApproval ordering, and timeout config

## Decisions Made
- **getDelegateTx over getPrismaDelegate inside tx**: The existing `getPrismaDelegate(prisma, modelName)` returns a delegate bound to the global prisma client, bypassing the transaction. `getDelegateTx(tx, modelName)` accesses `tx[modelName]` directly to ensure writes are transactional.
- **ApprovalOutcome discriminated union**: processApproval returns a typed `{ outcome: 'advanced' | 'fully_approved' | 'rejected' }` from $transaction. This enables type-safe post-commit branching via switch statement, carrying only the data needed for notifications.
- **Two separate transactions for MI approve**: Per research recommendation, keeping processApproval and stock reservation as separate atomic transactions is acceptable because approval is idempotent (re-approving is a no-op) and stock reservation failure is recoverable (MI can be re-processed).
- **Different timeouts**: Approval operations use 10000ms timeout; stock reservation uses 15000ms because it may involve optimistic lock retries on inventory levels.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added notification service mock to prevent unhandled rejection**
- **Found during:** Task 1 (approval service tests)
- **Issue:** The existing test file only mocked `logger.log` but the notification service transitively imported `logger.warn`. When processApproval moved submitter notification fetching inside the transaction, the notification mock was needed to prevent unhandled promise rejections.
- **Fix:** Added `vi.mock('../../notifications/services/notification.service.js')` and extended logger mock with `logger: { warn, info, error, debug }` stubs.
- **Files modified:** packages/backend/src/domains/workflow/services/approval.service.test.ts
- **Committed in:** 8cc8fe5

**2. [Rule 1 - Bug] Added mirv.findUnique mock for submitter lookup inside tx**
- **Found during:** Task 1 (approval service tests)
- **Issue:** processApproval now fetches the submitter ID inside the transaction (via `delegateTx.findUnique`) for post-commit notification. Existing tests did not mock this call, causing undefined submitter IDs.
- **Fix:** Added `mockPrisma.mirv.findUnique.mockResolvedValue({ createdById: 'submitter-1' })` to all approve and reject test setups.
- **Files modified:** packages/backend/src/domains/workflow/services/approval.service.test.ts
- **Committed in:** 8cc8fe5

---

**Total deviations:** 2 auto-fixed (2 bugs in test setup)
**Impact on plan:** Both fixes were necessary to make existing tests compatible with the refactored code. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All approval service mutations are now atomic -- Phase 1 transaction safety goals are complete
- The three-phase pattern (READ, MUTATE, NOTIFY) is established as the standard for transactional services
- getDelegateTx pattern available for any future service that needs tx-aware Prisma model access
- All 4929 backend tests pass across 245 test files

## Self-Check: PASSED

All 4 modified files verified present. All 4 task commits verified in git log.

---
*Phase: 01-transaction-safety*
*Completed: 2026-03-22*
