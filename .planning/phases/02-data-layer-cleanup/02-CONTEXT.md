# Phase 2: Data Layer Cleanup - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase cleans up the data layer: extend soft-delete Prisma extension to cover all query methods, migrate Float fields to Decimal for financial accuracy, unify the duplicated WT/stock-transfer services, and extract a shared totalValue calculation utility.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase:
- Extend Prisma soft-delete extension in `packages/backend/src/utils/prisma.ts` to cover findUnique, aggregate, groupBy
- Migrate CycleCountLine, StagingAssignment, PackingLine quantity fields from Float to Decimal(12,3) via Prisma migration
- Make V1 wt.service.ts a thin wrapper around V2 stock-transfer.service.ts (follow GRN/MRRV unification pattern)
- Extract `calculateDocumentTotalValue()` utility to shared domain, replace inline calculations in grn.service.ts, mr.service.ts, mi.service.ts

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/utils/prisma.ts` — Prisma singleton with existing soft-delete extension (covers findMany, findFirst, count)
- `packages/backend/src/domains/transfers/services/stock-transfer.service.ts` — V2 transfer service (canonical)
- `packages/backend/src/domains/transfers/services/wt.service.ts` — V1 transfer service (to become wrapper)
- `packages/backend/src/domains/inbound/services/grn.service.ts:81-85` — Example totalValue calculation

### Established Patterns
- Prisma extensions use `$extends()` with `query` middleware
- V1→V2 name mapping documented in CLAUDE.md (MRRV→GRN, MIRV→MI, etc.)
- GRN/MRRV unification pattern already exists as reference for WT unification

### Integration Points
- Prisma schema files in `packages/backend/prisma/schema/`
- All document services that calculate totalValue
- All queries that use findUnique, aggregate, groupBy on soft-deletable models

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow existing patterns.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
