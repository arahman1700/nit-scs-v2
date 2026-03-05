# Phase 1 Gap Closure — Design Document

**Date:** March 6, 2026
**Goal:** Close 6 critical gaps blocking Phase 1 UAT acceptance

---

## Gap 1: Multi-Locations (Rack/Shelf/Bin Hierarchy)

**Problem:** SOW + meeting decision requires "sub-locations (racks, zones, bins)." Only `WarehouseZone` exists (zone level).

**Solution:** Add `BinLocation` model under `WarehouseZone`:
- Fields: `zoneId`, `aisle`, `rack`, `shelf`, `bin`, `locationCode` (computed: `{zone}-{aisle}-{rack}-{shelf}-{bin}`), `locationType` (picking/bulk/staging/quarantine), `maxCapacity`, `currentOccupancy`, `isActive`
- Add `binLocationId` FK to: `InventoryLot`, `BinCardTransaction`, `MrrvLine`, `MirvLine`
- Add CRUD routes under `/warehouse-zones/:zoneId/bin-locations`
- Seed with sample locations for existing warehouses

## Gap 2: Bin Cards — Computed View as Primary

**Problem:** SOW requires computed views. We have stored records + computed endpoint hybrid.

**Solution:**
- Create database view `v_bin_card_balance` aggregating from `InventoryLevel` + transactions
- Make computed endpoint (`GET /bin-cards/computed`) the default in frontend `useBinCards` hook
- Stored `BinCard` model remains for physical bin-location assignment only (not balances)
- Rename frontend hook methods to clarify: `useComputedBinCards` (primary), `useBinLocations` (physical)

## Gap 3: Pick List Auto-Generation on MI Approval

**Problem:** Wave picking exists but requires manual trigger. SOW says "system generates a pick list on approval."

**Solution:**
- In `mirv-operations.ts` `approveMirv()`, after final approval, auto-call `createWave()` for single-MI wave
- Add `pickWaveId` FK on `Mirv` model linking to the generated wave
- Wave pick list visible on MI detail page
- Skip auto-generation if MI has no warehouse-stocked items (e.g. direct delivery)

## Gap 4: Inbound Gate → Expected Deliveries Link

**Problem:** Inbound gate pass doesn't link to expected MRRVs/ASN.

**Solution:**
- Add `asnId` and `expectedMrrvId` optional FKs to `GatePass` model
- Add lookup endpoint `GET /gate-passes/expected-deliveries?supplierId=X`
- In `verifyInbound()`, show matched expected deliveries to gate officer
- On inbound gate pass creation, auto-suggest matching ASN/draft MRRV

## Gap 5: Gate Movement vs Inventory Reconciliation

**Problem:** Daily reconciliation compares lots vs levels (internal). SOW wants gate movements vs inventory transactions.

**Solution:**
- Extend `runDailyReconciliation()` in maintenance-jobs.ts
- Add gate-vs-inventory comparison: outbound gate released quantities vs MI issued quantities per day
- Same for inbound: gate received vs GRN received quantities
- Flag mismatches exceeding configurable threshold (default 1%)
- Notify `warehouse_supervisor` + `gate_officer` on discrepancies

## Gap 6: Row Owner Filtering Consistency

**Problem:** `buildScopeFilter()` only applied in `crud-factory.ts`. Named domain routes bypass it.

**Solution:**
- Create `applyScopeFilter` Express middleware that sets `req.scopeFilter` from JWT
- Audit all 14 domain barrels — ensure every list endpoint applies `req.scopeFilter`
- For named routes that build custom queries, inject the scope filter into their `where` clauses
- Add integration test verifying warehouse_staff can only see their warehouse's data

---

## Out of Scope (Phase 2+)

- MRV → Scrap auto-routing
- MIRV → Pick auto-trigger improvements beyond single-MI wave
- Supplier Eval → Supplier.rating writeback
- Notify & Block Workflows (Phase 4, needs clarification)
- Custody Workflows (Phase 4, needs clarification)
