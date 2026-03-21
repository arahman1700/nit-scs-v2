# Phase 1: Transaction Safety - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase ensures every stock-modifying operation and approval transition is atomic. No partial commits, no ghost inventory, no stuck documents. Covers: GRN, MI, MRN, MR, WT stock mutations, approval state machine, ASN UOM bug, GRN totalValue bug, and domain event post-commit ordering.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

All implementation choices are at Claude's discretion — pure infrastructure phase. Key technical approaches:
- Use Prisma interactive transactions ($transaction) with TxClient pattern already established in inventory.service.ts
- Make `tx` parameter required (not optional) on all stock mutation functions
- Move Socket.IO and event bus emissions outside transaction boundaries using post-commit callback pattern
- Fix ASN UOM bug (one-line fix: line.uomId instead of line.itemId)
- Calculate GRN totalValue from line items inside create transaction

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/backend/src/utils/prisma.ts` — Prisma singleton with soft-delete extension, TxClient type
- `packages/backend/src/domains/inventory/services/inventory.service.ts` — Already has `externalTx` parameter pattern for stock operations
- `packages/backend/src/utils/audit.ts` — `auditAndEmit()` utility used across all route handlers
- `packages/backend/src/domains/workflow/services/approval.service.ts` — processApproval() needs transaction wrapping

### Established Patterns
- Document services follow factory pattern via `createDocumentRouter()`
- Stock operations use `addStockBatch()`, `consumeReservationBatch()`, `updateLevelWithVersion()`
- Event emissions currently happen inside service methods (need to move post-commit)
- `safeStatusTransition()` already provides atomic status updates with conflict detection

### Integration Points
- All document services in `packages/backend/src/domains/inbound/services/`, `outbound/services/`, `transfers/services/`
- `packages/backend/src/domains/workflow/services/approval.service.ts` — approval state machine
- `packages/backend/src/domains/inbound/services/asn.service.ts:254` — ASN UOM bug location
- `packages/backend/src/domains/inbound/services/grn.service.ts` — totalValue calculation

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase. Follow the TxClient pattern already established in inventory.service.ts and extend it consistently to all stock-affecting operations.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
