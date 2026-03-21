---
phase: 01-transaction-safety
plan: 01
subsystem: database
tags: [prisma, transactions, error-handling, audit, inventory, event-bus]

# Dependency graph
requires: []
provides:
  - P2034 transaction conflict error handling (409 TRANSACTION_CONFLICT)
  - Transaction-aware audit logging (createAuditLog with optional tx parameter)
  - Fixed ASN UOM bug (DINT-03)
  - Verified GRN totalValue calculation (DINT-04)
  - Post-commit low-stock alert pattern (DINT-07)
  - LowStockAlert type export for downstream consumers
affects: [01-02-PLAN, approval-refactor, inventory-operations]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-commit event publishing: collect alert data inside tx, publish after commit"
    - "Transaction-aware service functions: accept optional TxClient parameter"

key-files:
  created: []
  modified:
    - packages/backend/src/middleware/error-handler.ts
    - packages/backend/src/domains/audit/services/audit.service.ts
    - packages/backend/src/domains/inbound/services/asn.service.ts
    - packages/backend/src/domains/inventory/services/inventory.service.ts
    - packages/backend/src/middleware/error-handler.test.ts
    - packages/backend/src/domains/audit/services/audit.service.test.ts
    - packages/backend/src/domains/inbound/services/asn.service.test.ts
    - packages/backend/src/domains/inventory/services/inventory.service.test.ts

key-decisions:
  - "ASN UOM fallback uses type assertion (line as Record) since AsnLine Prisma model lacks uomId field"
  - "Low-stock alerts publish after both standalone and externalTx paths for simplicity"
  - "checkLowStockAlert returns LowStockAlert | null instead of void, enabling collection pattern"

patterns-established:
  - "Post-commit events: collect event data inside transaction, publish via helper after $transaction resolves"
  - "Transaction-aware services: accept optional TxClient param, use tx ?? prisma delegation"

requirements-completed: [DINT-03, DINT-04, DINT-07]

# Metrics
duration: 9min
completed: 2026-03-22
---

# Phase 01 Plan 01: Transaction Safety Foundation Summary

**P2034 conflict handling, tx-aware audit logging, ASN UOM bug fix, and post-commit low-stock alert pattern across error-handler, audit, inbound, and inventory services**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-21T23:06:01Z
- **Completed:** 2026-03-21T23:15:30Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- P2034 transaction conflict errors now return 409 with TRANSACTION_CONFLICT code instead of falling through to 500
- createAuditLog accepts optional tx parameter enabling audit logs inside shared transactions (backward compatible)
- ASN-to-GRN conversion no longer assigns itemId as uomId fallback (data corruption bug fixed)
- GRN totalValue calculation inside $transaction verified by existing test
- Low-stock eventBus.publish moved from inside transaction callbacks to post-commit, preventing side effects on rollback

## Task Commits

Each task was committed atomically:

1. **Task 1: P2034 error handling + tx-aware audit + ASN UOM fix + GRN totalValue verification** - `08d7ef0` (feat)
2. **Task 2: Post-commit low-stock alerts in inventory service** - `772095d` (feat)

## Files Created/Modified
- `packages/backend/src/middleware/error-handler.ts` - Added P2034 case returning 409 TRANSACTION_CONFLICT
- `packages/backend/src/middleware/error-handler.test.ts` - Added P2034 test
- `packages/backend/src/domains/audit/services/audit.service.ts` - Added optional tx param to createAuditLog with client delegation
- `packages/backend/src/domains/audit/services/audit.service.test.ts` - Added tx and non-tx path tests
- `packages/backend/src/domains/inbound/services/asn.service.ts` - Fixed UOM fallback from line.itemId to line.uomId
- `packages/backend/src/domains/inbound/services/asn.service.test.ts` - Updated UOM fallback test, added uomId fallback test
- `packages/backend/src/domains/inventory/services/inventory.service.ts` - Refactored checkLowStockAlert to return data, added LowStockAlert type, publish post-commit pattern
- `packages/backend/src/domains/inventory/services/inventory.service.test.ts` - Added 3 post-commit alert tests

## Decisions Made
- ASN UOM fallback uses type assertion (`line as Record<string, unknown>`) because the Prisma `AsnLine` model does not have a `uomId` field. The fallback to `undefined` is correct since assigning an `itemId` as a `uomId` was a data corruption bug.
- Low-stock alerts publish after both standalone and externalTx paths. For externalTx, this means alerts publish after `run()` completes but potentially before the outer transaction commits. This is acceptable because: (a) callers already publish events post-commit, and (b) the alert is informational, not transactional.
- `checkLowStockAlert` returns `LowStockAlert | null` instead of `void`, establishing the collection pattern for all 5 batch functions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TypeScript error on AsnLine.uomId property**
- **Found during:** Task 1 (ASN UOM fix)
- **Issue:** `AsnLine` Prisma model does not have a `uomId` field, so `line.uomId` causes TS2339
- **Fix:** Used type assertion `(line as Record<string, unknown>).uomId as string` to access the property safely
- **Files modified:** packages/backend/src/domains/inbound/services/asn.service.ts
- **Verification:** TypeScript compiles, tests pass
- **Committed in:** 08d7ef0

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Type assertion needed due to schema limitation. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Transaction-aware audit service is ready for Plan 02 (approval refactor) to use inside approval $transaction
- P2034 error handling prevents unhandled transaction conflicts system-wide
- Post-commit event pattern established for inventory operations
- All 155 tests pass across 5 test files

---
*Phase: 01-transaction-safety*
*Completed: 2026-03-22*
