# Business Rules - NIT Supply Chain System

> **Version:** 2.0
> **Date:** February 8, 2026
> **System:** NIT Logistics & Warehouse Management System
> **Language:** English only
> **Audience:** Development team - comprehensive technical reference

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [System Constants](#1-system-constants) | Global values and configuration parameters |
| 2 | [Inventory Constants](#2-inventory-constants) | Stock management and FIFO parameters |
| 3 | [SLA Constants](#3-sla-constants) | Service level agreement thresholds |
| 4 | [Validation Rules](#4-validation-rules) | Per-document input validation rules |
| 5 | [Approval Workflows](#5-approval-workflows) | Multi-level approval chains by value |
| 6 | [Auto-Numbering System](#6-auto-numbering-system) | Document numbering format and logic |
| 7 | [Inventory Sync Logic](#7-inventory-sync-logic) | How documents affect stock levels |
| 8 | [FIFO Lot Tracking](#8-fifo-lot-tracking) | IFRS IAS 2 compliance and costing |
| 9 | [SLA Rules](#9-sla-rules) | Service level targets and calculation |
| 10 | [Status State Machines](#10-status-state-machines) | Valid status transitions per document |
| 11 | [Material Shifting Rules](#11-material-shifting-rules) | Project-to-project transfers (IMSF) |
| 12 | [MRF Rules](#12-mrf-rules) | Material requisition and auto-routing |
| 13 | [Reservation System](#13-reservation-system) | MIRV inventory reservation logic |
| 14 | [Role-Based Access Control](#14-role-based-access-control) | Permission matrix by role |
| 15 | [Notification Rules](#15-notification-rules) | When to notify whom |
| 16 | [General Rules](#16-general-rules) | Cross-cutting business rules |

---

## 1. System Constants

These values are referenced throughout the system. They are configurable to allow changes without code modifications.

### 1.1 Currency and Locale

| Constant | Value | Notes |
|----------|-------|-------|
| `CURRENCY` | SAR (Saudi Riyal) | All monetary values |
| `VAT_RATE` | 15% | Saudi Arabia standard VAT |
| `TIMEZONE` | Asia/Riyadh (UTC+3) | All timestamps stored as UTC, displayed in Riyadh time |
| `WEEKEND_DAYS` | Friday, Saturday | Saudi Arabia working week = Sunday-Thursday |
| `FISCAL_YEAR_START` | January 1 | Calendar year = fiscal year |
| `DATE_FORMAT_DISPLAY` | DD/MM/YYYY | For UI display |
| `DATE_FORMAT_STORAGE` | ISO 8601 (YYYY-MM-DDTHH:MM:SSZ) | For database storage |

### 1.2 Working Hours

| Constant | Value | Notes |
|----------|-------|-------|
| `WORKING_HOURS_START` | 08:00 | Daily working hours start |
| `WORKING_HOURS_END` | 17:00 | Daily working hours end |
| `HOURS_PER_BUSINESS_DAY` | 9 | Used for SLA calculations |

---

## 2. Inventory Constants

| Constant | Value | Notes |
|----------|-------|-------|
| `OVER_DELIVERY_TOLERANCE` | 10% | Maximum acceptable over-delivery on MRRV |
| `NEGATIVE_INVENTORY_ALLOWED` | false | Database CHECK constraint enforces qty_on_hand >= 0 |
| `COSTING_METHOD` | FIFO | Per IFRS IAS 2 (LIFO prohibited) |
| `LOT_NUMBER_FORMAT` | LOT-YYYY-NNNN | Sequential per year |
| `LOW_STOCK_THRESHOLD` | Defined per item (min_stock field) | Triggers alert when qty_on_hand <= min_stock |
| `REORDER_THRESHOLD` | Defined per item (reorder_point field) | Triggers reorder suggestion |

---

## 3. SLA Constants

| Constant | Value | Notes |
|----------|-------|-------|
| `SLA_AT_RISK_HOURS` | 4 | When remaining time < 4 hours, status = "At Risk" |
| `SLA_TARGET_PERCENT` | 95% | Global target: 95% of items completed within SLA |
| `CUSTOMS_SLA_TARGET` | 90% | Lower target for customs (external dependency) |

---

## 4. Validation Rules

### 4.1 MRRV - Material Receiving Report Voucher

#### 4.1.1 Header Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| MRRV-V001 | receive_date | Must not be in the future: `receive_date <= NOW()` | "Received date cannot be in the future" |
| MRRV-V002 | receive_date | Must not be older than 7 days without admin approval: `receive_date >= NOW() - 7 days OR user.role = 'admin'` | "Backdating beyond 7 days requires admin approval" |
| MRRV-V003 | supplier_id | Required; must reference an active supplier: `suppliers.status = 'active'` | "Supplier must be active" |
| MRRV-V004 | warehouse_id | Required; must reference an active warehouse: `warehouses.status = 'active'` | "Warehouse must be active" |
| MRRV-V005 | mrrv_lines | At least one line item required | "MRRV must have at least one line item" |

#### 4.1.2 Line Item Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| MRRV-V010 | qty_received | Must be > 0 | "Quantity received must be positive" |
| MRRV-V011 | qty_received | Over-delivery check: If PO exists, `qty_received <= qty_ordered * 1.10`. If exceeds 10% tolerance, require approval flag | "Over-delivery exceeds 10% tolerance. Requires approval." |
| MRRV-V012 | qty_ordered | If PO reference exists, qty_ordered should be populated | "Ordered quantity required when PO is referenced" |
| MRRV-V013 | condition | Must be one of: `good`, `damaged`, `mixed` | "Invalid condition value" |

#### 4.1.3 Auto-Actions on MRRV

```
ON MRRV line WHERE condition = 'damaged':
  1. Set mrrv.rfim_required = true
  2. Auto-create RFIM record linked to this MRRV
  3. Auto-create OSD report linked to this MRRV
  4. Notify QC Officer

ON MRRV line WHERE qty_received != qty_ordered (and PO exists):
  1. Set mrrv.has_osd = true
  2. Auto-create OSD report if not already created for this MRRV
  3. OSD line created with:
     - qty_over = MAX(0, qty_received - qty_ordered)
     - qty_short = MAX(0, qty_ordered - qty_received)

ON MRRV line WHERE qty_received < qty_ordered:
  1. Mark MRRV status as "Partial" (allow multiple MRRVs per PO)
  2. Track cumulative received quantity against PO

ON MRRV status changed to 'received' or 'stored':
  1. Trigger inventory sync (see Section 7)
  2. Trigger lot creation (see Section 8)
```

### 4.2 MIRV - Material Issue Report Voucher

#### 4.2.1 Header Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| MIRV-V001 | project_id | Must reference an active project: `projects.status = 'active'` | "Cannot issue materials to a closed/cancelled project" |
| MIRV-V002 | warehouse_id | Required; must be active | "Warehouse must be active" |
| MIRV-V003 | requested_by_id | Required; must be active employee | "Requester must be an active employee" |
| MIRV-V004 | request_date | Required | "Request date is required" |
| MIRV-V005 | mirv_lines | At least one line item required | "MIRV must have at least one line item" |

#### 4.2.2 Line Item Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| MIRV-V010 | qty_requested | Must be > 0 | "Quantity requested must be positive" |
| MIRV-V011 | qty_requested | Stock availability check: `qty_requested <= inventory_levels.qty_available` WHERE `qty_available = qty_on_hand - qty_reserved` | "Insufficient stock. Available: {qty_available}" |
| MIRV-V012 | item_id | Check for reserved stock conflicts. If item is reserved for another MIRV, show warning | "Item reserved for {project_name}. Override requires confirmation." |
| MIRV-V013 | qty_issued | Must be <= qty_approved: `qty_issued <= qty_approved` | "Cannot issue more than approved quantity" |
| MIRV-V014 | qty_issued | Negative inventory prevention: `inventory_levels.qty_on_hand - qty_issued >= 0` | "Issue would cause negative inventory. Blocked." |

#### 4.2.3 Auto-Actions on MIRV

```
ON MIRV status changed to 'approved':
  1. Reserve inventory (see Section 13)
  2. Set reservation_status = 'reserved'
  3. Notify warehouse staff for picking

ON MIRV status changed to 'issued':
  1. Release reservation and deduct inventory (see Section 7)
  2. Set reservation_status = 'released'
  3. Consume FIFO lots (see Section 8)
  4. Auto-create Gate Pass (status = 'draft')
  5. Notify requestor: "Your materials are ready for pickup"

ON MIRV status changed to 'cancelled' OR 'rejected':
  1. Release reservation without deduction (see Section 13)
  2. Set reservation_status = 'released'
  3. Notify requestor with rejection_reason
```

### 4.3 MRV - Material Return Voucher

#### 4.3.1 Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| MRV-V001 | return_type | Required; must be one of: `return_to_warehouse`, `return_to_supplier`, `scrap`, `transfer_to_project` | "Invalid return type" |
| MRV-V002 | reason | Required; minimum 10 characters | "Return reason is required and must be descriptive" |
| MRV-V003 | original_mirv_id | Recommended. If provided, validate the MIRV exists and was issued to the same project | Warning if missing: "No original MIRV referenced" |
| MRV-V004 | mrv_lines.condition | Required per line; must be: `good`, `used`, `damaged` | "Condition assessment required for each item" |
| MRV-V005 | mrv_lines.qty_returned | Must be > 0 | "Return quantity must be positive" |

#### 4.3.2 Condition-Based Inventory Logic

```
ON MRV status changed to 'received':
  FOR EACH mrv_line:
    IF mrv_line.condition IN ('good', 'used'):
      // Add back to inventory
      inventory_levels.qty_on_hand += mrv_line.qty_returned
      // Create new lot (for FIFO tracking)
      Create inventory_lot with:
        receipt_date = NOW()
        initial_qty = qty_returned
        status = 'active'

    ELSE IF mrv_line.condition = 'damaged':
      // DO NOT add to available inventory
      // Log for disposition decision
      Log: "Damaged return - not added to inventory"
```

**Key rule:** Only `good` and `used` condition items are added back to available inventory. Damaged items are recorded but NOT added to qty_on_hand.

### 4.4 JO - Job Orders

#### 4.4.1 Common Validations (All JO Types)

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| JO-V001 | jo_type | Required; must be one of: `transport`, `equipment`, `rental_monthly`, `rental_daily`, `scrap`, `generator_rental`, `generator_maintenance` | "Invalid job order type" |
| JO-V002 | project_id | Required; must reference active project | "Project must be active" |
| JO-V003 | description | Required; minimum 20 characters | "Description must be at least 20 characters" |
| JO-V004 | request_date | Required; auto-set to NOW() on creation | System-set |
| JO-V005 | required_date | If provided, must be >= today | "Required date cannot be in the past" |

#### 4.4.2 Transport JO Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| JO-T001 | pickup_location / delivery_location | Same-location check: `pickup_location != delivery_location` (case-insensitive) | "Pickup and delivery cannot be the same location" |
| JO-T002 | cargo_weight_tons | Weight limit warning: If `cargo_weight_tons > 45`: set flag `requires_special_equipment = true` | Warning: "Exceeds standard trailer capacity (45 tons). Special equipment required." |
| JO-T003 | required_date | Weekend delivery warning: If falls on Friday or Saturday, show warning | Warning: "Weekend delivery may incur additional charges. Confirm?" |
| JO-T004 | cargo_weight_tons | Must be > 0 | "Cargo weight is required" |
| JO-T005 | insurance_required | Auto-set to true if `material_price_sar > 100000` | Auto-rule |

#### 4.4.3 Equipment JO Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| JO-E001 | equipment_type_id | Required | "Equipment type is required" |
| JO-E002 | quantity | Must be > 0 | "Equipment quantity must be positive" |

#### 4.4.4 Generator Rental JO Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| JO-GR001 | capacity_kva | Required; valid values: 20, 50, 100, 200, 500, 750 | "Invalid generator capacity" |
| JO-GR002 | rental dates | Availability check: Query generators with matching capacity_kva where `status = 'available'` within date range | "No generator available for requested capacity and dates" |
| JO-GR003 | rental duration | Long-term suggestion: If `duration_days > 180`, show info | Info: "Consider purchasing instead of renting. Cost comparison available." |
| JO-GR004 | rental_end_date | Must be > rental_start_date | "End date must be after start date" |

#### 4.4.5 Generator Maintenance JO Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| JO-GM001 | generator_id | Required; must reference existing generator | "Generator reference is required" |
| JO-GM002 | maintenance_type | Required; must be: `preventive`, `corrective`, `emergency` | "Maintenance type is required" |
| JO-GM003 | issue_description | Required for `corrective` and `emergency` types | "Issue description required for corrective/emergency maintenance" |

#### 4.4.6 Scrap JO Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| JO-S001 | photos (attachments) | Minimum 3 photos required | "Minimum 3 photos required for scrap disposal" |
| JO-S002 | scrap_weight_tons | Must be > 0 | "Scrap weight is required" |
| JO-S003 | scrap_weight_tons | Weighbridge certificate: If `scrap_weight_tons > 10`, set flag `requires_weighbridge_certificate = true` | "Weight exceeds 10 tons. Weighbridge certificate required." |
| JO-S004 | scrap_type | Required | "Scrap type is required" |

#### 4.4.7 Rental (Monthly/Daily) JO Validations

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| JO-R001 | rental_start_date | Required; must be >= today | "Start date cannot be in the past" |
| JO-R002 | rental_end_date | Required; must be > rental_start_date | "End date must be after start date" |
| JO-R003 | daily_rate / monthly_rate | Required based on type; must be > 0 | "Rate is required and must be positive" |
| JO-R004 | rental duration | Auto-calculated: `rental_end_date - rental_start_date` | Computed field |

### 4.5 Gate Pass

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| GP-V001 | valid_until | Auto-expiry: If not manually set, default to `issue_date + 24 hours` | Auto-set |
| GP-V002 | status | Auto-expire: Scheduled job checks all gate passes where `valid_until < NOW() AND status IN ('approved', 'released')` and sets `status = 'expired'` | Background job |
| GP-V003 | return_time | Return tracking: If `pass_type = 'outbound'` and `return_time` is not set within 72 hours of `exit_time`, trigger alert | Alert: "Gate pass {number} - vehicle not returned within 72 hours" |
| GP-V004 | vehicle_number | Required | "Vehicle number is required" |
| GP-V005 | driver_name | Required | "Driver name is required" |

### 4.6 Stock Transfer

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| ST-V001 | from_warehouse_id / to_warehouse_id | Same-warehouse prevention: `from_warehouse_id != to_warehouse_id` | "Cannot transfer to the same warehouse" |
| ST-V002 | stock_transfer_lines | Source stock check: For each line: `stock_transfer_lines.quantity <= inventory_levels.qty_available WHERE item_id AND warehouse_id = from_warehouse_id` | "Insufficient stock in source warehouse for item {item_name}" |
| ST-V003 | from_warehouse_id | Must be active warehouse | "Source warehouse must be active" |
| ST-V004 | to_warehouse_id | Must be active warehouse | "Destination warehouse must be active" |
| ST-V005 | transfer_type | If `project_to_project`, both `from_project_id` and `to_project_id` are required | "Both source and destination projects required for project-to-project transfer" |

### 4.7 RFIM - Request for Inspection of Materials

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| RFIM-V001 | mrrv_id | Required; must reference an existing MRRV | "MRRV reference is required" |
| RFIM-V002 | result | Must be: `pass`, `fail`, `conditional` | "Invalid inspection result" |
| RFIM-V003 | result = 'fail' | If result is 'fail', auto-create OSD report (if not exists) | Auto-action |
| RFIM-V004 | result = 'conditional' | If result is 'conditional', comments field is required | "Comments required for conditional approval" |

### 4.8 OSD - Over/Short/Damage Report

| Rule ID | Field | Rule | Error Message |
|---------|-------|------|---------------|
| OSD-V001 | mrrv_id | Required | "MRRV reference is required" |
| OSD-V002 | report_types | At least one of: `over`, `short`, `damage` | "At least one discrepancy type is required" |
| OSD-V003 | osd_lines.qty_invoice | Required; must be >= 0 | "Invoice quantity is required" |
| OSD-V004 | osd_lines.qty_received | Required; must be >= 0 | "Received quantity is required" |
| OSD-V005 | resolution_type | Required when status = 'resolved'. Must be one of: `credit_note`, `replacement`, `price_adjustment`, `insurance_claim`, `write_off`, `returned` | "Resolution type required to close OSD" |

---

## 5. Approval Workflows

### 5.1 MIRV Approval Chain (5 levels)

All thresholds are in SAR. The `estimated_value` is calculated as SUM of (qty_requested * unit_cost) across all MIRV lines.

| Level | Value Range (SAR) | Approver Role | SLA Hours |
|-------|-------------------|---------------|-----------|
| 1 | 0 - 9,999 | warehouse_staff | 4 |
| 2 | 10,000 - 49,999 | logistics_coordinator | 8 |
| 3 | 50,000 - 99,999 | manager | 24 |
| 4 | 100,000 - 499,999 | manager | 48 |
| 5 | >= 500,000 | admin | 72 |

**Implementation (from constants/index.ts):**
```typescript
export const MIRV_APPROVAL_LEVELS: ApprovalLevel[] = [
  { level: 1, roleName: 'warehouse_staff', minAmount: 0, maxAmount: 10_000, slaHours: 4 },
  { level: 2, roleName: 'logistics_coordinator', minAmount: 10_000, maxAmount: 50_000, slaHours: 8 },
  { level: 3, roleName: 'manager', minAmount: 50_000, maxAmount: 100_000, slaHours: 24 },
  { level: 4, roleName: 'manager', minAmount: 100_000, maxAmount: 500_000, slaHours: 48 },
  { level: 5, roleName: 'admin', minAmount: 500_000, maxAmount: Infinity, slaHours: 72 },
];
```

### 5.2 JO Approval Chain (4 levels)

The `total_amount` is the estimated or quoted cost of the job order.

| Level | Value Range (SAR) | Approver Role | SLA Hours |
|-------|-------------------|---------------|-----------|
| 1 | 0 - 4,999 | logistics_coordinator | 4 |
| 2 | 5,000 - 19,999 | manager | 8 |
| 3 | 20,000 - 99,999 | manager | 24 |
| 4 | >= 100,000 | admin | 48 |

**Implementation (from constants/index.ts):**
```typescript
export const JO_APPROVAL_LEVELS: ApprovalLevel[] = [
  { level: 1, roleName: 'logistics_coordinator', minAmount: 0, maxAmount: 5_000, slaHours: 4 },
  { level: 2, roleName: 'manager', minAmount: 5_000, maxAmount: 20_000, slaHours: 8 },
  { level: 3, roleName: 'manager', minAmount: 20_000, maxAmount: 100_000, slaHours: 24 },
  { level: 4, roleName: 'admin', minAmount: 100_000, maxAmount: Infinity, slaHours: 48 },
];
```

### 5.3 Escalation Rule

**If SLA expires without approval:**
1. Escalate to the next higher level
2. Send notification to both the original approver and escalation target
3. Log escalation in audit trail

---

## 6. Auto-Numbering System

### 6.1 Format

All document numbers follow the pattern:

```
PREFIX-YYYY-NNNN
```

Where:
- `PREFIX` = Document type abbreviation (see table below)
- `YYYY` = 4-digit year (e.g., 2026)
- `NNNN` = 4-digit zero-padded sequential number (0001 to 9999)

### 6.2 Document Types and Prefixes

| Document Type | Prefix | Table Name | Number Field | Example |
|---------------|--------|------------|--------------|---------|
| MRRV | MRRV | mrrv | mrrv_number | MRRV-2026-0001 |
| MIRV | MIRV | mirv | mirv_number | MIRV-2026-0001 |
| MRV | MRV | mrv | mrv_number | MRV-2026-0001 |
| Gate Pass | GP | gate_passes | gate_pass_number | GP-2026-0001 |
| Stock Transfer | ST | stock_transfers | transfer_number | ST-2026-0001 |
| OSD Report | OSD | osd_reports | osd_number | OSD-2026-0001 |
| RFIM | RFIM | rfim | rfim_number | RFIM-2026-0001 |
| Job Order | JO | job_orders | jo_number | JO-2026-0001 |
| MRF | MRF | mrf | mrf_number | MRF-2026-0001 |
| Shipment | SH | shipments | shipment_number | SH-2026-0001 |
| Lot | LOT | inventory_lots | lot_number | LOT-2026-0001 |
| Leftover | LO | leftover_materials | leftover_number | LO-2026-0001 |

### 6.3 Counter Table

The `document_counters` table stores the current state:

```sql
CREATE TABLE document_counters (
  id UUID PRIMARY KEY,
  document_type VARCHAR(30) NOT NULL,
  prefix VARCHAR(10) NOT NULL,
  year INTEGER NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  UNIQUE(document_type, year)
);
```

### 6.4 Number Generation Logic

```
function generateDocumentNumber(document_type):
  current_year = YEAR(NOW())

  // 1. Get or create counter
  counter = SELECT * FROM document_counters
            WHERE document_type = {document_type}
            AND year = {current_year}
            FOR UPDATE  -- Lock the row to prevent race conditions

  if counter is NULL:
    // Annual reset - create new counter
    INSERT INTO document_counters (document_type, prefix, year, last_number)
    VALUES ({document_type}, {prefix}, {current_year}, 0)
    counter.last_number = 0

  // 2. Increment
  new_number = counter.last_number + 1

  // 3. Update counter
  UPDATE document_counters
  SET last_number = {new_number}
  WHERE id = counter.id

  // 4. Format number
  padded = LPAD(new_number, 4, '0')
  return "{prefix}-{current_year}-{padded}"
```

### 6.5 Rules

| Rule | Description |
|------|-------------|
| **Annual Reset** | On January 1st, numbers reset to 0001. When a new year is detected, a new counter row is created with last_number = 0 |
| **No Reuse** | Deleted records do NOT free up their number. Gaps are acceptable and standard practice |
| **Concurrency Safety** | Use `SELECT ... FOR UPDATE` (PostgreSQL row lock) to prevent duplicate numbers under concurrent access |
| **Immutability** | Once assigned, a document number NEVER changes |

---

## 7. Inventory Sync Logic

### 7.1 Inventory Impact Matrix

| Event | Trigger Condition | qty_on_hand | qty_reserved | Net Effect |
|-------|-------------------|-------------|--------------|------------|
| **MRRV Stored** | mrrv.status -> 'received' or 'stored' | **+qty_received** | No change | Stock increases |
| **MIRV Approved** | mirv.status -> 'approved' | No change | **+qty_approved** | Available decreases (reservation) |
| **MIRV Issued** | mirv.status -> 'issued' | **-qty_issued** | **-qty_approved** | Stock decreases, reservation released |
| **MIRV Cancelled** | mirv.status -> 'cancelled' | No change | **-qty_approved** | Reservation released |
| **MIRV Rejected** | mirv.status -> 'rejected' | No change | **-qty_approved** | Reservation released |
| **MRV Received (good)** | mrv.status -> 'received' AND condition IN ('good','used') | **+qty_returned** | No change | Stock increases |
| **MRV Received (damaged)** | mrv.status -> 'received' AND condition = 'damaged' | **No change** | No change | No stock impact |
| **Stock Transfer Shipped** | stock_transfer.status -> 'shipped' | **-qty** (source warehouse) | No change | Source decreases |
| **Stock Transfer Received** | stock_transfer.status -> 'received' | **+qty** (dest warehouse) | No change | Destination increases |

### 7.2 Critical Constraint: No Negative Inventory

**Database constraint:**
```sql
ALTER TABLE inventory_levels
ADD CONSTRAINT chk_no_negative_onhand
CHECK (qty_on_hand >= 0);

ALTER TABLE inventory_levels
ADD CONSTRAINT chk_no_negative_reserved
CHECK (qty_reserved >= 0);
```

**Application-level enforcement:**
Before any deduction operation, validate:
```
IF (current_qty_on_hand - deduction_amount) < 0:
  BLOCK the operation
  LOG the attempt to audit_log
  RETURN error: "Operation would cause negative inventory"
```

### 7.3 Inventory Sync Pseudocode

```
// Automation: MRRV -> Add Inventory
function onMRRVApproved(mrrv_id):
  mrrv = getMRRV(mrrv_id)
  FOR EACH line IN mrrv.lines:
    inventory = getOrCreateInventory(line.item_id, mrrv.warehouse_id)
    inventory.qty_on_hand += line.qty_received
    inventory.last_movement_date = NOW()
    inventory.save()

    // Check if this resolved a low-stock alert
    IF inventory.qty_on_hand > inventory.min_level:
      inventory.alert_sent = false

// Automation: MIRV -> Subtract Inventory
function onMIRVIssued(mirv_id):
  mirv = getMIRV(mirv_id)
  // Pre-validation: check ALL lines before ANY deduction
  errors = []
  FOR EACH line IN mirv.lines:
    inventory = getInventory(line.item_id, mirv.warehouse_id)
    IF line.qty_issued > inventory.qty_on_hand:
      errors.push("{item_name}: Requested {qty_issued}, Available {qty_on_hand}")

  IF errors.length > 0:
    THROW "Insufficient inventory: " + errors.join("; ")

  // All validations passed - proceed
  FOR EACH line IN mirv.lines:
    inventory = getInventory(line.item_id, mirv.warehouse_id)
    inventory.qty_on_hand -= line.qty_issued
    IF mirv.reservation_status == 'reserved':
      inventory.qty_reserved -= line.qty_approved
      inventory.qty_reserved = MAX(0, inventory.qty_reserved) // Safety floor
    inventory.last_movement_date = NOW()
    inventory.save()

    // Check low stock
    IF inventory.qty_on_hand <= inventory.min_level AND NOT inventory.alert_sent:
      sendAlert("Low Stock", item, warehouse)
      inventory.alert_sent = true
```

---

## 8. FIFO Lot Tracking

### 8.1 Compliance Basis

**IFRS IAS 2 - Inventories:**
> "The cost of inventories shall be assigned by using either the first-in, first-out (FIFO) or weighted average cost formula."
> **LIFO is prohibited under IFRS.**

NIT uses **FIFO** (First In, First Out).

### 8.2 Lot Creation

A new lot is created whenever materials enter the warehouse:

```
ON MRRV approved (for each MRRV line):
  INSERT INTO inventory_lots {
    item_id:       mrrv_line.item_id,
    warehouse_id:  mrrv.warehouse_id,
    mrrv_line_id:  mrrv_line.id,
    receipt_date:  mrrv.receive_date,     // This is the FIFO sort key
    expiry_date:   mrrv_line.expiry_date, // If item is expirable
    initial_qty:   mrrv_line.qty_received,
    available_qty: mrrv_line.qty_received,
    reserved_qty:  0,
    unit_cost:     mrrv_line.unit_cost,
    supplier_id:   mrrv.supplier_id,
    bin_location:  mrrv_line.storage_location,
    status:        'active'
  }
```

### 8.3 FIFO Consumption

When materials are issued (MIRV), consume from the **oldest lots first** (sorted by `receipt_date ASC`):

```typescript
function consumeFIFO(item_id, warehouse_id, qty_needed, mirv_line_id):
  // Get active lots sorted by receipt date (oldest first)
  lots = SELECT * FROM inventory_lots
         WHERE item_id = {item_id}
         AND warehouse_id = {warehouse_id}
         AND status = 'active'
         AND available_qty > 0
         ORDER BY receipt_date ASC  // <-- FIFO order

  remaining = qty_needed
  total_cost = 0

  FOR EACH lot IN lots:
    IF remaining <= 0: BREAK

    consume_qty = MIN(remaining, lot.available_qty)
    lot.available_qty -= consume_qty

    IF lot.available_qty == 0:
      lot.status = 'depleted'

    lot.save()

    // Create audit trail record
    INSERT INTO lot_consumptions {
      lot_id:           lot.id,
      mirv_line_id:     mirv_line_id,
      quantity:          consume_qty,
      unit_cost:         lot.unit_cost,
      consumption_date:  NOW()
    }

    total_cost += consume_qty * lot.unit_cost
    remaining -= consume_qty

  IF remaining > 0:
    LOG_WARNING("FIFO shortage: {remaining} units unaccounted for {item_id}")

  RETURN total_cost  // This is the COGS (Cost of Goods Sold)
```

### 8.4 FIFO Example

| Step | Action | Lot A (Jan 1, 10 SAR/unit) | Lot B (Feb 1, 12 SAR/unit) | COGS |
|------|--------|---------------------------|---------------------------|------|
| 1 | Receive 100 units | 100 available | - | - |
| 2 | Receive 100 units | 100 available | 100 available | - |
| 3 | Issue 150 units | **0 available** (depleted) | **50 available** | (100 x 10) + (50 x 12) = **1,600 SAR** |

### 8.5 Lot Statuses

| Status | Description | Can Be Consumed? |
|--------|-------------|-----------------|
| `active` | Available for use | YES |
| `depleted` | Fully consumed (available_qty = 0) | NO |
| `expired` | Past expiry date | NO (requires disposal decision) |
| `blocked` | Quality hold or investigation | NO (requires manual unblock) |

---

## 9. SLA Rules

### 9.1 SLA Targets by Document Type

| Document Type | Approval SLA | Execution SLA | Target % |
|---------------|-------------|---------------|----------|
| MIRV (Material Issue) | 4-72 hours (varies by value) | 1 business day | >= 95% |
| MRRV (Material Receiving) | N/A | 24 hours | >= 95% |
| MRV (Material Return) | 4 hours | 1 business day | >= 95% |
| Stock Transfer | 1 business day | 2 business days | >= 95% |
| JO - Transport | 1 business day | 2 business days | >= 95% |
| JO - Equipment | 1 business day | 2-3 business days | >= 95% |
| JO - Rental Monthly | 1 business day | 3 business days | >= 95% |
| JO - Rental Daily | 1 business day | 2 business days | >= 95% |
| JO - Generator Rental | 1 business day | 3 business days | >= 95% |
| JO - Generator Maintenance | 1 business day | 2 business days | >= 95% |
| JO - Scrap | 1 business day | 3 business days | >= 95% |
| Customs Clearance | N/A | 5 business days | >= 90% |

### 9.2 Business Day Calculation

```
function calculateBusinessDays(start_date, end_date):
  business_days = 0
  current = start_date

  WHILE current <= end_date:
    day_of_week = getDayOfWeek(current)  // 0=Sun, 1=Mon, ..., 6=Sat

    // Saudi weekend = Friday (5) and Saturday (6)
    IF day_of_week NOT IN (5, 6):
      // Check if it's a public holiday
      IF NOT isPublicHoliday(current):
        business_days += 1

    current = current + 1 day

  RETURN business_days
```

**Public holidays to exclude:**
- Saudi National Day (September 23)
- Eid Al-Fitr (variable, ~3 days)
- Eid Al-Adha (variable, ~4 days)
- Founding Day (February 22)
- Any government-declared holidays

### 9.3 SLA Due Date Calculation

```
function calculateSLADueDate(start_time, sla_hours):
  // Working hours: 8:00 AM to 5:00 PM (9 hours/day), Saudi time
  WORKING_HOURS_START = 08:00
  WORKING_HOURS_END = 17:00
  HOURS_PER_DAY = 9

  remaining_hours = sla_hours
  current_time = start_time

  // If outside working hours, move to next working day start
  IF current_time.time > WORKING_HOURS_END:
    current_time = nextBusinessDay(current_time).setTime(WORKING_HOURS_START)
  ELSE IF current_time.time < WORKING_HOURS_START:
    current_time = current_time.setTime(WORKING_HOURS_START)

  WHILE remaining_hours > 0:
    // Skip weekends and holidays
    IF isWeekend(current_time) OR isPublicHoliday(current_time):
      current_time = nextBusinessDay(current_time).setTime(WORKING_HOURS_START)
      CONTINUE

    hours_left_today = WORKING_HOURS_END - current_time.time
    IF remaining_hours <= hours_left_today:
      current_time = current_time + remaining_hours
      remaining_hours = 0
    ELSE:
      remaining_hours -= hours_left_today
      current_time = nextBusinessDay(current_time).setTime(WORKING_HOURS_START)

  RETURN current_time
```

### 9.4 Stop-the-Clock Logic

Certain events pause the SLA timer:

**Valid stop-clock reasons:**
- `waiting_for_client` - Waiting for client response/decision
- `waiting_for_supplier` - Waiting for supplier action
- `waiting_for_approval` - Blocked on higher-level approval
- `external_dependency` - Government/customs/third-party delay
- `force_majeure` - Weather, strikes, etc.

```
function startStopClock(document_id, reason):
  sla = getSLATracking(document_id)
  sla.stop_clock_start = NOW()
  sla.stop_clock_reason = reason
  sla.save()

function endStopClock(document_id):
  sla = getSLATracking(document_id)
  stopped_duration = NOW() - sla.stop_clock_start
  sla.sla_due_date += stopped_duration  // Extend deadline by stopped time
  sla.stop_clock_end = NOW()
  sla.save()
```

### 9.5 SLA Status Progression

| Status | Condition | Color |
|--------|-----------|-------|
| `no_sla` | sla_due_date is NULL | Gray |
| `on_track` | sla_due_date - NOW() > 4 hours | Green |
| `at_risk` | 0 < sla_due_date - NOW() <= 4 hours | Yellow |
| `overdue` | NOW() > sla_due_date AND document not completed | Red |
| `met` | Document completed AND completion_date <= sla_due_date | Green (with checkmark) |
| `missed` | Document completed AND completion_date > sla_due_date | Red (with X) |

---

## 10. Status State Machines

### 10.1 MRRV Status Transitions

```
[draft] --submit--> [pending_qc] --qc_approve--> [qc_approved] --receive--> [received] --store--> [stored]
   |                    |
   +--cancel-->[cancelled]  +--qc_reject-->[rejected]
```

**Valid statuses:** `draft`, `pending_qc`, `qc_approved`, `received`, `stored`, `rejected`, `cancelled`

| From | To | Trigger | Who Can Do It | Auto-Actions |
|------|----|---------|---------------|--------------|
| draft | pending_qc | Submit for QC | Warehouse Staff | Create RFIM if rfim_required |
| pending_qc | qc_approved | QC passes inspection | QC Officer | - |
| pending_qc | rejected | QC fails inspection | QC Officer | Create OSD, notify supplier |
| qc_approved | received | Confirm receipt | Warehouse Staff | +inventory, create lots |
| received | stored | Confirm storage location | Warehouse Staff | Update bin locations |
| draft | cancelled | Cancel draft | Warehouse Staff, Admin | - |

### 10.2 MIRV Status Transitions

```
[draft] --submit--> [pending_approval] --approve--> [approved] --issue--> [issued] --complete--> [completed]
   |                      |                   |              |
   +--cancel-->[cancelled]  +--reject-->[rejected]  +--partial--> [partially_issued]
                                                                        |
                                                                   --issue--> [issued]
```

**Valid statuses:** `draft`, `pending_approval`, `approved`, `partially_issued`, `issued`, `completed`, `rejected`, `cancelled`

| From | To | Trigger | Who Can Do It | Auto-Actions |
|------|----|---------|---------------|--------------|
| draft | pending_approval | Submit | Site Engineer, Requester | Calculate approval level |
| pending_approval | approved | Approve | Approver (per threshold) | Reserve inventory |
| pending_approval | rejected | Reject | Approver | Release reservation (if any), notify requester |
| approved | partially_issued | Partial issue | Warehouse Staff | Partial deduction, partial FIFO consumption |
| approved | issued | Full issue | Warehouse Staff | Full deduction, FIFO consumption, create gate pass |
| partially_issued | issued | Issue remaining | Warehouse Staff | Remaining deduction |
| issued | completed | Confirm pickup/delivery | Warehouse Staff | - |
| draft | cancelled | Cancel | Requester, Admin | - |
| approved | cancelled | Cancel after approval | Requester + Admin approval | Release reservation |

### 10.3 MRV Status Transitions

```
[draft] --submit--> [pending] --receive--> [received] --complete--> [completed]
   |                    |
   +--cancel-->[cancelled]  +--reject-->[rejected]
```

**Valid statuses:** `draft`, `pending`, `received`, `completed`, `rejected`, `cancelled`

| From | To | Trigger | Who Can Do It | Auto-Actions |
|------|----|---------|---------------|--------------|
| draft | pending | Submit | Site Engineer | Notify warehouse |
| pending | received | Accept return | Warehouse Staff | +inventory (good condition only) |
| pending | rejected | Reject return | Warehouse Staff | Notify requester with reason |
| received | completed | Confirm storage | Warehouse Staff | Update lot records |

### 10.4 Job Order Status Transitions

```
[draft] --submit--> [pending_approval] --approve--> [approved] --assign--> [assigned] --start--> [in_progress] --complete--> [completed] --invoice--> [invoiced]
   |                      |                   |                                  |
   +--cancel-->[cancelled]  +--reject-->[rejected]                        --hold--> [on_hold]
                                      |                                              |
                                      +--quote--> [quoted] --approve_quote--> [approved]  --resume--> [in_progress]
```

**Valid statuses:** `draft`, `pending_approval`, `quoted`, `approved`, `assigned`, `in_progress`, `on_hold`, `completed`, `invoiced`, `rejected`, `cancelled`

| From | To | Trigger | Who Can Do It | Auto-Actions |
|------|----|---------|---------------|--------------|
| draft | pending_approval | Submit | Site Engineer, Coordinator | Calculate approval level, set SLA |
| pending_approval | quoted | Supplier provides quote | Logistics Coordinator | Notify requester |
| pending_approval | approved | Direct approval (no quote needed) | Approver (per threshold) | - |
| pending_approval | rejected | Reject | Approver | Notify requester |
| quoted | approved | Approve quote | Approver | Record quote_amount |
| approved | assigned | Assign to supplier/driver | Logistics Coordinator | Notify supplier |
| assigned | in_progress | Work begins | Logistics Coordinator, Supplier | Start execution SLA |
| in_progress | on_hold | Pause work | Logistics Coordinator | **Start stop-clock** |
| on_hold | in_progress | Resume work | Logistics Coordinator | **End stop-clock** |
| in_progress | completed | Work finished | Logistics Coordinator | Stop SLA timer |
| completed | invoiced | Invoice received and processed | Finance | Create jo_payments record |
| Any non-terminal | cancelled | Cancel | Admin, Logistics Manager | Release any commitments |

### 10.5 Gate Pass Status Transitions

```
[draft] --submit--> [pending] --approve--> [approved] --release--> [released] --return--> [returned]
   |                    |                                  |
   +--cancel-->[cancelled]                         [expired] (auto)
```

**Valid statuses:** `draft`, `pending`, `approved`, `released`, `returned`, `expired`, `cancelled`

| From | To | Trigger | Who Can Do It | Auto-Actions |
|------|----|---------|---------------|--------------|
| draft | pending | Submit | Warehouse Staff | - |
| pending | approved | Approve | Warehouse Supervisor | - |
| approved | released | Vehicle exits gate | Security | Record exit_time |
| released | returned | Vehicle returns | Security | Record return_time |
| approved/released | expired | valid_until < NOW() | **System (scheduled)** | Auto-expire |
| draft | cancelled | Cancel | Warehouse Staff | - |

### 10.6 Stock Transfer Status Transitions

```
[draft] --submit--> [pending] --approve--> [approved] --ship--> [shipped] --receive--> [received] --complete--> [completed]
   |                    |
   +--cancel-->[cancelled]  +--reject-->[rejected]
```

**Valid statuses:** `draft`, `pending`, `approved`, `shipped`, `received`, `completed`, `cancelled`, `rejected`

### 10.7 OSD Status Transitions

```
[draft] --review--> [under_review] --send_claim--> [claim_sent] --wait--> [awaiting_response] --negotiate--> [negotiating] --resolve--> [resolved]
   |                      |                                                                                      |
   +--close-->[closed]   +--close-->[closed]                                                          +--close-->[closed]
```

**Valid statuses:** `draft`, `under_review`, `claim_sent`, `awaiting_response`, `negotiating`, `resolved`, `closed`

### 10.8 MRF Status Transitions

```
[draft] --submit--> [submitted] --review--> [under_review] --approve--> [approved] --check--> [checking_stock]
                                                    |                                           |
                                            +--reject-->[rejected]              +--stock_available--> [from_stock]
                                                                                |
                                                                        +--needs_purchase--> [needs_purchase]
                                                                                |
                                                                        +--fulfill--> [partially_fulfilled] --fulfill--> [fulfilled]
```

**Valid statuses:** `draft`, `submitted`, `under_review`, `approved`, `checking_stock`, `from_stock`, `needs_purchase`, `partially_fulfilled`, `fulfilled`, `rejected`, `cancelled`

### 10.9 Shipment Status Transitions

```
[draft] --po_issued--> [po_issued] --production--> [in_production] --ready--> [ready_to_ship] --transit--> [in_transit]
                                                                                                                |
                                                                                                        --port--> [at_port]
                                                                                                                |
                                                                                                    --customs--> [customs_clearing]
                                                                                                                |
                                                                                                    --cleared--> [cleared]
                                                                                                                |
                                                                                                    --delivery--> [in_delivery]
                                                                                                                |
                                                                                                    --delivered--> [delivered]
```

**Valid statuses:** `draft`, `po_issued`, `in_production`, `ready_to_ship`, `in_transit`, `at_port`, `customs_clearing`, `cleared`, `in_delivery`, `delivered`, `cancelled`

---

## 11. Material Shifting Rules

**IMSF = Internal Materials Shifting Form**

### 11.1 What is IMSF?

IMSF handles the transfer of surplus materials from Project A to Project B. Materials must flow through the warehouse hub (they are never shipped directly project-to-project).

### 11.2 IMSF Flow

```
Project A (surplus)  -->  Warehouse (hub)  -->  Project B (needs)
     |                        |                       |
  MRV created           Receives + stores        MIRV created
  (return to WH)        (inventory updates)      (issue to project)
```

### 11.3 IMSF Business Rules

| Rule ID | Rule | Details |
|---------|------|---------|
| IMSF-001 | **Transfer type:** `project_to_project` in stock_transfers table | Must have both `from_project_id` and `to_project_id` populated |
| IMSF-002 | **Auto-create MRV + MIRV on approval** | When stock_transfer.status changes to 'approved': (1) Create MRV for Project A -> Warehouse, (2) Create MIRV for Warehouse -> Project B |
| IMSF-003 | **MRV auto-populated** | MRV.project = from_project, MRV.to_warehouse = transfer warehouse, MRV.return_type = 'return_to_warehouse', MRV.status = 'draft' |
| IMSF-004 | **MIRV auto-populated** | MIRV.project = to_project, MIRV.warehouse = transfer warehouse, MIRV.status = 'draft', MIRV lines auto-approved (qty_approved = qty_requested) |
| IMSF-005 | **Inventory flow** | Step 1: MRV received -> +inventory at warehouse. Step 2: MIRV issued -> -inventory at warehouse |
| IMSF-006 | **3 signatures required** | (1) Sender (Project A engineer), (2) Warehouse staff, (3) Receiver (Project B engineer) |
| IMSF-007 | **Transport JO** | If projects are at different locations, auto-suggest creating a Transport JO |
| IMSF-008 | **Completion** | IMSF is complete only when: MRV received + MIRV issued + all 3 signatures collected + Gate pass returned |

---

## 12. MRF Rules

**MRF = Material Requisition Form**

### 12.1 Purpose

MRF is the pre-MIRV request. Projects formally request materials. The system checks stock and routes accordingly.

### 12.2 MRF Business Rules

| Rule ID | Rule | Details |
|---------|------|---------|
| MRF-001 | **Stock check on approval** | When MRF.status changes to 'approved', automatically check inventory for each line item |
| MRF-002 | **Auto-routing: from stock** | If `qty_available >= qty_requested`: set `source = 'from_stock'`, `qty_from_stock = qty_requested` |
| MRF-003 | **Auto-routing: purchase required** | If `qty_available = 0` AND item exists: set `source = 'purchase_required'`, `qty_from_purchase = qty_requested` |
| MRF-004 | **Auto-routing: partial** | If `0 < qty_available < qty_requested`: set `source = 'both'`, `qty_from_stock = qty_available`, `qty_from_purchase = qty_requested - qty_available` |
| MRF-005 | **Auto-routing: new item** | If `item_id IS NULL` (new item not in catalog): set `source = 'purchase_required'` |
| MRF-006 | **Auto-MIRV creation** | When all "from stock" items are available, auto-create MIRV with: project = MRF.project, lines from MRF lines where source IN ('from_stock', 'both'), qty_approved = qty_from_stock |
| MRF-007 | **MRF status update** | If all items from stock -> status = 'from_stock'. If some need purchase -> status = 'from_stock' (process available first). If all need purchase -> status = 'needs_purchase' |
| MRF-008 | **Purchase routing** | Items with `source = 'purchase_required'` generate a notification to Procurement team. Manual creation of Purchase Request in Oracle |
| MRF-009 | **Fulfillment tracking** | MRF.status = 'fulfilled' only when ALL lines have `qty_issued >= qty_requested` |
| MRF-010 | **Partial fulfillment** | MRF.status = 'partially_fulfilled' when some but not all lines are issued |

### 12.3 MRF Priority Rules

| Priority | Required Within | Color Code |
|----------|----------------|------------|
| Urgent | 24 hours | Red |
| High | 3 days | Orange |
| Medium | 1 week | Yellow |
| Low | 2 weeks | Green |

---

## 13. Reservation System

**Purpose:** Prevent multiple MIRVs from committing the same stock.

### 13.1 Available Quantity Formula

```
qty_available = qty_on_hand - qty_reserved
```

### 13.2 Reservation Lifecycle

```
Step 1: MIRV Created (Draft)
  -> No reservation
  -> qty_available is shown to user for each item

Step 2: MIRV Approved
  -> Reserve quantities
  -> FOR EACH mirv_line:
       inventory_levels.qty_reserved += mirv_line.qty_approved
  -> mirv.reservation_status = 'reserved'
  -> VALIDATION: If qty_approved > qty_available, BLOCK approval

Step 3a: MIRV Issued
  -> Release reservation AND deduct
  -> FOR EACH mirv_line:
       inventory_levels.qty_on_hand -= mirv_line.qty_issued
       inventory_levels.qty_reserved -= mirv_line.qty_approved
  -> mirv.reservation_status = 'released'

Step 3b: MIRV Cancelled/Rejected
  -> Release reservation only (no deduction)
  -> FOR EACH mirv_line:
       inventory_levels.qty_reserved -= mirv_line.qty_approved
  -> mirv.reservation_status = 'released'
```

### 13.3 Implementation (from inventory.service.ts)

**Reserve Stock (FIFO):**
```typescript
async function reserveStock(itemId, warehouseId, qty): Promise<boolean> {
  // 1. Check availability
  level = await getInventoryLevel(itemId, warehouseId)
  available = level.qtyOnHand - level.qtyReserved
  if (available < qty) return false

  // 2. Increment qtyReserved in InventoryLevel
  await updateInventoryLevel({ qtyReserved: { increment: qty } })

  // 3. Reserve from oldest lots first (FIFO by receiptDate)
  lots = await getLots({ orderBy: { receiptDate: 'asc' } })

  remaining = qty
  for (lot in lots) {
    lotAvailable = lot.availableQty - lot.reservedQty
    toReserve = min(remaining, lotAvailable)
    await updateLot({ reservedQty: { increment: toReserve } })
    remaining -= toReserve
  }

  return true
}
```

**Consume Reservation (FIFO):**
```typescript
async function consumeReservation(itemId, warehouseId, qty, mirvLineId) {
  // 1. Decrement both qtyOnHand AND qtyReserved
  await updateInventoryLevel({
    qtyOnHand: { decrement: qty },
    qtyReserved: { decrement: qty }
  })

  // 2. Consume from oldest lots (FIFO)
  lots = await getLots({ orderBy: { receiptDate: 'asc' } })

  remaining = qty
  totalCost = 0

  for (lot in lots) {
    toConsume = min(remaining, lot.availableQty)
    totalCost += toConsume * lot.unitCost

    await updateLot({
      availableQty: { decrement: toConsume },
      reservedQty: { decrement: toConsume },
      status: lot.availableQty === 0 ? 'depleted' : 'active'
    })

    // Create LotConsumption record
    await createLotConsumption({ lotId, mirvLineId, quantity: toConsume })

    remaining -= toConsume
  }

  return { totalCost }  // This is the COGS
}
```

---

## 14. Role-Based Access Control

### 14.1 System Roles

| Role | Code | Description |
|------|------|-------------|
| Admin | `admin` | Full access to all features including user management and system configuration |
| Manager | `manager` | Full access to all features except user management and destructive operations |
| Warehouse Supervisor | `warehouse_supervisor` | Full warehouse operations + approvals within threshold |
| Warehouse Staff | `warehouse_staff` | Create/edit warehouse documents; no high-level approvals |
| Logistics Coordinator | `logistics_coordinator` | Full JO management, shipment tracking; view-only for warehouse documents |
| Site Engineer | `site_engineer` | Create MRF, MIRV requests, JO requests; view own submissions only |
| QC Officer | `qc_officer` | RFIM management, OSD reports; view MRRVs with rfim_required = true |
| Freight Forwarder | `freight_forwarder` | Shipment updates (assigned shipments only); limited view |

### 14.2 Permission Matrix Summary

**Full matrix available in permissions.ts**

| Resource | Admin | Manager | WH Supervisor | WH Staff | Logistics Coord | Site Engineer | QC Officer | Freight Fwd |
|----------|-------|---------|---------------|----------|-----------------|---------------|------------|-------------|
| **MRRV** | CRUD+A+E | R+A+E | CRUD | CRU | - | - | R | - |
| **MIRV** | CRUD+A+E | R+A+E | RU+A | RU | CRU+A | CR | - | - |
| **MRV** | CRUD+A+E | R+A+E | CRU | CRU | CRU | CR | - | - |
| **JO** | CRUD+A+E | CR+A+E | - | - | CRUD+A | CR | - | - |
| **RFIM** | CRUD+A+E | R+A+E | - | - | - | - | CRUD+A | - |
| **OSD** | CRUD+E | R+E | - | - | - | - | CRU | - |
| **Gate Pass** | CRUD+E | R+E | CRU | CRU | CRU | - | - | - |
| **Stock Transfer** | CRUD+A+E | R+A+E | CR | CR | CRU | - | - | - |
| **Shipment** | CRUD+E | R+E | - | - | CRU | - | - | U (assigned) |
| **Inventory** | RU+E | R+E | RU | RU | R+E | R | R | - |
| **Reports** | R+E | R+E | R+E (WH) | - | R+E (Transport) | - | R+E (QC) | - |

**Legend:** C=Create, R=Read, U=Update, D=Delete, A=Approve, E=Export

### 14.3 Data Filtering Rules

| Role | Data Scope | Filter |
|------|------------|--------|
| admin | All data | No filter |
| manager | All data | No filter |
| warehouse_supervisor | Own warehouse | `warehouse_id = employee.assigned_warehouse_id` |
| warehouse_staff | Own warehouse | `warehouse_id = employee.assigned_warehouse_id` |
| logistics_coordinator | All logistics data | No filter on JO/Shipments |
| site_engineer | Own submissions | `requested_by_id = current_user.id` OR `project_id = current_user.assigned_project_id` |
| qc_officer | QC-related items | MRRVs where `rfim_required = true`, all RFIM records |
| freight_forwarder | Assigned shipments | `freight_forwarder_id = current_user.supplier_id` |

### 14.4 Approval Level by Role

```typescript
function getMaxApprovalLevel(role: UserRole): number {
  switch (role) {
    case 'admin': return 5;
    case 'manager': return 4;
    case 'logistics_coordinator': return 2;
    case 'warehouse_staff': return 1;
    case 'qc_officer': return 1;
    default: return 0;
  }
}
```

---

## 15. Notification Rules

### 15.1 Notification Triggers

| Event | Recipients | Priority | Channel |
|-------|------------|----------|---------|
| MIRV submitted for approval | Approver (per threshold) | Normal | In-app |
| MIRV approved | Requester + Warehouse Staff | Normal | In-app |
| MIRV rejected | Requester | High | In-app + Email |
| MIRV ready for pickup | Requester | Normal | In-app |
| MRRV created with damage | QC Officer | High | In-app + Email |
| RFIM completed (fail) | Warehouse Manager, Procurement | High | In-app + Email |
| OSD created | QC Team, Procurement | Normal | In-app |
| JO submitted for approval | Approver (per threshold) | Normal | In-app |
| JO approved | Requester, Logistics Coordinator | Normal | In-app |
| JO assigned to supplier | Supplier contact, Requester | Normal | In-app |
| JO completed | Requester, Finance | Normal | In-app |
| Gate pass expired (vehicle not returned) | Security, Warehouse Manager | **Urgent** | In-app + Email + SMS |
| Low stock alert | Warehouse Manager, Procurement | High | In-app + Email |
| SLA at risk (< 4 hours remaining) | Document owner, their manager | High | In-app + Email |
| SLA overdue | Document owner, their manager, Logistics Manager | **Urgent** | In-app + Email + SMS |
| Inventory lot expired | Warehouse Manager | High | In-app + Email |
| Negative inventory attempt blocked | Logistics Manager, Admin | **Urgent** | In-app + Email |

### 15.2 Notification Channels

| Channel | When Used |
|---------|-----------|
| **In-app notification** | Always (all events) |
| **Email** | High and Urgent priority events |
| **SMS** (future) | Urgent events only (SLA overdue, security alerts) |

### 15.3 Notification Data Structure

```json
{
  "recipient_id": "UUID of employee",
  "title": "Short title (max 200 chars)",
  "body": "Detailed message with context",
  "notification_type": "approval_required | status_change | alert | info",
  "reference_table": "mirv | job_orders | etc",
  "reference_id": "UUID of the related record",
  "is_read": false,
  "created_at": "timestamp"
}
```

---

## 16. General Rules

### 16.1 Date Validations

| Rule | Description |
|------|-------------|
| No future dates on receiving | `mrrv.receive_date <= NOW()` |
| No future dates on issue | `mirv.issued_date <= NOW()` |
| End date after start date | Always enforce `end_date > start_date` for any date range |
| Backdate limit | Transactions older than 7 days require admin approval |
| Weekend awareness | Warn users when scheduling for Saudi weekend (Fri/Sat) |

### 16.2 Quantity Validations

| Rule | Description |
|------|-------------|
| Positive quantities | All quantity fields must be > 0 |
| Integer check | For items marked `is_serialized = true`, quantities must be whole numbers |
| Decimal precision | Maximum 3 decimal places for quantities, 2 for currency |
| Issued <= Approved | `mirv_lines.qty_issued <= mirv_lines.qty_approved` |
| Approved <= Requested | `mirv_lines.qty_approved <= mirv_lines.qty_requested` |

### 16.3 Reference Integrity

| Rule | Description |
|------|-------------|
| Active references only | When creating a new document, linked projects/warehouses/employees/suppliers must have `status = 'active'` |
| No orphan lines | Document lines (mrrv_lines, mirv_lines, etc.) must always have a parent header |
| Soft delete | Records are marked as cancelled or use an `is_deleted` flag (not physically deleted) |
| Cascade awareness | Cancelling a parent document should update all child records' status |

### 16.4 Audit Trail Rules

| Rule | Description |
|------|-------------|
| Log all status changes | Every status transition is recorded in `audit_log` with old_values and new_values |
| Log all inventory changes | Every qty_on_hand or qty_reserved change is logged with the triggering document |
| Log approvals | All approval/rejection decisions logged with approver, timestamp, and comments |
| Immutable log | Audit log records cannot be edited or deleted (append-only) |
| IP tracking | Record the IP address of the user for each action |

### 16.5 Low Stock Alert Rules

```
function checkAndAlertLowStock(item_id, warehouse_id):
  inventory = getInventory(item_id, warehouse_id)

  IF inventory.qty_on_hand <= 0:
    level = "out_of_stock"
    color = "red"
  ELSE IF inventory.qty_on_hand <= inventory.min_level:
    level = "low_stock"
    color = "yellow"
  ELSE IF inventory.qty_on_hand <= inventory.reorder_point:
    level = "reorder"
    color = "orange"
  ELSE:
    level = "adequate"
    color = "green"

  IF level IN ("out_of_stock", "low_stock") AND NOT inventory.alert_sent:
    notify(["Warehouse Manager", "Procurement"], {
      title: "Low Stock Alert: {item_name} at {warehouse_name}",
      body: "Current stock: {qty_on_hand}. Minimum: {min_level}."
    })
    inventory.alert_sent = true
```

### 16.6 System-Wide Constants

| Constant | Value | Notes |
|----------|-------|-------|
| Pagination default | 25 items per page | For all list views |
| Search | Case-insensitive | All text search operations |
| Timestamps | UTC | All stored as UTC, displayed in Asia/Riyadh (UTC+3) |
| Deletion | Hard delete with audit log | Records are permanently deleted but logged in audit_log |
| File upload limit | 10 MB per file | Backend enforced via multer |
| PDF export | Client-side | jsPDF + jspdf-autotable with NIT branding |

---

## Appendix A: Glossary

| Abbreviation | English | Description |
|--------------|---------|-------------|
| MRRV | Material Receiving Report Voucher | Document for receiving materials into warehouse |
| MIRV | Material Issue Report Voucher | Document for issuing materials from warehouse to project |
| MRV | Material Return Voucher | Document for returning materials from project to warehouse |
| RFIM | Request for Inspection of Materials | Quality inspection request |
| OSD | Over/Short/Damage Report | Discrepancy report for receiving |
| JO | Job Order | Work order (7 types: transport, equipment, rentals, scrap, generator) |
| GP | Gate Pass | Vehicle entry/exit authorization |
| ST | Stock Transfer | Warehouse-to-warehouse or project-to-project material transfer |
| MRF | Material Requisition Form | Pre-MIRV material request |
| IMSF | Internal Materials Shifting Form | Project-to-project transfer via warehouse hub |
| FIFO | First In, First Out | Inventory costing method (IFRS IAS 2 compliant) |
| SLA | Service Level Agreement | Target completion times |
| COGS | Cost of Goods Sold | Calculated via FIFO lot consumption |
| SAR | Saudi Riyal | Currency |
| VAT | Value Added Tax | 15% in Saudi Arabia |
| KVA | Kilovolt-Ampere | Generator capacity unit |

---

## Appendix B: Rule Count Summary

| Section | Rule Count | Critical Rules |
|---------|------------|----------------|
| MRRV Validations | 13 rules | Over-delivery tolerance, auto-RFIM |
| MIRV Validations | 14 rules + 5-level approval | Negative inventory prevention, approval thresholds |
| MRV Validations | 5 rules | Condition-based inventory logic |
| JO Validations | 18 rules | Same-location check, weight limits, photo requirements |
| Gate Pass Validations | 5 rules | Auto-expiry, return tracking |
| Stock Transfer Validations | 5 rules | Same-warehouse prevention, stock check |
| Approval Workflows | 2 chains (9 levels total) | SAR thresholds, escalation |
| Auto-Numbering | 12 document types | PREFIX-YYYY-NNNN format, atomic increment |
| Inventory Sync | 8 trigger events | Reservation system, FIFO consumption |
| FIFO | 5 rules | Consumption order, lot statuses |
| SLA | 11 document-type targets | Stop-the-clock, business days |
| Status Machines | 9 document types | ~60 total transitions |
| IMSF | 8 rules | Auto MRV+MIRV, 3 signatures |
| MRF | 10 rules | Auto-routing, auto-MIRV |
| Reservation System | 3 lifecycle stages | Reserve on approval, consume on issue |
| **Total** | **~170 business rules** | |

---

*Document created: February 8, 2026*
*For: NIT Supply Chain System Development*
*Nesma Infrastructure & Technology - Saudi Arabia*
*All rights reserved*
