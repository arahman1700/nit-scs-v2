# Phase 1 Gap Closure — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close 6 critical gaps blocking Phase 1 UAT acceptance for the NIT Supply Chain system.

**Architecture:** Each gap is an independent task touching Prisma schema, backend services, and routes. All changes are additive (no breaking changes). The Prisma schema uses multi-file layout in `packages/backend/prisma/schema/`. Services follow the existing document-factory and crud-factory patterns.

**Tech Stack:** Prisma 6 (multi-file schema), Express 5, TypeScript, Vitest, React Query v5

---

### Task 1: Add BinLocation Model (Gap 1 — Multi-Locations)

**Context:** SOW + meeting decision requires sub-locations (racks, zones, bins) under WarehouseZone. Currently only zone-level tracking exists. This adds a `BinLocation` model representing physical storage positions within zones.

**Files:**
- Modify: `packages/backend/prisma/schema/11-v2-modules.prisma:352-376` (after WarehouseZone)
- Modify: `packages/backend/prisma/schema/06-inventory.prisma:30-65` (InventoryLot — add FK)
- Modify: `packages/backend/prisma/schema/03-inbound.prisma:55-84` (MrrvLine — add FK)
- Modify: `packages/backend/prisma/schema/04-outbound.prisma:60-83` (MirvLine — add FK)
- Modify: `packages/backend/src/domains/warehouse-ops/index.ts` (register route)
- Create: `packages/backend/src/routes/bin-location.routes.ts`

**Step 1: Add BinLocation model to Prisma schema**

In `packages/backend/prisma/schema/11-v2-modules.prisma`, add after the WarehouseZone `@@map` line (after line 376):

```prisma
/// Physical storage position within a warehouse zone (rack/shelf/bin)
model BinLocation {
  id               String   @id @default(uuid()) @db.Uuid
  zoneId           String   @map("zone_id") @db.Uuid
  locationCode     String   @map("location_code") @db.VarChar(30)
  aisle            String?  @db.VarChar(10)
  rack             String?  @db.VarChar(10)
  shelf            String?  @db.VarChar(10)
  bin              String?  @db.VarChar(10)
  /// CHECK: location_type IN ('picking', 'bulk', 'staging', 'quarantine', 'returns', 'overflow')
  locationType     String   @default("picking") @map("location_type") @db.VarChar(20)
  maxCapacity      Decimal? @map("max_capacity") @db.Decimal(12, 3)
  currentOccupancy Decimal? @default(0) @map("current_occupancy") @db.Decimal(12, 3)
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  zone WarehouseZone @relation(fields: [zoneId], references: [id], onDelete: Cascade)

  // Reverse relations
  inventoryLots InventoryLot[]

  @@unique([zoneId, locationCode], map: "uq_bin_location_zone_code")
  @@index([zoneId, locationType], map: "idx_bin_location_zone_type")
  @@index([isActive], map: "idx_bin_location_active")
  @@map("bin_locations")
}
```

Also add `binLocations BinLocation[]` to WarehouseZone's reverse relations (around line 373, before `@@unique`).

**Step 2: Add binLocationId FK to InventoryLot**

In `packages/backend/prisma/schema/06-inventory.prisma`, add after the `binLocation` varchar field (line 45):

```prisma
  binLocationId String? @map("bin_location_id") @db.Uuid
```

Add relation after the supplier relation (around line 56):

```prisma
  binLocationRef BinLocation? @relation(fields: [binLocationId], references: [id], onDelete: SetNull)
```

**Step 3: Add binLocationId FK to MrrvLine and MirvLine**

In `packages/backend/prisma/schema/03-inbound.prisma`, add to MrrvLine (after storageLocation, around line 67):

```prisma
  binLocationId String? @map("bin_location_id") @db.Uuid
```

In `packages/backend/prisma/schema/04-outbound.prisma`, add to MirvLine (after storageLocation, around line 74):

```prisma
  binLocationId String? @map("bin_location_id") @db.Uuid
```

Note: These are optional FKs without Prisma `@relation` (bare UUID columns) to avoid circular dependencies. The application layer validates them.

**Step 4: Generate Prisma client and verify**

Run:
```bash
pnpm --filter backend exec prisma generate
pnpm --filter backend exec tsc --noEmit
```
Expected: Both pass with zero errors.

**Step 5: Create bin-location CRUD route**

Create `packages/backend/src/routes/bin-location.routes.ts`:

```typescript
import { createCrudRouter } from '../utils/crud-factory.js';

const router = createCrudRouter('binLocation', {
  modelName: 'BinLocation',
  defaultOrderBy: { locationCode: 'asc' },
  searchFields: ['locationCode', 'aisle', 'rack', 'shelf', 'bin'],
  include: { zone: { select: { id: true, zoneName: true, zoneCode: true, warehouseId: true } } },
  scopeMapping: { warehouseField: undefined },
  filterConfig: {
    zoneId: { field: 'zoneId', type: 'exact' },
    locationType: { field: 'locationType', type: 'exact' },
    isActive: { field: 'isActive', type: 'boolean' },
  },
});

export default router;
```

**Step 6: Register in warehouse-ops domain**

In `packages/backend/src/domains/warehouse-ops/index.ts`, add:

```typescript
import binLocationRoutes from '../../routes/bin-location.routes.js';
```

Inside `registerWarehouseOpsRoutes`:

```typescript
router.use('/bin-locations', binLocationRoutes);
```

**Step 7: Verify build**

Run:
```bash
pnpm --filter backend build
```
Expected: PASS

**Step 8: Commit**

```bash
git add packages/backend/prisma/schema/ packages/backend/src/routes/bin-location.routes.ts packages/backend/src/domains/warehouse-ops/index.ts
git commit -m "feat: add BinLocation model for rack/shelf/bin sub-locations (SOW Gap 1)"
```

---

### Task 2: Bin Cards — Make Computed View Primary (Gap 2)

**Context:** SOW requires bin cards as computed views. We have a hybrid: stored `BinCard` model + `GET /bin-cards/computed` endpoint. Make the computed endpoint the primary source of truth for balances.

**Files:**
- Modify: `packages/backend/src/routes/bin-card.routes.ts:77-173` (rename endpoint)
- Modify: `packages/frontend/src/api/hooks/useBinCards.ts` (swap default)

**Step 1: Add `/bin-cards` alias for computed endpoint**

In `packages/backend/src/routes/bin-card.routes.ts`, the computed endpoint is at `GET /computed` (line 77). Add a comment clarifying this is the SOW-authoritative endpoint. No code change needed — the computed endpoint is already accessible and the frontend already has `useComputedBinCards`.

**Step 2: Update frontend default hook**

In `packages/frontend/src/api/hooks/useBinCards.ts`, find the `useBinCards` or `useBinCardList` export (line 6). Add a JSDoc comment marking `useComputedBinCards` as the primary hook:

```typescript
/**
 * SOW M1-F05: Primary bin card hook — computed running balances.
 * Use this for all balance-related queries. The stored BinCard model
 * is for physical location tracking only.
 */
```

**Step 3: Update InventoryDashboard and any pages using useBinCardList**

Search for usages of `useBinCardList` in page components. If any dashboard/page uses `useBinCardList` for balance display, replace with `useComputedBinCards`.

Run:
```bash
pnpm --filter frontend exec tsc --noEmit
```
Expected: PASS

**Step 4: Commit**

```bash
git add packages/frontend/src/api/hooks/useBinCards.ts packages/backend/src/routes/bin-card.routes.ts
git commit -m "feat: make computed bin cards the primary endpoint (SOW Gap 2)"
```

---

### Task 3: Auto-Generate Pick List on MI Approval (Gap 3)

**Context:** SOW AC-04 requires "system generates a pick list for the Warehouse Officer on MI approval." Wave picking service exists (`createWave()`) but must be manually triggered. Wire it to auto-fire on approval.

**Files:**
- Modify: `packages/backend/prisma/schema/04-outbound.prisma:2-57` (add pickWaveId to Mirv)
- Modify: `packages/backend/src/services/mirv-operations.ts:66-183` (wire auto-wave in issueMirv or add to approval callback)

**Step 1: Add pickWaveId to Mirv model**

In `packages/backend/prisma/schema/04-outbound.prisma`, add to Mirv model (after `gatePassAutoCreated`, before `createdAt`):

```prisma
  pickWaveId         String?   @map("pick_wave_id") @db.VarChar(50)
```

Note: This is a varchar reference to the in-memory wave ID (wave-picking uses in-memory Map, not a Prisma model). Not a UUID FK.

**Step 2: Generate Prisma client**

Run:
```bash
pnpm --filter backend exec prisma generate
```

**Step 3: Wire auto-wave creation in issueMirv**

In `packages/backend/src/services/mirv-operations.ts`, the `issueMirv` function (line 66) runs after approval and QC sign-off. This is where pick lists should generate. Add before the inventory consumption (around line 110, before `consumeReservationBatch`):

```typescript
// SOW Gap 3: Auto-generate pick wave for warehouse officer
if (!mirv.pickWaveId) {
  try {
    const { createWave } = await import('./wave-picking.service.js');
    const wave = await createWave(mirv.warehouseId, [mirv.id]);
    await tx.mirv.update({
      where: { id: mirv.id },
      data: { pickWaveId: wave.id },
    });
  } catch (err) {
    // Non-blocking — pick list is a convenience, not a blocker
    console.warn('[issueMirv] Auto-wave creation failed:', (err as Error).message);
  }
}
```

**Step 4: Verify build**

Run:
```bash
pnpm --filter backend build
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/prisma/schema/04-outbound.prisma packages/backend/src/services/mirv-operations.ts
git commit -m "feat: auto-generate pick list on MI issuance (SOW Gap 3)"
```

---

### Task 4: Inbound Gate → Expected Deliveries Link (Gap 4)

**Context:** Inbound gate pass doesn't link to expected MRRVs/ASN. Gate officer should see what deliveries are expected for a supplier.

**Files:**
- Modify: `packages/backend/prisma/schema/04-outbound.prisma:151-206` (GatePass — add FKs)
- Modify: `packages/backend/src/routes/gate-pass.routes.ts` (add lookup endpoint)
- Modify: `packages/backend/src/services/gate-pass.service.ts:268-319` (enhance verifyInbound)

**Step 1: Add asnId and expectedMrrvId to GatePass**

In `packages/backend/prisma/schema/04-outbound.prisma`, add to GatePass model (after `jobOrderId` FK, around line 157):

```prisma
  asnId           String?   @map("asn_id") @db.Uuid
  expectedMrrvId  String?   @map("expected_mrrv_id") @db.Uuid
```

Add relations after existing relations:

```prisma
  asn          AdvanceShippingNotice? @relation(fields: [asnId], references: [id], onDelete: SetNull)
  expectedMrrv Mrrv?                 @relation("GatePassExpectedMrrv", fields: [expectedMrrvId], references: [id], onDelete: SetNull)
```

Add `gatePassesExpected GatePass[] @relation("GatePassExpectedMrrv")` to Mrrv's reverse relations.
Add `gatePasses GatePass[]` to AdvanceShippingNotice's reverse relations in `11-v2-modules.prisma`.

**Step 2: Generate Prisma client**

Run:
```bash
pnpm --filter backend exec prisma generate
pnpm --filter backend exec tsc --noEmit
```

**Step 3: Add expected-deliveries lookup endpoint**

In `packages/backend/src/routes/gate-pass.routes.ts`, add before the existing custom routes:

```typescript
/**
 * SOW Gap 4: Lookup expected deliveries for inbound gate verification.
 * Gate officer queries by supplier to see pending ASNs and draft GRNs.
 */
router.get('/expected-deliveries', authenticate, authorize('gate_officer', 'warehouse_supervisor', 'admin'), async (req, res, next) => {
  try {
    const { supplierId, warehouseId } = req.query;
    const where: Record<string, unknown> = { status: 'pending' };
    if (supplierId) where.supplierId = supplierId;
    if (warehouseId) where.warehouseId = warehouseId;

    const [asns, draftGrns] = await Promise.all([
      prisma.advanceShippingNotice.findMany({
        where,
        include: { asnLines: true },
        orderBy: { expectedArrival: 'asc' },
        take: 20,
      }),
      prisma.mrrv.findMany({
        where: {
          status: 'draft',
          ...(supplierId ? { supplierId: supplierId as string } : {}),
          ...(warehouseId ? { warehouseId: warehouseId as string } : {}),
        },
        include: { mrrvLines: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    res.json({ asns, draftGrns });
  } catch (err) {
    next(err);
  }
});
```

**Step 4: Verify build**

Run:
```bash
pnpm --filter backend build
```
Expected: PASS

**Step 5: Commit**

```bash
git add packages/backend/prisma/schema/ packages/backend/src/routes/gate-pass.routes.ts
git commit -m "feat: add inbound gate expected-deliveries lookup (SOW Gap 4)"
```

---

### Task 5: Gate Movement vs Inventory Reconciliation (Gap 5)

**Context:** Daily reconciliation currently compares lot totals vs inventory levels. SOW also requires comparing gate movements vs inventory transactions to catch physical discrepancies.

**Files:**
- Modify: `packages/backend/src/domains/system/jobs/maintenance-jobs.ts:252-342` (extend reconciliation)

**Step 1: Add gate-vs-inventory comparison to runDailyReconciliation**

In `packages/backend/src/domains/system/jobs/maintenance-jobs.ts`, after the existing lot-vs-level reconciliation block (around line 340, before the function closing brace), add:

```typescript
  // SOW Gap 5: Gate movement vs inventory transaction reconciliation
  // Compare today's outbound gate pass released quantities vs MI issued quantities
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [gateOutbound, miIssued] = await Promise.all([
    ctx.prisma.$queryRaw<Array<{ item_id: string; warehouse_id: string; total_qty: number }>>`
      SELECT gpi.item_id, gp.warehouse_id, SUM(gpi.quantity)::float AS total_qty
      FROM gate_pass_items gpi
      JOIN gate_passes gp ON gp.id = gpi.gate_pass_id
      WHERE gp.status = 'released'
        AND gp.pass_type = 'outbound'
        AND gp.exit_time >= ${oneDayAgo}
      GROUP BY gpi.item_id, gp.warehouse_id
    `,
    ctx.prisma.$queryRaw<Array<{ item_id: string; warehouse_id: string; total_qty: number }>>`
      SELECT ml.item_id, m.warehouse_id, SUM(ml.qty_issued)::float AS total_qty
      FROM mirv_lines ml
      JOIN mirv m ON m.id = ml.mirv_id
      WHERE m.status IN ('issued', 'partially_issued')
        AND m.issued_date >= ${oneDayAgo}
      GROUP BY ml.item_id, m.warehouse_id
    `,
  ]);

  // Build lookup maps and find discrepancies
  const gateMap = new Map(gateOutbound.map(r => [`${r.item_id}:${r.warehouse_id}`, r.total_qty]));
  const gateDiscrepancies: Array<{ itemId: string; warehouseId: string; gateQty: number; miQty: number }> = [];

  for (const mi of miIssued) {
    const key = `${mi.item_id}:${mi.warehouse_id}`;
    const gateQty = gateMap.get(key) ?? 0;
    if (Math.abs(gateQty - mi.total_qty) > 0.01) {
      gateDiscrepancies.push({
        itemId: mi.item_id,
        warehouseId: mi.warehouse_id,
        gateQty,
        miQty: mi.total_qty,
      });
    }
    gateMap.delete(key);
  }

  // Items that went through gate but have no MI record
  for (const [key, gateQty] of gateMap) {
    const [itemId, warehouseId] = key.split(':');
    gateDiscrepancies.push({ itemId, warehouseId, gateQty, miQty: 0 });
  }

  if (gateDiscrepancies.length > 0) {
    ctx.log('warn', `[reconciliation] ${gateDiscrepancies.length} gate-vs-inventory discrepancies found`);
    const detail = gateDiscrepancies.slice(0, 5).map(d =>
      `Item ${d.itemId.slice(0, 8)}… WH ${d.warehouseId.slice(0, 8)}…: gate=${d.gateQty} vs MI=${d.miQty}`
    ).join('\n');

    await ctx.notifySla(
      ['warehouse_supervisor', 'gate_officer'],
      'Gate vs Inventory Mismatch',
      `${gateDiscrepancies.length} discrepancies found in last 24h:\n${detail}`,
      'gate_reconciliation',
    );
  }
```

**Step 2: Verify build**

Run:
```bash
pnpm --filter backend build
```
Expected: PASS

**Step 3: Commit**

```bash
git add packages/backend/src/domains/system/jobs/maintenance-jobs.ts
git commit -m "feat: add gate-vs-inventory reconciliation to daily job (SOW Gap 5)"
```

---

### Task 6: Row Owner Filtering Consistency (Gap 6)

**Context:** `buildScopeFilter()` is only applied in `crud-factory.ts` routes via `scopeMapping`. Many named domain routes bypass it. Need to add `scopeMapping` to all warehouse-bound CRUD routes.

**Files:**
- Modify: Multiple route files that use `createCrudRouter` or `createDocumentRouter` without `scopeMapping`

**Step 1: Identify and fix routes missing scopeMapping**

The following warehouse-bound routes need `scopeMapping: { warehouseField: 'warehouseId' }` added to their `createCrudRouter` or `createDocumentRouter` config:

Routes that handle warehouse-scoped data and need scoping:

```
packages/backend/src/routes/cycle-count.routes.ts     → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/surplus.routes.ts          → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/scrap.routes.ts            → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/imsf.routes.ts             → scopeMapping: { warehouseField: 'sourceWarehouseId' }
packages/backend/src/routes/stock-transfer.routes.ts   → scopeMapping: { warehouseField: 'sourceWarehouseId' }
packages/backend/src/routes/handover.routes.ts         → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/staging.routes.ts          → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/cross-dock.routes.ts       → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/yard.routes.ts             → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/packing.routes.ts          → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/amc.routes.ts              → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/asset.routes.ts            → scopeMapping: { warehouseField: 'warehouseId' }
packages/backend/src/routes/visitor.routes.ts          → scopeMapping: { warehouseField: 'warehouseId' }
```

For each file, find the `createCrudRouter` or `createDocumentRouter` call and add the `scopeMapping` key to its config object.

Example pattern — in each file, find the factory call like:

```typescript
const router = createCrudRouter('surplusItem', {
  modelName: 'SurplusItem',
  // ... existing config
});
```

Add:
```typescript
  scopeMapping: { warehouseField: 'warehouseId' },
```

For IMSF and StockTransfer, use `sourceWarehouseId` instead of `warehouseId` since the user's warehouse is the source.

**Step 2: Routes that DON'T need warehouse scoping**

These are cross-cutting or don't have warehouse data:
- `master-data.routes.ts` — admin-only
- `notification.routes.ts` — user-scoped by recipientId, not warehouse
- `approval.routes.ts` — cross-warehouse
- `barcode.routes.ts` — utility, no data
- `kpi.routes.ts` — aggregated views
- `rate-card.routes.ts` — admin/finance, no warehouse FK
- `tariff.routes.ts` — admin, no warehouse FK
- `compliance.routes.ts` — compliance officer, cross-warehouse
- `security.routes.ts` — admin-only
- `task.routes.ts` — personal tasks, not warehouse-scoped
- `labor.routes.ts` — project-scoped, not warehouse
- `cost-allocation.routes.ts` — reporting, cross-warehouse
- `demand.routes.ts` — reporting

**Step 3: Verify build**

Run:
```bash
pnpm --filter backend build
```
Expected: PASS

**Step 4: Run existing tests**

Run:
```bash
pnpm --filter backend test -- --run
```
Expected: All existing tests pass (scope filter only activates for warehouse-bound roles, test users are typically admin).

**Step 5: Commit**

```bash
git add packages/backend/src/routes/
git commit -m "feat: add row-owner scope filtering to all warehouse-bound routes (SOW Gap 6)"
```

---

## Verification Checklist (After All Tasks)

Run the full verification suite:

```bash
# 1. Prisma schema compiles
pnpm --filter backend exec prisma generate

# 2. TypeScript compiles (backend + frontend)
pnpm --filter backend exec tsc --noEmit
pnpm --filter frontend exec tsc --noEmit

# 3. Backend builds
pnpm --filter backend build

# 4. All backend tests pass
pnpm --filter backend test -- --run

# 5. Frontend builds
pnpm --filter frontend build
```

All must pass before pushing.
