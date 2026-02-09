# Inventory Management

## Description

The inventory system tracks material stock levels across warehouses using FIFO (First-In-First-Out) lot-based costing, reservation management for approved material issues, and automatic stock movements triggered by document workflows (MRRV, MIRV, MRV, Stock Transfers).

**Why it exists**: To maintain accurate, real-time visibility of material quantities, costs, and availability across all warehouse locations while preventing negative stock and ensuring IFRS IAS 2 compliance.

## User Flow

### Stock Addition (via MRRV Store)
1. Warehouse staff creates MRRV (Material Receiving Report Voucher)
2. MRRV moves through workflow: draft → pending_qc → qc_approved → received
3. Staff clicks "Store" on received MRRV
4. Backend calls `addStock()` for each MRRV line:
   - Creates/updates `inventory_levels` record (increments `qty_on_hand`)
   - Creates new `inventory_lot` with receipt date, unit cost, supplier
   - Auto-generates lot number: LOT-YYYY-NNNN
5. Stock is now available for issue

### Stock Reservation (via MIRV Approval)
1. Site engineer creates MIRV (Material Issue Request Voucher)
2. MIRV moves through approval workflow (5 levels based on value)
3. When MIRV reaches "approved" status:
   - Backend calls `reserveStock()` for each line
   - Increments `qty_reserved` in `inventory_levels`
   - Marks reserved quantity in oldest lots first (FIFO)
4. Reserved stock is not available for other MIRVs (qty_available = qty_on_hand - qty_reserved)

### Stock Consumption (via MIRV Issue)
1. Warehouse staff marks MIRV line items as issued
2. Backend calls `consumeReservation()`:
   - Decrements both `qty_on_hand` AND `qty_reserved`
   - Consumes from oldest lots first (FIFO)
   - Creates `lot_consumption` records linking to MIRV line
   - Calculates total cost based on lot unit costs
3. Stock is permanently removed from inventory

### Reservation Release (via MIRV Cancel)
1. If MIRV is cancelled before issuing
2. Backend calls `releaseReservation()`:
   - Decrements `qty_reserved` (leaves `qty_on_hand` unchanged)
   - Releases reserved quantity from oldest lots first
3. Stock becomes available for other requests

### Stock Return (via MRV)
1. Site engineer creates MRV (Material Return Voucher) for unused materials
2. MRV workflow: draft → pending → received → completed
3. When MRV status changes to "completed":
   - Backend calls `addStock()` with returned quantities
   - Stock is added back to warehouse inventory

### Stock Transfer (Between Warehouses)
1. User creates Stock Transfer: Warehouse A → Warehouse B
2. On "ship" status:
   - Deduct from Warehouse A (using `deductStock()`)
3. On "receive" status:
   - Add to Warehouse B (using `addStock()`)

## API Endpoints

Inventory operations are triggered by document workflows, not direct API calls. However, the following routes affect inventory:

| Document | Route | Inventory Action |
|----------|-------|------------------|
| MRRV | POST `/api/mrrv/:id/store` | Add stock (create lots) |
| MIRV | POST `/api/mirv/:id/approve` | Reserve stock (FIFO) |
| MIRV | POST `/api/mirv/:id/issue-line` | Consume reservation (deduct + release) |
| MIRV | POST `/api/mirv/:id/cancel` | Release reservation |
| MRV | PUT `/api/mrv/:id` (status=completed) | Add returned stock |
| Stock Transfer | POST `/api/stock-transfers/:id/ship` | Deduct from source |
| Stock Transfer | POST `/api/stock-transfers/:id/receive` | Add to destination |

### Query Inventory Levels
**GET /api/inventory-levels**
```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "itemId": "uuid",
      "warehouseId": "uuid",
      "qtyOnHand": 1000,
      "qtyReserved": 200,
      "lastMovementDate": "2026-02-08T10:00:00Z",
      "minStock": 50,
      "reorderPoint": 100,
      "alertSent": false,
      "item": { "itemCode": "PIPE-100", "itemDescription": "PVC Pipe 100mm" },
      "warehouse": { "warehouseName": "Central Warehouse", "warehouseCode": "CW-01" }
    }
  ],
  "meta": { "page": 1, "pageSize": 50, "total": 150 }
}
```
**Available Quantity = qtyOnHand - qtyReserved** (calculated client-side)

### Query Inventory Lots
**GET /api/inventory-lots?itemId=xxx&warehouseId=yyy**
```json
// Response
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "lotNumber": "LOT-2026-0042",
      "itemId": "uuid",
      "warehouseId": "uuid",
      "receiptDate": "2026-01-15",
      "expiryDate": null,
      "initialQty": 500,
      "availableQty": 300,
      "reservedQty": 100,
      "unitCost": 25.50,
      "supplierId": "uuid",
      "status": "active",
      "supplier": { "supplierName": "ABC Trading" }
    }
  ]
}
```

## Validations

### 1. Negative Stock Prevention
- Database constraint: `CHECK (qty_on_hand >= 0)`
- Application validation: `addStock()`, `deductStock()`, `consumeReservation()` check availability
- Error thrown if operation would result in negative inventory

### 2. Reservation Availability
- `reserveStock()` checks: `(qty_on_hand - qty_reserved) >= qty_to_reserve`
- Returns `false` if insufficient availability (does not throw error)
- Caller handles failure (e.g., reject approval)

### 3. FIFO Enforcement
- All lot operations (reserve, consume, release) use `orderBy: { receiptDate: 'asc' }`
- Oldest lots are always processed first
- No user override allowed

### 4. Lot Depletion
- When `availableQty` reaches 0, lot status changes to "depleted"
- Depleted lots are excluded from future FIFO operations

### 5. Over-Delivery Tolerance
- MRRV allows receiving up to 110% of PO quantity (10% tolerance)
- Validation in MRRV schema: `qtyReceived <= qtyOrdered * 1.1`

## Edge Cases

### 1. Partial Reservation (Insufficient Stock)
- If available stock < requested quantity
- `reserveStock()` returns `false` (no partial reservation)
- MIRV approval is rejected with message "Insufficient stock"
- User must reduce quantity or wait for new stock

### 2. Lot Spanning (Consumption Across Multiple Lots)
- If single MIRV line consumes from 3 lots:
  - Lot A (200 units at 10 SAR)
  - Lot B (150 units at 12 SAR)
  - Lot C (50 units at 11 SAR)
- Total cost = (200 × 10) + (150 × 12) + (50 × 11) = 4350 SAR
- 3 separate `lot_consumption` records created

### 3. Reserved Stock Availability
- Item X has 1000 on-hand, 300 reserved
- Available for new MIRV = 700 (not 1000)
- Dashboard shows all 3 values separately

### 4. Concurrent Reservations (Race Condition)
- Two MIRVs approved simultaneously for same item/warehouse
- Prisma transactions ensure atomic updates
- Second transaction may fail if first depletes available stock
- Application should retry or reject second MIRV

### 5. Lot Cost Discrepancies
- Lots may have different unit costs from different suppliers/dates
- FIFO ensures oldest cost is used first
- Item valuation = weighted average of all lots (calculated separately)

### 6. Expired Materials
- `inventory_lot.expiryDate` is tracked but NOT enforced
- System does not prevent issuing expired lots
- Quality team must manually check expiry via RFIM

### 7. Non-Moving Materials
- Items with no `lastMovementDate` activity for configurable period (e.g., 90 days)
- Identified via query: `WHERE lastMovementDate < NOW() - INTERVAL '90 days'`
- No automatic action (manual review required)

### 8. Zero-Cost Lots
- Lots with `unitCost = null` or `0` (donated/internal transfers)
- Consumption calculates cost as 0
- Total cost may be understated

### 9. Reservation Without Consumption
- MIRV approved but never issued (stuck in "approved" status)
- Stock remains reserved indefinitely (blocks availability)
- Manual cleanup required (cancel MIRV to release)

### 10. Stock Transfer in Transit
- During transfer, stock is deducted from source but not yet added to destination
- "In transit" quantity not tracked separately
- May appear as stock loss until received

## Business Rules

### 1. FIFO Lot Costing (IFRS IAS 2 Compliant)
- Inventory valued using First-In-First-Out method
- Ensures oldest costs are matched with consumption first
- Required for financial reporting compliance

### 2. Lot Attributes
Each lot tracks:
- Receipt date (for FIFO sorting)
- Unit cost (for valuation)
- Supplier (for traceability)
- Expiry date (optional, for perishables)
- Initial quantity (for audit)
- Available quantity (current stock)
- Reserved quantity (committed but not issued)

### 3. Inventory Levels Calculation
```
qty_on_hand = Total physical stock
qty_reserved = Stock committed to approved MIRVs
qty_available = qty_on_hand - qty_reserved (for new requests)
```

### 4. Low Stock Alerts
- `inventory_levels.minStock` = minimum safe quantity
- `inventory_levels.reorderPoint` = trigger for replenishment
- When `qty_available <= reorderPoint`, system should send alert
- `alertSent` flag prevents duplicate notifications

### 5. Stock Movement Triggers
Automatic inventory updates only via approved documents:
- MRRV stored → Add stock + create lots
- MIRV approved → Reserve stock
- MIRV issued → Consume + release reservation
- MIRV cancelled → Release reservation only
- MRV completed → Add returned stock
- Stock Transfer shipped → Deduct source
- Stock Transfer received → Add destination

### 6. Manual Stock Adjustments
- NOT implemented in current system
- Would require dedicated "Stock Adjustment" document type
- Must include reason codes (damage, theft, cycle count variance)

### 7. Negative Inventory Prohibition
- Database-level constraint prevents negative values
- Business rule: No stock can be issued if availability is insufficient
- Exception: Emergency issues require manual override (not implemented)

### 8. Item Shifting Between Projects
- Implemented via Stock Transfer with `transferType = 'project_to_project'`
- Requires "Material Shifting Form" (IMSF) in future release
- Tracks movement of leftover materials from completed projects

### 9. Leftover Materials Threshold
- Materials remaining after project completion
- If value > 5,000 SAR, must be returned to central warehouse
- If value < 5,000 SAR, may be disposed locally (pending approval)

### 10. Inventory Valuation Methods
- FIFO (implemented) - required for compliance
- Weighted Average (not implemented) - alternative method
- Standard Costing (not implemented) - uses `item.standardCost`

### 11. Cycle Counting
- Periodic physical inventory verification
- NOT implemented in Phase 1
- Future: "Cycle Count" document type to adjust discrepancies

### 12. Quarantine Inventory
- Damaged/rejected materials from RFIM/OSD
- NOT tracked separately (same as regular inventory)
- Future: Add `status` field to `inventory_levels` (available, quarantined, obsolete)

### 13. Consignment Stock
- Materials stored in NIT warehouse but owned by supplier
- NOT supported in current system
- Future: Add `ownershipType` field to lots

### 14. Safety Stock
- Buffer quantity to prevent stockouts
- Conceptually = `minStock` threshold
- Not enforced (advisory only)

### 15. ABC Classification
- A items: High value (80% of inventory value, 20% of items)
- B items: Medium value
- C items: Low value (20% of inventory value, 80% of items)
- NOT implemented (future analytics feature)
