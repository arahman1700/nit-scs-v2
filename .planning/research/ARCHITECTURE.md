# Architecture Patterns: Hardening DDD Express+Prisma for Production

**Domain:** Enterprise supply chain management (19-domain backend)
**Researched:** 2026-03-22
**Overall Confidence:** HIGH (patterns verified against codebase + official docs)

## Recommended Architecture

The system already follows a sound domain-driven structure with 19 backend domains, a document router factory, and centralized error handling. The hardening work is not a rewrite -- it is systematically closing gaps in the existing patterns. The architecture is fundamentally correct; the execution has inconsistencies.

### Current State Assessment

**What works well:**
- Domain organization with barrel exports (`registerXxxRoutes`)
- `createDocumentRouter` factory eliminates boilerplate
- `safeStatusUpdate` / `safeStatusUpdateTx` for atomic status transitions
- `TxClient` type alias enables transaction composition
- `addStockBatch` / `reserveStockBatch` already accept `externalTx` parameter
- Optimistic locking on `InventoryLevel` and `InventoryLot` with version fields
- Soft-delete extension via `$extends` on PrismaClient (auto-filters `deletedAt`)
- Read replica support via `prismaRead` for reporting queries
- Centralized error handler with Prisma error mapping (P2002, P2025, P2003)

**What needs hardening (in dependency order):**

1. Transaction safety gaps (some stock ops not wrapped)
2. Approval state machine not transactional (10+ sequential DB calls)
3. N+1 queries in MR stock checking (partially fixed, others remain)
4. Missing database indexes on high-volume join columns
5. Soft-delete not covering `findUnique` or nested relation filters
6. No caching layer for frequently-read reference data
7. Event bus publishes inside transactions (side effects before commit)

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Document Router Factory** | CRUD + status transitions, RBAC, validation, audit | Service layer, middleware |
| **Domain Services** | Business logic, orchestration, transaction boundaries | Prisma via TxClient, EventBus |
| **Inventory Service** | Stock mutations (add, reserve, consume, release) | Called by Inbound/Outbound/Transfer services |
| **Approval Service** | Multi-level approval state machine | Document services via delegates, notifications |
| **Safe Status Transition** | Atomic status updates with conflict detection | Used by all document services |
| **Event Bus** | Domain event dispatch (in-memory EventEmitter) | Rule engine, notifications, Socket.IO |
| **Cache Utility** | Redis cache-aside with TTL | Dashboard/reporting endpoints |
| **Error Handler** | Centralized Express error middleware | All routes (terminal middleware) |
| **Soft-Delete Extension** | Auto-filter `deletedAt` on read queries | Prisma client extension |

### Data Flow (Hardened)

The target data flow for any stock-affecting operation:

```
1. Route handler receives request
2. Validate input (Zod schema)
3. Check RBAC permissions
4. Open prisma.$transaction(async tx => { ... })
   4a. Read current state (findUnique with version)
   4b. Assert valid transition (assertTransition)
   4c. Perform status update (safeStatusUpdateTx)
   4d. Perform stock mutation (addStockBatch/reserveStockBatch with tx)
   4e. Create audit log (within tx)
5. AFTER transaction commits:
   5a. Publish domain event (eventBus.publish)
   5b. Emit Socket.IO event
   5c. Invalidate cache
6. Return response
```

Critical rule: **Steps 5a-5c must happen AFTER the transaction commits, never inside it.** The current codebase publishes events inside some transactions, which means side effects fire for operations that may still roll back.

## Patterns to Follow

### Pattern 1: Transaction Client Injection (Already Partially Implemented)

The codebase already defines `TxClient` and uses `externalTx` parameters on batch operations. This pattern must be extended to ALL stock-affecting operations consistently.

**What:** Every service function that mutates stock or status accepts an optional `tx?: TxClient` parameter. Callers compose multiple operations into a single transaction.

**When:** Any operation that:
- Changes document status AND inventory levels
- Performs multi-step approval state changes
- Creates related records that must succeed or fail together

**Example (already in codebase, extend to all):**
```typescript
// inventory.service.ts -- EXISTING GOOD PATTERN
export type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function addStockBatch(items: AddStockParams[], externalTx?: TxClient): Promise<void> {
  const run = async (tx: TxClient) => {
    // ... all mutations use tx, not prisma
  };

  if (externalTx) {
    await run(externalTx);  // compose into caller's transaction
  } else {
    await prisma.$transaction(run);  // standalone transaction
  }
}
```

**Apply to:** `processApproval` in `approval.service.ts` (currently uses `prisma.approvalStep.update` directly -- not transactional).

### Pattern 2: Post-Commit Side Effects

**What:** Domain events, Socket.IO emissions, and cache invalidation happen AFTER the transaction commits, not inside it.

**When:** Every service function that wraps operations in `$transaction`.

**Example (target pattern):**
```typescript
export async function store(id: string, userId: string) {
  const grn = await prisma.mrrv.findUnique({ where: { id }, include: { mrrvLines: true } });
  if (!grn) throw new NotFoundError('GRN', id);
  assertTransition(DOC_TYPE, grn.status, 'stored');

  const stockItems = grn.mrrvLines
    .map(line => ({ /* ... */ }))
    .filter(item => item.qty > 0);

  // Transaction boundary -- only DB mutations
  await prisma.$transaction(async tx => {
    await safeStatusUpdateTx(tx.mrrv, grn.id, grn.status, { status: 'stored' });
    await addStockBatch(stockItems, tx);
  });

  // Post-commit side effects (current code already does this correctly here)
  eventBus.publish({ type: 'document:status_changed', /* ... */ });
  await invalidateInventoryCache();

  return { id: grn.id, warehouseId: grn.warehouseId, linesStored: grn.mrrvLines.length };
}
```

**Note:** The GRN `store()` function already follows this pattern correctly. The approval service does NOT -- it interleaves DB writes and notifications without a transaction boundary.

### Pattern 3: Transactional Approval State Machine

**What:** Wrap all approval step mutations (approve current, find next, update document, update SLA) in a single `$transaction`. Move notification/event publishing outside.

**When:** `processApproval()` in `approval.service.ts`.

**Current problem:** Lines 362-549 execute 6-8 sequential Prisma calls without a transaction wrapper. If step 4 fails after step 3 succeeds, the approval is in an inconsistent state (step marked approved, but document status not updated).

**Example (target refactor):**
```typescript
export async function processApproval(params: ProcessApprovalParams): Promise<void> {
  const { documentType, documentId, action, processedById, comments, io } = params;

  // Read state outside transaction (or inside, both work)
  const currentStep = await prisma.approvalStep.findFirst({
    where: { documentType, documentId, status: 'pending' },
    orderBy: { level: 'asc' },
  });
  if (!currentStep) throw new Error(`No pending approval step`);

  const isAuthorized = await isAuthorizedApprover(processedById, currentStep.approverRole, documentType);
  if (!isAuthorized) throw new Error(`User not authorized`);

  const delegate = getDelegate(documentType);

  // All mutations in one transaction
  const result = await prisma.$transaction(async tx => {
    if (action === 'approve') {
      await tx.approvalStep.update({
        where: { id: currentStep.id },
        data: { status: 'approved', approverId: processedById, notes: comments, decidedAt: new Date() },
      });

      const nextStep = await tx.approvalStep.findFirst({
        where: { documentType, documentId, status: 'pending', level: { gt: currentStep.level } },
        orderBy: { level: 'asc' },
      });

      if (nextStep) {
        // Update SLA on document if applicable
        // ... (within tx)
        return { outcome: 'advanced', nextStep };
      } else {
        // Final approval -- update document status
        await delegate.update({
          where: { id: documentId },
          data: { status: 'approved', approvedById: processedById, approvedDate: new Date() },
        });
        await createAuditLog({ /* ... */ });
        return { outcome: 'fully_approved' };
      }
    } else {
      // Reject path -- also transactional
      await tx.approvalStep.update({ where: { id: currentStep.id }, data: { status: 'rejected', /* ... */ } });
      await tx.approvalStep.updateMany({ where: { /* pending steps */ }, data: { status: 'skipped' } });
      await delegate.update({ where: { id: documentId }, data: { status: 'rejected', /* ... */ } });
      return { outcome: 'rejected' };
    }
  });

  // Post-commit: notifications, events, socket emissions
  if (result.outcome === 'advanced') {
    notifyRoleUsers(result.nextStep.approverRole, { /* ... */ }, io).catch(/* ... */);
    eventBus.publish({ type: 'approval:level_approved', /* ... */ });
  } else if (result.outcome === 'fully_approved') {
    // notify submitter, publish event
  } else {
    // notify submitter of rejection, publish event
  }
}
```

### Pattern 4: Batch Query for N+1 Prevention

**What:** Replace loop-based individual queries with batch `findMany` using `IN` clauses.

**When:** Any service function that queries inside a loop.

**Already partially done:** `mr.service.ts:checkStock()` now uses `getStockLevelsBatch()` -- good. But the cross-project stock check at line 271 still queries projects individually.

**Example (the batch function already exists):**
```typescript
// inventory.service.ts -- EXISTING
export async function getStockLevelsBatch(
  pairs: { itemId: string; warehouseId: string }[]
): Promise<Map<string, StockLevel>> {
  // Single query with OR conditions instead of N individual queries
}
```

**Apply to:** Any remaining loops that call `prisma.xxx.findUnique` inside `for` loops, particularly in:
- `approval.service.ts:88-91` (mentioned in CONCERNS.md)
- Any `forEach`/`for...of` patterns that issue individual queries

### Pattern 5: Composite Database Indexes

**What:** Add composite indexes that match WHERE + JOIN + ORDER BY patterns in actual queries.

**When:** Before production, after auditing slow queries with `EXPLAIN ANALYZE`.

**Missing indexes identified in codebase analysis:**

| Table | Columns | Query Pattern | Priority |
|-------|---------|---------------|----------|
| `JobOrder` | `entityId` | Lookup by entity | HIGH |
| `InventoryLevel` | `itemId, lastMovementDate` | Dashboard movement queries | MEDIUM |
| `ApprovalStep` | `documentType, documentId, status` | Approval lookups (used in every approval) | HIGH |
| `AuditLog` | `tableName, recordId, createdAt` | Audit trail queries | HIGH |
| `Notification` | `recipientId, read, createdAt` | Unread notification counts | MEDIUM |

**Note:** The Shipment and InventoryLot models already have comprehensive indexes (verified in schema). The InventoryLevel model has indexes but is missing `lastMovementDate` composite.

**Prisma schema example:**
```prisma
model ApprovalStep {
  // ... existing fields ...
  @@index([documentType, documentId, status], map: "idx_approval_steps_doc_status")
}
```

**Process:** Run `EXPLAIN ANALYZE` on the top 20 most frequent queries after deploying query logging. Add indexes based on evidence, not guesses.

### Pattern 6: Hardened Soft-Delete Extension

**What:** Extend the existing `$extends` soft-delete filter to cover `findUnique`, `findFirst`, and nested `include` relations.

**Current gap:** The existing extension in `prisma.ts` only filters `findMany`, `findFirst`, and `count`. It does NOT filter `findUnique` or nested relations queried via `include`. This means:
- `prisma.mrrv.findUnique({ where: { id } })` could return a soft-deleted record
- `prisma.supplier.findMany({ include: { shipments: true } })` could include soft-deleted shipments

**Target pattern:**
```typescript
function buildExtendedClient(base: PrismaClient): PrismaClient {
  return base.$extends({
    query: {
      $allModels: {
        async findMany({ model, args, query }) {
          applySoftDeleteFilter(model, args);
          return query(args);
        },
        async findFirst({ model, args, query }) {
          applySoftDeleteFilter(model, args);
          return query(args);
        },
        async findUnique({ model, args, query }) {
          // Convert to findFirst with soft-delete filter
          // findUnique doesn't support non-unique WHERE conditions
          if (model && SOFT_DELETE_MODELS.has(model)) {
            applySoftDeleteFilter(model, args);
          }
          return query(args);
        },
        async count({ model, args, query }) {
          applySoftDeleteFilter(model, args);
          return query(args);
        },
        async aggregate({ model, args, query }) {
          applySoftDeleteFilter(model, args);
          return query(args);
        },
      },
    },
  }) as any as PrismaClient;
}
```

**Limitation:** Prisma extensions cannot automatically filter nested `include` relations. For nested relation filtering, use explicit `where` clauses in `include`:
```typescript
prisma.supplier.findMany({
  include: { shipments: { where: { deletedAt: null } } }
});
```

This is a known Prisma limitation. The `prisma-extension-soft-delete` library handles it but adds complexity. For this codebase, documenting the convention (always add `deletedAt: null` to nested includes on soft-delete models) is the pragmatic approach.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Event Publishing Inside Transactions

**What:** Calling `eventBus.publish()` or `emitToRole()` inside a `prisma.$transaction()` callback.

**Why bad:** If the transaction rolls back after the event is published, downstream listeners (rule engine, notifications) have already processed a phantom event. The notification was sent for an approval that never committed.

**Instead:** Collect events during the transaction, publish them after the transaction resolves successfully. The GRN `store()` function does this correctly; replicate the pattern everywhere.

### Anti-Pattern 2: Fire-and-Forget Stock Operations

**What:** Calling `addStockBatch()` or `reserveStockBatch()` without passing the current transaction client.

**Why bad:** Creates a separate transaction for the stock operation. If the document status update succeeds but stock add fails (or vice versa), inventory is inconsistent.

**Current violations:**
- Some outbound services call stock functions without `externalTx`
- Approval service calls `reserveStockBatch` within its own transaction (correct in MI, but verify all paths)

**Instead:** Always pass `tx` when calling stock operations from within a transaction:
```typescript
await prisma.$transaction(async tx => {
  await safeStatusUpdateTx(tx.mrrv, grn.id, grn.status, { status: 'stored' });
  await addStockBatch(stockItems, tx);  // tx passed as externalTx
});
```

### Anti-Pattern 3: Optimistic Lock Retry Inside Interactive Transaction

**What:** The `updateLevelWithVersion()` function retries 3 times inside the transaction on version conflicts.

**Why problematic in theory:** Inside a Prisma interactive transaction (which uses a DB-level transaction), another concurrent transaction cannot commit changes to the same row while this transaction holds a lock. The retry loop may be unnecessary inside a serializable transaction, or it may conflict with PostgreSQL's default `READ COMMITTED` isolation level where the version could change between reads.

**Current reality:** Under PostgreSQL's default `READ COMMITTED`, the retry loop IS appropriate because concurrent transactions CAN commit between statements. The pattern is correct for the current isolation level. Do NOT change isolation to `SERIALIZABLE` without understanding the performance implications.

**Watch for:** If timeout is too short (Prisma default: 5s), retries inside long transactions may cause the whole transaction to time out. Set `$transaction` timeout to at least 15s for stock operations:
```typescript
await prisma.$transaction(
  async tx => { /* ... */ },
  { timeout: 15000, maxWait: 10000 }
);
```

### Anti-Pattern 4: Missing `select` on Bulk Queries

**What:** Using `findMany({ include: { allRelations: true } })` when only a few fields are needed.

**Why bad:** Fetches entire object graphs for simple list operations. Increases memory, network, and serialization cost.

**Instead:** Use `select` for list queries, `include` for detail views:
```typescript
// List query -- select only what's needed
const items = await prisma.mrrv.findMany({
  select: { id: true, mrrvNumber: true, status: true, createdAt: true, totalValue: true },
  where: { ...scopeFilter },
  orderBy: { createdAt: 'desc' },
  take: pageSize,
  skip: skip,
});
```

## Scalability Considerations

| Concern | At 100 users | At 10K users | At 1M rows |
|---------|--------------|--------------|------------|
| **Transaction contention** | Negligible | Monitor lock wait times | Add `statement_timeout` per query class |
| **Approval throughput** | No issue | Add index on `(documentType, documentId, status)` | Consider partitioning `approvalStep` by `documentType` |
| **Stock operations** | Optimistic locking handles it | Monitor retry rate in logs | Consider advisory locks per `(itemId, warehouseId)` |
| **Audit log growth** | In-table | Add composite index, partition by month | Move to append-only event store (Kafka) |
| **Cache invalidation** | Low volume | SCAN pattern OK | Switch to Redis keyspace notifications or pub/sub |
| **Read replicas** | Not needed | `prismaRead` for dashboards/reports | Add connection pooling (PgBouncer) |

## Fix Order (Dependency-Aware)

The following order accounts for dependencies -- each step builds on the previous:

### Phase 1: Transaction Safety (MUST come first)

Everything else depends on data consistency being correct.

**Step 1.1: Audit all stock operations** (discovery)
- Grep for `addStockBatch`, `reserveStockBatch`, `consumeReservationBatch`, `releaseReservation` calls
- Verify each caller passes `externalTx` when inside a `$transaction`
- Document which services are missing the pattern

**Step 1.2: Wrap approval service in transactions**
- Refactor `processApproval()` to use `prisma.$transaction`
- Move all `eventBus.publish`, `notifyRoleUsers`, Socket.IO emissions outside the transaction
- Return a result object from the transaction, use it for post-commit side effects

**Step 1.3: Fix remaining unwrapped stock operations**
- Apply `externalTx` pattern to any discovered gaps from Step 1.1
- Test with concurrent requests (two users approving same document simultaneously)

**Step 1.4: Set transaction timeouts**
- Add `{ timeout: 15000, maxWait: 10000 }` to stock-affecting transactions
- Add `{ timeout: 10000 }` to approval transactions
- Add `{ timeout: 5000 }` (default) to simple CRUD transactions

### Phase 2: Database Optimization (Independent of Phase 1, can parallel partially)

**Step 2.1: Add missing indexes**
- `ApprovalStep(documentType, documentId, status)` -- used on every approval lookup
- `AuditLog(tableName, recordId, createdAt)` -- used on every audit trail query
- `JobOrder(entityId)` -- used in entity lookups
- `Notification(recipientId, read, createdAt)` -- used for unread counts

**Step 2.2: Enable query logging in staging**
- Set `log: ['query']` on PrismaClient in staging environment
- Run realistic load test (seed data scenarios)
- Identify queries > 100ms with `EXPLAIN ANALYZE`

**Step 2.3: Fix remaining N+1 patterns**
- Audit all `for...of` and `forEach` loops that contain `await prisma.xxx.find*`
- Replace with batch `findMany` using `IN` clauses or `getStockLevelsBatch` pattern
- Priority: `approval.service.ts` delegate lookups

**Step 2.4: Float to Decimal migration**
- Migrate `CycleCountLine`, `StagingAssignment`, `PackingLine` quantity fields from Float to Decimal(12,3)
- Run in a migration with data conversion

### Phase 3: Soft-Delete Hardening (After Phase 1)

**Step 3.1: Extend `$extends` to cover `findUnique` and `aggregate`**
- Update `buildExtendedClient()` in `prisma.ts`
- Test that soft-deleted records are excluded from `findUnique` calls

**Step 3.2: Audit nested includes**
- Grep for `include:` patterns on soft-delete models
- Add explicit `where: { deletedAt: null }` to nested includes
- Document the convention in CLAUDE.md

### Phase 4: Caching Layer (After Phase 2)

**Step 4.1: Cache frequently-read reference data**
- Master data (items, suppliers, warehouses, UOMs) changes rarely
- Add `cached()` wrapper to `masterData.list()` with 5-minute TTL
- Invalidate on create/update/delete mutations

**Step 4.2: Cache approval chain lookups**
- `approvalWorkflow.findFirst()` is called on every submission
- Cache with key `approval-chain:{documentType}:{amountBucket}`, 10-minute TTL
- Invalidate when approval workflows are modified

**Step 4.3: Cache permission matrix**
- Permission lookups happen on every authenticated request
- Cache with key `permissions:{roleId}`, 5-minute TTL
- Invalidate on permission changes

### Phase 5: Monitoring and Observability (After Phase 1-2)

**Step 5.1: Add transaction duration metrics**
- Instrument `$transaction` calls with Prometheus histogram
- Track: `prisma_transaction_duration_seconds{operation, domain}`
- Alert on P99 > 5s

**Step 5.2: Add optimistic lock retry metrics**
- Track retry count in `updateLevelWithVersion`
- High retry rates indicate contention hotspots

**Step 5.3: Structured error context**
- Add `documentType`, `documentId`, `userId` to all Sentry error contexts
- Add `transactionId` (UUID) to correlate logs within a transaction

## Build Order Implications for Roadmap

1. **Phase 1 (Transaction Safety) blocks everything.** If stock operations are inconsistent, caching magnifies the inconsistency, indexes speed up bad queries, and monitoring measures wrong data.

2. **Phase 2 (Database Optimization) is largely independent** and can overlap with Phase 1 completion. Index creation is non-blocking in PostgreSQL (`CREATE INDEX CONCURRENTLY`). N+1 fixes are isolated per service file.

3. **Phase 3 (Soft-Delete) depends on Phase 1** because wrapping operations in transactions means soft-delete filters need to work correctly within transaction clients.

4. **Phase 4 (Caching) must come after Phase 2** because caching N+1-affected endpoints amplifies the problem (cache miss triggers expensive query). Fix queries first, then cache.

5. **Phase 5 (Monitoring) is most valuable after Phases 1-2** because it measures the impact of the fixes and establishes baselines for production.

## Express 5 Error Handling Notes

The current error handler is solid. Express 5 automatically catches rejected promises from async route handlers -- no need for `express-async-errors` or try-catch wrappers. The existing `errorHandler` middleware correctly handles:
- `AppError` subclasses with status codes
- Prisma client errors (P2002, P2025, P2003)
- Validation errors
- 500 fallback with Sentry

**One gap:** The `PrismaClientKnownRequestError` handler does not handle `P2034` (transaction conflict/deadlock). Add:
```typescript
case 'P2034':
  res.status(409).json({
    success: false,
    message: 'Transaction conflict. Please retry your operation.',
    code: 'TRANSACTION_CONFLICT',
  });
  return;
```

This is important because wrapping more operations in transactions (Phase 1) will increase the likelihood of deadlocks under concurrent load.

## Sources

- [Prisma Transactions and Batch Queries (Official Docs)](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Prisma Best Practices (Official)](https://www.prisma.io/docs/orm/more/best-practices)
- [Cross Module Transaction with Prisma](https://dev.to/kenfdev/cross-module-transaction-with-prisma-5d08)
- [Prisma Transaction Architecture Discussion](https://github.com/prisma/prisma/discussions/7754)
- [Express 5 Error Handling (Official)](https://expressjs.com/en/guide/error-handling.html)
- [Prisma Index Optimization Guide](https://www.prisma.io/blog/improving-query-performance-using-indexes-1-zuLNZwBkuL)
- [The Missing Index Crisis: Prisma + PostgreSQL Study](https://stackinsight.dev/blog/missing-index-empirical-study)
- [Prisma Query Optimization](https://www.prisma.io/docs/orm/prisma-client/queries/query-optimization-performance)
- [Prisma Soft Delete Extension Pattern](https://www.prisma.io/docs/orm/prisma-client/client-extensions/middleware/soft-delete-middleware)
- [Implementing Soft Deletion with Client Extensions](https://matranga.dev/true-soft-deletion-in-prisma-orm/)
- [Cache-Aside Pattern with Redis](https://redis.io/tutorials/howtos/solutions/microservices/caching/)
- [State Machines for Robust APIs](https://dev.to/mohsinalipro/building-robust-backend-apis-with-state-machines-a-comprehensive-guide-2g37)
- [Prisma Indexes Documentation](https://www.prisma.io/docs/orm/prisma-schema/data-model/indexes)

---

*Architecture research: 2026-03-22*
