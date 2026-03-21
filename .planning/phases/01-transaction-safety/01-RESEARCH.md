# Phase 1: Transaction Safety - Research

**Researched:** 2026-03-22
**Domain:** Prisma interactive transactions, approval state machines, domain event ordering
**Confidence:** HIGH

## Summary

Phase 1 addresses the most critical data integrity gaps in the codebase: stock-modifying operations that are not atomic, an approval state machine with 6-8 sequential DB writes without a transaction boundary, domain events published inside transactions (risking phantom notifications), a one-line ASN UOM bug, and a GRN totalValue calculation that should happen inside the create transaction.

The codebase already has the right abstractions -- `TxClient` type, `externalTx` parameter pattern on batch stock operations, `safeStatusUpdateTx` for transaction-aware status transitions, and a clean `eventBus.publish()` API. The work is extending these patterns consistently to all stock-affecting paths and refactoring the approval service to wrap its mutations in a single `$transaction`.

**Primary recommendation:** Make `tx` (TxClient) a required parameter on all stock-mutating service functions. Collect side effects (events, notifications, socket emissions) as return values from the transaction, then dispatch them after the transaction commits.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
All implementation choices are at Claude's discretion -- pure infrastructure phase. Key technical approaches:
- Use Prisma interactive transactions ($transaction) with TxClient pattern already established in inventory.service.ts
- Make `tx` parameter required (not optional) on all stock mutation functions
- Move Socket.IO and event bus emissions outside transaction boundaries using post-commit callback pattern
- Fix ASN UOM bug (one-line fix: line.uomId instead of line.itemId)
- Calculate GRN totalValue from line items inside create transaction

### Claude's Discretion
All implementation choices.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DINT-01 | All stock-modifying operations (GRN, MI, MRN, MR, WT) wrap stock mutations + document updates in a single Prisma $transaction | Pattern 1 (TxClient injection), Pattern 2 (post-commit side effects), detailed gap analysis below |
| DINT-02 | Approval state machine (processApproval) wraps all DB calls in a single $transaction with notifications moved post-commit | Pattern 3 (transactional approval), full processApproval analysis shows 6-8 unwrapped sequential writes |
| DINT-03 | ASN UOM assignment bug fixed -- line.uomId used instead of line.itemId | ASN bug analysis confirms one-line fix at asn.service.ts:262 |
| DINT-04 | GRN totalValue calculated from line items during create transaction, returned in initial response | GRN create analysis confirms totalValue is already calculated inside transaction but pattern is verified |
| DINT-07 | Domain events published AFTER transaction commits, never inside transaction boundaries | Post-commit pattern analysis identifies all violation points |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @prisma/client | 6.19.2 | ORM with interactive transactions | Already installed, `$transaction` is the atomic boundary |
| express | 5.1.0 | HTTP framework | Already installed, auto-catches async rejections |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @nit-scs-v2/shared | workspace:* | Error classes (ConflictError, AppError) | Throw ConflictError on P2034 transaction conflicts |

### No New Dependencies Required
This phase modifies existing code patterns. No new packages needed.

## Architecture Patterns

### Recommended File Structure (changes only)
```
packages/backend/src/
├── utils/
│   └── prisma.ts              # TxClient type export (already exists)
├── middleware/
│   └── error-handler.ts       # Add P2034 handling
├── domains/
│   ├── inventory/services/
│   │   └── inventory.service.ts  # Low-stock event moved post-tx
│   ├── inbound/services/
│   │   ├── grn.service.ts       # Verify totalValue in create tx
│   │   └── asn.service.ts       # Fix UOM bug line 262
│   ├── outbound/services/
│   │   ├── mi.service.ts        # Wrap approve() atomically with processApproval
│   │   ├── mrn.service.ts       # Already correct (verified)
│   │   └── mr.service.ts        # No stock mutations (verified)
│   ├── transfers/services/
│   │   └── stock-transfer.service.ts  # Already correct (verified)
│   └── workflow/services/
│       └── approval.service.ts  # Major refactor: wrap in $transaction
```

### Pattern 1: TxClient Injection (Extend Existing)

**What:** Every function that mutates stock or document status accepts `tx: TxClient` as a required parameter (not optional `externalTx?`). The caller owns the transaction boundary.

**When to use:** Any operation that changes `InventoryLevel`, `InventoryLot`, document status, or `ApprovalStep`.

**Current state:** The `addStockBatch`, `reserveStockBatch`, `consumeReservationBatch`, `deductStockBatch`, and `releaseReservationBatch` functions already accept `externalTx?: TxClient`. The decision is to make this required.

**Example (existing good pattern in inventory.service.ts):**
```typescript
// Source: packages/backend/src/domains/inventory/services/inventory.service.ts:569
export async function addStockBatch(items: AddStockParams[], externalTx?: TxClient): Promise<void> {
  const run = async (tx: TxClient) => {
    for (const params of items) {
      // ... all mutations use tx
    }
  };
  if (externalTx) {
    await run(externalTx);  // compose into caller's transaction
  } else {
    await prisma.$transaction(run);  // standalone transaction
  }
}
```

**Key insight:** The optional `externalTx` pattern is already correct. Making it required would break the standalone-use pattern. Instead, enforce that all callers MUST pass `tx` when operating inside a transaction. The function signature stays the same; the contract is enforced by code review and test.

### Pattern 2: Post-Commit Side Effects

**What:** Collect events, notifications, and socket emissions as data during the transaction. Dispatch them after `$transaction` resolves successfully.

**When to use:** Every service function that wraps operations in `$transaction` AND currently calls `eventBus.publish()`, `emitToRole()`, `emitToDocument()`, or `createNotification()` inside or adjacent to the transaction.

**Example (target pattern for approval):**
```typescript
// Transaction returns a result object describing what happened
const result = await prisma.$transaction(async tx => {
  // All DB mutations here
  await tx.approvalStep.update({ ... });
  await tx.someModel.update({ ... });
  await createAuditLog({ ... }); // uses tx internally

  return { outcome: 'approved', data: { ... } };
});

// Post-commit: safe to emit because transaction is committed
eventBus.publish({ type: 'approval:approved', ... });
if (io) emitToDocument(io, documentId, 'approval:approved', { ... });
notifyRoleUsers(...).catch(err => log('warn', ...));
```

**Critical violations found:**
1. `approval.service.ts:processApproval()` -- ALL DB writes (lines 364-554) are unwrapped, with `eventBus.publish`, `emitToRole`, `emitToDocument`, `createNotification` interleaved between DB writes
2. `approval.service.ts:submitForApproval()` -- 3 sequential writes (delegate.update, approvalStep.createMany, createAuditLog) without transaction, followed by socket/notification emissions
3. `inventory.service.ts:checkLowStockAlert()` (line 168) -- calls `eventBus.publish()` INSIDE the transaction callback (called from `consumeReservation` which runs inside `$transaction`)

### Pattern 3: Transactional Approval State Machine

**What:** Wrap the `processApproval()` function's 6-8 sequential DB calls in a single `$transaction`. Return a typed result object. Move all notifications, socket emissions, and event publishing to post-commit.

**Current problem (verified in code):**
- `processApproval()` (lines 330-611) makes 6-8 sequential `prisma.*` calls WITHOUT any `$transaction`:
  - Line 364: `prisma.approvalStep.update` (mark step approved/rejected)
  - Line 375: `prisma.approvalStep.findFirst` (find next step)
  - Line 389: `prisma.approvalWorkflow.findFirst` (SLA lookup)
  - Line 401: `delegate.update` (update SLA date)
  - Line 460: `delegate.update` (mark document approved)
  - Line 469: `createAuditLog` (write audit record)
  - Line 526: `prisma.approvalStep.update` (reject)
  - Line 537: `prisma.approvalStep.updateMany` (skip remaining)
  - Line 548: `delegate.update` (mark document rejected)
  - Line 556: `createAuditLog` (write audit record)
- If any of these fail mid-way, the approval is in an inconsistent state
- Between each DB call, event/notification emissions happen -- if the transaction were to roll back, phantom events would have already fired

**Target refactor structure:**
```typescript
export async function processApproval(params: { ... }): Promise<void> {
  // 1. Read-only checks OUTSIDE transaction (authorization, find pending step)
  const currentStep = await prisma.approvalStep.findFirst({ ... });
  const isAuthorized = await isAuthorizedApprover( ... );

  // 2. ALL mutations in ONE transaction
  const result = await prisma.$transaction(async tx => {
    if (action === 'approve') {
      await tx.approvalStep.update({ ... });
      const nextStep = await tx.approvalStep.findFirst({ ... });
      if (nextStep) {
        // SLA update within tx
        return { outcome: 'advanced' as const, nextStep, currentLevel: currentStep.level };
      } else {
        await delegate.update({ where: { id: documentId }, data: { status: 'approved', ... } });
        await createAuditLog({ ... }); // needs tx-aware variant
        return { outcome: 'fully_approved' as const };
      }
    } else {
      await tx.approvalStep.update({ ... });
      await tx.approvalStep.updateMany({ ... });
      await delegate.update({ ... });
      await createAuditLog({ ... });
      return { outcome: 'rejected' as const };
    }
  }, { timeout: 10000 });

  // 3. Post-commit side effects based on result
  switch (result.outcome) {
    case 'advanced': /* notify next approver, emit events */ break;
    case 'fully_approved': /* notify submitter, emit events */ break;
    case 'rejected': /* notify submitter, emit events */ break;
  }
}
```

**Also fix `submitForApproval()`:** Same pattern -- wrap `delegate.update`, `approvalStep.createMany`, `createAuditLog` in one `$transaction`. Move socket/notification emissions post-commit.

### Pattern 4: Transaction Timeout Configuration

**What:** Set explicit `timeout` and `maxWait` on all interactive transactions based on operation complexity.

**Current state:** Zero timeout configurations found anywhere in the codebase. All transactions use Prisma defaults (timeout: 5000ms, maxWait: 2000ms).

**Recommended timeouts:**
```typescript
// Stock operations (may retry optimistic locks up to 3 times)
await prisma.$transaction(async tx => { ... }, { timeout: 15000, maxWait: 10000 });

// Approval operations (multiple reads + writes, no retries)
await prisma.$transaction(async tx => { ... }, { timeout: 10000, maxWait: 5000 });

// Simple CRUD (document create with lines)
await prisma.$transaction(async tx => { ... }, { timeout: 5000 }); // defaults fine
```

### Anti-Patterns to Avoid

- **Event publishing inside transactions:** `eventBus.publish()` inside `$transaction` callback means listeners fire for uncommitted data. If the transaction rolls back, phantom events exist. Found in `checkLowStockAlert()` at inventory.service.ts:168.
- **Fire-and-forget stock operations:** Calling `addStockBatch()` without passing `tx` when inside a `$transaction`. Creates a separate transaction for stock ops, breaking atomicity.
- **Notification calls inside approval mutations:** `createNotification()` and `emitToRole()` currently interleaved with DB writes in `processApproval()`. Must be moved post-commit.
- **Missing P2034 error handling:** More transactions = more potential deadlocks. The error handler has no case for Prisma P2034 (transaction conflict/deadlock). Must add 409 response.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic status transitions | Custom SQL or multiple updateMany calls | `safeStatusUpdateTx()` from safe-status-transition.ts | Already handles optimistic locking, conflict detection, returns proper errors |
| Transaction client typing | Manual Prisma type extraction | `TxClient` from inventory.service.ts | Already defined, used project-wide |
| Optimistic locking | Manual version check-and-update | `updateLevelWithVersion()` from inventory.service.ts | Already handles retries, proper error messages |
| Event bus | Custom pub/sub | `eventBus` singleton from event-bus.ts | Already integrated with Prometheus metrics, Zod validation |
| Audit logging | Manual DB inserts | `createAuditLog()` from audit.service.ts | Already standardized across codebase |

**Key insight:** Every building block needed already exists. This phase is about composition -- using the existing tools correctly and consistently.

## Common Pitfalls

### Pitfall 1: createAuditLog Is Not Transaction-Aware
**What goes wrong:** `createAuditLog()` uses the global `prisma` client, not a `tx` client. Calling it inside a `$transaction` creates a separate DB connection for the audit log.
**Why it happens:** The audit service was written before the transaction pattern was established.
**How to avoid:** Either (a) make `createAuditLog` accept an optional `tx` parameter (preferred), or (b) perform audit logging outside the transaction (acceptable since audit is informational).
**Warning signs:** Audit log exists for an operation whose main DB write was rolled back.

### Pitfall 2: Delegate Calls Use Global Prisma
**What goes wrong:** In `processApproval()`, `getDelegate(documentType)` returns a delegate from the global `prisma` instance, not from `tx`. Calling `delegate.update()` inside a `$transaction` creates a separate connection.
**Why it happens:** The delegate pattern was built for standalone use.
**How to avoid:** Create a `getDelegateTx(tx, documentType)` variant that extracts the delegate from the transaction client, or inline the `tx.modelName.update()` calls.
**Warning signs:** Document status update commits even when approval step update fails.

### Pitfall 3: Low-Stock Alert Publishes Inside Transaction
**What goes wrong:** `checkLowStockAlert()` in inventory.service.ts calls `eventBus.publish()` at line 168, but this function is called from within `consumeReservation()` which runs inside `$transaction`.
**Why it happens:** The comment says "fire-and-forget outside tx" but the code is actually inside the transaction callback.
**How to avoid:** Collect alert data as a return value from the transaction. Publish the event after the transaction commits.
**Warning signs:** Low-stock notifications sent for consumption operations that were rolled back.

### Pitfall 4: MI Approve Has Two Separate Transactions
**What goes wrong:** `mi.service.ts:approve()` calls `processApproval()` (no transaction) then opens a SEPARATE `$transaction` for stock reservation. If the second transaction fails, the approval is committed but stock is not reserved.
**Why it happens:** `processApproval()` was not transaction-aware when `approve()` was written.
**How to avoid:** After wrapping `processApproval()` in a transaction, either (a) compose both into a single transaction, or (b) accept the two-phase approach since stock reservation failure is recoverable (the MI can be re-processed).
**Warning signs:** MI shows "approved" status but `reservationStatus` is "none".

### Pitfall 5: Transaction Timeout Too Short for Optimistic Lock Retries
**What goes wrong:** `updateLevelWithVersion()` retries up to 3 times. Each retry requires a read + write. If the default 5s timeout is used and the system is under load, the transaction times out partway through.
**Why it happens:** Prisma default timeout (5000ms) is designed for simple CRUD, not operations with retry loops.
**How to avoid:** Set `{ timeout: 15000, maxWait: 10000 }` on transactions that include stock operations with optimistic locking.
**Warning signs:** `PrismaClientKnownRequestError: P2028` (transaction already closed).

## Code Examples

### Current ASN Bug (DINT-03)
```typescript
// Source: packages/backend/src/domains/inbound/services/asn.service.ts:262
// BUG: Fallback uses line.itemId instead of line.uomId
uomId: itemUomMap.get(line.itemId) ?? line.itemId, // <-- line.itemId is WRONG

// FIX:
uomId: itemUomMap.get(line.itemId) ?? line.uomId,  // <-- use line.uomId as fallback
```

### GRN totalValue Already in Transaction (DINT-04, verify)
```typescript
// Source: packages/backend/src/domains/inbound/services/grn.service.ts:104-157
// totalValue IS calculated inside the $transaction at lines 107-112
// and IS included in the create data at line 131
// This requirement appears already satisfied -- verify no edge cases
async function createGrnRecord(...) {
  return prisma.$transaction(async tx => {
    let totalValue = 0;
    for (const line of lines) {
      if (line.unitCost && line.qtyReceived) {
        totalValue += line.unitCost * line.qtyReceived;
      }
    }
    const created = await tx.mrrv.create({
      data: { ...headerData, totalValue, mrrvLines: { create: lines.map(...) } },
      include: { mrrvLines: true, ... },
    });
    return created; // totalValue included in response
  });
}
```

### Services Already Correctly Wrapped (No Changes Needed)
```typescript
// GRN store() -- CORRECT: status + stock in one transaction, event post-commit
// Source: packages/backend/src/domains/inbound/services/grn.service.ts:327-330
await prisma.$transaction(async tx => {
  await safeStatusUpdateTx(tx.mrrv, grn.id, grn.status, { status: 'stored' });
  await addStockBatch(stockItems, tx);
});
eventBus.publish({ type: 'document:status_changed', ... }); // post-commit

// MRN complete() -- CORRECT: status + stock in one transaction, event post-commit
// Source: packages/backend/src/domains/outbound/services/mrn.service.ts:190-193
await prisma.$transaction(async tx => {
  await safeStatusUpdateTx(tx.mrv, mrn.id, mrn.status, { status: 'completed' }, mrn.version);
  await addStockBatch([...goodStockItems, ...blockedStockItems], tx);
});
eventBus.publish({ ... }); // post-commit

// WT ship() -- CORRECT: deduct + status in one transaction, event post-commit
// Source: packages/backend/src/domains/transfers/services/stock-transfer.service.ts:197-206
await prisma.$transaction(async tx => {
  await deductStockBatch(deductItems, tx);
  await safeStatusUpdateTx(tx.stockTransfer, st.id, st.status, { status: 'shipped', ... }, st.version);
});
eventBus.publish({ ... }); // post-commit

// WT receive() -- CORRECT: add stock + status in one transaction, event post-commit
// Source: packages/backend/src/domains/transfers/services/stock-transfer.service.ts:235-244
await prisma.$transaction(async tx => {
  await addStockBatch(stockItems, tx);
  await safeStatusUpdateTx(tx.stockTransfer, st.id, st.status, { status: 'received', ... }, st.version);
});
eventBus.publish({ ... }); // post-commit
```

### Gap: MI approve() Has Split Transaction
```typescript
// Source: packages/backend/src/domains/outbound/services/mi.service.ts:183-244
// PROBLEM: processApproval (no tx) then separate $transaction for stock
export async function approve(id, action, userId, comments, io) {
  // Step 1: processApproval -- NO TRANSACTION (6-8 sequential writes)
  await processApproval({ documentType: 'mirv', documentId: mi.id, action, ... });

  if (action === 'approve') {
    // Step 2: SEPARATE transaction for stock reservation
    await prisma.$transaction(async tx => {
      const { success } = await reserveStockBatch(reserveItems, tx);
      await Promise.all(mi.mirvLines.map(line => tx.mirvLine.update({ ... })));
      await tx.mirv.update({ ... });
    });
  }
  // If step 2 fails, step 1 already committed the approval state changes
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma middleware for soft-delete | Prisma `$extends` client extensions | Prisma 4.16+ (2023) | Already using `$extends` in prisma.ts |
| Sequential Prisma calls | Interactive `$transaction` with TxClient | Prisma 4.7+ (2022) | Partially adopted -- this phase completes it |
| Default tx timeout (5s) | Configurable per-transaction timeout | Always available | Not used anywhere -- must add |

## Detailed Gap Analysis

### What NEEDS fixing (Phase 1 scope)

| Service | Function | Issue | Requirement |
|---------|----------|-------|-------------|
| approval.service.ts | `processApproval()` | 6-8 DB writes with no $transaction, events interleaved | DINT-02 |
| approval.service.ts | `submitForApproval()` | 3 DB writes with no $transaction, events interleaved | DINT-02 |
| mi.service.ts | `approve()` | processApproval + stock reservation are split transactions | DINT-01, DINT-02 |
| inventory.service.ts | `checkLowStockAlert()` | `eventBus.publish()` inside tx callback | DINT-07 |
| asn.service.ts:262 | `createGrnFromAsn()` | `line.itemId` instead of `line.uomId` in fallback | DINT-03 |
| error-handler.ts | `errorHandler()` | Missing P2034 (transaction conflict) case | Supports DINT-01/02 |

### What is ALREADY correct (no changes needed)

| Service | Function | Why Correct |
|---------|----------|-------------|
| grn.service.ts | `createGrnRecord()` | totalValue calculated inside $transaction, returned in response |
| grn.service.ts | `submit()` | Status + QCI/DR creation in $transaction, event post-commit |
| grn.service.ts | `store()` | Status + addStockBatch in $transaction, event post-commit |
| mrn.service.ts | `complete()` | Status + addStockBatch in $transaction, event post-commit |
| stock-transfer.service.ts | `ship()` | deductStockBatch + status in $transaction, event post-commit |
| stock-transfer.service.ts | `receive()` | addStockBatch + status in $transaction, event post-commit |
| mi.service.ts | `issue()` | issueMirv runs inside $transaction, event post-commit |
| mi.service.ts | `create()` | Document + lines + estimatedValue in $transaction |

### What needs VERIFICATION (edge cases)

| Service | Function | Check |
|---------|----------|-------|
| grn.service.ts | `createGrnRecord()` | Verify totalValue is 0 only when all lines have null unitCost (not a bug, expected behavior) |
| mi.service.ts | `autoFulfillParentMr()` | Already uses $transaction -- verify event publishing is post-commit |

## Open Questions

1. **Should `createAuditLog` accept a transaction client?**
   - What we know: It currently uses global `prisma`. Called both inside and outside transactions.
   - What's unclear: Whether audit log atomicity is required (informational vs. legally required).
   - Recommendation: Add optional `tx?: TxClient` parameter. When called inside approval transaction, pass `tx`. When called standalone, use global `prisma`. This is consistent with the `externalTx` pattern.

2. **Should MI approve() compose processApproval + stock reservation into ONE transaction?**
   - What we know: Currently two separate transactions. If stock reservation fails, approval is already committed.
   - What's unclear: Whether this is acceptable (MI can be re-processed) or must be atomic.
   - Recommendation: Keep as two transactions. The approval state change is idempotent (re-approving a committed approval is a no-op), and stock reservation failure is recoverable. Composing would require `processApproval` to accept `tx`, which is a larger refactor that may introduce the delegate-from-tx pitfall.

3. **Should `getPrismaDelegate` work with transaction clients?**
   - What we know: `getDelegate(documentType)` returns from global `prisma`. Inside transactions, this creates a separate connection.
   - What's unclear: Whether Prisma transaction clients expose the same delegate accessors.
   - Recommendation: Inside the approval transaction, use `tx[modelName as keyof typeof tx]` directly instead of the delegate helper. This avoids the global prisma escape.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (via vitest.config.ts) |
| Config file | packages/backend/vitest.config.ts |
| Quick run command | `cd packages/backend && npx vitest run --passWithNoTests` |
| Full suite command | `cd packages/backend && npx vitest run --passWithNoTests` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DINT-01 | Stock mutations + doc updates atomic | integration | `cd packages/backend && npx vitest run src/domains/inbound/services/grn.service.test.ts -t "transaction" --passWithNoTests` | No -- Wave 0 |
| DINT-02 | processApproval wraps all DB in $transaction | unit | `cd packages/backend && npx vitest run src/domains/workflow/services/approval.service.test.ts -t "transaction" --passWithNoTests` | No -- Wave 0 |
| DINT-03 | ASN UOM uses line.uomId not line.itemId | unit | `cd packages/backend && npx vitest run src/domains/inbound/services/asn.service.test.ts -t "uom" --passWithNoTests` | No -- Wave 0 |
| DINT-04 | GRN totalValue from lines in create tx | unit | `cd packages/backend && npx vitest run src/domains/inbound/services/grn.service.test.ts -t "totalValue" --passWithNoTests` | No -- Wave 0 |
| DINT-07 | Domain events after commit, not inside tx | unit | `cd packages/backend && npx vitest run src/domains/workflow/services/approval.service.test.ts -t "post-commit" --passWithNoTests` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/backend && npx vitest run --passWithNoTests`
- **Per wave merge:** `cd packages/backend && npx vitest run --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/backend/src/domains/workflow/services/approval.service.test.ts` -- covers DINT-02, DINT-07 (processApproval transaction wrapping, post-commit events)
- [ ] `packages/backend/src/domains/inbound/services/asn.service.test.ts` -- covers DINT-03 (UOM assignment)
- [ ] `packages/backend/src/domains/inbound/services/grn.service.test.ts` -- covers DINT-04 (totalValue calculation)
- [ ] Note: Existing test files for workflow (workflow.routes.test.ts) and mirv-operations (mirv-operations.test.ts) exist but do not cover transaction atomicity

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/backend/src/domains/inventory/services/inventory.service.ts` -- TxClient pattern, addStockBatch, updateLevelWithVersion
- Codebase analysis: `packages/backend/src/domains/workflow/services/approval.service.ts` -- processApproval 280 lines without $transaction
- Codebase analysis: `packages/backend/src/domains/inbound/services/asn.service.ts:262` -- UOM bug confirmed
- Codebase analysis: `packages/backend/src/domains/inbound/services/grn.service.ts:104-157` -- totalValue in create tx confirmed
- Codebase analysis: `packages/backend/src/middleware/error-handler.ts` -- P2034 missing confirmed
- [Prisma Interactive Transactions Docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions) -- timeout, maxWait, $transaction API

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- Phase 1 patterns verified against actual code
- `.planning/codebase/CONCERNS.md` -- Issue descriptions verified against source

### Tertiary (LOW confidence)
- None -- all findings verified against source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new dependencies, verified against installed versions
- Architecture: HIGH -- patterns extracted from actual codebase, every gap verified line-by-line
- Pitfalls: HIGH -- each pitfall traced to specific code locations with line numbers
- Validation: MEDIUM -- test framework verified, but specific test patterns for transaction atomicity need Wave 0 design

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable -- Prisma 6 API unlikely to change)
