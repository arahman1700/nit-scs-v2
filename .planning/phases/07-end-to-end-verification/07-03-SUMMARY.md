---
phase: 07-end-to-end-verification
plan: 03
subsystem: testing
tags: [vitest, navigation, rtl, pdf, jspdf, react-context, user-roles]

# Dependency graph
requires:
  - phase: 06-code-quality
    provides: Stable frontend codebase with refactored components
provides:
  - Navigation coverage tests verifying all 17 UserRole entries in SECTION_NAVIGATION
  - RTL direction toggle tests verifying bidirectional switch with document attribute and localStorage persistence
  - PDF export tests for all 8 document generators (GRN, QCI, DR, MI, MRN, MR, WT, IMSF)
  - Core PDF utility tests for createNitPdf, addInfoSection, addTable, generateDocumentPdf, downloadPdf
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Stable jsPDF mock constructor pattern (function instead of vi.fn) to survive module-level caching"
    - "localStorage mock via vi.stubGlobal for jsdom environments lacking full Storage API"
    - "expectTextContaining helper for asserting partial string matches across PDF text calls"

key-files:
  created:
    - packages/frontend/src/config/navigation.test.ts
    - packages/frontend/src/contexts/DirectionContext.test.tsx
    - packages/frontend/src/utils/pdf/core.test.ts
    - packages/frontend/src/utils/pdf/inbound.test.ts
    - packages/frontend/src/utils/pdf/outbound.test.ts
    - packages/frontend/src/utils/pdf/transfers.test.ts
  modified: []

key-decisions:
  - "Stable function constructor for jsPDF mock -- vi.fn().mockImplementation fails when core.ts caches the loaded module and vi.clearAllMocks resets the implementation"
  - "vi.stubGlobal('localStorage') for DirectionContext tests -- jsdom in Vitest 4 does not provide functional localStorage.clear/removeItem"
  - "clearMockCalls pattern instead of vi.clearAllMocks -- preserves mock implementations while resetting call history between tests"

patterns-established:
  - "jsPDF mock pattern: use plain function constructor returning mock doc object, never vi.fn() for cached lazy-loaded modules"
  - "expectTextContaining helper: scan mockDoc.text.mock.calls for partial string matches in PDF content verification"

requirements-completed: [VERF-03, VERF-04, VERF-05]

# Metrics
duration: 10min
completed: 2026-03-22
---

# Phase 07 Plan 03: Frontend Verification Summary

**87 tests verifying role-based navigation coverage for all 17 roles, RTL direction toggle with localStorage persistence, and PDF export for 8 document types (GRN, QCI, DR, MI, MRN, MR, WT, IMSF)**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-22T03:34:10Z
- **Completed:** 2026-03-22T03:44:18Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments
- Navigation test confirms all 17 UserRole values have SECTION_NAVIGATION entries with at least 1 navigable item per role, no empty paths, and role-specific coverage (ADMIN has OVERVIEW/OPERATIONS/INVENTORY, QC_OFFICER has inspections, WAREHOUSE_STAFF has inventory)
- RTL direction toggle test confirms ltr<->rtl bidirectional switching, document.documentElement.dir attribute update, localStorage persistence under 'nit-scs-direction', and initial direction read from localStorage
- PDF export tests verify all 8 generators (GRN, QCI, DR, MI, MRN, MR, WT, IMSF) produce correctly structured PDFs with document number, key header fields (supplier/warehouse/project), and line item tables via jspdf-autotable
- Core PDF tests verify NIT branding header, addInfoSection field rendering, addTable column/row delegation, and downloadPdf extension handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Role navigation and RTL direction tests** - `d4293b6` (test)
2. **Task 2: PDF export tests for all 7 core document types** - `2c890a1` (test)

## Files Created/Modified
- `packages/frontend/src/config/navigation.test.ts` - 22 tests verifying SECTION_NAVIGATION completeness for all 17 roles
- `packages/frontend/src/contexts/DirectionContext.test.tsx` - 7 tests verifying RTL toggle, persistence, and document attribute sync
- `packages/frontend/src/utils/pdf/core.test.ts` - 6 tests verifying createNitPdf, addInfoSection, addTable, generateDocumentPdf, downloadPdf
- `packages/frontend/src/utils/pdf/inbound.test.ts` - 18 tests verifying GRN, QCI, DR PDF generators
- `packages/frontend/src/utils/pdf/outbound.test.ts` - 20 tests verifying MI, MRN, MR PDF generators
- `packages/frontend/src/utils/pdf/transfers.test.ts` - 14 tests verifying WT, IMSF PDF generators

## Decisions Made
- Used stable function constructor (`function MockJsPDF() { return mockDoc; }`) instead of `vi.fn().mockImplementation()` for the jsPDF mock because core.ts caches loaded modules in `_cached` and `vi.clearAllMocks()` would reset the implementation on the cached reference
- Used `vi.stubGlobal('localStorage', storageMock)` for DirectionContext tests because jsdom in Vitest 4 does not provide a functional localStorage with clear/removeItem methods
- Used `clearMockCalls()` (only clears call history) instead of `vi.clearAllMocks()` (resets implementations) to preserve mock behavior across tests while still getting clean call counts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed localStorage mock for jsdom environment**
- **Found during:** Task 1 (DirectionContext tests)
- **Issue:** jsdom's localStorage in Vitest 4 does not support `.clear()` or `.removeItem()` -- both threw "not a function" errors
- **Fix:** Created a custom localStorage mock object with vi.fn() implementations for getItem/setItem/removeItem/clear, installed via vi.stubGlobal
- **Files modified:** packages/frontend/src/contexts/DirectionContext.test.tsx
- **Verification:** All 7 DirectionContext tests pass
- **Committed in:** d4293b6 (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed jsPDF mock constructor pattern for cached lazy-loaded modules**
- **Found during:** Task 2 (PDF tests)
- **Issue:** Using `vi.fn().mockImplementation(() => mockDoc)` for the jsPDF default export failed with "() => mockDoc is not a constructor" because core.ts caches the JsPDF constructor in `_cached` and `vi.clearAllMocks()` resets the mock implementation, leaving the cached reference as a bare function
- **Fix:** Replaced with a stable plain function `function MockJsPDF() { return mockDoc; }` that survives mock clearing, and switched from `vi.clearAllMocks()` to targeted `mockClear()` on individual mock methods
- **Files modified:** All 4 PDF test files (core, inbound, outbound, transfers)
- **Verification:** All 58 PDF tests pass
- **Committed in:** 2c890a1 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both fixes were necessary to make tests work in the jsdom/Vitest 4 environment. No scope creep -- the test coverage matches the plan exactly.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All frontend verification tests complete: navigation coverage, RTL toggle, and PDF export
- Combined with plans 07-01 (backend lifecycle) and 07-02 (workflow/notification), phase 07 verification coverage is comprehensive
- Ready for phase 08 or production deployment readiness review

## Self-Check: PASSED

All 6 created files verified present. Both task commits (d4293b6, 2c890a1) verified in git log. 87 tests passing across all 6 test files.

---
*Phase: 07-end-to-end-verification*
*Completed: 2026-03-22*
