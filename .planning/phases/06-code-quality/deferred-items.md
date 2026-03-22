# Deferred Items - Phase 06 Code Quality

## Pre-existing Flaky Tests (Out of Scope)

### 1. scheduler.service.test.ts intermittent failure
- **File:** `packages/backend/src/domains/scheduler/services/scheduler.service.test.ts`
- **Behavior:** Passes in isolation (39/39) but occasionally fails 1 test in full suite runs (timing-dependent)
- **Observed during:** Phase 06 Plan 01 Task 1 verification (3rd consecutive full suite run)
- **Impact:** Not in scope for this plan (plan targets cycle-count, dashboard-builder, vehicle-maintenance only)
- **Recommendation:** Investigate timer/mock timing in scheduler tests; likely needs `vi.useFakeTimers()` consistency
