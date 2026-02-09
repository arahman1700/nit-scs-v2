# Material Issuing (MIRV, MRF, Stock Transfers)

## Description

The issuing module handles outbound material flows from warehouses to projects via Material Issue Request Vouchers (MIRV) with 5-level approval workflow, Material Requisition Forms (MRF) for auto-routing requests (from stock or purchase), and Stock Transfers for inter-warehouse movements.

**Why it exists**: To control material consumption, ensure proper authorization before issuing expensive materials, and track material movements between locations.

## User Flow

### MIRV (Material Issue Request Voucher) Lifecycle

#### 1. Create MIRV (Draft)
- Site Engineer navigates to "MIRV" → "New MIRV"
- Enters header:
  - Project (destination)
  - Warehouse (source)
  - Location of Work
  - Request Date, Required Date
  - Priority (low/normal/high/urgent)
  - Notes
- Adds line items: Item, Quantity Requested
- System calculates `estimatedValue = sum(qtyRequested × item.standardCost)`
- Auto-assigns MIRV-YYYY-NNNN
- Status: draft

#### 2. Submit for Approval
- Site Engineer clicks "Submit for Approval"
- Status: draft → pending_approval
- System determines approval level based on `estimatedValue`:
  - **Level 1** (<10K SAR): Storekeeper, SLA 4 hours
  - **Level 2** (10-50K SAR): Logistics Manager, SLA 8 hours
  - **Level 3** (50-100K SAR): Department Head, SLA 24 hours
  - **Level 4** (100-500K SAR): Operations Director, SLA 48 hours
  - **Level 5** (>500K SAR): CEO, SLA 72 hours
- Creates approval record in `approvals` table
- Sends notification to approver's role
- Creates SLA tracking record (if enabled)

#### 3. Multi-Level Approval Flow
- Approver receives notification
- Reviews MIRV details
- Options:
  - **Approve**:
    - If this is the final required level → status: pending_approval → approved
    - If more levels needed → create next approval record
  - **Reject**: status → rejected, workflow ends
- Each approval records: approver, approved date, level, comments

#### 4. Stock Reservation (On Approval)
- When MIRV reaches "approved" status
- System calls `reserveStock()` for each line item:
  - Checks availability: `(qty_on_hand - qty_reserved) >= qty_requested`
  - If sufficient: Reserves stock from oldest lots (FIFO)
  - If insufficient: Approval fails with error "Insufficient stock for item X"
- Reserved stock is committed (not available for other MIRVs)

#### 5. Issue Materials (Partial or Full)
- Warehouse Staff navigates to approved MIRV
- For each line, clicks "Issue" and enters `qtyIssued`
- Can issue partial quantity (e.g., request 100, issue 50 first)
- System:
  - Calls `consumeReservation()`:
    - Deducts from `qty_on_hand`
    - Releases from `qty_reserved`
    - Consumes oldest lots (FIFO)
    - Creates `lot_consumption` records
  - Updates line: `qtyIssued` += issued amount
  - If `sum(qtyIssued) < sum(qtyRequested)` across lines → status: partially_issued
  - If all lines fully issued → status: issued
- Auto-generates Gate Pass for material exit (optional)

#### 6. Complete MIRV
- After all lines issued, warehouse staff marks MIRV as "completed"
- Status: issued → completed
- MIRV is closed, no further changes allowed

#### 7. Cancellation (Before Issue)
- If MIRV needs to be cancelled (approved but not issued)
- Status: approved → cancelled
- System calls `releaseReservation()` to free reserved stock

### MRF (Material Requisition Form) Lifecycle

#### 1. Create MRF
- Site Engineer creates MRF for needed materials
- Enters:
  - Project
  - Justification/Purpose
  - Required Date
- Adds line items: Item, Quantity, UOM, Notes
- Auto-assigns MRF-YYYY-NNNN
- Status: draft

#### 2. Submit → Review → Approve
- Submit: draft → submitted
- Logistics Coordinator reviews: submitted → under_review
- Manager approves: under_review → approved

#### 3. Auto-Routing (Check Stock)
- When MRF approved, system changes status to "checking_stock"
- For each line, checks inventory availability:
  - Queries `inventory_levels` for item across all warehouses
  - If `(qty_on_hand - qty_reserved) >= qty_requested`:
    - Line marked as "from_stock"
    - Auto-creates MIRV line (linked to MRF)
  - If insufficient:
    - Line marked as "needs_purchase"
    - Procurement team notified

#### 4. Fulfillment
- **From Stock**: Warehouse issues via MIRV
  - When MIRV line fully issued → MRF line status: fulfilled
- **Needs Purchase**: Procurement creates PO
  - When PO received via MRRV → MRF line status: fulfilled
- When all lines fulfilled → MRF status: fulfilled

#### 5. Rejection/Cancellation
- Manager can reject at approval stage: under_review → rejected
- Requester can cancel before fulfillment: any status → cancelled

### Stock Transfer Lifecycle

#### 1. Create Stock Transfer
- User creates transfer:
  - Transfer Type: warehouse_to_warehouse, project_to_project, warehouse_to_project
  - From Warehouse/Project, To Warehouse/Project
  - Transfer Date, Expected Delivery Date
  - Reason
- Adds line items: Item, Quantity, UOM
- Auto-assigns ST-YYYY-NNNN
- Status: draft

#### 2. Submit → Approve
- Submit: draft → pending
- Supervisor approves: pending → approved

#### 3. Ship (Deduct from Source)
- Warehouse staff clicks "Ship"
- Status: approved → shipped
- System calls `deductStock()` for each line:
  - Deducts from source warehouse `qty_on_hand`
  - Consumes oldest lots (FIFO)
  - Creates `lot_consumption` records
- Material is now "in transit" (not in any warehouse)

#### 4. Receive (Add to Destination)
- Receiving warehouse clicks "Receive"
- Status: shipped → received
- System calls `addStock()` for each line:
  - Adds to destination warehouse `qty_on_hand`
  - Creates new inventory lot

#### 5. Complete
- After verification, mark as "completed"
- Status: received → completed
- Transfer is closed

#### 6. Cancellation
- Can cancel from draft/pending/approved (before shipping)
- Cannot cancel after shipped (must complete or create reverse transfer)

## API Endpoints

### MIRV Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mirv` | List MIRVs (filter by status, project) |
| GET | `/api/mirv/:id` | Get single MIRV with lines, approvals |
| POST | `/api/mirv` | Create new MIRV (draft) |
| PUT | `/api/mirv/:id` | Update MIRV header (draft only) |
| POST | `/api/mirv/:id/submit` | Submit for approval (draft → pending_approval, create approval record) |
| POST | `/api/mirv/:id/approve` | Approve current level (pending_approval → approved or next level) |
| POST | `/api/mirv/:id/reject` | Reject (pending_approval → rejected) |
| POST | `/api/mirv/:id/issue-line` | Issue line item (partial/full), deduct inventory, update status |
| POST | `/api/mirv/:id/complete` | Mark as completed (issued → completed) |
| POST | `/api/mirv/:id/cancel` | Cancel (approved → cancelled, release reservation) |

**RBAC**: Create requires `site_engineer`, `warehouse_supervisor`, `manager`, `admin`. Approve requires role based on approval level. Issue requires `warehouse_staff`, `warehouse_supervisor`, `manager`, `admin`.

### MRF Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mrf` | List MRFs (filter by status, project) |
| GET | `/api/mrf/:id` | Get single MRF with lines, linked MIRV |
| POST | `/api/mrf` | Create new MRF (draft) |
| PUT | `/api/mrf/:id` | Update MRF header (draft only) |
| POST | `/api/mrf/:id/submit` | Submit (draft → submitted) |
| POST | `/api/mrf/:id/review` | Mark under review (submitted → under_review) |
| POST | `/api/mrf/:id/approve` | Approve (under_review → approved → checking_stock, auto-route) |
| POST | `/api/mrf/:id/reject` | Reject (under_review → rejected) |
| POST | `/api/mrf/:id/cancel` | Cancel (any status → cancelled, before fulfillment) |

**RBAC**: Create requires `site_engineer`. Review requires `logistics_coordinator`. Approve requires `manager`, `admin`.

### Stock Transfer Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/stock-transfers` | List Stock Transfers (filter by status, type) |
| GET | `/api/stock-transfers/:id` | Get single Stock Transfer with lines |
| POST | `/api/stock-transfers` | Create new Stock Transfer (draft) |
| PUT | `/api/stock-transfers/:id` | Update header (draft only) |
| POST | `/api/stock-transfers/:id/submit` | Submit (draft → pending) |
| POST | `/api/stock-transfers/:id/approve` | Approve (pending → approved) |
| POST | `/api/stock-transfers/:id/ship` | Ship (approved → shipped, deduct source inventory) |
| POST | `/api/stock-transfers/:id/receive` | Receive (shipped → received, add destination inventory) |
| POST | `/api/stock-transfers/:id/complete` | Complete (received → completed) |
| POST | `/api/stock-transfers/:id/cancel` | Cancel (draft/pending/approved → cancelled) |

**RBAC**: Create/submit requires `warehouse_supervisor`, `logistics_coordinator`, `manager`, `admin`. Approve/ship/receive requires `warehouse_supervisor`, `manager`, `admin`.

## Validations

### MIRV Validations
- At least 1 line item required
- `qtyRequested` must be > 0
- `requestDate` cannot be future date
- `requiredDate` must be >= `requestDate`
- Status transitions:
  - Only "draft" can be updated or submitted
  - Only "pending_approval" can be approved/rejected
  - Only "approved" can issue lines or be cancelled
  - Only "issued" (all lines fully issued) can be completed
- Approval level validation:
  - Approver's role must match required level
  - Cannot skip approval levels
- Stock availability check on approval:
  - Each line must have sufficient available stock
  - Error if `(qty_on_hand - qty_reserved) < qty_requested`

### MRF Validations
- At least 1 line item required
- `qtyRequested` must be > 0
- `requiredDate` must be >= current date
- Status transitions:
  - Only "draft" can be updated or submitted
  - Only "submitted" can be reviewed
  - Only "under_review" can be approved/rejected
  - Cannot cancel if status is "fulfilled"

### Stock Transfer Validations
- At least 1 line item required
- `qtyToTransfer` must be > 0
- From and To locations must be different
- `transferDate` cannot be future date
- `expectedDeliveryDate` must be >= `transferDate`
- Status transitions:
  - Only "draft" can be updated or submitted
  - Only "pending" can be approved
  - Only "approved" can be shipped
  - Only "shipped" can be received
  - Only "received" can be completed
  - Cannot cancel if status is "shipped", "received", or "completed"
- Stock availability check on ship:
  - Each line must have sufficient stock at source warehouse

## Edge Cases

### 1. MIRV Approval Fails (Insufficient Stock)
- MIRV value is within approval level (e.g., 20K SAR, Level 2)
- Approver clicks "Approve"
- System checks stock availability → Item A has only 50 units, but 100 requested
- Approval transaction rolls back with error: "Insufficient stock for Item A"
- MIRV remains in "pending_approval" status
- Approver must reject MIRV or requester must reduce quantity

### 2. MIRV Partial Issue Over Multiple Days
- Day 1: Issue 50 units → status: partially_issued, qty_reserved -= 50, qty_on_hand -= 50
- Day 2: Issue remaining 50 units → status: issued, qty_reserved -= 50, qty_on_hand -= 50
- Reservation is released incrementally as quantities are issued

### 3. MIRV Multi-Level Approval
- MIRV value: 75K SAR
- Level 1 (Storekeeper) approves → creates Level 2 approval
- Level 2 (Logistics Manager) approves → creates Level 3 approval
- Level 3 (Department Head) approves → MIRV status = "approved", stock reserved
- Total approval time: 4h + 8h + 24h = 36 hours (if SLA met)

### 4. MRF Mixed Fulfillment
- MRF has 5 line items
- 3 items available in stock → auto-creates MIRV with 3 lines
- 2 items need purchase → Procurement creates PO
- MIRV issued → 3 lines fulfilled
- PO received → 2 lines fulfilled
- When all 5 fulfilled → MRF status: fulfilled

### 5. MRF Auto-Routing Across Warehouses
- Item X requested: 100 units
- Warehouse A: 60 available
- Warehouse B: 80 available
- System selects Warehouse B (highest availability) → creates MIRV from Warehouse B
- Future enhancement: Split across warehouses if no single warehouse has full quantity

### 6. Stock Transfer In-Transit Loss
- Transfer shipped from Warehouse A
- Quantity deducted from A
- Truck accident → materials lost
- Transfer cannot be marked "received" at Warehouse B
- Manual stock adjustment required at Warehouse A (credit back) and B (write-off)
- Current system: No "lost in transit" status (future enhancement)

### 7. Stock Transfer Rejection After Shipment
- Transfer already shipped (inventory deducted from source)
- Receiving warehouse finds materials damaged/incorrect
- Cannot cancel transfer (already shipped)
- Must receive at destination, then create:
  - OSD Report for damaged items
  - Reverse Stock Transfer to return to source

### 8. MIRV Cancellation After Partial Issue
- MIRV approved, 100 units reserved
- 50 units issued, 50 still reserved
- Cannot cancel MIRV (status is "partially_issued", not "approved")
- Workaround: Issue 0 units for remaining lines (marks as "issued"), then close
- Future: Allow cancellation of remaining quantity

### 9. MIRV SLA Tracking (Stop-the-Clock)
- Approval SLA: 4 hours (Level 1)
- Clock starts when MIRV submitted
- Approver requests additional info → MIRV status: on_hold
- Clock pauses
- Requester provides info → MIRV status: pending_approval (resumes)
- Clock resumes from paused time
- Current system: SLA tracking exists but stop-the-clock not fully implemented

### 10. Approval Level Mismatch
- MIRV value: 25K SAR (Level 2: Logistics Manager)
- Storekeeper (Level 1 role) attempts to approve
- System checks: `req.user.systemRole` vs. required role for Level 2
- Error: "You do not have permission to approve at this level"
- Only users with "logistics_coordinator" or higher role can approve

## Business Rules

### 1. MIRV 5-Level Approval Thresholds
Defined in `@nit-scs/shared/constants.ts`:
```
Level 1: 0-10K SAR, Storekeeper, 4h SLA
Level 2: 10-50K SAR, Logistics Manager, 8h SLA
Level 3: 50-100K SAR, Department Head, 24h SLA
Level 4: 100-500K SAR, Operations Director, 48h SLA
Level 5: >500K SAR, CEO, 72h SLA
```
**Rationale**: Higher value requisitions require more senior approval to control spending.

### 2. Stock Reservation Timing
- Reservation occurs ONLY when MIRV reaches "approved" status
- NOT when MIRV is created or submitted
- Prevents locking stock for un-approved requests
- Released on cancellation or full issuance

### 3. FIFO Consumption on Issue
- When issuing materials, system consumes oldest lots first
- Ensures proper cost matching and inventory rotation
- Prevents expiry of older stock

### 4. Estimated Value Calculation
- Uses `item.standardCost` (not lot unit cost)
- Calculated at MIRV creation: `sum(qtyRequested × standardCost)`
- Does NOT update if standard cost changes later
- Used solely for approval routing (not actual cost tracking)

### 5. Actual Cost Tracking
- When materials issued, system calculates `actualCost` using lot unit costs
- May differ from estimated value
- Recorded in `lot_consumption` records
- Used for project cost accounting

### 6. MIRV Priority Levels
- **Urgent**: Same-day requirement (SLA shortened)
- **High**: 1-2 day requirement
- **Normal**: 3-7 day requirement
- **Low**: >7 day requirement
- Priority does NOT affect approval levels (only SLA targets)

### 7. MRF Auto-Routing Logic
```
FOR each line:
  IF available_stock >= qty_requested:
    Mark line as "from_stock"
    Create MIRV line
  ELSE:
    Mark line as "needs_purchase"
    Notify procurement
```
- Runs when MRF status changes from "approved" to "checking_stock"
- Automated decision (no user intervention)

### 8. Stock Transfer Types
- **warehouse_to_warehouse**: Between central warehouses
- **project_to_project**: Between project sites (via IMSF)
- **warehouse_to_project**: Initial project material delivery
- Each type may have different approval requirements (future)

### 9. Stock Transfer Linked Documents
- `sourceMrvId`: If transfer is triggered by MRV (material return)
- `destinationMirvId`: If transfer is to fulfill a MIRV at destination
- `transportJoId`: If transport JO is created for the transfer
- `gatePassId`: Gate Pass for truck exit/entry
- Linkage is optional but recommended for traceability

### 10. Gate Pass Auto-Generation from MIRV
- When MIRV line is issued, can auto-create Gate Pass
- Gate Pass type: "Material Out"
- Linked via `mirvId` field
- Simplifies warehouse exit documentation

### 11. MIRV Completion Criteria
- All line items must have `qtyIssued = qtyRequested` (full issue)
- OR user manually marks as "completed" (accepting shortfall)
- Completed MIRVs cannot be modified or re-opened

### 12. MRF Justification Requirement
- Free-text field explaining why materials are needed
- Required for approval (manager reviews justification)
- Helps prevent unnecessary purchases

### 13. Leftover Materials Handling
- After project completion, unused materials should be returned
- Create Stock Transfer: project → central warehouse
- Alternative: Create MRV (Material Return Voucher)
- Materials over 5,000 SAR value must be returned (company policy)

### 14. MIRV Rejection Reasons
Common reasons:
- Insufficient stock availability
- Unjustified quantity (over-ordering)
- Wrong project charged
- Budget constraints
- Rejection reason recorded in `approvals.comments` field

### 15. Stock Transfer Variance Handling
- If received quantity ≠ shipped quantity (loss/damage in transit)
- System currently allows entering different `qtyReceived` at destination
- Variance requires investigation (theft, damage, counting error)
- Should trigger OSD Report for discrepancies over threshold (future)
