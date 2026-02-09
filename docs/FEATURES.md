# NIT Supply Chain System - Features Documentation

**Version:** 1.0
**Last Updated:** February 8, 2026
**Company:** Nesma Infrastructure & Technology (NIT) - Saudi Arabia

---

## Table of Contents

1. [Authentication & Session Management](#1-authentication--session-management)
2. [Role-Based Dashboards](#2-role-based-dashboards)
3. [Material Receiving (MRRV)](#3-material-receiving-mrrv)
4. [Material Issuing (MIRV)](#4-material-issuing-mirv)
5. [Material Return (MRV)](#5-material-return-mrv)
6. [Quality Inspection (RFIM)](#6-quality-inspection-rfim)
7. [Over/Short/Damage Reporting (OSD)](#7-overshortdamage-reporting-osd)
8. [Job Orders (7 Types)](#8-job-orders-7-types)
9. [Gate Passes](#9-gate-passes)
10. [Stock Transfers](#10-stock-transfers)
11. [Material Requisition Form (MRF)](#11-material-requisition-form-mrf)
12. [Shipments & Customs Clearance](#12-shipments--customs-clearance)
13. [Inventory Management](#13-inventory-management)
14. [SLA Dashboard](#14-sla-dashboard)
15. [Payments Dashboard](#15-payments-dashboard)
16. [Reports & PDF Export](#16-reports--pdf-export)
17. [Real-time Notifications](#17-real-time-notifications)

---

## 1. Authentication & Session Management

### Description
Secure JWT-based authentication system with persistent sessions, refresh tokens, and password recovery.

### Key Capabilities
- **JWT Access Tokens** (15 min expiry) + **Refresh Tokens** (7 days)
- **Session Persistence**: Auto-login on page refresh using stored tokens
- **Password Recovery**: 6-digit code flow (15 min expiry)
- **Role-based Redirects**: Auto-route users to their designated dashboard
- **Token Refresh**: Automatic silent token refresh before expiry
- **Multi-role Support**: Maps backend system roles to frontend UserRole enum

### User Interface
- **Login Page**: Email, password, "Forgot Password" link
- **Forgot Password Flow**: Email → 6-digit code → New Password
- **Auto-redirect**: On successful login, users land on their role's dashboard

### Edge Cases & Validations
- **Invalid Credentials**: "Invalid email or password" error
- **Account Deactivated**: "Account is deactivated" error
- **Expired Reset Code**: 15-minute window; code invalid after
- **Token Expiry**: Auto-refresh access token using refresh token; if both invalid, redirect to login
- **Concurrent Sessions**: JWT stateless; multiple devices supported
- **Role Mapping**:
  - `admin` → `UserRole.ADMIN`
  - `manager` → `UserRole.MANAGER`
  - `warehouse_supervisor`, `warehouse_staff` → `UserRole.WAREHOUSE`
  - `freight_forwarder` → `UserRole.TRANSPORT`
  - `logistics_coordinator` → `UserRole.LOGISTICS_COORDINATOR`
  - `site_engineer` → `UserRole.SITE_ENGINEER`
  - `qc_officer` → `UserRole.QC_OFFICER`
  - Default → `UserRole.ENGINEER`

**API Endpoints:**
- `POST /api/auth/login` — Returns `accessToken`, `refreshToken`, `user`
- `POST /api/auth/refresh` — Refresh access token
- `POST /api/auth/forgot-password` — Send 6-digit code via console log (dev mode)
- `POST /api/auth/reset-password` — Validate code + set new password
- `GET /api/auth/me` — Get current user profile
- `POST /api/auth/change-password` — Change password (requires current password)

---

## 2. Role-Based Dashboards

### Description
8 distinct role-specific dashboards, each tailored to the user's responsibilities and permissions.

### Key Capabilities
- **Admin Dashboard**: Full system overview with 6 section cards (Inventory, Receiving, Issuing, Quality, Logistics, Master Data), stats, charts, recent activity
- **Manager Dashboard**: Approvals queue, project overview, pending documents, SLA compliance
- **Warehouse Dashboard**: MRRV/MIRV/MRV queues, stock levels, low stock alerts, non-moving materials
- **Transport Dashboard**: Job orders kanban, fleet status, driver assignments
- **Engineer Dashboard**: Request forms (MIRV, MRF, JO), personal request history
- **Logistics Coordinator Dashboard**: Shipments, customs, job orders, gate passes, transport coordination
- **QC Officer Dashboard**: RFIM queue, OSD reports, inspection results, quality metrics
- **Site Engineer Dashboard**: Material requests (MIRV, MRF), project-specific inventory

### User Interface
- **Section Cards**: Click to navigate to detailed views (e.g., "Inventory" → `/admin/inventory`)
- **Stats Widgets**: KPIs (Pending Approvals, Active Projects, Total Items, Low Stock Alerts)
- **Charts**: Inventory Movement (bar chart), Job Orders by Type (pie chart)
- **Activity Log**: Real-time recent actions across the system
- **Filters**: Project, time range (7/30/90 days)

### Edge Cases & Validations
- **Role Switching**: Changing role in sidebar redirects to new role's base path
- **Permissions**: UI elements hidden based on role permissions (RBAC enforced)
- **Loading States**: Skeleton screens during data fetch
- **Error Handling**: Graceful fallback for API failures with retry
- **Empty States**: "No data available" placeholders when no records

---

## 3. Material Receiving (MRRV)

**Document Name:** Material Receiving Report Voucher
**Arabic:** سند استلام مواد
**Prefix:** `MRRV-YYYY-NNNN`

### Description
Records receipt of materials from suppliers, supports QC inspection, damage reporting, and automatic stock addition.

### Key Capabilities
- **Create MRRV**: Header (supplier, PO, warehouse, project, receive date) + line items (item, qty received, qty damaged, unit cost)
- **QC Workflow**: Draft → Submit for QC → QC Approved → Received → Stored
- **Auto-create RFIM**: If `rfimRequired` flag is set
- **Auto-create OSD**: If any line has `qtyDamaged > 0`
- **Inventory Update**: On "Store" action, adds stock (qtyReceived - qtyDamaged) via FIFO lot creation
- **Multi-line Support**: Unlimited line items per MRRV

### User Interface
- **List View**: Paginated table with filters (status, search), status badges
- **Create Form**: Header fields + dynamic line item table (add/remove rows)
- **Detail View**: Full MRRV with all lines, linked RFIM/OSD, approval history
- **Actions**: Submit for QC, Approve QC, Receive, Store

### Edge Cases & Validations
- **Draft Edits Only**: Once submitted, header locked (status ≠ draft)
- **QC Approval**: Only users with `warehouse_supervisor` or higher role
- **Store Validation**: Must be "Received" before storing
- **Negative Inventory**: Prevented by CHECK constraint at DB level
- **Line Item Validation**: `qtyReceived > 0`, `qtyDamaged <= qtyReceived`
- **PO Reference**: Optional; system works with or without PO
- **Storage Location**: Per-line field for shelf/bin location

**Status Flow:**
1. `draft` — Editable, not yet submitted
2. `pending_qc` — Submitted, awaiting QC inspection
3. `qc_approved` — QC passed, ready to receive
4. `received` — Materials physically received
5. `stored` — Stock added to inventory (final)
6. `rejected` — QC failed (terminal)

**API Endpoints:**
- `GET /api/mrrv` — List MRRVs (paginated, filterable)
- `POST /api/mrrv` — Create MRRV
- `PUT /api/mrrv/:id` — Update header (draft only)
- `POST /api/mrrv/:id/submit` — Submit for QC
- `POST /api/mrrv/:id/approve-qc` — QC approve
- `POST /api/mrrv/:id/receive` — Mark received
- `POST /api/mrrv/:id/store` — Store + add inventory

---

## 4. Material Issuing (MIRV)

**Document Name:** Material Issue Report Voucher
**Arabic:** سند صرف مواد
**Prefix:** `MIRV-YYYY-NNNN`

### Description
Issues materials to projects/sites with 5-level approval based on estimated value, includes stock reservation and FIFO deduction.

### Key Capabilities
- **5-Level Approval**:
  - Level 1: <10,000 SAR (warehouse_staff) — 4h SLA
  - Level 2: 10,000–50,000 SAR (logistics_coordinator) — 8h SLA
  - Level 3: 50,000–100,000 SAR (manager) — 24h SLA
  - Level 4: 100,000–500,000 SAR (manager) — 48h SLA
  - Level 5: >500,000 SAR (admin) — 72h SLA
- **Stock Reservation**: On approval, reserves qty from warehouse inventory
- **FIFO Deduction**: On issue, consumes oldest lots first
- **Auto-create Gate Pass**: Outbound gate pass generated on issue
- **Reservation Release**: On cancel/reject, releases reserved stock

### User Interface
- **List View**: Filterable by status, project, approval level
- **Create Form**: Project, warehouse, location of work, line items (item, qty requested)
- **Detail View**: Full MIRV with approval chain, reservation status, issued qty
- **Actions**: Submit, Approve, Reject, Issue, Cancel

### Edge Cases & Validations
- **Estimated Value Calculation**: Sum of (item.standardCost × qtyRequested) at creation
- **Approval Level**: Auto-determined by estimatedValue; cannot be manually set
- **Stock Availability**: System reserves on approval; if insufficient, reservation status = 'none'
- **Partial Issue**: Not supported in current version (all or nothing)
- **Cancellation**: Releases reservation; only allowed before "issued" status
- **FIFO Logic**: Deducts from lot.qtyAvailable in createdAt order
- **Unit Cost**: Calculated as weighted average during consumption

**Status Flow:**
1. `draft` — Editable
2. `pending_approval` — Awaiting approver
3. `approved` — Stock reserved, ready to issue
4. `partially_issued` — (Reserved for future enhancement)
5. `issued` — Stock deducted, gate pass created
6. `completed` — Closed
7. `rejected` — Approval denied
8. `cancelled` — User-cancelled

**Reservation States:**
- `none` — No reservation
- `reserved` — Stock reserved
- `released` — Reservation released (cancel/reject)

**API Endpoints:**
- `GET /api/mirv` — List MIRVs
- `POST /api/mirv` — Create MIRV
- `PUT /api/mirv/:id` — Update header (draft only)
- `POST /api/mirv/:id/submit` — Submit for approval
- `POST /api/mirv/:id/approve` — Approve (reserves stock)
- `POST /api/mirv/:id/issue` — Issue materials (deduct stock)
- `POST /api/mirv/:id/cancel` — Cancel + release reservation

---

## 5. Material Return (MRV)

**Document Name:** Material Return Voucher
**Arabic:** سند إرجاع مواد
**Prefix:** `MRV-YYYY-NNNN`

### Description
Returns materials from project sites back to warehouse, restocking inventory.

### Key Capabilities
- **Return Types**: Excess, damaged, unused, expired
- **Inventory Restoration**: Adds returned materials back to stock (new lot)
- **Condition Tracking**: Good, damaged, expired
- **Approval Workflow**: Simple pending → received → completed

### User Interface
- **List View**: Status filter, search by MRV number
- **Create Form**: Project, warehouse, return type, line items (item, qty returned, condition)
- **Detail View**: Full MRV with return reason, inspection notes
- **Actions**: Submit, Receive, Complete, Reject

### Edge Cases & Validations
- **Condition Check**: If "damaged", do not add to available stock (or add to separate damaged bin)
- **Lot Creation**: Each MRV creates a new lot (not merged with existing)
- **Cost Basis**: Uses original MIRV line's unit cost if linked; else standardCost
- **Return Limit**: No validation against original issue qty (trust-based)
- **Rejection**: Returns rejected items not restocked

**Status Flow:**
1. `draft` — Editable
2. `pending` — Submitted, awaiting warehouse receipt
3. `received` — Warehouse confirmed receipt
4. `completed` — Stock added, MRV closed
5. `rejected` — Not accepted (e.g., wrong items)

**API Endpoints:**
- `GET /api/mrv` — List MRVs
- `POST /api/mrv` — Create MRV
- `PUT /api/mrv/:id` — Update header (draft only)
- `POST /api/mrv/:id/submit` — Submit for receipt
- `POST /api/mrv/:id/receive` — Mark received
- `POST /api/mrv/:id/complete` — Complete + add stock
- `POST /api/mrv/:id/reject` — Reject return

---

## 6. Quality Inspection (RFIM)

**Document Name:** Request for Inspection of Materials
**Arabic:** طلب فحص مواد
**Prefix:** `RFIM-YYYY-NNNN`

### Description
Formal QC inspection request, typically auto-created from MRRV or manually for periodic audits.

### Key Capabilities
- **Auto-creation**: MRRV with `rfimRequired=true` auto-generates RFIM
- **Manual Creation**: QC officer can create standalone RFIM
- **Inspection Types**: Incoming, periodic, audit, pre-issue
- **Result Recording**: Pass/fail, defect notes, photos (attachmentUrl)
- **Link to MRRV**: Tracks which receiving document triggered inspection

### User Interface
- **List View**: QC Officer dashboard shows pending RFIMs
- **Detail View**: MRRV reference, item list, inspection checklist
- **Actions**: Start Inspection, Record Result, Complete

### Edge Cases & Validations
- **Auto-created RFIM**: Status = `pending` at creation
- **Inspector Assignment**: Any QC Officer can claim
- **Result Options**: "approved", "rejected", "conditional_approval"
- **Rejection Impact**: If RFIM rejected, linked MRRV status → `rejected`
- **Re-inspection**: Not supported (create new RFIM)

**Status Flow:**
1. `pending` — Awaiting inspector
2. `in_progress` — Inspector assigned, work started
3. `completed` — Result recorded

**API Endpoints:**
- `GET /api/rfim` — List RFIMs
- `POST /api/rfim` — Create RFIM
- `PUT /api/rfim/:id` — Update (pending only)
- `POST /api/rfim/:id/start` — Start inspection
- `POST /api/rfim/:id/complete` — Record result + complete

---

## 7. Over/Short/Damage Reporting (OSD)

**Document Name:** Over/Short/Damage Report
**Arabic:** تقرير نقص/تلف
**Prefix:** `OSD-YYYY-NNNN`

### Description
Documents discrepancies (damage, shortage, overage) on received materials; tracks claims and supplier responses.

### Key Capabilities
- **Auto-creation**: MRRV with `qtyDamaged > 0` auto-generates OSD
- **Manual Creation**: Warehouse staff can create standalone OSD
- **Report Types**: Damage, shortage, overage
- **Claim Tracking**: Status progression from draft → claim sent → resolved → closed
- **Supplier Communication**: Records claim amounts, supplier responses, negotiation notes
- **Photo Attachments**: Evidence of damage

### User Interface
- **List View**: Filterable by status, supplier, report type
- **Create Form**: MRRV reference (optional), supplier, report type, line items (item, qty invoice, qty received, qty damaged/short/over, damage type, claim amount)
- **Detail View**: Full OSD with photos, claim history, supplier responses
- **Actions**: Submit Claim, Update Status, Record Resolution, Close

### Edge Cases & Validations
- **Auto-created OSD**: One OSD per MRRV with all damaged lines
- **Claim Amount**: Sum of (unitCost × qtyDamaged) per line
- **Supplier Response**: Free-text field for supplier's reply
- **Resolution Options**: Replacement, credit note, no action
- **Closure**: Only after resolution recorded
- **Multiple Damages**: One OSD can have lines with different damage types (physical, water, expired, etc.)

**Status Flow:**
1. `draft` — Editable
2. `under_review` — Internal review by manager
3. `claim_sent` — Sent to supplier
4. `awaiting_response` — Waiting for supplier reply
5. `negotiating` — Back-and-forth on claim
6. `resolved` — Agreement reached
7. `closed` — Final, no further action

**API Endpoints:**
- `GET /api/osd` — List OSDs
- `POST /api/osd` — Create OSD
- `PUT /api/osd/:id` — Update header (draft only)
- `POST /api/osd/:id/send-claim` — Send to supplier
- `POST /api/osd/:id/resolve` — Record resolution
- `POST /api/osd/:id/close` — Close OSD

---

## 8. Job Orders (7 Types)

**Document Name:** Job Order
**Arabic:** أمر عمل
**Prefix:** `JO-YYYY-NNNN`

### Description
Unified job order system supporting 7 operational types with 4-level approval, SLA tracking, kanban board, and payment tracking.

### Key Capabilities
- **7 Types**:
  1. `transport` — Site-to-site material transport
  2. `equipment` — Equipment rental (excavators, cranes, etc.)
  3. `rental_monthly` — Monthly equipment lease
  4. `rental_daily` — Daily equipment lease
  5. `scrap` — Scrap removal
  6. `generator_rental` — Generator rental with shift tracking
  7. `generator_maintenance` — Generator repair/maintenance
- **4-Level Approval**:
  - Level 1: <5,000 SAR (logistics_coordinator) — 4h SLA
  - Level 2: 5,000–20,000 SAR (manager) — 8h SLA
  - Level 3: 20,000–100,000 SAR (manager) — 24h SLA
  - Level 4: >100,000 SAR (admin) — 48h SLA
- **Kanban Board**: Drag-and-drop job order cards across status columns (dnd-kit)
- **SLA Tracking**: Auto-calculated due date, stop-the-clock support for holds
- **Type-specific Details**: Transport (pickup/delivery, cargo), Rental (start/end dates, rates), Generator (shift times, capacity), Scrap (weight, destination), Equipment (multi-line with operator flag)
- **Payment Tracking**: Invoice receipt, VAT, grand total, payment status, Oracle voucher

### User Interface
- **Kanban View**: Columns for each status (draft, pending_approval, quoted, approved, assigned, in_progress, on_hold, completed, invoiced), drag cards to change status
- **List View**: Filterable by type, status, project, date range
- **Create Form**: Dynamic form based on JO type (e.g., Transport shows pickup/delivery fields)
- **Detail View**: Full JO with all subtables, approval chain, SLA clock, payments
- **Actions**: Submit, Approve, Reject, Assign Supplier, Start, Hold, Resume, Complete, Invoice, Cancel

### Edge Cases & Validations
- **Amount Calculation**: `totalAmount` set on creation; approval level based on this
- **SLA Clock**: Starts on submit; pauses on hold; resumes with extended due date
- **Drag-and-Drop**: Only allowed status transitions (e.g., can't drag from "draft" to "completed")
- **Type-specific Validation**:
  - Transport: `pickupLocation`, `deliveryLocation` required
  - Rental: `rentalStartDate`, `rentalEndDate` required; start < end
  - Generator: `capacityKva` or `generatorId` required
  - Scrap: `scrapWeightTons` > 0
  - Equipment: At least one line item required
- **Payment Creation**: Can add multiple payments per JO (e.g., advance, final)
- **Cancellation**: Cannot cancel if status = completed/invoiced/cancelled

**Status Flow:**
1. `draft` — Editable
2. `pending_approval` — Awaiting approver (SLA starts)
3. `quoted` — Quote received from supplier
4. `approved` — Approved, ready to assign
5. `assigned` — Supplier assigned
6. `in_progress` — Work started
7. `on_hold` — Paused (SLA clock stopped)
8. `completed` — Work finished (SLA evaluated)
9. `invoiced` — Payment processed
10. `rejected` — Approval denied
11. `cancelled` — User-cancelled

**SLA Stop-the-Clock:**
- **Hold**: `POST /api/job-orders/:id/hold` — Sets `stopClockStart`, reason
- **Resume**: `POST /api/job-orders/:id/resume` — Sets `stopClockEnd`, extends `slaDueDate` by paused duration

**API Endpoints:**
- `GET /api/job-orders` — List JOs (filterable by type, status, project)
- `POST /api/job-orders` — Create JO + type-specific details
- `PUT /api/job-orders/:id` — Update header (draft only)
- `POST /api/job-orders/:id/submit` — Submit for approval
- `POST /api/job-orders/:id/approve` — Approve
- `POST /api/job-orders/:id/reject` — Reject
- `POST /api/job-orders/:id/assign` — Assign supplier
- `POST /api/job-orders/:id/start` — Start work
- `POST /api/job-orders/:id/hold` — Put on hold
- `POST /api/job-orders/:id/resume` — Resume from hold
- `POST /api/job-orders/:id/complete` — Complete work
- `POST /api/job-orders/:id/invoice` — Mark invoiced + create payment
- `POST /api/job-orders/:id/cancel` — Cancel
- `POST /api/job-orders/:id/payments` — Add payment record
- `PUT /api/job-orders/:id/payments/:pid` — Update payment

---

## 9. Gate Passes

**Document Name:** Gate Pass
**Arabic:** تصريح دخول/خروج
**Prefix:** `GP-YYYY-NNNN`

### Description
Controls material entry/exit at warehouse gates; tracks vehicle, driver, linked documents (MIRV, MRV, Stock Transfer).

### Key Capabilities
- **Pass Types**: Inbound, outbound
- **Auto-creation**: MIRV issue auto-creates outbound gate pass
- **Vehicle Tracking**: Plate number, driver name, driver phone
- **Document Linking**: Links to MIRV, MRV, Stock Transfer, Shipment
- **Expiry Tracking**: Auto-expires after `validUntil` date
- **Return Confirmation**: For outbound passes, tracks when vehicle returns

### User Interface
- **List View**: Filterable by type, status, date
- **Create Form**: Type, linked document (dropdown), warehouse, vehicle, driver, destination/origin, valid until
- **Detail View**: Full pass with linked document details, gate officer notes
- **Actions**: Approve, Release, Return, Expire, Cancel

### Edge Cases & Validations
- **Approval**: Manager or warehouse supervisor approves before release
- **Release Time**: Recorded when vehicle exits gate
- **Return Time**: For outbound passes, when vehicle returns (optional)
- **Expiry**: Auto-expires at `validUntil` time; cannot release after expiry
- **Linking Validation**: Linked document must exist and be in valid status (e.g., MIRV = "issued")
- **Multiple Passes**: One MIRV can have multiple gate passes (e.g., multiple trips)

**Status Flow:**
1. `draft` — Editable
2. `pending` — Awaiting approval
3. `approved` — Ready for release
4. `released` — Vehicle exited/entered
5. `returned` — Vehicle returned (outbound only)
6. `expired` — Past valid date
7. `cancelled` — User-cancelled

**API Endpoints:**
- `GET /api/gate-passes` — List gate passes
- `POST /api/gate-passes` — Create gate pass
- `PUT /api/gate-passes/:id` — Update header (draft only)
- `POST /api/gate-passes/:id/approve` — Approve
- `POST /api/gate-passes/:id/release` — Release (exit/enter gate)
- `POST /api/gate-passes/:id/return` — Mark returned
- `POST /api/gate-passes/:id/cancel` — Cancel

---

## 10. Stock Transfers

**Document Name:** Stock Transfer
**Arabic:** نقل مخزون
**Prefix:** `ST-YYYY-NNNN`

### Description
Moves inventory between warehouses with approval, shipment tracking, and dual-ledger stock updates.

### Key Capabilities
- **Inter-warehouse Transfer**: From warehouse A to warehouse B
- **Approval Required**: Manager approves before shipment
- **Lot Tracking**: Transfers specific lots (FIFO deduction from source)
- **In-transit Status**: Shipped but not yet received
- **Dual Update**: Deduct from source on "shipped", add to destination on "received"

### User Interface
- **List View**: Filterable by status, source/destination warehouse
- **Create Form**: From warehouse, to warehouse, transfer date, line items (item, qty, lot selection)
- **Detail View**: Full transfer with lot details, approval, shipment tracking
- **Actions**: Submit, Approve, Ship, Receive, Complete, Cancel

### Edge Cases & Validations
- **Stock Availability**: Validates source warehouse has sufficient stock before approval
- **Lot Selection**: User can manually select lots or system auto-selects FIFO
- **Approval**: Cannot ship without approval
- **In-transit Deduction**: Stock deducted from source on "shipped" status
- **Receive Confirmation**: Destination warehouse confirms receipt; stock added
- **Discrepancy Handling**: If received qty ≠ shipped qty, create OSD (future enhancement)
- **Cancellation**: Only before "shipped" status

**Status Flow:**
1. `draft` — Editable
2. `pending` — Awaiting approval
3. `approved` — Approved, ready to ship
4. `shipped` — In transit (source stock deducted)
5. `received` — Arrived at destination (not yet put away)
6. `completed` — Destination stock added
7. `cancelled` — User-cancelled

**API Endpoints:**
- `GET /api/stock-transfers` — List transfers
- `POST /api/stock-transfers` — Create transfer
- `PUT /api/stock-transfers/:id` — Update header (draft only)
- `POST /api/stock-transfers/:id/submit` — Submit for approval
- `POST /api/stock-transfers/:id/approve` — Approve
- `POST /api/stock-transfers/:id/ship` — Ship (deduct source stock)
- `POST /api/stock-transfers/:id/receive` — Receive at destination
- `POST /api/stock-transfers/:id/complete` — Complete (add destination stock)
- `POST /api/stock-transfers/:id/cancel` — Cancel

---

## 11. Material Requisition Form (MRF)

**Document Name:** Material Requisition Form
**Arabic:** طلب توريد مواد
**Prefix:** `MRF-YYYY-NNNN`

### Description
Internal request for materials; system auto-routes to issue from stock (MIRV) or purchase (PO).

### Key Capabilities
- **Auto-routing**: On approval, system checks stock:
  - If available → creates MIRV (from_stock)
  - If not available → flags for purchase (needs_purchase)
- **Approval Workflow**: Similar to MIRV (5 levels based on amount)
- **Partial Fulfillment**: Tracks partially fulfilled MRFs
- **Link to MIRV/PO**: MRF can spawn multiple MIRVs or POs

### User Interface
- **List View**: Filterable by status, project, fulfillment status
- **Create Form**: Project, requester, line items (item, qty requested, justification)
- **Detail View**: Full MRF with approval chain, linked MIRVs/POs, fulfillment tracking
- **Actions**: Submit, Approve, Reject, Check Stock, Fulfill, Cancel

### Edge Cases & Validations
- **Stock Check**: Runs on approval; compares `qtyRequested` vs warehouse.qtyAvailable
- **Partial Fulfillment**: If only some items available, creates MIRV for available + flags rest for purchase
- **Purchase Trigger**: Sets `purchaseRequired=true`; logistics coordinator creates PO manually (or auto in future)
- **Fulfillment Tracking**: `qtyFulfilled` updated as MIRVs are issued
- **Multi-warehouse**: System checks all warehouses (future: priority order)

**Status Flow:**
1. `draft` — Editable
2. `submitted` — Awaiting approval
3. `under_review` — Reviewing by approver
4. `approved` — Approved, ready to check stock
5. `checking_stock` — System checking availability
6. `from_stock` — All available, MIRV created
7. `needs_purchase` — Some/all items need purchase
8. `partially_fulfilled` — Some items issued
9. `fulfilled` — All items issued
10. `rejected` — Approval denied
11. `cancelled` — User-cancelled

**API Endpoints:**
- `GET /api/mrf` — List MRFs
- `POST /api/mrf` — Create MRF
- `PUT /api/mrf/:id` — Update header (draft only)
- `POST /api/mrf/:id/submit` — Submit for approval
- `POST /api/mrf/:id/approve` — Approve
- `POST /api/mrf/:id/check-stock` — Check stock availability
- `POST /api/mrf/:id/fulfill` — Create MIRV(s) for available stock
- `POST /api/mrf/:id/cancel` — Cancel

---

## 12. Shipments & Customs Clearance

**Document Name:** Shipment / Customs Clearance
**Arabic:** شحنة / تخليص جمركي
**Prefix:** `SH-YYYY-NNNN`

### Description
Tracks international shipments from PO to delivery, with integrated customs clearance workflow (10 statuses).

### Key Capabilities
- **Shipment Lifecycle**: PO issued → in production → ready to ship → in transit → at port → customs clearing → cleared → in delivery → delivered
- **Customs Integration**: Embedded customs clearance workflow within shipment
- **Freight Forwarder Portal**: Dedicated role for freight agents (future enhancement)
- **Document Tracking**: BL number, AWB, commercial invoice, packing list, customs declaration
- **ETD/ETA Tracking**: Estimated vs actual dates
- **Port/Agent**: Tracks arrival port, customs agent, clearing fees

### User Interface
- **List View**: Filterable by status, supplier, port, agent
- **Create Form**: Supplier, description, PO number, ETD, ETA, port, agent, shipment mode (sea/air/land)
- **Detail View**: Full shipment timeline, customs documents, fees, clearance status
- **Actions**: Update Status, Upload Documents, Record Clearance, Mark Delivered

### Edge Cases & Validations
- **Status Progression**: Must follow order (cannot skip from "in_transit" to "delivered")
- **Customs Documents**: Required before "cleared" status
- **Clearance Fees**: Recorded in customs section
- **Delivery Confirmation**: Signature/photo required
- **Delay Tracking**: If actualArrival > ETA, flag as delayed

**Shipment Status Flow:**
1. `draft` — Initial entry
2. `po_issued` — PO sent to supplier
3. `in_production` — Supplier manufacturing
4. `ready_to_ship` — Packed, awaiting pickup
5. `in_transit` — En route to port/destination
6. `at_port` — Arrived at entry port
7. `customs_clearing` — Undergoing customs inspection
8. `cleared` — Customs released
9. `in_delivery` — Final mile delivery
10. `delivered` — Received at warehouse
11. `cancelled` — Shipment cancelled

**Customs Workflow (embedded in shipment):**
- **Documents**: Upload BL, invoice, packing list, certificate of origin
- **Duties & Fees**: Record customs duty, VAT, clearing agent fees
- **Inspection**: Track customs inspection result (pass/hold/reject)
- **Release**: Customs release date, release reference number

**API Endpoints:**
- `GET /api/shipments` — List shipments
- `POST /api/shipments` — Create shipment
- `PUT /api/shipments/:id` — Update shipment
- `POST /api/shipments/:id/update-status` — Update status
- `POST /api/shipments/:id/upload-document` — Upload customs document
- `POST /api/shipments/:id/record-clearance` — Record customs clearance
- `POST /api/shipments/:id/deliver` — Mark delivered

---

## 13. Inventory Management

### Description
Real-time inventory tracking with FIFO lot management, reservation system, non-moving material detection, and negative inventory prevention.

### Key Capabilities
- **Stock Levels**: Real-time `qtyAvailable`, `qtyReserved`, `qtyOnHold` per item per warehouse
- **FIFO Lot Tracking**: Each MRRV line creates a lot; consumption uses oldest first
- **Reservation System**:
  - MIRV approved → reserve stock (`qtyReserved` increments)
  - MIRV issued → release + deduct (`qtyReserved` decrements, `qtyAvailable` decrements)
  - MIRV cancelled → release only (`qtyReserved` decrements)
- **Non-moving Detection**: Items with no movement in last 90 days flagged
- **Shifting Materials**: Items with pending inter-warehouse transfers
- **Low Stock Alerts**: Auto-alerts when `qtyAvailable < reorderPoint`
- **Negative Inventory Prevention**: DB CHECK constraint + application validation

### User Interface
- **Stock Levels View**: Table showing item, warehouse, qty available, qty reserved, qty on hold, reorder point
- **Lot Details**: Drill-down to see all lots for an item (lot number, receive date, qty, unit cost, expiry)
- **Non-moving Materials Dashboard**: List of items with no movement, suggestions (return to supplier, scrap, transfer)
- **Shifting Materials Dashboard**: In-transit stock transfers, expected arrival dates
- **Inventory Dashboard**: Charts (stock by category, warehouse utilization, turnover rate)

### Edge Cases & Validations
- **Negative Stock**: Prevented by `CHECK (qtyAvailable >= 0)` at DB + app-level validation
- **Reservation Overflow**: Cannot reserve more than available; MIRV approval fails if insufficient
- **FIFO Edge Case**: If oldest lot expired, skip to next lot (or flag for disposal)
- **Multi-warehouse**: Each item tracked separately per warehouse
- **Unit Cost**: Weighted average on consumption (sum of lot costs / total qty)
- **Expiry Handling**: Auto-alerts 30 days before expiry; expired items flagged for return/disposal

**Inventory Transactions:**
- **Add Stock**: MRRV store, MRV complete, Stock Transfer receive
- **Deduct Stock**: MIRV issue, Stock Transfer ship
- **Reserve**: MIRV approve
- **Release**: MIRV cancel/reject

**API Endpoints:**
- `GET /api/inventory` — Stock levels (filterable by warehouse, item, category)
- `GET /api/inventory/lots` — Lot details for an item
- `GET /api/inventory/non-moving` — Non-moving materials report
- `GET /api/inventory/shifting` — In-transit transfers
- `GET /api/inventory/low-stock` — Low stock alerts
- `POST /api/inventory/adjust` — Manual stock adjustment (admin only)

---

## 14. SLA Dashboard

### Description
Tracks service level agreement compliance for all documents with SLA timers (MIRV, JO, MRF).

### Key Capabilities
- **SLA Timers**: Auto-calculated due date based on approval level SLA hours
- **Stop-the-Clock**: Job orders on hold pause SLA timer; resumed with extended due date
- **At-risk Indicators**: Documents approaching SLA deadline (within 2h) flagged red
- **Compliance Metrics**: % of documents meeting SLA, average response time
- **Historical Tracking**: Past SLA performance per approver, per document type

### User Interface
- **Dashboard**: Table showing document, type, status, SLA due date, time remaining, at-risk flag
- **Filters**: Document type, approver, date range, SLA status (met/missed/pending)
- **Charts**: SLA compliance trend (line chart), compliance by approver (bar chart)
- **Detail View**: Individual document SLA timeline (submitted, paused, resumed, completed)

### Edge Cases & Validations
- **SLA Calculation**: `slaDueDate = submittedDate + slaHours`
- **Stop-the-Clock**: `pausedDuration = stopClockEnd - stopClockStart`; new due date = old + paused
- **Met/Missed**: Evaluated on completion: `completed <= slaDueDate` → met
- **No SLA**: Some documents (e.g., draft) have no SLA; excluded from dashboard
- **Timezone**: All dates in UTC; displayed in user's local timezone

**API Endpoints:**
- `GET /api/dashboard/sla` — SLA compliance summary
- `GET /api/dashboard/sla/details` — Detailed SLA records (paginated)
- `GET /api/dashboard/sla/metrics` — Compliance metrics (%, avg time)

---

## 15. Payments Dashboard

### Description
Tracks payment lifecycle for job orders from invoice receipt to payment approval to actual payment.

### Key Capabilities
- **Payment Statuses**: Pending, approved, paid, on_hold, rejected
- **Invoice Tracking**: Invoice number, receipt date, cost excl VAT, VAT amount, grand total
- **Oracle Integration**: Voucher number field for ERP sync (future)
- **Attachment Support**: Upload invoice scans (PDF, image)
- **Multi-payment Support**: One JO can have multiple payments (advance, progress, final)

### User Interface
- **Dashboard**: Table showing JO number, supplier, invoice number, grand total, payment status, payment date
- **Filters**: Status, supplier, date range, project
- **Detail View**: Full payment with invoice details, approval history, payment proof
- **Actions**: Approve Payment, Record Payment, Upload Invoice, Reject

### Edge Cases & Validations
- **Approval Required**: Payment status = "pending" until manager approves
- **Payment Date**: Auto-set to current date on status change to "paid"
- **VAT Calculation**: Auto-calculated as 15% of costExclVat (Saudi Arabia standard rate)
- **Grand Total**: costExclVat + vatAmount
- **Attachment Validation**: Only PDF, JPG, PNG allowed; max 10MB
- **Oracle Sync**: Manual voucher entry for now; auto-sync future enhancement

**Payment Status Flow:**
1. `pending` — Invoice received, awaiting approval
2. `approved` — Manager approved, ready for finance to pay
3. `paid` — Payment completed
4. `on_hold` — Payment paused (e.g., dispute)
5. `rejected` — Invoice rejected (e.g., incorrect amount)

**API Endpoints:**
- `GET /api/dashboard/payments` — Payments list (filterable)
- `GET /api/job-orders/:id/payments` — Payments for a specific JO
- `POST /api/job-orders/:id/payments` — Create payment record
- `PUT /api/job-orders/:id/payments/:pid` — Update payment
- `POST /api/job-orders/:id/payments/:pid/approve` — Approve payment
- `POST /api/job-orders/:id/payments/:pid/pay` — Mark as paid
- `POST /api/job-orders/:id/payments/:pid/reject` — Reject payment

---

## 16. Reports & PDF Export

### Description
Client-side PDF generation for documents and reports using jsPDF with NIT branding.

### Key Capabilities
- **Document PDF**: Single-click export any document (MRRV, MIRV, MRV, JO, etc.) to PDF
- **Report PDF**: Export list views and dashboards to PDF
- **NIT Branding**: Header with NIT logo colors (nesma-primary blue), footer with timestamp
- **Line Items Table**: Auto-table generation for multi-line documents
- **Summary Fields**: Two-column layout for header fields
- **Custom Reports**: Configurable columns, filters, summary stats

### User Interface
- **Export Button**: On all detail views (top-right corner)
- **Bulk Export**: Select multiple records in list view, export as single PDF (future)
- **Report Builder**: Admin can configure custom reports (filters, columns, grouping)

### Edge Cases & Validations
- **Large Documents**: Line items paginated if >50 rows
- **Special Characters**: Arabic text support (right-to-left rendering future)
- **Image Embedding**: Attachments/photos not embedded (only URLs listed)
- **Print Preview**: No preview; direct download
- **File Naming**: `{docNumber}.pdf` or `{ReportTitle}_Report.pdf`

**PDF Templates:**
1. **Document PDF**: Title, doc number, status, date, fields (2-col), line items table, footer
2. **Report PDF**: Title, subtitle, filters, summary cards, data table, footer

**API Endpoints:**
- No backend API; PDF generated client-side using `utils/pdfExport.ts`
- Functions: `generateDocumentPdf(options)`, `generateReportPdf(options)`, `buildPdfOptions(resourceType, record)`

---

## 17. Real-time Notifications

### Description
Socket.IO-based push notifications with automatic React Query cache invalidation for instant UI updates.

### Key Capabilities
- **Push Notifications**: Server emits events on document status changes, approvals, assignments
- **Auto-invalidation**: `useRealtimeSync` hook listens for events and invalidates React Query caches
- **Event Types**:
  - `document:status` — Status changed (MRRV, MIRV, JO, etc.)
  - `entity:created/updated/deleted` — CRUD operations
  - `approval:requested/approved/rejected` — Approval actions
  - `notification:new` — User-specific notifications
  - `inventory:updated/reserved/released` — Stock changes
  - `task:assigned/completed` — Task events (future)
- **Role-based Routing**: Events sent to specific roles (e.g., `jo:created` → logistics_coordinator)
- **Document-specific**: Events sent to users watching a specific document

### User Interface
- **Notification Bell**: Header icon with unread count badge
- **Notification Panel**: Dropdown showing recent notifications (time, action, document link)
- **Toast Messages**: Real-time toasts for critical events (e.g., "MIRV-2026-0042 approved")
- **Auto-refresh**: No manual refresh needed; UI updates instantly on events

### Edge Cases & Validations
- **Connection Loss**: Socket auto-reconnects; missed events fetched on reconnect
- **Duplicate Events**: React Query deduplication prevents redundant API calls
- **Event Throttling**: Backend throttles high-frequency events (e.g., 1 update/sec max)
- **Notification Expiry**: Unread notifications expire after 30 days
- **Mark as Read**: User can dismiss notifications individually or "mark all read"
- **Offline Handling**: Queued events delivered on reconnect

**Socket.IO Events (Backend → Frontend):**
- `mrrv:created`, `mrrv:submitted`, `mrrv:qc_approved`, `mrrv:received`, `mrrv:stored`
- `mirv:created`, `mirv:approved`, `mirv:issued`, `mirv:cancelled`
- `jo:created`, `jo:approved`, `jo:assigned`, `jo:started`, `jo:completed`, `jo:invoiced`, `jo:on_hold`, `jo:resumed`, `jo:rejected`, `jo:cancelled`
- `document:status` (generic catch-all)
- `entity:created/updated/deleted`
- `approval:requested`, `approval:approved`, `approval:rejected`
- `inventory:updated`, `inventory:reserved`, `inventory:released`
- `task:assigned`, `task:completed`
- `notification:new`

**API Endpoints:**
- `GET /api/notifications` — Fetch user notifications (paginated)
- `PUT /api/notifications/:id/read` — Mark as read
- `PUT /api/notifications/read-all` — Mark all as read
- `DELETE /api/notifications/:id` — Delete notification

**Frontend Hook:**
- `useRealtimeSync()` — Mount once in `Layout.tsx`; auto-invalidates React Query caches on events

---

## Feature Summary Table

| Feature | Prefix | Status Count | Approval Levels | Auto-actions |
|---------|--------|--------------|-----------------|--------------|
| MRRV | MRRV-YYYY-NNNN | 6 | None | Auto-create RFIM, OSD; add stock |
| MIRV | MIRV-YYYY-NNNN | 8 | 5 | Reserve stock, create gate pass |
| MRV | MRV-YYYY-NNNN | 5 | None | Add stock (return) |
| RFIM | RFIM-YYYY-NNNN | 3 | None | Link to MRRV |
| OSD | OSD-YYYY-NNNN | 7 | None | Track claims |
| Job Orders | JO-YYYY-NNNN | 11 | 4 | SLA tracking, payments |
| Gate Pass | GP-YYYY-NNNN | 7 | None | Expiry tracking |
| Stock Transfer | ST-YYYY-NNNN | 7 | 1 | Dual-ledger stock update |
| MRF | MRF-YYYY-NNNN | 11 | 5 | Auto-route to MIRV or purchase |
| Shipment | SH-YYYY-NNNN | 11 | None | Customs workflow |

---

## System-wide Features

### Code-splitting
All page components lazy-loaded via `React.lazy()` for optimal bundle size. Largest chunk: 366 KB.

### Error Handling
Global error boundary catches unhandled errors; user-friendly fallback UI with retry.

### Responsive Design
Mobile-first Tailwind CSS; sidebar collapses on mobile; touch-friendly buttons.

### Dark Theme
Gradient background (`nesma-dark` to `#051020`), glass-morphism cards, glow effects.

### Arabic Support (Future)
RTL layout toggle; all document names have Arabic equivalents; UI translation pending.

### Offline Support (Future)
Service worker for offline access; queue actions for sync when online.

---

**End of FEATURES.md**
