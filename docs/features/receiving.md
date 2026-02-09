# Material Receiving (MRRV, Gate Pass, Shipments)

## Description

The receiving module handles inbound material flows from suppliers, including Material Receiving Report Vouchers (MRRV) for recording receipt and quality inspection, Gate Passes for controlling entry/exit of materials and vehicles, and Shipments for tracking international imports through customs clearance.

**Why it exists**: To ensure all incoming materials are properly received, inspected, documented, and stored before they can be issued to projects.

## User Flow

### MRRV (Material Receiving Report Voucher) Lifecycle

#### 1. Create MRRV (Draft)
- Warehouse staff navigates to "Warehouse" → "MRRV" → "New MRRV"
- Enters header data:
  - Supplier
  - PO Number (reference)
  - Warehouse (destination)
  - Project (optional)
  - Receive Date
  - Invoice Number
  - Delivery Note
  - Notes
- Adds line items:
  - Item, Quantity Ordered, Quantity Received, UOM
  - Unit Cost (for valuation)
  - Condition (good/damaged/defective)
  - Storage Location
  - Expiry Date (optional)
- System calculates:
  - `totalValue = sum(qtyReceived × unitCost)` across all lines
  - `hasOsd = true` if any line has `qtyDamaged > 0`
  - `rfimRequired` flag (user-selected if inspection needed)
- Auto-assigns MRRV Number: MRRV-YYYY-NNNN
- Saves as "draft" status

#### 2. Submit for QC
- Staff clicks "Submit for QC"
- Status changes: draft → pending_qc
- If `rfimRequired = true`:
  - System auto-creates RFIM (Request for Inspection) with status "pending"
  - RFIM links to MRRV
- If any line has `qtyDamaged > 0`:
  - System auto-creates OSD Report (Over/Short/Damage) with status "draft"
  - OSD includes damaged line items

#### 3. QC Approval
- QC Officer reviews RFIM (if required)
- QC Officer or Warehouse Supervisor clicks "Approve QC" on MRRV
- Status changes: pending_qc → qc_approved
- Records `qcInspectorId` and `qcApprovedDate`

#### 4. Mark as Received
- Warehouse staff confirms physical receipt
- Clicks "Mark as Received"
- Status changes: qc_approved → received

#### 5. Store in Warehouse
- Staff clicks "Store" button
- System:
  - Updates MRRV status: received → stored
  - For each line item:
    - Calls `addStock()` to add `(qtyReceived - qtyDamaged)` to inventory
    - Creates inventory lot with receipt date, unit cost, supplier
  - Emits Socket.IO event: `inventory:updated`
- Materials are now available for issue via MIRV

#### Rejection (Alternative Path)
- At any stage before "stored", authorized user can reject
- Status changes to "rejected"
- No inventory impact

### Gate Pass Lifecycle

#### 1. Create Gate Pass
- Warehouse staff creates Gate Pass for:
  - **Material Out**: Linked to MIRV (material leaving for project)
  - **Material In**: Receiving from external source
  - **Returnable**: Equipment/tools leaving temporarily
- Enters:
  - Pass Type (in/out/returnable)
  - Vehicle Number
  - Driver Name, Driver ID Number
  - Destination
  - Purpose
  - Valid Until (expiry date)
  - Items (item, quantity, UOM)
- Auto-assigns GP-YYYY-NNNN
- Status: draft

#### 2. Submit → Approve → Release → Return
- Submit: draft → pending
- Approve (Supervisor): pending → approved
- Release (Security Officer at gate exit): approved → released
  - Records `exitTime` and `securityOfficer` name
- Return (for returnable items): released → returned
  - Records `returnTime`

#### 3. Expiry/Cancellation
- Auto-expires if `validUntil` passes and status not released
- Manual cancel: Any status → cancelled (except released/returned)

### Shipment Lifecycle (International Imports)

#### 1. Create Shipment
- Logistics Coordinator creates Shipment for overseas orders
- Enters:
  - Supplier, Freight Forwarder
  - PO Number
  - Origin Country, Port of Loading
  - Port of Entry (Saudi Arabia), Destination Warehouse
  - Mode of Shipment (air/sea/land)
  - Order Date, Expected Ship Date
  - Commercial Value, Freight Cost, Insurance, Estimated Duties
- Adds line items (description, quantity, unit value, HS code)
- Auto-assigns SH-YYYY-NNNN
- Status: draft

#### 2. 10-Stage Tracking Flow
Status progression:
1. **draft** - Initial creation
2. **po_issued** - Purchase order sent to supplier
3. **in_production** - Supplier manufacturing
4. **ready_to_ship** - Goods ready for export
5. **in_transit** - Goods shipped (air/sea/land)
6. **at_port** - Arrived at Saudi port
7. **customs_clearing** - Customs clearance in progress
8. **cleared** - Customs released
9. **in_delivery** - En route to warehouse
10. **delivered** - Received at destination warehouse

#### 3. Customs Tracking (Stages 7-8)
- Freight Forwarder adds customs tracking stages via:
  - POST `/api/shipments/:id/customs`
- Customs stages (in order):
  1. `docs_submitted` - Customs declaration filed
  2. `declaration_filed` - Official declaration registered
  3. `under_inspection` - Physical inspection by customs
  4. `awaiting_payment` - Duties calculated, awaiting payment
  5. `duties_paid` - Duties/VAT paid
  6. `ready_for_release` - Clearance approved
  7. `released` - Goods released from customs
- Each stage records:
  - Customs Declaration Number
  - Customs Reference
  - Inspector Name
  - Duties Amount, VAT Amount, Other Fees
  - Payment Status
  - Issues/Resolution
- Auto-updates Shipment status:
  - Stages 1-6 → shipment status = `customs_clearing`
  - Stage 7 (released) → shipment status = `cleared`

#### 4. Delivery
- Logistics Coordinator marks shipment as delivered
- Status: cleared → delivered
- If linked to MRRV, auto-updates MRRV status to "received"

## API Endpoints

### MRRV Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/mrrv` | List MRRVs (paginated, filterable by status) |
| GET | `/api/mrrv/:id` | Get single MRRV with lines, supplier, warehouse, RFIM, OSD |
| POST | `/api/mrrv` | Create new MRRV (draft) |
| PUT | `/api/mrrv/:id` | Update MRRV header (draft only) |
| POST | `/api/mrrv/:id/submit` | Submit for QC (draft → pending_qc, auto-create RFIM/OSD) |
| POST | `/api/mrrv/:id/approve-qc` | QC approve (pending_qc → qc_approved) |
| POST | `/api/mrrv/:id/receive` | Mark as received (qc_approved → received) |
| POST | `/api/mrrv/:id/store` | Store in warehouse (received → stored, add inventory) |

**RBAC**: Create/update/submit/approve/store require `warehouse_supervisor`, `warehouse_staff`, `manager`, or `admin`.

### Gate Pass Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/gate-passes` | List Gate Passes (filter by status, passType) |
| GET | `/api/gate-passes/:id` | Get single Gate Pass with items |
| POST | `/api/gate-passes` | Create new Gate Pass (draft) |
| PUT | `/api/gate-passes/:id` | Update Gate Pass (draft only) |
| POST | `/api/gate-passes/:id/submit` | Submit for approval (draft → pending) |
| POST | `/api/gate-passes/:id/approve` | Approve (pending → approved) |
| POST | `/api/gate-passes/:id/release` | Release at gate (approved → released, set exitTime) |
| POST | `/api/gate-passes/:id/return` | Mark as returned (released → returned, set returnTime) |
| POST | `/api/gate-passes/:id/cancel` | Cancel (any status → cancelled, except released/returned) |

**RBAC**: Create/submit/release require `warehouse_supervisor`, `warehouse_staff`, or `admin`. Approve requires `warehouse_supervisor` or `admin`.

### Shipment Routes
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/shipments` | List Shipments (filter by status, mode) |
| GET | `/api/shipments/:id` | Get single Shipment with lines, customs tracking |
| POST | `/api/shipments` | Create new Shipment (draft) |
| PUT | `/api/shipments/:id` | Update Shipment header |
| PUT | `/api/shipments/:id/status` | Update shipment status + dates (actualShipDate, etaPort, actualArrivalDate) |
| POST | `/api/shipments/:id/customs` | Add customs tracking stage (auto-updates shipment status) |
| PUT | `/api/shipments/:id/customs/:cid` | Update customs tracking stage |
| POST | `/api/shipments/:id/deliver` | Mark as delivered (cleared/in_delivery → delivered, set deliveryDate) |
| POST | `/api/shipments/:id/cancel` | Cancel shipment (any status → cancelled, except delivered) |

**RBAC**: Create/update requires `logistics_coordinator`, `freight_forwarder`, `manager`, or `admin`.

## Validations

### MRRV Validations
- At least 1 line item required
- `qtyReceived` must be > 0
- `qtyDamaged` cannot exceed `qtyReceived`
- Over-delivery tolerance: `qtyReceived <= qtyOrdered × 1.1` (10%)
- `unitCost` must be >= 0
- `receiveDate` cannot be future date
- Status transitions:
  - Only "draft" can be updated
  - Only "draft" can submit for QC
  - Only "pending_qc" can be QC approved
  - Only "qc_approved" can be marked received
  - Only "received" can be stored

### Gate Pass Validations
- At least 1 item required
- `vehicleNumber` required
- `driverName` required
- `destination` required
- `issueDate` cannot be future date
- `validUntil` must be >= `issueDate`
- Status transitions:
  - Only "draft" can be updated
  - Only "draft" can submit
  - Only "pending" can be approved
  - Only "approved" can be released
  - Only "released" can be returned
  - Cannot cancel if status is "released" or "returned"

### Shipment Validations
- At least 1 line item required
- `modeOfShipment` must be one of: air, sea, land
- `orderDate` <= `expectedShipDate` (if both provided)
- `commercialValue` must be >= 0
- Customs stage must be one of 7 valid stages
- `dutiesAmount`, `vatAmount`, `otherFees` must be >= 0
- Cannot deliver from status other than "cleared" or "in_delivery"
- Cannot cancel if status is "delivered"

## Edge Cases

### 1. MRRV with Partial Damage
- Received 100 units, 10 damaged
- Stored quantity = 90 units (good stock only)
- OSD Report created for 10 damaged units
- Supplier claim process handles damaged materials separately

### 2. MRRV Rejection After QC
- If QC fails, MRRV status changes to "rejected"
- No inventory is added
- Materials returned to supplier or disposed
- Rejection reason recorded in notes

### 3. Gate Pass Expiry
- If `validUntil` date passes and pass not released
- Status auto-changes to "expired" (via scheduled job - not implemented)
- Current: Manual update required

### 4. Gate Pass for Non-Inventory Items
- Can issue Gate Pass for items not in master data (e.g., visitor equipment)
- Item description entered as free text instead of selecting from dropdown

### 5. Shipment with Multiple Container Numbers
- Current schema: `containerNumber` is single string
- Workaround: Enter comma-separated values
- Future: Add `shipment_containers` table

### 6. Customs Delay/Hold
- Shipment stuck in "customs_clearing" status
- Add customs stage "under_inspection" with issue description
- Resolution field tracks how delay was resolved

### 7. Shipment Cancellation Before Delivery
- Can cancel from any status except "delivered"
- If customs duties already paid, requires manual refund process
- Cancellation reason required (via `notes` field)

### 8. MRRV Without PO Number
- Allowed for emergency purchases or donations
- `poNumber` is optional field
- Procurement team follows up post-receipt

### 9. Shipment Delivered to Wrong Warehouse
- If delivered to different warehouse than `destinationWarehouseId`
- Must create Stock Transfer to correct warehouse
- Shipment record not updated (keeps original destination for audit)

### 10. Gate Pass Linked to MIRV
- When MIRV is issued, auto-generates Gate Pass
- `mirvId` field links them
- If MIRV is cancelled, Gate Pass should also be cancelled (manual for now)

## Business Rules

### 1. MRRV Auto-Numbering
- Format: MRRV-YYYY-NNNN (e.g., MRRV-2026-0042)
- Sequence resets annually
- Generated via `document_counters` table

### 2. RFIM Auto-Creation
- If MRRV has `rfimRequired = true`
- RFIM created automatically when MRRV submitted for QC
- RFIM status starts as "pending"
- QC Officer must complete RFIM before approving MRRV QC

### 3. OSD Auto-Creation
- If any MRRV line has `qtyDamaged > 0`
- OSD Report created automatically when MRRV submitted
- OSD status starts as "draft"
- Warehouse team completes OSD to claim from supplier

### 4. Inventory Impact Timing
- Inventory is NOT updated until MRRV status = "stored"
- Prevents premature availability for issue
- Ensures QC and physical storage complete before issuance

### 5. Gate Pass Types
- **Material Out**: For issuing materials to projects (linked to MIRV)
- **Material In**: For receiving materials from external sources
- **Returnable**: For temporary removal of equipment/tools (must track return)

### 6. Gate Pass Security Officer Role
- When releasing gate pass, security officer name is recorded
- Provides accountability for physical gate control
- Not a system role (free text field)

### 7. Shipment Mode of Shipment
- **Sea**: Longest lead time, lowest cost, tracked by BL (Bill of Lading)
- **Air**: Fastest, highest cost, tracked by AWB (Air Waybill)
- **Land**: Regional imports (GCC countries), tracked by truck number

### 8. Customs Tracking Stages (Sequential)
- Stages should follow logical order (docs → declaration → inspection → payment → release)
- System does NOT enforce sequential progression (user can skip stages)
- Future: Add validation to prevent out-of-order stages

### 9. Customs Duties Calculation
- System records `dutiesAmount`, `vatAmount`, `otherFees` (user-entered)
- Does NOT auto-calculate duties (requires tariff database)
- Finance team reconciles with actual customs invoice

### 10. Shipment-to-MRRV Linkage
- When shipment delivered, can link to MRRV via `mrrvId` field
- MRRV records physical receipt at warehouse
- Shipment tracks international transit
- Linkage is optional (can create MRRV independently)

### 11. AWB/BL Number Storage
- `awbBlNumber` field stores either:
  - AWB (Air Waybill) for air shipments
  - BL (Bill of Lading) for sea shipments
- Single field accommodates both (determined by `modeOfShipment`)

### 12. Freight Forwarder Access
- Role: `freight_forwarder`
- Can create/update shipments and add customs stages
- Cannot access other modules (limited scope)
- May require dedicated portal (future)

### 13. Port of Entry Master Data
- Saudi Arabia has 3 major ports:
  - King Abdul Aziz Port (Jeddah)
  - King Fahd Port (Dammam)
  - Jizan Port
- Plus multiple air cargo terminals
- Master data table: `ports` (portName, portCode, portType)

### 14. HS Code Tracking
- Harmonized System code for customs classification
- Stored at shipment line level: `shipmentLines.hsCode`
- Used for duty calculation (not automated)
- Required for customs declaration

### 15. Commercial Value vs. Duties
- `commercialValue` = invoice value of goods (for insurance)
- `dutiesEstimated` = estimated customs duties (before clearance)
- Actual duties recorded in `customsTracking.dutiesAmount` (after calculation)
- Variance requires financial adjustment
