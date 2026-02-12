# NIT Supply Chain System V2 — Comprehensive System Documentation

**Company:** Nesma Infrastructure & Technology (NIT) — Saudi Arabia
**Version:** 2.0
**Date:** February 2026
**Database:** PostgreSQL (Xano — Saudi Region)
**Stack:** React 19 + Vite 6 + Express 5 + Prisma 6 + TypeScript

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture & Technology Stack](#2-architecture--technology-stack)
   - 2.3 Key Architecture Patterns
   - 2.4 Authentication & Security (JWT, Redis Blacklist, Password Reset, Socket.IO Security)
3. [Database Schema — 103 Models](#3-database-schema--103-models)
4. [Core Documents](#4-core-documents) — GRN, MI, MRN, MR, QCI, DR, JO, WT, IMSF, Gate Pass, Surplus, Scrap, Rental Contract, Shipment
   - Each with: fields, state machine, validation rules, side effects, implementation detail
5. [FIFO Inventory System](#5-fifo-inventory-system)
6. [Multi-Level Approval System](#6-multi-level-approval-system)
7. [RBAC — Role-Based Access Control](#7-rbac--role-based-access-control)
8. [Integrated Business Flows](#8-integrated-business-flows)
9. [Advanced Features](#9-advanced-features)
   - 9.19 PWA & Push Notifications (VAPID architecture)
   - 9.20 Workflow Engine (rule conditions, actions)
   - 9.21 Real-Time Updates — Socket.IO (rooms, RBAC-scoped broadcasting)
   - 9.22 Email System (Resend + Handlebars, retry queue)
   - 9.23 Background Job Scheduler (8 jobs, SLA monitoring, distributed locks)
   - 9.24 Event Bus — Full Catalog (18 event types)
10. [Reports & Dashboards](#10-reports--dashboards)
11. [Appendices](#11-appendices)
    - 11.5 Event Catalog — Full Reference
    - 11.7 Triple-Layer Notification System
    - 11.8 API Security Model

---

## 1. System Overview

### 1.1 Purpose

NIT Supply Chain System V2 (NIT SCS V2) is an enterprise-grade supply chain management platform designed specifically for **construction and infrastructure projects** in Saudi Arabia. The system manages the complete lifecycle of materials — from procurement and international shipping, through warehouse receipt and quality inspection, to issuance on project sites, returns, surplus management, and scrap disposal.

### 1.2 Key Objectives

- **End-to-end material traceability** — every item is tracked from purchase order to project consumption
- **FIFO inventory costing** — lot-based first-in-first-out ensures accurate cost allocation
- **Multi-level approval workflows** — configurable approval chains with SLA enforcement and delegation support
- **Real-time visibility** — Socket.IO live updates and role-based dashboards
- **Bilingual support** — full English/Arabic with RTL layout
- **Offline capability** — PWA with offline queue for field use
- **Saudi regulatory compliance** — SABER, FASAH, SADAD integration for customs clearance

### 1.3 Document Types Managed

| Code | Full Name | V1 Internal Name | Purpose |
|------|-----------|-------------------|---------|
| GRN  | Goods Receipt Note | MRRV | Record material receipt at warehouse |
| MI   | Material Issue | MIRV | Issue materials from warehouse to project |
| MRN  | Material Return Note | MRV | Return materials from project to warehouse |
| MR   | Material Requisition | MRF | Request materials for a project |
| QCI  | Quality Control Inspection | RFIM | Inspect received materials for quality |
| DR   | Discrepancy Report | OSD | Report over/short/damage discrepancies |
| JO   | Job Order | JO | Request transport, equipment rental, scrap disposal |
| WT   | Warehouse Transfer | Stock Transfer | Transfer stock between warehouses/projects |
| IMSF | Internal Material Shifting Form | NEW in V2 | Inter-project material transfer |
| GP   | Gate Pass | Gate Pass | Authorize material entry/exit |
| SUR  | Surplus Item | NEW in V2 | Identify and dispose of surplus inventory |
| SCR  | Scrap Item | NEW in V2 | Manage scrap identification, bidding, and disposal |
| RC   | Rental Contract | NEW in V2 | Equipment rental agreement management |
| SH   | Shipment | Shipment | Track international/domestic cargo movement |

---

## 2. Architecture & Technology Stack

### 2.1 Monorepo Structure

```
NIT-SCS-V2/
├── packages/
│   ├── frontend/          # React 19 + Vite 6 + Tailwind CSS
│   │   ├── src/
│   │   │   ├── components/     # 77 reusable UI components
│   │   │   ├── pages/          # Feature-organized pages
│   │   │   ├── api/hooks/      # 71 React Query hooks
│   │   │   ├── contexts/       # Auth, Direction (RTL) contexts
│   │   │   ├── layouts/        # MainLayout.tsx
│   │   │   └── config/         # Navigation, column definitions
│   │   └── public/             # Static assets
│   ├── backend/           # Express 5 + Prisma 6
│   │   ├── src/
│   │   │   ├── routes/         # Factory-based REST routers
│   │   │   ├── services/       # 59 business logic services
│   │   │   ├── middleware/     # Auth, RBAC, rate-limiting
│   │   │   ├── socket/        # Socket.IO real-time events
│   │   │   └── events/        # Event bus for workflow engine
│   │   └── prisma/            # Schema + migrations
│   └── shared/            # Shared types, validators, constants
│       └── src/
│           ├── types/          # TypeScript interfaces & enums
│           ├── validators/     # Document validation rules
│           ├── utils/          # State machine, helpers
│           └── constants/      # Approval levels, status flows
└── pnpm-workspace.yaml
```

### 2.2 Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| **Frontend** | React | 19 | UI framework |
| | Vite | 6 | Build tool |
| | Tailwind CSS | 3.4 | Styling (custom Nesma dark theme) |
| | React Query | v5 | Server state management |
| | Zustand | latest | Client state management |
| | React Hook Form + Zod | latest | Form management + validation |
| | i18next | latest | Internationalization (EN/AR) |
| | Socket.IO Client | latest | Real-time updates |
| | Lucide React | latest | Icon library |
| **Backend** | Express | 5 | HTTP server |
| | Prisma | 6 | ORM / database toolkit |
| | Socket.IO | latest | Real-time WebSocket server |
| | Handlebars | latest | Email templates |
| | web-push | latest | Push notifications |
| **Database** | PostgreSQL | latest | Primary database |
| **Shared** | TypeScript | latest | Type safety across monorepo |

### 2.3 Key Architecture Patterns

1. **Factory Routers** — `createDocumentRouter` and `createCrudRouter` generate standardized REST endpoints with built-in RBAC, validation, pagination, sorting, and filtering.

2. **State Machine** — Every document type has a predefined set of valid status transitions enforced by `canTransition()` / `assertTransition()`. Invalid transitions are rejected with descriptive errors.

3. **Event Bus** — Document state changes emit events consumed by the Workflow Engine to trigger automated actions (notifications, auto-create linked documents, SLA tracking).

4. **Optimistic Locking** — `InventoryLevel` uses a `version` field. Updates atomically check-and-increment the version; on conflict, the operation retries up to 3 times.

5. **FIFO Lot Tracking** — Every stock receipt creates an `InventoryLot`. Consumptions always draw from the oldest active lot first (ordered by `receiptDate ASC`).

6. **Triple-Layer Notifications** — Every system event can trigger three delivery channels: in-app (DB persistence), Socket.IO (real-time WebSocket), and Web Push (VAPID-based push notifications).

7. **Distributed Scheduler** — Background jobs use Redis-based distributed locks to ensure single-execution across multiple backend instances, with sequential loops that prevent overlapping runs.

### 2.4 Authentication & Security

#### 2.4.1 JWT Token Architecture

The system uses a **dual-token strategy** (access + refresh) with server-side revocation:

```
Login Flow:
  Employee → POST /auth/login (email, password)
    ├── Password verified via bcrypt (comparePassword)
    ├── Account status checked (isActive = true)
    ├── JWT Access Token signed (15 min TTL)
    │   └── Payload: { userId, email, role, systemRole, assignedProjectId, assignedWarehouseId }
    │   └── Contains jti (unique token ID) for blacklisting
    ├── JWT Refresh Token signed (7 day TTL)
    │   └── Stored in RefreshToken DB table for server-side revocation
    └── Employee.lastLogin updated

Token Refresh:
  POST /auth/refresh (refreshToken)
    ├── Verify refresh token signature
    ├── Check DB: RefreshToken must exist + not expired
    ├── Verify Employee still active
    ├── Rotate: delete old refresh token, create new one
    └── Return new access + refresh tokens

Logout:
  POST /auth/logout (accessToken, refreshToken?)
    ├── Blacklist access token jti in Redis (15 min TTL)
    └── Delete refresh token from DB
```

#### 2.4.2 Token Blacklisting (Redis)

- Access tokens are short-lived (15 min) but can be explicitly blacklisted on logout
- Redis key: `bl:{jti}` with TTL matching token expiry
- `isTokenBlacklisted(jti)` checked in auth middleware on every request
- Falls back gracefully if Redis unavailable (single-instance mode)

#### 2.4.3 Password Reset

```
Forgot Password:
  POST /auth/forgot-password (email)
    ├── Rate limited: max 3 codes per email per hour (MAX_RESET_CODES_PER_HOUR)
    ├── 6-digit code generated (crypto.randomInt)
    ├── Stored in PasswordResetCode table (15 min expiry)
    ├── Email sent via sendTemplatedEmail('password_reset')
    └── Silent response (doesn't reveal if email exists)

Reset Password:
  POST /auth/reset-password (email, code, newPassword)
    ├── Verify code exists + not expired
    ├── Hash new password (bcrypt)
    ├── Delete all reset codes for email
    └── Revoke all refresh tokens (force re-login)
```

#### 2.4.4 Socket.IO Security

- JWT verified on WebSocket handshake (`socket.handshake.auth.token`)
- Periodic re-validation every 5 minutes on long-lived connections
- Rate limiting: max 30 events per 10-second window per socket
- Room-based access control: `join:document` checks RBAC `read` permission
- User and role rooms for scoped event delivery

---

## 3. Database Schema — 103 Models

The schema is organized into 16 sections covering all aspects of the supply chain.

### 3.1 Section Overview

| Section | Models | Purpose |
|---------|--------|---------|
| **1. Reference / Lookup** | 8 | Regions, Cities, Ports, UOM, Warehouse Types, Equipment Categories/Types, Approval Workflows |
| **2. Core Master** | 8 | Entities, Projects, Employees, Suppliers, Warehouses, Items, Generators, Equipment Fleet |
| **3. Material Management** | 15 | MRRV + Lines, RFIM, OSD + Lines, MIRV + Lines, MRV + Lines, Gate Pass + Items, MRF + Lines, Stock Transfer + Lines |
| **4. Job Orders** | 9 | JobOrder, Transport Detail, Rental Detail, Generator Detail, Scrap Detail, Equipment Lines, SLA Tracking, Approvals, Payments |
| **5. Inventory** | 4 | Inventory Levels, Inventory Lots, Lot Consumptions, Leftover Materials |
| **6. Shipping & Customs** | 3 | Shipments, Customs Tracking, Shipment Lines |
| **7. Finance** | 2 | Supplier Equipment Rates, Depreciation Entries |
| **8. System** | 4 | Document Counters, Audit Log, Notifications, Push Subscriptions |
| **9. Task Management** | 3 | Tasks, Task Comments, Password Reset Codes |
| **10. Workflow Engine** | 4 | Workflows, Workflow Rules, Execution Logs, System Settings |
| **11. Email** | 2 | Email Templates, Email Logs |
| **12. Dashboard Builder** | 3 | Dashboards, Dashboard Widgets, Saved Reports |
| **13. Token Management** | 1 | Refresh Tokens |
| **14. Document Comments** | 1 | Document Comments (polymorphic) |
| **15. Approval** | 2 | Approval Steps, Delegation Rules |
| **16. File Attachments** | 2 | Attachments (polymorphic), User Views |
| **V2 New Modules** | 18 | IMSF, Bin Cards, Rental Contracts, Generator Fuel/Maintenance, Surplus, Scrap, SSC Bids, Tools, Tool Issues, Warehouse Zones, Storekeeper Handover, Put-Away Rules |
| **Cycle Counting** | 2 | Cycle Counts, Cycle Count Lines |
| **ASN** | 2 | Advance Shipping Notices, ASN Lines |
| **Cross-Docking** | 1 | Cross Docks |
| **Inspection** | 2 | Inspection Checklists, Checklist Items |
| **Parallel Approval** | 2 | Parallel Approval Groups, Parallel Approval Responses |
| **Yard Management** | 3 | Dock Doors, Yard Appointments, Truck Visits |
| **IoT Sensors** | 3 | Sensors, Sensor Readings, Sensor Alerts |

### 3.2 Core Master Tables

#### Project
```
Fields: id, projectCode, projectName, projectNameAr, client, entityId, regionId,
        cityId, projectManagerId, status, startDate, endDate, budget, description
Status: active | on_hold | completed | cancelled
Relations: Entity, Region, City, ProjectManager (Employee)
           → MRRV, MIRV, MRV, GatePass, MRF, StockTransfer, JobOrder,
             Generator, Shipment, Task, IMSF, Surplus, Scrap
```

#### Employee
```
Fields: id, employeeIdNumber, fullName, fullNameAr, email, phone, department,
        role, systemRole, assignedProjectId, assignedWarehouseId, managerId,
        isActive, passwordHash, lastLogin
Departments: logistics | warehouse | transport | projects | quality | finance | admin
System Roles: admin | manager | warehouse_supervisor | warehouse_staff |
              logistics_coordinator | site_engineer | qc_officer |
              freight_forwarder | transport_supervisor | scrap_committee_member
```

#### Item (Material Master)
```
Fields: id, itemCode, itemDescription, itemDescriptionAr, category, subCategory,
        uomId, minStock, reorderPoint, standardCost, barcode, isSerialized,
        isExpirable, status, masterItemCode, mainCategory, commodity, templateName,
        abcClass, abcUpdatedAt
Categories: construction | electrical | mechanical | safety | tools | consumables | spare_parts
Main Categories: MECHANICAL | ELECTRICAL | CIVIL | INSTRUMENTATION | PMV
ABC Classes: A | B | C (auto-calculated by ABC Analysis)
```

#### Supplier
```
Fields: id, supplierCode, supplierName, supplierNameAr, types[], contactPerson,
        phone, email, address, cityId, crNumber, vatNumber, rating (1-5),
        status, paymentTerms
Status: active | inactive | blocked
Types: supplier | freight_forwarder | equipment_rental | scrap_buyer
```

#### Warehouse
```
Fields: id, warehouseCode, warehouseName, warehouseNameAr, warehouseTypeId,
        projectId, regionId, cityId, address, managerId, contactPhone,
        status, latitude, longitude
Status: active | inactive | closed
→ Zones: A (Civil), B (Mechanical/Scrap), C (Electrical), D (General),
         CONTAINER, OPEN_YARD, HAZARDOUS
```

---

## 4. Core Documents

### 4.1 GRN — Goods Receipt Note (V1: MRRV)

**Purpose:** Record the physical receipt of materials at a warehouse upon delivery from a supplier.

**Who Creates It:** Warehouse Staff or Warehouse Supervisor

**Fields:**
| Field | Description |
|-------|-------------|
| mrrvNumber | Auto-generated (format: GRN-YYYY-NNNN) |
| supplierId | Supplier delivering the goods |
| poNumber | Purchase order reference |
| warehouseId | Receiving warehouse |
| projectId | Target project (optional) |
| receivedById | Employee who physically received |
| receiveDate | Date/time of receipt |
| invoiceNumber | Supplier invoice reference |
| deliveryNote | Delivery note number |
| totalValue | Calculated total value of received items |
| rfimRequired | Whether QCI is needed |
| hasOsd | Whether discrepancies were found |
| qcInspectorId | QC officer assigned |
| receivingDock | Physical dock door used |
| binLocation | Initial storage location |

**Line Items (MrrvLine):**
| Field | Description |
|-------|-------------|
| itemId | Material from master catalog |
| qtyOrdered | Expected quantity |
| qtyReceived | Actually received quantity |
| qtyDamaged | Damaged quantity |
| uomId | Unit of measure |
| unitCost | Unit cost for lot costing |
| condition | good / damaged / mixed |
| storageLocation | Bin assignment |
| expiryDate | For expirable items |

**State Machine:**
```
draft → pending_qc → qc_approved → received → stored
                   → rejected → draft (resubmit)
```

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| GRN-V001 | Receipt date cannot be in the future |
| GRN-V002 | Warning: Receipt date > 7 days old requires supervisor approval |
| GRN-V003 | At least one line item is required |
| GRN-V004 | PO Number is required |
| GRN-V005 | Supplier is required |
| GRN-V006 | Warning: Over-delivery > 10% tolerance |
| GRN-AUTO1 | Warning: Damaged items auto-create QCI |

**Side Effects:**
1. When status → `stored`: **Inventory lots are created** for each line item via `addStockBatch()`. Each lot records supplier, unit cost, expiry date, and receipt date (used for FIFO ordering).
2. When condition = `Damaged`: **QCI document auto-created** linking to this GRN.
3. When qty discrepancy detected: **DR document auto-created** with over/short/damage details.
4. **Bin card transaction** created with type `receipt`.
5. **Audit log** entry for every status change.

---

### 4.2 MI — Material Issue (V1: MIRV)

**Purpose:** Authorize and track the issuance of materials from warehouse to a project site.

**Who Creates It:** Site Engineer or Logistics Coordinator

**Fields:**
| Field | Description |
|-------|-------------|
| mirvNumber | Auto-generated (format: MI-YYYY-NNNN) |
| projectId | Destination project |
| warehouseId | Source warehouse |
| locationOfWork | Specific work area |
| requestedById | Employee requesting materials |
| requestDate | Date of request |
| requiredDate | When materials are needed |
| priority | normal / urgent / emergency |
| estimatedValue | Total estimated value (determines approval level) |
| approvedById | Approver |
| issuedById | Warehouse staff who physically issued |
| reservationStatus | none / reserved / released |
| mrfId | Link to originating MR (if applicable) |
| slaDueDate | Approval SLA deadline |
| gatePassAutoCreated | Whether GP was auto-generated |

**Line Items (MirvLine):**
| Field | Description |
|-------|-------------|
| itemId | Requested material |
| qtyRequested | Quantity requested |
| qtyApproved | Quantity approved (may be less) |
| qtyIssued | Quantity actually issued |
| unitCost | FIFO-calculated unit cost |
| storageLocation | Where to pick from |

**State Machine:**
```
draft → pending_approval → approved → partially_issued → issued → completed
                        → rejected → draft
       approved → cancelled
```

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| MI-V001 | At least one line item is required |
| MI-V002 | Project is required |
| MI-V003 | Warehouse is required |
| MI-V004 | Error: Insufficient stock for item |
| MI-V005 | Error: Issued qty exceeds approved qty |

**Approval Levels (MI_APPROVAL_LEVELS):**

| Level | Label | Role | Amount Range (SAR) | SLA |
|-------|-------|------|-------------------|-----|
| 1 | Storekeeper | warehouse_staff | 0 – 10,000 | 4 hours |
| 2 | Logistics Manager | logistics_coordinator | 10,000 – 50,000 | 8 hours |
| 3 | Department Head | manager | 50,000 – 100,000 | 24 hours |
| 4 | Operations Director | manager | 100,000 – 500,000 | 48 hours |
| 5 | CEO | admin | 500,000+ | 72 hours |

**Side Effects:**
1. On `pending_approval`: **Stock is reserved** via `reserveStockBatch()` — FIFO from oldest lots.
2. On `approved`: Reservation confirmed, quantities locked.
3. On `issued`/`partially_issued`: **Stock consumed** via `consumeReservationBatch()` — FIFO deduction with cost calculation. `LotConsumption` records created.
4. On `rejected`: **Reservation released** via `releaseReservation()`.
5. On `issued`: **Gate Pass auto-created** if materials leave warehouse.
6. **Bin card transactions** created with type `issue`.
7. **Low-stock alerts** triggered if available qty drops below `minLevel` or `reorderPoint`.

**Implementation Detail — MI Lifecycle:**

```
create(headerData, lines, userId):
  Transaction:
    1. Generate auto-number: MI-YYYY-NNNN (via generateDocumentNumber('mirv'))
    2. Batch-fetch item standardCost for all line items (avoid N+1)
    3. Calculate estimatedValue = Σ(standardCost × qtyRequested)
    4. Create Mirv record (status: 'draft') with MirvLine records
    5. Return with project + warehouse includes

submit(id, userId, io?):
  1. Load MI, validate transition: draft → pending_approval
  2. Call submitForApproval() — calculates required approval level from estimatedValue
  3. ApprovalStep records created, first approver notified via Socket.IO
  4. SLA deadline set based on approval level configuration

approve(id, 'approve', userId, comments?, io?):
  1. Load MI with lines, verify status = 'pending_approval'
  2. Call processApproval() — marks step as approved, checks for next level
  3. ★ FIFO RESERVATION: reserveStockBatch() for all line items
     - Each item reserved from oldest lots first (receiptDate ASC)
     - InventoryLevel.qtyReserved incremented (optimistic lock)
     - InventoryLot.reservedQty incremented per lot
  4. Update all lines: qtyApproved = qtyRequested
  5. Set reservationStatus = 'reserved' (or 'none' if any item failed)

signQc(id, qcUserId):
  V5 Requirement — QC counter-signature required before issuing
  1. Verify MI status = 'approved'
  2. Record qcSignatureId on MI record

issue(id, userId):
  1. Load MI with lines, verify status = 'approved' or 'partially_issued'
  2. Verify QC counter-signature present (V5 requirement)
  3. ★ FIFO CONSUMPTION: consumeReservationBatch() for all approved lines
     - Deducts from oldest lots first (FIFO)
     - Returns { totalCost, lineCosts } — FIFO-weighted average cost per line
     - Creates LotConsumption audit records
     - Sets depleted lots to status = 'depleted'
  4. Update each MirvLine: qtyIssued, unitCost (= FIFO cost / qty)
  5. Update MI: status = 'issued', issuedById, issuedDate, reservationStatus = 'released'
  6. ★ AUTO-CREATE Gate Pass (outbound) if not already created:
     - GatePass { passType: 'outbound', mirvId, destination: locationOfWork }
     - Marked gatePassAutoCreated = true to prevent duplicates

cancel(id):
  1. Verify status in ['approved', 'partially_issued', 'pending_approval']
  2. If reservationStatus = 'reserved': releaseReservation() for each line
  3. Status → 'cancelled', reservationStatus → 'released'
```

---

### 4.3 MRN — Material Return Note (V1: MRV)

**Purpose:** Document the return of materials from project site back to warehouse.

**Who Creates It:** Site Engineer or Warehouse Staff

**Fields:**
| Field | Description |
|-------|-------------|
| mrvNumber | Auto-generated (format: MRN-YYYY-NNNN) |
| returnType | return_to_warehouse / return_to_supplier / scrap / transfer_to_project |
| projectId | Source project |
| fromWarehouseId | Origin warehouse (if applicable) |
| toWarehouseId | Destination warehouse |
| returnedById | Employee returning materials |
| returnDate | Date of return |
| reason | Reason for return |
| receivedById | Warehouse staff receiving |
| originalMirvId | Link to original MI |

**Line Items (MrvLine):**
| Field | Description |
|-------|-------------|
| itemId | Returned material |
| qtyReturned | Quantity returned |
| uomId | Unit of measure |
| condition | good / used / damaged |

**State Machine:**
```
draft → pending → received → completed
               → rejected → draft
```

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| MRN-V001 | Return type is required |
| MRN-V002 | Project is required |
| MRN-V003 | Return reason is required |
| MRN-V004 | At least one line item is required |

**Side Effects:**
1. On `completed`: **Stock added back** to warehouse via `addStockBatch()`. New lots created with condition recorded.
2. If `returnType = scrap`: Material routed to scrap process instead of restocking.
3. If `returnType = return_to_supplier`: DR or credit note process initiated.

---

### 4.4 MR — Material Requisition (V1: MRF)

**Purpose:** Formally request materials for a project. Triggers stock check and either warehouse issue (MI) or purchase order.

**Who Creates It:** Site Engineer

**Fields:**
| Field | Description |
|-------|-------------|
| mrfNumber | Auto-generated (format: MR-YYYY-NNNN) |
| requestDate | Date of request |
| requiredDate | When materials are needed |
| projectId | Requesting project |
| department | electrical / mechanical / civil / safety / general |
| requestedById | Requester |
| deliveryPoint | Where to deliver on site |
| workOrder | Work order reference |
| drawingReference | Engineering drawing ref |
| priority | urgent / high / medium / low |
| totalEstimatedValue | Calculated value |
| mirvId | Generated MI (if from stock) |
| stockVerificationSla | Deadline for warehouse to verify stock |
| slaBreached | Whether SLA was exceeded |
| convertedToImsfId | If converted to inter-project transfer |

**Line Items (MrfLine):**
| Field | Description |
|-------|-------------|
| itemId | Requested item |
| itemDescription | Description (for non-catalog items) |
| category | Item category |
| qtyRequested | Quantity needed |
| source | from_stock / purchase_required / both / tbd |
| qtyFromStock | Quantity fulfilled from warehouse |
| qtyFromPurchase | Quantity to be purchased |
| qtyIssued | Quantity actually issued |
| unitCost | Estimated cost |
| mirvLineId | Link to MI line item |

**State Machine:**
```
draft → submitted → under_review → approved → checking_stock
checking_stock → from_stock → partially_fulfilled → fulfilled
             → needs_purchase → partially_fulfilled → fulfilled
             → not_available_locally → partially_fulfilled → fulfilled
submitted → rejected → draft
```

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| MR-V001 | Project is required |
| MR-V002 | Requester is required |
| MR-V003 | At least one line item is required |
| MR-V004 | Priority is required |
| MR-V005 | Required date is required |
| MR-V006 | Quantity > 0 for each item |
| MR-V010 | Item code must exist in master catalog |
| MR-V011 | Warning: Stock verification is stale (exceeds SLA) |

**Side Effects:**
1. On `approved`: **SLA timer starts** for warehouse stock verification (4 hours).
2. On `from_stock`: **MI document auto-created** with line items from this MR.
3. On `needs_purchase`: Purchase department notified.
4. On `not_available_locally`: Can be **converted to IMSF** for inter-project transfer.
5. SLA breach recorded if warehouse doesn't respond within `SLA_HOURS.stock_verification` (4 hours).

**Implementation Detail — MR Lifecycle:**

```
create(headerData, lines, userId):
  Transaction:
    1. Generate auto-number: MR-YYYY-NNNN (via generateDocumentNumber('mrf'))
    2. Batch-fetch item standardCost for all line items
    3. Calculate totalEstimatedValue = Σ(standardCost × qtyRequested)
    4. Create MaterialRequisition (status: 'draft') with MrfLine records
    5. Lines can have itemId = null (for non-catalog free-text items)

approve(id, userId):
  1. Validate transition: under_review → approved
  2. ★ SET SLA DEADLINE: stockVerificationSla = now + 4 hours
  3. Warehouse must respond within 4 hours or SLA is breached

checkStock(id):
  1. Load MR with lines and project warehouses
  2. For each line item:
     a. Check stock across all project warehouses: getStockLevel(itemId, warehouseId)
     b. Determine source:
        - 'from_stock' if totalAvailable ≥ qtyNeeded
        - 'both' if some available but not enough
        - 'purchase_required' if no stock
     c. Update MrfLine: source, qtyFromStock, qtyFromPurchase
  3. ★ CROSS-PROJECT CHECK: If ALL lines are 'purchase_required':
     - Check stock in other active projects' warehouses
     - If found: mark source = 'available_other_project' + record otherProjectId
     - Set suggestImsf = true (UI shows "Convert to IMSF" button)
  4. Status → 'checking_stock'

convertToMirv(id, userId, warehouseId?):
  ★ AUTO-CREATE MI from MR
  1. Filter lines where source = 'from_stock' or 'both'
  2. If no from-stock lines → status = 'needs_purchase', return
  3. Transaction:
     a. Generate MI number: MI-YYYY-NNNN
     b. Create Mirv record (status: 'draft') linked to MR via mrfId
     c. Create MirvLine for each from-stock MrfLine
     d. Link each MrfLine to its MirvLine (mirvLineId)
     e. MR status → 'from_stock' (if all from stock) or 'needs_purchase' (if mixed)
     f. MR.mirvId = created MI id
  4. Return MI id + number for redirect

convertToImsf(id, userId, receiverProjectId):
  ★ AUTO-CREATE IMSF from MR
  1. Filter lines with source = 'purchase_required' or 'available_other_project'
  2. Transaction:
     a. Generate IMSF number: IMSF-YYYY-NNNN
     b. Create Imsf record linked to MR via originMrId
     c. Create ImsfLine for each eligible MrfLine
     d. MR status → 'not_available_locally', convertedToImsfId set
  3. Return IMSF record with project details
```

---

### 4.5 QCI — Quality Control Inspection (V1: RFIM)

**Purpose:** Perform quality inspection on received materials. Can be auto-triggered by damaged items in GRN.

**Who Creates It:** QC Officer (or auto-created from GRN)

**Fields:**
| Field | Description |
|-------|-------------|
| rfimNumber | Auto-generated (format: QCI-YYYY-NNNN) |
| mrrvId | Link to GRN being inspected |
| inspectorId | QC Officer performing inspection |
| requestDate | When inspection was requested |
| inspectionDate | When inspection was performed |
| result | pass / fail / conditional |
| status | Current state |
| pmApprovalRequired | Whether PM needs to sign off |
| pmApprovalById | PM who approved conditional result |

**State Machine:**
```
pending → in_progress → completed
                     → completed_conditional → completed (after PM approval)
```

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| QCI-V001 | GRN reference is required |
| QCI-V002 | Inspection type is required |
| QCI-V003 | Priority is required |
| QCI-V004 | Items description is required |
| QCI-V005 | Warning: Inspection date is in the past |
| QCI-V006 | Warning: Critical priority requires QC Manager approval |

**Side Effects:**
1. On `completed` (pass): GRN can proceed to `stored` status.
2. On `completed` (fail): GRN items rejected, DR auto-created for claim.
3. On `completed_conditional`: Requires **PM approval** to upgrade to `completed`.
4. **SLA**: 14 days for QC inspection (`SLA_HOURS.qc_inspection = 336`).
5. Inspection checklists (reusable templates) can be attached.

---

### 4.6 DR — Discrepancy Report (V1: OSD)

**Purpose:** Report over-delivery, short-delivery, or damage discrepancies found during receiving.

**Who Creates It:** Warehouse Staff or QC Officer

**Fields:**
| Field | Description |
|-------|-------------|
| osdNumber | Auto-generated (format: DR-YYYY-NNNN) |
| mrrvId | Link to GRN |
| poNumber | PO reference |
| supplierId | Supplier involved |
| reportDate | Date reported |
| reportTypes | Array: over / short / damage |
| totalOverValue / totalShortValue / totalDamageValue | Calculated values |
| claimSentDate | When claim was sent to supplier |
| claimReference | Claim tracking number |
| supplierResponse | Supplier's response |
| resolutionType | credit_note / replacement / price_adjustment / insurance_claim / write_off / returned |
| resolutionAmount | Final resolution value |
| resolvedById | Who resolved the issue |

**Line Items (OsdLine):**
| Field | Description |
|-------|-------------|
| itemId | Affected item |
| mrrvLineId | Link to GRN line |
| qtyInvoice | Invoiced quantity |
| qtyReceived | Actually received |
| qtyDamaged | Damaged quantity |
| damageType | physical / water / missing_parts / wrong_item / expired / other |
| unitCost | Cost per unit |

**State Machine:**
```
draft → under_review → claim_sent → awaiting_response → negotiating → resolved → closed
       under_review → resolved → closed
```

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| DR-V001 | GRN reference is required |
| DR-V002 | Issue type is required |
| DR-V003 | Quantity affected > 0 |
| DR-V004 | Description is required |
| DR-V005 | Required action must be specified |
| DR-V006 | Warning: Photos recommended for damage reports |
| DR-V007 | Warning: Insurance claims require documentation |

---

### 4.7 JO — Job Order

**Purpose:** Request and track external services — transport, equipment rental, scrap disposal, generator maintenance.

**Who Creates It:** Logistics Coordinator, Transport Supervisor, or Site Engineer

**7 Job Order Types:**

| Type | Description | Subtype Table |
|------|-------------|---------------|
| transport | Cargo transportation between locations | JoTransportDetail |
| equipment | Heavy equipment rental | JoEquipmentLine |
| rental_monthly | Monthly equipment rental | JoRentalDetail |
| rental_daily | Daily equipment rental | JoRentalDetail |
| scrap | Scrap material disposal | JoScrapDetail |
| generator_rental | Generator rental | JoGeneratorDetail |
| generator_maintenance | Generator servicing | JoGeneratorDetail |

**Core Fields:**
| Field | Description |
|-------|-------------|
| joNumber | Auto-generated (format: JO-YYYY-NNNN) |
| joType | One of 7 types above |
| entityId | Legal entity |
| projectId | Associated project |
| supplierId | Service provider |
| requestedById | Requester |
| totalAmount | Quoted/actual cost |
| insuranceRequired | Whether cargo requires insurance |
| insuranceValue | Insurance coverage amount |
| cnNumber | Contract number |
| coaApprovalRequired | COA (Chart of Accounts) approval needed |
| projectBudgetApproved | Whether budget is available |

**State Machine:**
```
draft → pending_approval → quoted → approved → assigned → in_progress
    → on_hold → in_progress (resume)
              → cancelled
    → completed → closure_pending → closure_approved → invoiced
pending_approval → rejected → draft
```

**Approval Levels (JO_APPROVAL_LEVELS):**

| Level | Label | Role | Amount Range (SAR) | SLA |
|-------|-------|------|-------------------|-----|
| 1 | Logistics Coordinator | logistics_coordinator | 0 – 5,000 | 4 hours |
| 2 | Logistics Manager | manager | 5,000 – 20,000 | 8 hours |
| 3 | Operations Director | manager | 20,000 – 100,000 | 24 hours |
| 4 | CEO | admin | 100,000+ | 48 hours |

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| JO-V001 | JO type is required |
| JO-V002 | Project is required |
| JO-V003 | Cargo type required (transport) |
| JO-V004 | Cargo weight required (transport) |
| JO-V005 | Scrap type required (scrap) |
| JO-V006 | Scrap weight required (scrap) |
| JO-V010 | Insurance required if value > 7,000,000 SAR |
| JO-V011 | Monthly rental requires COO approval |
| JO-V012 | No budget available — finance approval needed |

**Side Effects:**
1. **SLA tracking** via `JoSlaTracking` table — stop-clock support for on-hold periods.
2. Transport JOs can **auto-generate Gate Passes**.
3. Scrap JOs link to `ScrapItem` and SSC (Scrap Selling Committee) process.
4. Generator JOs update generator status and maintenance records.
5. **Payment tracking** — invoice, VAT, payment approval, Oracle voucher posting.

**Implementation Detail — JO Lifecycle:**

```
create(body, userId):
  1. ★ INSURANCE CHECK: If totalAmount > 7,000,000 SAR and !insuranceRequired → error
  2. Monthly rentals auto-set coaApprovalRequired = true (COO approval needed)
  3. Transaction:
     a. Generate auto-number: JO-YYYY-NNNN
     b. Create JobOrder header with all V5 fields (driver, vehicle, Google Maps, etc.)
     c. Create type-specific subtable based on joType:
        - 'transport' → JoTransportDetail (pickup/delivery locations, cargo info)
        - 'rental_monthly'/'rental_daily' → JoRentalDetail (rates, dates, operator)
        - 'generator_rental'/'generator_maintenance' → JoGeneratorDetail (generator link, capacity)
        - 'scrap' → JoScrapDetail (scrap type, weight, destination)
        - 'equipment' → JoEquipmentLine[] (equipment types, quantities)
     d. Create JoSlaTracking record (empty — populated on submit)
  4. Return full JO with all relations

submit(id, userId, io?):
  1. Validate transition: draft → pending_approval
  2. Call submitForApproval() — calculates level from totalAmount using JO_APPROVAL_LEVELS
  3. Set JoSlaTracking: slaResponseHours, slaDueDate = now + slaHours
  4. Notify approvers via Socket.IO

hold(id, reason?):
  ★ STOP-CLOCK SLA: When JO is placed on hold:
  1. Validate transition: in_progress → on_hold
  2. JoSlaTracking.stopClockStart = now (records when clock stopped)
  3. JoSlaTracking.stopClockReason = reason

resume(id):
  ★ RESTART SLA CLOCK: Paused duration is added to deadline:
  1. Validate transition: on_hold → in_progress
  2. Calculate pausedMs = now - stopClockStart
  3. JoSlaTracking.slaDueDate += pausedMs (extends deadline by paused duration)
  4. JoSlaTracking.stopClockEnd = now

complete(id, userId):
  1. Validate transition: in_progress → completed
  2. Set completionDate, completedById
  3. SLA evaluation: slaMet = (completionDate <= slaDueDate)

invoice(id, paymentData):
  1. Validate transition: completed → invoiced (or closure_approved → invoiced)
  2. Create JoPayment record:
     - invoiceNumber, invoiceReceiptDate
     - costExclVat, vatAmount, grandTotal
     - paymentStatus ('pending' → 'approved' → 'paid')
     - oracleVoucher (Oracle ERP reference)
     - attachmentUrl (invoice scan)

Payment Lifecycle:
  JoPayment.paymentStatus:
    pending → approved (paymentApprovedDate set) → paid (actualPaymentDate set)
```

---

### 4.8 WT — Warehouse Transfer (V1: Stock Transfer)

**Purpose:** Transfer stock between warehouses or between projects.

**Who Creates It:** Warehouse Supervisor or Logistics Coordinator

**Transfer Types:** `warehouse_to_warehouse` | `project_to_project` | `warehouse_to_project` | `project_to_warehouse`

**State Machine:**
```
draft → pending → approved → shipped → received → completed
              → cancelled
```

**Side Effects:**
1. On `shipped`: **Stock deducted** from source warehouse via `deductStockBatch()` (FIFO).
2. On `received`: **Stock added** to destination warehouse via `addStockBatch()`.
3. Can link to a **Transport JO** for physical movement.
4. Requires **Gate Pass** for material exit.
5. **Bin card transactions** created at both source (issue) and destination (receipt).

---

### 4.9 IMSF — Internal Material Shifting Form (NEW in V2)

**Purpose:** Transfer materials between projects (not warehouses). Used when MR identifies materials available at another project.

**Who Creates It:** Logistics Coordinator

**State Machine:**
```
created → sent → confirmed → in_transit → delivered → completed
              → rejected
```

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| IMSF-V001 | Sender project is required |
| IMSF-V002 | Receiver project is required |
| IMSF-V003 | Sender and receiver must be different |
| IMSF-V004 | Material type is required |
| IMSF-V005 | At least one line item is required |

---

### 4.10 Gate Pass

**Purpose:** Authorize the entry or exit of materials through warehouse gates. Can be auto-created from MI.

**Pass Types:** `inbound` | `outbound` | `transfer`

**State Machine:**
```
draft → pending → approved → released → returned
                                      → expired
              → cancelled
```

**SLA:** 24 hours (`SLA_HOURS.gate_pass`).

**Side Effects:**
1. Auto-created when MI status → `issued` and materials leave warehouse.
2. Tracks vehicle details, driver identity, exit time, and return time.
3. Expiration enforcement — passes auto-expire after `validUntil` date.

---

### 4.11 Surplus Item (NEW in V2)

**Purpose:** Identify excess inventory that is no longer needed by any project.

**State Machine:**
```
identified → evaluated → approved → actioned → closed
                      → rejected → identified
```

**Dispositions:** `transfer` | `return` | `retain` | `sell`

**Side Effects:**
1. Requires OU Head approval + SCM approval (dual sign-off tracked separately).
2. **Surplus timeout SLA**: 14 days (`SLA_HOURS.surplus_timeout`).
3. Can trigger IMSF (inter-project transfer) or sale process.

---

### 4.12 Scrap Item (NEW in V2)

**Purpose:** Manage identification, approval, and disposal of scrap materials through the Scrap Selling Committee (SSC).

**Scrap Material Types:** cable, mv_cable, hv_cable, aluminum, copper, steel, cable_tray, wood, other

**State Machine:**
```
identified → reported → approved → in_ssc → sold → closed
                                         → disposed → closed
                     → rejected → identified
```

**Approval Chain:** Site Manager → QC Officer → Storekeeper (triple sign-off)

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| SCRAP-V001 | Material type is required |
| SCRAP-V002 | Warehouse is required |
| SCRAP-V003 | Estimated weight > 0 |
| SCRAP-V004 | Photos required for identification |
| SCRAP-W001 | Warning: Buyer pickup exceeds 10-day SLA |

**Side Effects:**
1. SSC Bids managed via `SscBid` table — multiple bidders, committee review.
2. SSC memo must be signed, copy sent to finance.
3. **Buyer pickup SLA**: 10 days (`SLA_HOURS.scrap_buyer_pickup`).
4. Smart container tracking via `smartContainerId`.

---

### 4.13 Rental Contract (NEW in V2)

**Purpose:** Manage equipment rental agreements with suppliers.

**State Machine:**
```
draft → pending_approval → active → extended → active (re-extended)
                                  → terminated
                        → rejected → draft
```

**Validation Rules:**
| Rule | Code | Description |
|------|------|-------------|
| RC-V001 | Supplier is required |
| RC-V002 | Start date is required |
| RC-V003 | End date is required |
| RC-V004 | End date must be after start date |
| RC-V005 | Monthly or daily rate is required |

**Key Features:**
- Chamber of Commerce stamp tracking
- Insurance value and expiry management
- Line items for multiple equipment pieces

---

### 4.14 Shipment

**Purpose:** Track international and domestic cargo from purchase order to warehouse delivery.

**Shipping Modes:** `sea_fcl` | `sea_lcl` | `air` | `land` | `courier`

**State Machine:**
```
draft → po_issued → in_production → ready_to_ship → in_transit → at_port
→ customs_clearing → cleared → in_delivery → delivered
→ cancelled (from any state)
```

**Customs Tracking Stages:**
```
docs_submitted → declaration_filed → under_inspection → awaiting_payment
→ duties_paid → ready_for_release → released
→ on_hold / rejected
```

**Inspection Types:** document_review | xray_scan | physical_inspection | lab_testing | green_channel

**Shipping Milestones:**
1. booking_confirmed
2. cargo_loaded
3. vessel_departed
4. in_transit
5. arrived_at_port
6. customs_clearance
7. saber_registration (Saudi quality mark)
8. fasah_customs (Saudi e-customs)
9. sadad_payment (Saudi payment system)
10. delivered_to_warehouse
11. advance_shipment_notification

---

## 5. FIFO Inventory System

### 5.1 Core Concepts

The inventory system implements **First-In, First-Out (FIFO)** costing at the lot level. This means materials received earliest are consumed first, ensuring accurate cost allocation.

#### Data Model

```
InventoryLevel (per item per warehouse)
├── qtyOnHand      — Total physical quantity
├── qtyReserved    — Quantity locked for approved MIs
├── available      — Calculated: qtyOnHand - qtyReserved
├── minLevel       — Critical low-stock threshold
├── reorderPoint   — Warning low-stock threshold
├── version        — Optimistic locking counter
└── alertSent      — Low-stock notification flag

InventoryLot (per receipt batch — the FIFO unit)
├── lotNumber      — Unique identifier (LOT-YYYY-NNNN)
├── itemId         — Material
├── warehouseId    — Location
├── mrrvLineId     — Link to GRN receipt line
├── receiptDate    — When received (FIFO ordering key)
├── expiryDate     — For perishable items
├── initialQty     — Original receipt quantity
├── availableQty   — Current available (decremented on consumption)
├── reservedQty    — Reserved but not yet consumed
├── unitCost       — Per-unit cost (from PO/invoice)
├── supplierId     — Source supplier
├── binLocation    — Physical storage location
└── status         — active | depleted | expired | blocked

LotConsumption (audit trail of every lot deduction)
├── lotId          — Which lot was consumed
├── mirvLineId     — For MI-linked consumption
├── referenceType  — For generic consumption (e.g. 'stock_transfer')
├── referenceId    — ID of consuming document
├── quantity       — How much was consumed
├── unitCost       — Cost at time of consumption
└── consumptionDate — When consumed
```

### 5.2 Stock Operations

#### 5.2.1 Add Stock (GRN → Stored)

When a GRN transitions to `stored`:

1. **Upsert InventoryLevel** — increment `qtyOnHand`, reset `alertSent`
2. **Create InventoryLot** — new lot with receipt date, unit cost, supplier, expiry
3. If the InventoryLevel didn't exist, it's created with initial quantities
4. Uses **optimistic locking** — if version conflict, retries up to 3 times

```
Transaction:
  InventoryLevel.qtyOnHand += qty (version checked)
  InventoryLot.create(lotNumber, qty, unitCost, receiptDate)
  AuditLog.create(...)
```

#### 5.2.2 Reserve Stock (MI → Pending Approval)

When an MI is submitted for approval, stock is reserved to prevent overselling:

1. **Check availability**: `available = qtyOnHand - qtyReserved`
2. If sufficient: **Increment qtyReserved** on InventoryLevel
3. **Reserve from lots** — FIFO order (oldest `receiptDate` first):
   - For each lot: `lotAvailable = availableQty - reservedQty`
   - Reserve `min(remaining, lotAvailable)`
   - Increment lot's `reservedQty`
4. All within a single **database transaction**

```
Transaction:
  InventoryLevel.qtyReserved += qty (version checked)
  For each lot (FIFO order):
    InventoryLot.reservedQty += toReserve
```

#### 5.2.3 Consume Reservation (MI → Issued)

When materials are physically issued:

1. **Decrement both** `qtyOnHand` AND `qtyReserved` on InventoryLevel
2. **Consume from lots** — FIFO order:
   - Reduce `availableQty`
   - Reduce `reservedQty`
   - If `availableQty = 0` → set status to `depleted`
3. **Calculate FIFO cost** — each lot's `unitCost * consumed qty`
4. **Create LotConsumption** records for full audit trail
5. **Check low-stock alerts**

```
Transaction:
  InventoryLevel.qtyOnHand -= qty
  InventoryLevel.qtyReserved -= qty (version checked)
  For each lot (FIFO order):
    cost += min(remaining, lotAvailable) * lot.unitCost
    InventoryLot.availableQty -= consumed
    InventoryLot.status = 'depleted' if empty
    LotConsumption.create(lotId, mirvLineId, qty, unitCost)
  CheckLowStockAlert(itemId, warehouseId)
Return: { totalCost, lineCosts per mirvLine }
```

#### 5.2.4 Release Reservation (MI → Rejected)

When an MI is rejected:

1. **Decrement qtyReserved** on InventoryLevel
2. **Release from lots** — FIFO order, decrement each lot's `reservedQty`

#### 5.2.5 Direct Deduction (WT → Shipped)

For warehouse transfers (no prior reservation):

1. Verify sufficient `qtyOnHand`
2. Decrement `qtyOnHand` (no reserved change)
3. Consume from lots — same FIFO logic
4. Create LotConsumption with `referenceType = 'stock_transfer'`

### 5.3 Batch Operations

All inventory operations support **batch mode** for processing multiple line items in a single transaction:

| Operation | Single | Batch | Used By |
|-----------|--------|-------|---------|
| Add Stock | `addStock()` | `addStockBatch()` | GRN stored, MRN completed |
| Reserve | `reserveStock()` | `reserveStockBatch()` | MI approval |
| Consume | `consumeReservation()` | `consumeReservationBatch()` | MI issuance |
| Deduct | `deductStock()` | `deductStockBatch()` | WT shipped |

### 5.4 Optimistic Locking

The `InventoryLevel.version` field prevents race conditions:

```typescript
// Pseudocode
for (attempt = 0; attempt < 3; attempt++) {
  currentVersion = SELECT version FROM inventory_levels WHERE item, warehouse;
  result = UPDATE inventory_levels
           SET qty = new_value, version = version + 1
           WHERE item AND warehouse AND version = currentVersion;
  if (result.count > 0) return; // success
  // else: version changed (concurrent update), retry
}
throw "Optimistic lock failure after 3 retries";
```

### 5.5 Low-Stock Alerts

After every stock consumption, the system checks:

1. **Critical Alert**: `available <= minLevel` → logs warning, sets `alertSent = true`
2. **Warning Alert**: `available <= reorderPoint` → logs info, sets `alertSent = true`
3. `alertSent` is reset to `false` when new stock arrives

### 5.6 Bin Card System

Physical bin cards track item movement at the bin location level:

```
BinCard (per item per warehouse per bin)
├── binNumber — Zone-Aisle-Shelf (e.g. A-03-12)
├── currentQty — Running balance
└── transactions:
    BinCardTransaction
    ├── transactionType — receipt | issue | adjustment | transfer
    ├── referenceType — grn | mi | wt | adjustment
    ├── referenceNumber — Document number
    ├── qtyIn / qtyOut — Movement quantities
    ├── runningBalance — Balance after transaction
    └── performedBy — Who performed it
```

---

## 6. Multi-Level Approval System

### 6.1 Architecture

The approval system supports **configurable multi-level approval chains** with SLA enforcement, delegation, and parallel approval groups.

#### Data Model

```
ApprovalWorkflow (configuration)
├── documentType   — Which document type this applies to
├── minAmount      — Minimum amount threshold
├── maxAmount      — Maximum amount threshold
├── approverRole   — Required role at this level
└── slaHours       — Maximum hours to approve

ApprovalStep (instance per document per level)
├── documentType   — e.g. 'mirv'
├── documentId     — Specific document
├── level          — 1, 2, 3...
├── approverRole   — Required role
├── approverId     — Who actually approved
├── status         — pending | approved | rejected | skipped
├── notes          — Approval comments
└── decidedAt      — When decision was made

DelegationRule (out-of-office coverage)
├── delegatorId    — Employee transferring authority
├── delegateId     — Employee receiving authority
├── startDate/endDate — Active period
├── scope          — 'all' | specific document type
└── isActive       — Can be deactivated
```

### 6.2 Approval Flow

```
1. Document submitted for approval
   ├── getApprovalChain(docType, amount) → calculates required levels
   ├── ApprovalStep records created for ALL levels (status: pending)
   └── First level notified via Socket.IO

2. Level N approver takes action:
   ├── isAuthorizedApprover() checks:
   │   ├── Direct role match (systemRole === requiredRole)
   │   ├── Admin override (admin can always approve)
   │   └── Active delegation (delegate has valid DelegationRule)
   │
   ├── If APPROVE:
   │   ├── Mark current step: status = 'approved'
   │   ├── If more levels exist:
   │   │   ├── Calculate next level's SLA deadline
   │   │   └── Notify next level approvers
   │   └── If final level:
   │       ├── Document status → 'approved'
   │       └── Emit approval:approved event
   │
   └── If REJECT:
       ├── Mark current step: status = 'rejected'
       ├── All subsequent steps: status = 'skipped'
       ├── Document status → 'rejected'
       └── Emit approval:rejected event
```

### 6.3 Delegation Rules

When an approver is unavailable (vacation, travel), they can delegate authority:

- **Scope**: Specific document type or `'all'`
- **Date Range**: Active during specified period
- **Resolution**: When checking authorization, system checks:
  1. Does the user's own `systemRole` match the required role?
  2. If not, does any active delegation exist where the `delegator` has the required role?
- **Audit Trail**: All delegated approvals log both the delegate and the original delegator

### 6.4 Parallel Approval Groups

For scenarios requiring **multiple approvers at the same level** (e.g., committee approval):

```
ParallelApprovalGroup
├── mode: 'all' — all members must approve
├── mode: 'any' — first approval wins
└── responses: ParallelApprovalResponse[]
    ├── approverId
    ├── decision: approved | rejected
    └── comments
```

### 6.5 SLA Enforcement

Each approval level has an SLA deadline:

- SLA calculation: `dueDate = now + slaHours`
- SLA tracked on the document (`slaDueDate` field)
- **Scheduler** periodically checks for overdue approvals and sends notifications
- SLA breach recorded for reporting

---

## 7. RBAC — Role-Based Access Control

### 7.1 System Roles

| Role | Code | Description |
|------|------|-------------|
| Admin | `admin` | Full system access, highest approval level |
| Manager | `manager` | Department management, high-level approval |
| Warehouse Supervisor | `warehouse_supervisor` | Warehouse operations oversight |
| Warehouse Staff | `warehouse_staff` | Day-to-day warehouse operations |
| Logistics Coordinator | `logistics_coordinator` | Logistics and procurement |
| Site Engineer | `site_engineer` | Project site material requests |
| QC Officer | `qc_officer` | Quality control inspections |
| Freight Forwarder | `freight_forwarder` | Shipping and customs tracking |
| Transport Supervisor | `transport_supervisor` | Transport and fleet management |
| Scrap Committee Member | `scrap_committee_member` | Scrap disposal oversight |

### 7.2 Permission Types

Six permission types are defined: `create` | `read` | `update` | `delete` | `approve` | `export`

### 7.3 Full Permission Matrix

| Resource | Admin | Manager | WH Supervisor | WH Staff | Logistics | Site Eng | QC Officer | Freight | Transport | Scrap |
|----------|-------|---------|---------------|----------|-----------|----------|------------|---------|-----------|-------|
| **GRN** | CRUADE | RAE | CRUA | CRU | CRU | — | — | — | R | — |
| **MI** | CRUADE | RAE | RUA | RU | CRUA | CR | — | — | R | — |
| **MRN** | CRUADE | RAE | CRU | CRU | CRU | — | — | — | — | — |
| **QCI** | CRUADE | RAE | CR | CR | — | — | CRUA | — | — | — |
| **DR** | CRUADE | RE | CRU | CR | — | — | CRU | — | — | — |
| **JO** | CRUADE | CRAE | — | — | CRUA | CR | — | — | CRUA | — |
| **Gate Pass** | CRUDE | RE | CRU | CRU | CRU | — | — | R | CRU | — |
| **WT** | CRUADE | RAE | CRU | CR | CRU | — | — | — | CRUA | — |
| **MR** | CRUADE | RAE | — | — | — | CR | — | — | R | — |
| **Shipment** | CRUDE | RE | — | — | CRU | — | — | RU | R | — |
| **Customs** | CRUDE | RE | — | — | CRU | — | — | R | — | — |
| **Inventory** | RUE | RE | RUE | RU | RE | R | R | — | R | R |
| **Items** | CRUDE | RE | RU | R | — | — | — | — | — | — |
| **Projects** | CRUDE | RE | R | R | — | R | — | — | — | — |
| **Suppliers** | CRUDE | RE | — | — | R | — | — | — | — | — |
| **IMSF** | CRUADE | — | CRU | R | CRU | — | — | — | CRU | — |
| **Surplus** | CRUADE | — | CRU | — | — | — | R | — | — | R |
| **Scrap** | CRUADE | — | CR | — | — | — | RA | — | — | RA |
| **SSC** | CRUA | — | — | — | — | — | — | — | — | CRUA |
| **Rental** | CRUDA | — | — | — | R | — | — | — | — | — |
| **Tools** | CRUD | — | RU | — | — | — | — | — | — | — |
| **Tool Issues** | CRU | — | CRU | CR | — | — | — | — | — | — |
| **Bin Card** | RU | — | RU | RU | — | — | — | — | — | — |
| **Gen. Fuel** | CR | — | — | — | CR | — | — | — | — | — |
| **Gen. Maint.** | CRU | — | — | — | R | — | — | — | — | — |
| **WH Zones** | CRUD | — | R | — | — | — | — | — | — | — |
| **Reports** | RE | RE | — | — | — | — | — | — | — | — |
| **Audit Log** | RE | — | — | — | — | — | — | — | — | — |
| **Settings** | RU | — | — | — | — | — | — | — | — | — |

*Legend: C=Create, R=Read, U=Update, D=Delete, A=Approve, E=Export*

### 7.4 Max Approval Levels by Role

| Role | Max Approval Level |
|------|--------------------|
| Admin | 5 (CEO) |
| Manager | 4 (Operations Director) |
| Logistics Coordinator | 2 |
| Warehouse Supervisor | 1 |
| Warehouse Staff | 1 |
| QC Officer | 1 |
| Transport Supervisor | 1 |
| Scrap Committee Member | 1 |
| Site Engineer | 0 (cannot approve) |
| Freight Forwarder | 0 (cannot approve) |

### 7.5 Permission Override System

The system supports **runtime permission overrides** that merge with hardcoded defaults:

```typescript
getEffectivePermissions(role, overrides?) {
  defaults = ROLE_PERMISSIONS[role];
  if (!overrides[role]) return defaults;
  return { ...defaults, ...overrides[role] }; // overrides replace per-resource
}
```

---

## 8. Integrated Business Flows

### 8.1 Procurement-to-Stock Flow

```
Purchase Order (external)
    ↓
Shipment tracking (SH-YYYY-NNNN)
    ↓ (customs clearance)
Advance Shipping Notice (ASN)
    ↓ (expected arrival)
Yard Appointment scheduled
    ↓ (truck check-in)
GRN created (GRN-YYYY-NNNN) ← materials physically received
    ↓ (if damaged items found)
    ├── QCI auto-created (QCI-YYYY-NNNN)
    └── DR auto-created (DR-YYYY-NNNN) if qty discrepancy
    ↓ (QC approved)
GRN → stored
    ↓
Inventory lots created (FIFO costing)
Bin card updated (receipt transaction)
Low-stock alerts cleared
```

### 8.2 Material Request-to-Issue Flow

```
Site Engineer creates MR (MR-YYYY-NNNN)
    ↓ (submitted)
Warehouse reviews stock (4-hour SLA)
    ↓
┌─── from_stock ─────┐     ┌── needs_purchase ──┐    ┌── not_available_locally ──┐
│                     │     │                     │    │                            │
MI created            │     Purchase process      │    IMSF created                │
(MI-YYYY-NNNN)        │     (external)            │    (inter-project transfer)    │
│                     │     │                     │    │                            │
└─── approval chain ──┘     └─────────────────────┘    └────────────────────────────┘
    ↓ (approved)
Stock reserved (FIFO lots)
    ↓ (issued)
Stock consumed (FIFO cost calculation)
Gate Pass auto-created (GP-YYYY-NNNN)
Bin card updated (issue transaction)
    ↓ (materials on site)
MI → completed
```

### 8.3 Material Return Flow

```
Project site has excess/unused materials
    ↓
MRN created (MRN-YYYY-NNNN) linked to original MI
    ↓ (return_type?)
┌── return_to_warehouse ──┐    ┌── scrap ──────────┐    ┌── return_to_supplier ──┐
│                          │    │                    │    │                        │
│ Warehouse receives       │    │ Scrap Item created │    │ DR created             │
│ Stock added back (FIFO)  │    │ SSC process        │    │ Supplier credit/claim  │
│ New lot created          │    │                    │    │                        │
└──────────────────────────┘    └────────────────────┘    └────────────────────────┘
```

### 8.4 Scrap Disposal Flow

```
Scrap identified (by warehouse staff)
    ↓
ScrapItem created (SCR-YYYY-NNNN)
    ↓ (photos required)
Reported → triple approval:
    ├── Site Manager approval
    ├── QC Officer approval
    └── Storekeeper approval
    ↓ (approved)
Moved to SSC (Scrap Selling Committee)
    ↓
SSC Bids collected (SscBid table)
    ├── Bidder 1: amount, status
    ├── Bidder 2: amount, status
    └── Bidder N: amount, status
    ↓ (committee selects best bid)
SSC Memo signed
Finance copy sent
    ↓ (buyer picks up within 10-day SLA)
Scrap → sold/disposed → closed
JO created for transport (if needed)
```

### 8.5 Warehouse Transfer Flow

```
Transfer request created (WT-YYYY-NNNN)
    ↓ (pending → approved)
JO created for transport (if inter-city)
Gate Pass created
    ↓ (shipped)
Source warehouse: stock deducted (FIFO)
Source bin card: issue transaction
    ↓ (in transit)
    ↓ (received at destination)
Destination warehouse: stock added
Destination bin card: receipt transaction
    ↓ (completed)
Transfer closed
```

---

## 9. Advanced Features

### 9.1 ABC Analysis

Automatic classification of inventory items based on value contribution:

- **Class A**: Top 20% items accounting for ~80% of total value — counted frequently
- **Class B**: Next 30% items accounting for ~15% of value — moderate counting
- **Class C**: Bottom 50% items accounting for ~5% of value — least frequent counting

Classification stored on `Item.abcClass` field, updated periodically by `abc-analysis.service.ts`. Used to prioritize cycle counting schedules.

### 9.2 Cycle Counting

Physical inventory verification without full shutdown:

```
CycleCount (header)
├── countType: full | abc_based | zone | random
├── warehouseId: target warehouse
├── zoneId: specific zone (optional)
├── scheduledDate: when to count
└── status: scheduled → in_progress → completed | cancelled

CycleCountLine (per item)
├── expectedQty: system quantity
├── countedQty: physical count
├── varianceQty: difference
├── variancePercent: percentage deviation
├── status: pending → counted → verified → adjusted
└── countedBy: employee who counted
```

**Types:**
- **Full Count** — all items in warehouse
- **ABC-Based** — Class A items counted more frequently
- **Zone Count** — specific warehouse zone
- **Random** — statistically sampled items

### 9.3 Cross-Docking

Bypass put-away by routing inbound items directly to outbound orders:

```
CrossDock
├── sourceGrnId: incoming GRN
├── targetMiId: pending MI (outbound)
├── targetWtId: pending WT (transfer)
├── quantity: cross-dock amount
└── status: identified → approved → in_progress → completed | cancelled
```

### 9.4 Advance Shipping Notice (ASN)

Supplier pre-announces incoming shipments:

```
AdvanceShippingNotice
├── supplierId: sending supplier
├── warehouseId: destination warehouse
├── expectedArrival: when to expect
├── carrierName: transport company
├── trackingNumber: carrier tracking
├── purchaseOrderRef: PO link
├── grnId: created GRN (after receipt)
└── lines: AsnLine[] (item, qty, lot, expiry)
```

### 9.5 Warehouse Zones & Put-Away Rules

Automated bin assignment for incoming materials:

**Zones:** Civil (A) | Mechanical/Scrap (B) | Electrical (C) | General (D) | Container | Open Yard | Hazardous

**Put-Away Rules Engine:**
```
PutAwayRule
├── name: rule description
├── priority: evaluation order
├── warehouseId: applies to
├── targetZoneId: where to place
├── itemCategory: matching criteria
├── isHazardous: hazardous material flag
├── maxWeight: weight limit
└── isActive: can be disabled
```

Rules are evaluated by priority — first matching rule determines the target zone.

### 9.6 Yard Management

Physical dock door and truck visit management:

```
DockDoor
├── doorNumber: physical identifier
├── doorType: inbound | outbound | both
└── status: available | occupied | maintenance

YardAppointment
├── appointmentType: delivery | pickup | transfer
├── scheduledStart/End: time window
├── dockDoorId: assigned dock
├── referenceType/Id: linked ASN/GRN/MI/WT
└── status: scheduled → checked_in → loading → completed | cancelled | no_show

TruckVisit
├── vehiclePlate, driverName, carrierName
├── purpose: delivery | pickup | transfer
├── checkInAt / checkOutAt
├── dockDoorId: assigned dock
└── status: in_yard → at_dock → departed
```

### 9.7 IoT Sensor Monitoring

Environmental monitoring in warehouses:

```
Sensor
├── sensorType: temperature | humidity | smoke | motion | weight
├── warehouseId, zoneId: location
├── minThreshold, maxThreshold: alert boundaries
├── unit: °C, %RH, etc.
└── lastReadingAt, lastValue: latest data

SensorReading (time-series)
├── value: measured value
└── recordedAt: timestamp

SensorAlert
├── alertType: threshold_high | threshold_low | offline
├── value, threshold: trigger values
├── acknowledged: dismissal status
└── acknowledgedBy, acknowledgedAt
```

### 9.8 Tool Management

Track tools and equipment issued to employees:

```
Tool
├── toolCode, toolName, category
├── serialNumber: unique identifier
├── condition: good | under_maintenance | damaged | decommissioned
├── ownerId: responsible employee
├── warehouseId: storage location
└── purchaseDate, warrantyExpiry

ToolIssue
├── issuedToId, issuedById
├── expectedReturnDate
├── actualReturnDate
├── returnCondition
├── returnVerifiedById
└── status: issued → overdue → returned
```

### 9.9 Generator Management

Full lifecycle tracking for power generators:

- **Asset Register** — capacity, purchase value, depreciation method
- **Fuel Logs** — daily consumption, meter readings, cost tracking
- **Maintenance** — scheduled (daily/weekly/monthly/annual), status tracking
- **Depreciation** — straight-line or usage-based, GL posting integration
- **Job Orders** — rental and maintenance JOs linked to generators

### 9.10 Storekeeper Handover

Formal process for transferring warehouse custody between employees:

```
StorekeeperHandover
├── warehouseId: which warehouse
├── outgoingEmployeeId: departing storekeeper
├── incomingEmployeeId: new storekeeper
├── handoverDate: transfer date
├── inventoryVerified: physical count completed
├── discrepanciesFound: any variances
└── status: initiated → in_progress → completed
```

### 9.11 Demand Forecasting

Service at `demand-forecast.service.ts` — predicts future material requirements based on historical consumption patterns.

### 9.12 Wave Picking

Service at `wave-picking.service.ts` — groups multiple MI requests into optimized picking waves for warehouse efficiency.

### 9.13 Route Optimization

Service at `route-optimizer.service.ts` — optimizes delivery routes for transport JOs.

### 9.14 Slotting Optimization

Service at `slotting-optimizer.service.ts` — optimizes item placement in warehouse based on pick frequency (fast-movers near docks).

### 9.15 Labor Productivity

Service at `labor-productivity.service.ts` — tracks warehouse labor efficiency metrics.

### 9.16 Pick Optimization

Service at `pick-optimizer.service.ts` — optimizes pick paths within warehouse.

### 9.17 AQL (Acceptable Quality Level)

Service at `aql.service.ts` — statistical sampling plans for quality inspection based on lot size.

### 9.18 Barcode System

Service at `barcode.service.ts` — barcode generation and scanning for items, lots, and locations.

### 9.19 PWA & Push Notifications

#### Progressive Web App (PWA)

- **Service Worker** — pre-caches app shell and API responses for offline access
- **Offline Queue** — `useOfflineQueue` hook queues mutation operations when offline; syncs automatically when connectivity returns
- **Install Prompt** — supports "Add to Home Screen" on mobile devices
- **App Icons** — `pwa-192x192.png` and `pwa-512x512.png` for home screen

#### Web Push Notifications (VAPID)

The push notification system uses the **Web Push protocol with VAPID** (Voluntary Application Server Identification):

```
Architecture:
  Frontend (Service Worker)
    ↓ PushManager.subscribe()
  Browser Push Service (FCM/APNS/Mozilla)
    ↑ webPush.sendNotification() via VAPID
  Backend (push-notification.service.ts)

Subscription Flow:
  1. Frontend requests push permission
  2. Service worker calls PushManager.subscribe({ applicationServerKey: VAPID_PUBLIC_KEY })
  3. Browser returns PushSubscription { endpoint, keys: { p256dh, auth } }
  4. Frontend sends subscription to POST /push/subscribe
  5. Backend stores in PushSubscription table (upsert by userId + endpoint)

Delivery Flow:
  1. System event triggers notification
  2. createNotification() saves to DB + emits Socket.IO
  3. sendPushToUser() fetches all active subscriptions for user
  4. webPush.sendNotification() called for each subscription
  5. If subscription returns 410 Gone or 404 → deactivated (isActive = false)
```

**Push Payload Format:**
```json
{
  "title": "SLA Breached: Material Requisition",
  "body": "MR MR-2026-0123 has exceeded its stock verification SLA",
  "icon": "/pwa-192x192.png",
  "url": "/materialRequisition/abc123",
  "tag": "sla_breach"
}
```

**Push API Functions:**
| Function | Target | Usage |
|----------|--------|-------|
| `sendPushToUser(userId, payload)` | Single user, all devices | Most notifications |
| `sendPushToRole(role, payload)` | All users with role | SLA breach alerts |
| `broadcastPush(payload)` | All subscribers | System announcements |

**VAPID Key Management:**
- Keys loaded from `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` env vars
- If not set, auto-generated and logged to console (for development)
- Subject: `mailto:admin@nit-scs.com`

### 9.20 Workflow Engine

Configurable event-driven automation with JSON rule definitions:

```
Workflow
├── name: workflow name
├── entityType: which document type (or '*' for all)
├── isActive: can be disabled without deletion
├── rules: WorkflowRule[]
│   ├── triggerEvent: e.g. 'document:status_changed'
│   ├── conditions: JSON condition tree { operator: AND|OR, conditions: [...] }
│   ├── actions: JSON action array [{ type: 'send_email', params: {...} }]
│   ├── stopOnMatch: stop evaluating further rules
│   └── sortOrder: execution priority
└── executionLogs: WorkflowExecutionLog[]
    ├── triggeredAt: when the rule fired
    ├── eventType: which event triggered it
    ├── documentType/documentId: which document
    ├── ruleId: which rule was evaluated
    ├── success: whether the action succeeded
    └── error: error message (if failed)
```

**Condition Tree Example:**
```json
{
  "operator": "AND",
  "conditions": [
    { "field": "status", "op": "eq", "value": "approved" },
    { "field": "totalAmount", "op": "gt", "value": 100000 },
    {
      "operator": "OR",
      "conditions": [
        { "field": "joType", "op": "eq", "value": "transport" },
        { "field": "joType", "op": "eq", "value": "equipment" }
      ]
    }
  ]
}
```

**Available Actions:**
| Action Type | Parameters | Description |
|-------------|-----------|-------------|
| `send_email` | `{ templateCode, to, variables }` | Send email via template engine |
| `create_notification` | `{ recipientId, title, body }` | Create in-app notification |
| `change_status` | `{ targetStatus }` | Transition document to new status |
| `create_document` | `{ docType, data }` | Auto-create linked document |
| `emit_event` | `{ eventType, data }` | Emit a custom Socket.IO event |

### 9.21 Real-Time Updates (Socket.IO)

#### Architecture

```
Client (React)                      Server (Express)
─────────────                       ────────────────
Socket.IO Client                    Socket.IO Server
  ↕ JWT in handshake.auth.token       ↕ JWT verified via middleware
  ↕ Auto-reconnect with backoff       ↕ Periodic re-validation (5 min)
  ↕ Listens to events                 ↕ Emits to rooms

Room Structure:
  user:{userId}     — personal notifications (1 user per room)
  role:{roleName}   — role-scoped broadcasts (e.g. role:admin, role:warehouse_staff)
  doc:{documentId}  — document collaboration (multiple users watching same doc)
```

#### Connection Lifecycle

1. **Connect**: Client provides JWT in `auth.token` → server verifies → joins `user:{userId}` and `role:{role}` rooms
2. **Join Document**: Client sends `join:document` → server validates document exists + user has `read` permission → joins `doc:{documentId}` room
3. **Re-validation**: Every 5 minutes, server re-checks JWT validity. If expired, emits `auth:expired` and disconnects
4. **Rate Limiting**: Max 30 events per 10-second window per socket. Excess events receive `error:rate_limit`
5. **Disconnect**: Timer cleared, rooms auto-left

#### Event Emission Helpers

| Function | Target | Usage |
|----------|--------|-------|
| `emitToUser(io, userId, event, data)` | Single user | Notifications, approval requests |
| `emitToRole(io, role, event, data)` | All users with role | SLA alerts, low-stock alerts |
| `emitToDocument(io, docId, event, data)` | Users watching document | Collaborative editing |
| `emitEntityEvent(io, event, data)` | Roles with `read` permission on entity | Smart role-scoped broadcasts |

#### Events Emitted

| Event | Trigger | Recipients |
|-------|---------|------------|
| `notification:new` | New notification created | Target user |
| `approval:requested` | Document submitted for approval | Users with approver role |
| `approval:approved` | Document fully approved | Document creator + relevant roles |
| `approval:rejected` | Document rejected | Document creator |
| `document:status` | Any status change | Roles with `read` on document type |
| `inventory:low_stock` | Stock below threshold | warehouse_staff, admin |
| `sla:breached` | SLA deadline missed | Relevant approver role + admin |
| `sla:warning` | SLA deadline within 1 hour | Relevant approver role |
| `auth:expired` | JWT expired on active connection | Connected user |

#### RBAC-Scoped Broadcasting

`emitEntityEvent()` automatically resolves which roles have `read` permission on a document type using the RBAC matrix. For example, a GRN status change only reaches `admin`, `manager`, `warehouse_supervisor`, `warehouse_staff`, `logistics_coordinator`, and `transport_supervisor` — not `site_engineer` or `qc_officer` who lack GRN read access.

### 9.22 Email System

#### Architecture

```
Email Pipeline:
  Business Event (e.g. approval requested)
    ↓
  sendTemplatedEmail({ templateCode, to, variables })
    ↓
  1. Fetch EmailTemplate from DB by code
  2. Check template.isActive (skip if inactive)
  3. Resolve recipients:
     ├── Direct email: "john@nit.sa"
     ├── Array: ["john@nit.sa", "ahmed@nit.sa"]
     └── Role-based: "role:manager" → all active employees with that systemRole
  4. Compile Handlebars template ONCE (subject + body)
  5. For each recipient:
     ├── Create EmailLog (status: 'queued', bodyHtml: rendered HTML)
     └── Attempt immediate send via Resend API
         ├── Success → EmailLog.status = 'sent', externalId saved
         └── Failure → EmailLog.status = 'queued' (retry later)
```

#### Email Provider

- **Resend API** — modern email delivery service
- From address: `NIT Logistics <noreply@nit.sa>` (configurable via env)
- Lazy client initialization (only when first email sent)

#### Template System

```
EmailTemplate (stored in DB)
├── code: unique template identifier (e.g. 'password_reset', 'approval_needed')
├── subject: Handlebars template for subject line
├── bodyHtml: Handlebars template for email body
├── isActive: can disable without deletion
└── language: template language (en/ar)

Example:
  code: 'password_reset'
  subject: 'Password Reset Code — {{fullName}}'
  bodyHtml: '<h1>Your reset code: {{code}}</h1><p>Expires in {{expiryMinutes}} minutes.</p>'
```

**Template Preview**: `previewTemplate(bodyHtml, subject, variables)` renders templates without sending — used for admin template editor.

#### Retry Queue

```
Retry Configuration:
  MAX_RETRIES = 3           — max attempts per email
  BATCH_SIZE = 50           — max emails processed per retry run
  Retry interval: 2 min     — scheduler calls processQueuedEmails()

processQueuedEmails():
  1. Fetch EmailLog records with status='queued' AND retryCount < 3
  2. For each: re-send using stored rendered HTML (no template re-compilation needed)
  3. On success: status → 'sent'
  4. On failure: retryCount++, if retryCount ≥ 3 → status = 'failed'
  5. Rate limit delay: 200ms between sends if batch > 10
```

#### Audit Trail

Every email is logged in `EmailLog`:
| Field | Description |
|-------|-------------|
| `templateId` | Which template was used |
| `toEmail` | Recipient address |
| `subject` | Rendered subject line |
| `bodyHtml` | Fully rendered HTML (for retry) |
| `status` | `queued` → `sent` / `failed` |
| `externalId` | Resend API message ID |
| `sentAt` | Successful delivery timestamp |
| `error` | Error message (if failed) |
| `retryCount` | Number of send attempts |
| `referenceTable/referenceId` | Link to triggering document |

### 9.23 Background Job Scheduler

#### Architecture

The scheduler uses **simple `setInterval`-based loops** (no external dependencies like node-cron or Bull) with Redis-based distributed locks to ensure single-execution across multiple backend instances.

```
Scheduler Lifecycle:
  startScheduler(io: SocketIOServer)
    ├── Registers 8 background jobs as sequential loops
    ├── Each loop: acquire Redis lock → run job → wait interval → repeat
    ├── Lock prevents duplicate execution across multiple server instances
    └── Initial checks run 10s after startup

  stopScheduler()
    ├── Sets running = false
    └── Clears all timers
```

#### Distributed Locking

```typescript
acquireLock(lockName, ttlSec):
  Redis SET scheduler:lock:{lockName} {pid} EX {ttl} NX
  ├── Returns true if acquired (NX = only if not exists)
  ├── TTL auto-releases lock (prevents deadlocks)
  └── Falls back to true if Redis unavailable (single-instance mode)
```

#### Registered Jobs

| Job | Interval | Lock TTL | Description |
|-----|----------|----------|-------------|
| **SLA Breach Detection** | 5 min | 4 min | Checks 7 SLA types for overdue items |
| **SLA Warning Detection** | 5 min | 4 min | Checks 7 SLA types for items due within 1 hour |
| **Email Retry** | 2 min | 90 sec | Processes queued emails (up to 50 per batch) |
| **Expired Lot Marking** | 1 hour | 50 min | Sets InventoryLot.status = 'expired' for past-expiry lots |
| **Low Stock Alert** | 30 min | 25 min | Raw SQL query for items below minLevel/reorderPoint |
| **Token Cleanup** | 6 hours | 5 hours | Deletes expired RefreshToken records |
| **ABC Classification** | 7 days | 6 days | Recalculates A/B/C classes for all items |
| **Cycle Count Auto-Create** | 24 hours | 23 hours | Creates scheduled cycle counts based on ABC classes |

#### SLA Breach Detection — 7 Monitored Processes

| SLA Type | Document | Trigger Condition | Notified Roles |
|----------|----------|-------------------|----------------|
| **Approval SLA** | MI, JO | `status = 'pending_approval'` AND `slaDueDate < now` | Pending approver role + admin |
| **Stock Verification** | MR | `status = 'approved'` AND `stockVerificationSla < now` (or approvalDate + 4h) | warehouse_staff + admin |
| **JO Execution** | JO | `JoSlaTracking.slaDueDate < now` AND `slaMet = null` | logistics_coordinator + admin |
| **Gate Pass** | Gate Pass | `status IN ('pending','approved')` AND `createdAt + 24h < now` | warehouse_staff + warehouse_supervisor + admin |
| **Scrap Buyer Pickup** | Scrap Item | `status = 'sold'` AND `buyerPickupDeadline < now` (or updatedAt + 10 days) | scrap_committee_member + admin |
| **Surplus Timeout** | Surplus | `status IN ('identified','evaluated')` AND `ouHeadApprovalDate + 14 days < now` | manager + admin |
| **QCI Inspection** | QCI | `status IN ('pending','in_progress')` AND `createdAt + 14 days < now` | qc_officer + admin |

**Deduplication**: Before creating a breach notification, the scheduler checks if a notification with the same `referenceTable`, `referenceId`, and title fragment was already created within the last hour (`hasRecentNotification()`).

**SLA Warnings**: Same 7 SLA types, but checks for items where the deadline is within the **next hour** (not yet breached but imminent). Warnings are sent to the responsible role only (not escalated to admin).

#### Low Stock Alert (Raw SQL)

The scheduler runs a raw SQL query for performance:
```sql
SELECT il.item_id, il.warehouse_id, il.qty_on_hand, il.qty_reserved,
       il.min_level, il.reorder_point, i.item_code, w.warehouse_code
FROM inventory_levels il
JOIN items i ON i.id = il.item_id
JOIN warehouses w ON w.id = il.warehouse_id
WHERE il.alert_sent = false
  AND ((il.min_level IS NOT NULL AND (il.qty_on_hand - il.qty_reserved) <= il.min_level)
   OR  (il.reorder_point IS NOT NULL AND (il.qty_on_hand - il.qty_reserved) <= il.reorder_point))
LIMIT 100
```
- Batch-marks `alert_sent = true` to prevent repeated alerts
- Notifies all warehouse_staff and admin with a summary of affected items
- `alert_sent` is reset to `false` when new stock arrives (in `addStock()`)

### 9.24 Event Bus — Full Catalog

The system defines **18 event types** across 6 categories, used by the Workflow Engine, Socket.IO, and audit logging:

| Category | Event | Constant | Description |
|----------|-------|----------|-------------|
| **Document** | `document:created` | `DOCUMENT_EVENTS.CREATED` | New document created |
| | `document:updated` | `DOCUMENT_EVENTS.UPDATED` | Document modified |
| | `document:deleted` | `DOCUMENT_EVENTS.DELETED` | Document deleted |
| | `document:status_changed` | `DOCUMENT_EVENTS.STATUS_CHANGED` | Status transition (e.g. draft → pending) |
| **Approval** | `approval:requested` | `APPROVAL_EVENTS.REQUESTED` | Document submitted for approval |
| | `approval:approved` | `APPROVAL_EVENTS.APPROVED` | Document approved (all levels passed) |
| | `approval:rejected` | `APPROVAL_EVENTS.REJECTED` | Document rejected at any level |
| **Inventory** | `inventory:updated` | `INVENTORY_EVENTS.UPDATED` | Stock quantities changed |
| | `inventory:low_stock` | `INVENTORY_EVENTS.LOW_STOCK` | Item below reorder point |
| | `inventory:reserved` | `INVENTORY_EVENTS.RESERVED` | Stock reserved for MI |
| | `inventory:released` | `INVENTORY_EVENTS.RELEASED` | Reserved stock released back |
| **SLA** | `sla:at_risk` | `SLA_EVENTS.AT_RISK` | Approaching SLA deadline |
| | `sla:breached` | `SLA_EVENTS.BREACHED` | SLA deadline missed |
| | `sla:warning` | `SLA_EVENTS.WARNING` | Deadline within next hour |
| **Job Order** | `jo:assigned` | `JO_EVENTS.ASSIGNED` | JO assigned to supplier/team |
| | `jo:completed` | `JO_EVENTS.COMPLETED` | JO marked completed |
| **User** | `user:login` | `USER_EVENTS.LOGIN` | User logged in |
| | `user:password_reset` | `USER_EVENTS.PASSWORD_RESET` | Password reset requested |

All event types are exported as `SystemEventType` union type for type-safe usage.

---

## 10. Reports & Dashboards

### 10.1 Dashboard Builder

User-configurable dashboards with drag-and-drop widgets:

```
Dashboard
├── name, description
├── ownerId: creator
├── defaultForRole: auto-assigned to users with this role
├── isPublic: shared with all users
└── widgets: DashboardWidget[]
    ├── widgetType: kpi | chart | table | list | activity | status_count
    ├── title: display name
    ├── dataSource: e.g. 'stats/projects', 'grouped/jo_by_status'
    ├── queryConfig: JSON filters, date range, groupBy, limit
    ├── displayConfig: colors, chart type, columns
    └── gridPosition: { col, row, colSpan, rowSpan }
```

### 10.2 Saved Reports

```
SavedReport
├── dataSource: entity type (e.g. 'mrrv', 'jo', 'inventory')
├── columns: JSON column definitions
├── filters: JSON filter configuration
├── visualization: table | bar | line | pie
└── isPublic: shared or private
```

### 10.3 Role-Based Default Dashboards

| Role | Dashboard Focus |
|------|----------------|
| Admin | System-wide KPIs, approval bottlenecks, SLA performance |
| Manager | Project performance, budget utilization, pending approvals |
| Warehouse Supervisor | Inventory levels, low-stock alerts, receipt/issue activity |
| Warehouse Staff | Pending GRNs, pending issues, bin card discrepancies |
| Logistics Coordinator | Shipment tracking, JO status, customs pipeline |
| Site Engineer | MR status, MI delivery timeline, project inventory |
| QC Officer | QCI backlog, inspection results, DR tracking |
| Transport Supervisor | Transport JOs, fleet status, route optimization |
| Scrap Committee Member | Scrap pipeline, SSC bids, disposal progress |

### 10.4 Widget Data Sources (59 Services)

The `widget-data.service.ts` aggregates data from all 59 backend services for dashboard consumption.

---

## 11. Appendices

### 11.1 V1 → V2 Naming Map

| V1 Internal Name | V2 Display Name | Prisma Model | API Endpoint | Validator |
|------------------|-----------------|--------------|--------------|-----------|
| MRRV | GRN (Goods Receipt Note) | Mrrv | `/grn` | validateGRN |
| MIRV | MI (Material Issue) | Mirv | `/mi` | validateMI |
| MRV | MRN (Material Return Note) | Mrv | `/mrn` | validateMRN |
| MRF | MR (Material Requisition) | MaterialRequisition | `/mr` | validateMR |
| RFIM | QCI (Quality Control Inspection) | Rfim | `/qci` | validateQCI |
| OSD | DR (Discrepancy Report) | OsdReport | `/dr` | validateDR |
| Stock Transfer | WT (Warehouse Transfer) | StockTransfer | `/wt` | — |

### 11.2 Document Prefixes (Auto-Number Format)

| Document | Prefix | Format Example |
|----------|--------|---------------|
| GRN | GRN | GRN-2026-0001 |
| QCI | QCI | QCI-2026-0001 |
| DR | DR | DR-2026-0001 |
| MI | MI | MI-2026-0001 |
| MRN | MRN | MRN-2026-0001 |
| MR | MR | MR-2026-0001 |
| WT | WT | WT-2026-0001 |
| IMSF | IMSF | IMSF-2026-0001 |
| JO | JO | JO-2026-0001 |
| Gate Pass | GP | GP-2026-0001 |
| Rental Contract | RC | RC-2026-0001 |
| Scrap | SCR | SCR-2026-0001 |
| Surplus | SUR | SUR-2026-0001 |
| Shipment | SH | SH-2026-0001 |
| Lot | LOT | LOT-2026-0001 |
| Leftover | LO | LO-2026-0001 |
| Cycle Count | CC | CC-2026-0001 |
| ASN | ASN | ASN-2026-0001 |

### 11.3 SLA Configuration

| Process | SLA | Duration |
|---------|-----|----------|
| Stock Verification (MR) | `stock_verification` | 4 hours |
| JO Execution | `jo_execution` | 48 hours |
| QC Inspection | `qc_inspection` | 336 hours (14 days) |
| Gate Pass | `gate_pass` | 24 hours |
| Post-Install Check | `post_install_check` | 48 hours |
| Scrap Buyer Pickup | `scrap_buyer_pickup` | 240 hours (10 days) |
| Surplus Timeout | `surplus_timeout` | 336 hours (14 days) |

### 11.4 Insurance Threshold

Materials or JOs exceeding **7,000,000 SAR** require insurance coverage (`INSURANCE_THRESHOLD_SAR`).

### 11.5 Event Catalog — Full Reference

| Event | Description |
|-------|-------------|
| `document:created` | When a new document is created |
| `document:updated` | When a document is modified |
| `document:deleted` | When a document is deleted |
| `document:status_changed` | When a document status changes (e.g. draft → pending) |
| `approval:requested` | When a document is submitted for approval |
| `approval:approved` | When a document is approved |
| `approval:rejected` | When a document is rejected |
| `inventory:updated` | When inventory quantities change |
| `inventory:low_stock` | When an item falls below its reorder point |
| `inventory:reserved` | When stock is reserved for an issuance |
| `inventory:released` | When reserved stock is released back |
| `sla:at_risk` | When an approval or task is approaching its SLA deadline |
| `sla:breached` | When an SLA deadline has been missed |
| `sla:warning` | When a document SLA deadline is within the next hour |
| `jo:assigned` | When a job order is assigned to a supplier/team |
| `jo:completed` | When a job order is marked completed |
| `user:login` | When a user logs in |
| `user:password_reset` | When a password reset is requested |

### 11.6 Backend Services (59 Total)

| Service | File | Purpose |
|---------|------|---------|
| abc-analysis | abc-analysis.service.ts | ABC inventory classification |
| approval | approval.service.ts | Multi-level approval chains |
| aql | aql.service.ts | Acceptable quality level sampling |
| asn | asn.service.ts | Advance shipping notices |
| attachment | attachment.service.ts | File attachment management |
| audit | audit.service.ts | Audit log creation |
| auth | auth.service.ts | Authentication (JWT + refresh) |
| barcode | barcode.service.ts | Barcode generation/scanning |
| bulk | bulk.service.ts | Bulk data operations |
| comment | comment.service.ts | Document comments |
| cross-dock | cross-dock.service.ts | Cross-docking operations |
| cycle-count | cycle-count.service.ts | Cycle counting |
| delegation | delegation.service.ts | Approval delegation |
| demand-forecast | demand-forecast.service.ts | Material demand prediction |
| document-number | document-number.service.ts | Auto-number generation |
| dr / osd | dr.service.ts / osd.service.ts | Discrepancy reports |
| email | email.service.ts | Email template rendering & sending |
| gate-pass | gate-pass.service.ts | Gate pass management |
| generator-fuel | generator-fuel.service.ts | Fuel consumption logs |
| generator-maintenance | generator-maintenance.service.ts | Maintenance scheduling |
| grn / mrrv | grn.service.ts / mrrv.service.ts | Goods receipt |
| handover | handover.service.ts | Storekeeper handover |
| imsf | imsf.service.ts | Inter-project material shifting |
| import | import.service.ts | Data import/migration |
| inspection-checklist | inspection-checklist.service.ts | QCI checklists |
| inventory | inventory.service.ts | FIFO stock operations |
| job-order | job-order.service.ts | Job order lifecycle |
| labor-productivity | labor-productivity.service.ts | Workforce metrics |
| mi / mirv | mi.service.ts / mirv.service.ts | Material issue |
| mr / mrf | mr.service.ts / mrf.service.ts | Material requisition |
| mrn / mrv | mrn.service.ts / mrv.service.ts | Material return |
| notification | notification.service.ts | In-app notifications |
| parallel-approval | parallel-approval.service.ts | Committee approvals |
| pick-optimizer | pick-optimizer.service.ts | Pick path optimization |
| push-notification | push-notification.service.ts | Web push delivery |
| putaway-rules | putaway-rules.service.ts | Bin assignment rules |
| qci / rfim | qci.service.ts / rfim.service.ts | Quality inspection |
| rental-contract | rental-contract.service.ts | Equipment rental |
| route-optimizer | route-optimizer.service.ts | Delivery route planning |
| scheduler | scheduler.service.ts | SLA monitoring & cron jobs |
| scrap | scrap.service.ts | Scrap disposal lifecycle |
| sensor | sensor.service.ts | IoT sensor management |
| shipment | shipment.service.ts | Cargo tracking |
| slotting-optimizer | slotting-optimizer.service.ts | Warehouse item placement |
| ssc | ssc.service.ts | Scrap Selling Committee |
| stock-transfer / wt | stock-transfer.service.ts / wt.service.ts | Warehouse transfer |
| surplus | surplus.service.ts | Surplus item management |
| tool | tool.service.ts | Tool registry |
| tool-issue | tool-issue.service.ts | Tool issue/return |
| wave-picking | wave-picking.service.ts | Pick wave grouping |
| widget-data | widget-data.service.ts | Dashboard data aggregation |
| yard | yard.service.ts | Yard & dock management |

---

### 11.7 Triple-Layer Notification System

Every system notification is delivered through three channels simultaneously:

```
Event Trigger (e.g. approval requested)
    ↓
createNotification(params, io?)
    ↓
Layer 1: DATABASE PERSISTENCE
    ├── Notification record created in DB
    ├── Fields: recipientId, title, titleAr, body, notificationType, referenceTable, referenceId
    ├── Includes recipient name/email (for display)
    └── Always persisted (even if other layers fail)
    ↓
Layer 2: SOCKET.IO REAL-TIME
    ├── If io server available: emitToUser(io, recipientId, 'notification:new', notification)
    ├── Delivered instantly if user is online
    └── Missed notifications recovered from DB on next page load
    ↓
Layer 3: WEB PUSH (Fire-and-Forget)
    ├── sendPushToUser(recipientId, { title, body, url, tag })
    ├── url = /{referenceTable}/{referenceId} (or '/notifications' if no reference)
    ├── tag = notificationType (collapses same-type notifications)
    ├── .catch(() => {}) — silently ignores push failures
    └── Reaches user even if app is closed (native OS notification)
```

**Notification Management API:**
| Endpoint | Function | Description |
|----------|----------|-------------|
| `GET /notifications` | `getNotifications()` | Paginated list with unreadOnly filter |
| `GET /notifications/unread-count` | `getUnreadCount()` | Badge counter for UI |
| `PUT /notifications/:id/read` | `markAsRead()` | Mark single as read (ownership verified) |
| `PUT /notifications/read-all` | `markAllAsRead()` | Batch mark all unread → read |
| `DELETE /notifications/:id` | `deleteNotification()` | Delete single (ownership verified) |

### 11.8 API Security Model

| Layer | Mechanism | Implementation |
|-------|-----------|----------------|
| **Authentication** | JWT Bearer Token | `Authorization: Bearer <accessToken>` in all requests |
| **Token Blacklisting** | Redis SET NX | `bl:{jti}` key checked on every request |
| **Token Rotation** | Refresh → new pair | Old refresh token deleted, new one created |
| **RBAC** | `hasPermission(role, resource, permission)` | Checked in middleware before route handler |
| **Rate Limiting** | Express middleware | Per-IP limits for auth endpoints |
| **Socket Rate Limiting** | In-memory per-socket | 30 events / 10 seconds |
| **Input Validation** | Zod schemas | All request bodies validated at route level |
| **SQL Injection** | Prisma ORM | Parameterized queries by default |
| **Optimistic Locking** | `version` field | InventoryLevel concurrent access protection |

---

*Document generated from source code analysis of NIT Supply Chain System V2 codebase.*
*All data models, state machines, validators, permissions, and business logic are extracted directly from the Prisma schema, shared package constants, and backend service implementations.*
*Enhanced with detailed service implementations, authentication architecture, email pipeline, push notification system, background scheduler, and Socket.IO real-time architecture.*
