# Phase 6: Code Quality - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase improves code maintainability: refactor large frontend components, fix test reliability, add workflow rule cache invalidation, and validate dynamic document type status flows with Zod. Covers QUAL-01, QUAL-02, QUAL-03, QUAL-04.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — code quality phase:
- Extract sub-components from YardDashboard (~1081 LOC), NotificationRulesPage (~1074 LOC), DynamicTypeBuilderPage (~1044 LOC) to get each under 400 LOC (QUAL-01)
- Fix socket hang failures in cycle-count.routes.test.ts and dashboard-builder.routes.test.ts — likely need proper server cleanup in afterEach or increased timeout (QUAL-02)
- Add cache invalidation on workflow rule CRUD operations — invalidate the 60s TTL cache when rules change (QUAL-03)
- Add Zod schema validation for dynamic document type status flows before saving — reject circular transitions (QUAL-04)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/frontend/src/pages/warehouse/YardDashboard.tsx` — 1081 LOC, needs sub-component extraction
- `packages/frontend/src/pages/admin/NotificationRulesPage.tsx` — 1074 LOC
- `packages/frontend/src/pages/admin/DynamicTypeBuilderPage.tsx` — 1044 LOC
- `packages/backend/src/domains/inventory/routes/cycle-count.routes.test.ts` — socket hang failures
- `packages/backend/src/domains/reporting/routes/dashboard-builder.routes.test.ts` — socket hang failures
- `packages/backend/src/domains/workflow/services/workflow-rule.service.ts` — 60s cache TTL
- `packages/backend/src/domains/system/services/dynamic-document-type.service.ts` — status flow JSON

### Established Patterns
- Frontend components use glass-card + Nesma dark theme
- Test files use Vitest with supertest for route testing
- Cache utility already exists (enhanced in Phase 5)

### Integration Points
- Frontend component extraction: maintain same props/exports for parent pages
- Workflow rule cache: hook into CRUD operations in workflow-rule.service.ts
- Dynamic type validation: add Zod schema in shared validators

</code_context>

<specifics>
## Specific Ideas

No specific requirements — code quality phase.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
