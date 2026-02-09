# API Reference - NIT Supply Chain Management System

**Version:** 1.0
**Base URL:** `http://localhost:4000/api` (Development) | `https://your-domain.com/api` (Production)
**Date:** 2026-02-08
**Company:** Nesma Infrastructure & Technology (NIT) - Saudi Arabia

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Standard Response Format](#standard-response-format)
4. [Error Handling](#error-handling)
5. [Authentication Endpoints](#authentication-endpoints)
6. [Master Data Endpoints](#master-data-endpoints)
7. [Material Management](#material-management)
8. [Logistics Operations](#logistics-operations)
9. [Dashboard & Reporting](#dashboard--reporting)
10. [System Endpoints](#system-endpoints)

---

## Overview

The NIT Supply Chain API is a RESTful API that provides comprehensive warehouse management, logistics coordination, and material tracking capabilities. The API follows standard REST conventions with JSON request/response formats.

### Key Features
- JWT-based authentication
- Role-based access control (RBAC)
- Real-time WebSocket notifications
- Pagination and filtering
- Audit trail for all operations
- Rate limiting (200 requests/minute)

### Technology Stack
- **Runtime:** Node.js with Express 5
- **Database:** PostgreSQL via Prisma ORM
- **Real-time:** Socket.IO
- **Authentication:** JWT with refresh tokens

---

## Authentication

All API endpoints require authentication unless otherwise specified. Authentication uses JWT (JSON Web Tokens).

### Authentication Flow

1. **Login:** Send credentials to `/api/auth/login`
2. **Receive tokens:** Get `accessToken` (1 hour) and `refreshToken` (7 days)
3. **Use access token:** Include in `Authorization` header for all requests
4. **Refresh token:** Use `/api/auth/refresh` when access token expires

### Authorization Header Format

```http
Authorization: Bearer <your_access_token>
```

### System Roles

The system supports 8 roles with different permission levels:

| Role | Code | Description |
|------|------|-------------|
| Administrator | `admin` | Full system access |
| Manager | `manager` | Management-level operations |
| Warehouse Supervisor | `warehouse_supervisor` | Warehouse operations oversight |
| Warehouse Staff | `warehouse_staff` | Day-to-day warehouse tasks |
| Logistics Coordinator | `logistics_coordinator` | Job order and transport management |
| Site Engineer | `site_engineer` | Project-level material requests |
| QC Officer | `qc_officer` | Quality control and inspection |
| Freight Forwarder | `freight_forwarder` | Shipment tracking |

---

## Standard Response Format

### Success Response

```json
{
  "success": true,
  "data": { /* response data */ },
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100
  }
}
```

### Pagination Parameters

All list endpoints support the following query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-indexed) |
| `pageSize` | integer | 20 | Items per page (max 100) |
| `sortBy` | string | varies | Field name to sort by |
| `sortDir` | string | `asc` | Sort direction: `asc` or `desc` |
| `search` | string | - | Search term (varies by endpoint) |

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE"
}
```

### Standard Error Codes

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Request validation failed |
| 400 | `FK_VIOLATION` | Foreign key constraint violation |
| 401 | `UNAUTHORIZED` | Authentication required or failed |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `DUPLICATE_ENTRY` | Unique constraint violation |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

---

## Authentication Endpoints

### Base Path: `/api/auth`

All authentication endpoints are public (no auth required).

---

#### POST `/api/auth/login`

Authenticate user and receive access and refresh tokens.

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "John Doe",
      "systemRole": "warehouse_supervisor"
    },
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

**Error (401 Unauthorized):**

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

---

#### POST `/api/auth/refresh`

Refresh access token using refresh token.

**Request Body:**

```json
{
  "refreshToken": "eyJhbGci..."
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGci...",
    "refreshToken": "eyJhbGci..."
  }
}
```

---

#### GET `/api/auth/me`

Get current authenticated user information.

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "employeeIdNumber": "EMP001",
    "fullName": "John Doe",
    "email": "john@nit.com",
    "systemRole": "warehouse_supervisor",
    "department": "warehouse",
    "assignedProject": { /* project details */ },
    "assignedWarehouse": { /* warehouse details */ }
  }
}
```

---

#### POST `/api/auth/change-password`

Change password for current user.

**Authentication:** Required

**Request Body:**

```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword456"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Password changed successfully"
  }
}
```

---

#### POST `/api/auth/forgot-password`

Request password reset code via email.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "If an account with that email exists, a reset code has been sent."
  }
}
```

**Note:** Returns success even if email doesn't exist (security best practice).

---

#### POST `/api/auth/reset-password`

Reset password using 6-digit code.

**Request Body:**

```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "newPassword456"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Password has been reset successfully."
  }
}
```

---

#### POST `/api/auth/logout`

Logout (client-side token deletion, server acknowledges).

**Authentication:** Required

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## Master Data Endpoints

### Base Path: `/api`

All master data endpoints follow the CRUD factory pattern with consistent routes.

**Authentication:** All endpoints require authentication
**Write Permissions:** Create, Update, Delete operations restricted to `admin` and `manager` roles

### Standard CRUD Pattern

Each master data entity follows this pattern:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/{entity}` | List all records (with pagination) |
| GET | `/{entity}/:id` | Get single record by ID |
| POST | `/{entity}` | Create new record |
| PUT | `/{entity}/:id` | Update existing record |
| DELETE | `/{entity}/:id` | Delete record |

---

### Lookup Tables

#### 1. Regions - `/api/regions`

Administrative regions in Saudi Arabia.

**List Example:**

```http
GET /api/regions?page=1&pageSize=20&search=riyadh
```

**Create Example:**

```json
POST /api/regions
{
  "regionName": "Riyadh Region",
  "regionNameAr": "منطقة الرياض"
}
```

**Search Fields:** `regionName`, `regionNameAr`

---

#### 2. Cities - `/api/cities`

Cities within regions.

**Create Example:**

```json
POST /api/cities
{
  "cityName": "Riyadh",
  "cityNameAr": "الرياض",
  "regionId": "uuid"
}
```

**Includes:** `region`
**Search Fields:** `cityName`, `cityNameAr`

---

#### 3. Ports - `/api/ports`

Ports of entry (sea, air, land).

**Create Example:**

```json
POST /api/ports
{
  "portName": "King Abdulaziz Port",
  "portCode": "JEDDAH",
  "cityId": "uuid",
  "portType": "sea"
}
```

**Port Types:** `sea`, `air`, `land`
**Includes:** `city`
**Search Fields:** `portName`, `portCode`

---

#### 4. Units of Measure - `/api/uoms`

Standard units of measurement.

**Create Example:**

```json
POST /api/uoms
{
  "uomCode": "EA",
  "uomName": "Each",
  "uomNameAr": "قطعة",
  "category": "quantity"
}
```

**Search Fields:** `uomCode`, `uomName`

---

#### 5. Warehouse Types - `/api/warehouse-types`

Warehouse classifications.

**Search Fields:** `typeName`

---

#### 6. Equipment Categories - `/api/equipment-categories`

Equipment groupings.

**Search Fields:** `categoryName`

---

#### 7. Equipment Types - `/api/equipment-types`

Specific equipment types.

**Includes:** `category`
**Search Fields:** `typeName`

---

### Core Master Data

#### 8. Projects - `/api/projects`

Construction projects and sites.

**Create Example:**

```json
POST /api/projects
{
  "projectCode": "PRJ-2026-001",
  "projectName": "New Highway Construction",
  "projectNameAr": "إنشاء طريق سريع جديد",
  "client": "Ministry of Transport",
  "entityId": "uuid",
  "regionId": "uuid",
  "cityId": "uuid",
  "projectManagerId": "uuid",
  "status": "active",
  "startDate": "2026-01-01",
  "endDate": "2027-12-31",
  "budget": 50000000.00,
  "description": "Highway construction project"
}
```

**Status Values:** `active`, `on_hold`, `completed`, `cancelled`
**Includes:** `region`, `city`
**Search Fields:** `projectCode`, `projectName`, `client`

---

#### 9. Employees - `/api/employees`

System users and employees.

**Create Example:**

```json
POST /api/employees
{
  "employeeIdNumber": "EMP001",
  "fullName": "John Doe",
  "fullNameAr": "جون دو",
  "email": "john@nit.com",
  "phone": "+966501234567",
  "department": "warehouse",
  "role": "Warehouse Supervisor",
  "systemRole": "warehouse_supervisor",
  "assignedProjectId": "uuid",
  "assignedWarehouseId": "uuid",
  "managerId": "uuid",
  "isActive": true,
  "hireDate": "2025-01-01",
  "passwordHash": "hashed_password"
}
```

**System Roles:** `admin`, `manager`, `warehouse_supervisor`, `warehouse_staff`, `logistics_coordinator`, `site_engineer`, `qc_officer`, `freight_forwarder`
**Departments:** `logistics`, `warehouse`, `transport`, `projects`, `quality`, `finance`, `admin`
**Search Fields:** `fullName`, `email`, `employeeIdNumber`

---

#### 10. Suppliers - `/api/suppliers`

Suppliers, vendors, and freight forwarders.

**Create Example:**

```json
POST /api/suppliers
{
  "supplierCode": "SUP001",
  "supplierName": "ABC Trading Co.",
  "supplierNameAr": "شركة ABC التجارية",
  "types": ["material_supplier", "freight_forwarder"],
  "contactPerson": "Ahmed Ali",
  "phone": "+966501234567",
  "email": "contact@abc.com",
  "address": "123 Main St, Riyadh",
  "cityId": "uuid",
  "crNumber": "1234567890",
  "vatNumber": "300123456700003",
  "rating": 4,
  "status": "active",
  "paymentTerms": "Net 30"
}
```

**Status Values:** `active`, `inactive`, `blocked`
**Rating:** 1-5 stars
**Search Fields:** `supplierCode`, `supplierName`

---

#### 11. Warehouses - `/api/warehouses`

Warehouse and storage locations.

**Create Example:**

```json
POST /api/warehouses
{
  "warehouseCode": "WH-RYD-001",
  "warehouseName": "Riyadh Main Warehouse",
  "warehouseNameAr": "مستودع الرياض الرئيسي",
  "warehouseTypeId": "uuid",
  "projectId": "uuid",
  "regionId": "uuid",
  "cityId": "uuid",
  "address": "Industrial Area, Riyadh",
  "managerId": "uuid",
  "contactPhone": "+966501234567",
  "status": "active",
  "latitude": 24.7136,
  "longitude": 46.6753
}
```

**Status Values:** `active`, `inactive`, `closed`
**Includes:** `warehouseType`, `region`, `city`
**Search Fields:** `warehouseCode`, `warehouseName`

---

#### 12. Items - `/api/items`

Material and item master catalog.

**Create Example:**

```json
POST /api/items
{
  "itemCode": "MAT-001",
  "itemDescription": "Cement Portland Type I - 50kg Bag",
  "itemDescriptionAr": "أسمنت بورتلاند نوع I - كيس 50 كجم",
  "category": "construction",
  "subCategory": "cement",
  "uomId": "uuid",
  "minStock": 100.0,
  "reorderPoint": 200.0,
  "standardCost": 25.50,
  "barcode": "1234567890123",
  "isSerialized": false,
  "isExpirable": false,
  "status": "active"
}
```

**Categories:** `construction`, `electrical`, `mechanical`, `safety`, `tools`, `consumables`, `spare_parts`
**Status Values:** `active`, `inactive`, `discontinued`
**Includes:** `uom`
**Search Fields:** `itemCode`, `itemDescription`

---

#### 13. Generators - `/api/generators`

Generator asset register.

**Create Example:**

```json
POST /api/generators
{
  "generatorCode": "GEN-001",
  "generatorName": "Caterpillar 500 KVA",
  "capacityKva": 500,
  "equipmentTypeId": "uuid",
  "currentProjectId": "uuid",
  "currentWarehouseId": "uuid",
  "status": "available",
  "purchaseDate": "2024-01-01",
  "purchaseValue": 250000.00,
  "salvageValue": 50000.00,
  "usefulLifeMonths": 120,
  "depreciationMethod": "straight_line",
  "inServiceDate": "2024-02-01",
  "hoursTotal": 0.0
}
```

**Status Values:** `available`, `assigned`, `maintenance`, `decommissioned`
**Depreciation Methods:** `straight_line`, `usage_based`
**Search Fields:** `generatorCode`, `generatorName`

---

#### 14. Equipment Fleet - `/api/equipment-fleet`

Vehicle and heavy equipment fleet.

**Search Fields:** `vehicleCode`, `vehicleType`, `plateNumber`

---

#### 15. Supplier Rates - `/api/supplier-rates`

Supplier equipment rental rate cards.

**Includes:** `supplier`, `equipmentType`

---

#### 16. Inventory Levels - `/api/inventory`

Real-time inventory quantities per item per warehouse.

**Includes:** `item`, `warehouse`

---

#### 17. Customs Tracking - `/api/customs`

Customs clearance stage tracking.

**Includes:** `shipment`
**Search Fields:** `customsDeclaration`, `customsRef`

---

## Material Management

### MRRV (Material Receiving Report Voucher)

**Base Path:** `/api/mrrv`
**Authentication:** Required
**Write Permissions:** `admin`, `manager`, `warehouse_supervisor`, `warehouse_staff`

---

#### GET `/api/mrrv`

List all MRRVs with pagination and filtering.

**Query Parameters:**
- Standard pagination params
- `status` - Filter by status

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "mrrvNumber": "MRRV-2026-0001",
      "supplier": {
        "id": "uuid",
        "supplierName": "ABC Trading",
        "supplierCode": "SUP001"
      },
      "warehouse": { /* warehouse details */ },
      "project": { /* project details */ },
      "receivedBy": { /* employee details */ },
      "receiveDate": "2026-02-08T10:00:00Z",
      "status": "draft",
      "totalValue": 15000.00,
      "_count": {
        "mrrvLines": 5
      }
    }
  ],
  "pagination": { /* pagination info */ }
}
```

---

#### GET `/api/mrrv/:id`

Get single MRRV with full details including line items.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "mrrvNumber": "MRRV-2026-0001",
    "supplierId": "uuid",
    "poNumber": "PO-123",
    "warehouseId": "uuid",
    "projectId": "uuid",
    "receivedById": "uuid",
    "receiveDate": "2026-02-08T10:00:00Z",
    "invoiceNumber": "INV-456",
    "deliveryNote": "DN-789",
    "totalValue": 15000.00,
    "rfimRequired": true,
    "hasOsd": false,
    "status": "draft",
    "notes": "Regular delivery",
    "mrrvLines": [
      {
        "id": "uuid",
        "itemId": "uuid",
        "item": { /* item details */ },
        "qtyOrdered": 100.0,
        "qtyReceived": 100.0,
        "qtyDamaged": 0.0,
        "uomId": "uuid",
        "uom": { /* uom details */ },
        "unitCost": 150.00,
        "condition": "good",
        "storageLocation": "A-01-05",
        "expiryDate": null,
        "notes": null
      }
    ],
    "supplier": { /* full supplier details */ },
    "warehouse": { /* full warehouse details */ },
    "project": { /* full project details */ },
    "receivedBy": { /* full employee details */ },
    "qcInspector": null,
    "rfims": [],
    "osdReports": []
  }
}
```

---

#### POST `/api/mrrv`

Create new MRRV.

**Request Body:**

```json
{
  "supplierId": "uuid",
  "poNumber": "PO-123",
  "warehouseId": "uuid",
  "projectId": "uuid",
  "receiveDate": "2026-02-08T10:00:00Z",
  "invoiceNumber": "INV-456",
  "deliveryNote": "DN-789",
  "rfimRequired": true,
  "notes": "Regular delivery",
  "lines": [
    {
      "itemId": "uuid",
      "qtyOrdered": 100.0,
      "qtyReceived": 100.0,
      "qtyDamaged": 0.0,
      "uomId": "uuid",
      "unitCost": 150.00,
      "condition": "good",
      "storageLocation": "A-01-05",
      "expiryDate": null,
      "notes": null
    }
  ]
}
```

**Response (201 Created):**

Returns created MRRV with auto-generated `mrrvNumber`.

**Business Rules:**
- Auto-calculates `totalValue` from line items
- Sets `hasOsd` flag if any line has `qtyDamaged > 0`
- Creates with `status: 'draft'`
- Auto-generates document number: `MRRV-YYYY-NNNN`

---

#### PUT `/api/mrrv/:id`

Update MRRV header (draft only).

**Restriction:** Only MRRVs with `status: 'draft'` can be updated.

---

#### POST `/api/mrrv/:id/submit`

Submit MRRV for QC approval.

**Restriction:** Only `draft` MRRVs can be submitted.

**Business Logic:**
- Changes status to `pending_qc`
- Auto-creates RFIM if `rfimRequired: true`
- Auto-creates OSD if any line has `qtyDamaged > 0`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending_qc"
  }
}
```

---

#### POST `/api/mrrv/:id/approve-qc`

QC approve MRRV.

**Permissions:** `admin`, `manager`, `warehouse_supervisor`
**Restriction:** Only `pending_qc` MRRVs can be QC approved.

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "qc_approved",
    "qcInspectorId": "uuid",
    "qcApprovedDate": "2026-02-08T12:00:00Z"
  }
}
```

---

#### POST `/api/mrrv/:id/receive`

Mark MRRV as received.

**Restriction:** Only `qc_approved` MRRVs can be received.

---

#### POST `/api/mrrv/:id/store`

Mark MRRV as stored and add inventory.

**Restriction:** Only `received` MRRVs can be stored.

**Business Logic:**
- Changes status to `stored`
- For each line: adds `(qtyReceived - qtyDamaged)` to inventory
- Creates inventory lots with FIFO tracking
- Updates `inventory_levels` table

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "stored"
  }
}
```

---

### MIRV (Material Issue Report Voucher)

**Base Path:** `/api/mirv`
**Authentication:** Required

---

#### GET `/api/mirv`

List MIRVs with pagination and filtering.

**Query Parameters:**
- Standard pagination params
- `status` - Filter by status

---

#### GET `/api/mirv/:id`

Get single MIRV with line items.

---

#### POST `/api/mirv`

Create new MIRV.

**Permissions:** `admin`, `manager`, `site_engineer`, `warehouse_supervisor`

**Request Body:**

```json
{
  "projectId": "uuid",
  "warehouseId": "uuid",
  "locationOfWork": "Site A - Building 3",
  "requestDate": "2026-02-08T10:00:00Z",
  "requiredDate": "2026-02-10",
  "priority": "normal",
  "notes": "Materials for concrete work",
  "lines": [
    {
      "itemId": "uuid",
      "qtyRequested": 50.0,
      "notes": null
    }
  ]
}
```

**Priority Values:** `normal`, `urgent`, `emergency`

**Business Rules:**
- Auto-calculates `estimatedValue` from item `standardCost`
- Creates with `status: 'draft'`
- Auto-generates document number: `MIRV-YYYY-NNNN`

---

#### PUT `/api/mirv/:id`

Update MIRV (draft only).

---

#### POST `/api/mirv/:id/submit`

Submit MIRV for approval.

**Restriction:** Only `draft` MIRVs can be submitted.

**Business Logic:**
- Changes status to `pending_approval`
- Submits to approval workflow based on `estimatedValue`
- Creates approval tracking record
- Sets SLA due date

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "pending_approval",
    "approverRole": "manager",
    "slaHours": 24
  }
}
```

---

#### POST `/api/mirv/:id/approve`

Approve MIRV.

**Permissions:** `admin`, `manager`, `warehouse_supervisor`
**Restriction:** Only `pending_approval` MIRVs can be approved.

**Request Body:**

```json
{
  "action": "approve",
  "comments": "Approved for issuance"
}
```

**Action Values:** `approve`, `reject`

**Business Logic (on approve):**
- Changes status to `approved`
- Reserves stock for all line items
- Sets `reservationStatus: 'reserved'`
- Emits socket event: `inventory:reserved`

---

#### POST `/api/mirv/:id/issue`

Issue materials and consume stock.

**Permissions:** `admin`, `warehouse_supervisor`, `warehouse_staff`
**Restriction:** Only `approved` or `partially_issued` MIRVs can be issued.

**Business Logic:**
- Consumes reserved stock using FIFO
- Updates line items with `qtyIssued` and actual `unitCost`
- Changes status to `issued`
- Auto-creates outbound Gate Pass
- Emits socket event: `inventory:updated`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "issued",
    "totalCost": 7500.00
  }
}
```

---

#### POST `/api/mirv/:id/cancel`

Cancel MIRV.

**Permissions:** `admin`, `manager`
**Restriction:** Can cancel from: `approved`, `partially_issued`, `pending_approval`

**Business Logic:**
- Releases all reserved stock
- Changes status to `cancelled`
- Sets `reservationStatus: 'released'`

---

### MRV (Material Return Voucher)

**Base Path:** `/api/mrv`
**Authentication:** Required

---

#### GET `/api/mrv`

List MRVs.

---

#### GET `/api/mrv/:id`

Get single MRV.

---

#### POST `/api/mrv`

Create MRV.

**Permissions:** `admin`, `manager`, `site_engineer`, `warehouse_supervisor`

**Request Body:**

```json
{
  "returnType": "return_to_warehouse",
  "projectId": "uuid",
  "fromWarehouseId": "uuid",
  "toWarehouseId": "uuid",
  "returnDate": "2026-02-08T10:00:00Z",
  "reason": "Excess materials from project",
  "originalMirvId": "uuid",
  "notes": null,
  "lines": [
    {
      "itemId": "uuid",
      "qtyReturned": 20.0,
      "uomId": "uuid",
      "condition": "good",
      "notes": null
    }
  ]
}
```

**Return Types:** `return_to_warehouse`, `return_to_supplier`, `scrap`, `transfer_to_project`
**Condition Values:** `good`, `used`, `damaged`

---

#### PUT `/api/mrv/:id`

Update MRV (draft only).

---

#### POST `/api/mrv/:id/submit`

Submit MRV.

**Restriction:** Only `draft` MRVs can be submitted.

---

#### POST `/api/mrv/:id/receive`

Mark MRV as received.

**Permissions:** `admin`, `warehouse_supervisor`
**Restriction:** Only `pending` MRVs can be received.

---

#### POST `/api/mrv/:id/complete`

Complete MRV and add stock for good items.

**Permissions:** `admin`, `warehouse_supervisor`
**Restriction:** Only `received` MRVs can be completed.

**Business Logic:**
- Changes status to `completed`
- Adds stock for lines with `condition: 'good'`
- Emits socket event: `inventory:updated`

---

### RFIM (Request for Inspection of Materials)

**Base Path:** `/api/rfim`
**Authentication:** Required

---

#### GET `/api/rfim`

List RFIMs.

---

#### GET `/api/rfim/:id`

Get single RFIM with MRRV details.

---

#### PUT `/api/rfim/:id`

Update RFIM (assign inspector, set result).

**Permissions:** `admin`, `manager`, `qc_officer`, `warehouse_supervisor`

---

#### POST `/api/rfim/:id/start`

Start inspection.

**Permissions:** `admin`, `qc_officer`
**Restriction:** Only `pending` RFIMs can be started.

**Business Logic:**
- Changes status to `in_progress`
- Sets `inspectionDate` and `inspectorId`

---

#### POST `/api/rfim/:id/complete`

Complete inspection with result.

**Permissions:** `admin`, `qc_officer`
**Restriction:** Only `in_progress` RFIMs can be completed.

**Request Body:**

```json
{
  "result": "pass",
  "comments": "All items meet quality standards"
}
```

**Result Values:** `pass`, `fail`, `conditional`

**Business Logic:**
- Changes status to `completed`
- Notifies linked MRRV
- Emits socket event: `rfim:completed`

---

### OSD (Over/Short/Damage Report)

**Base Path:** `/api/osd`
**Authentication:** Required

---

#### GET `/api/osd`

List OSD reports.

---

#### GET `/api/osd/:id`

Get single OSD report with line items.

---

#### POST `/api/osd`

Create OSD report.

**Permissions:** `admin`, `manager`, `warehouse_supervisor`, `qc_officer`

**Request Body:**

```json
{
  "mrrvId": "uuid",
  "poNumber": "PO-123",
  "supplierId": "uuid",
  "warehouseId": "uuid",
  "reportDate": "2026-02-08",
  "reportTypes": ["damage"],
  "lines": [
    {
      "itemId": "uuid",
      "uomId": "uuid",
      "mrrvLineId": "uuid",
      "qtyInvoice": 100.0,
      "qtyReceived": 95.0,
      "qtyDamaged": 5.0,
      "damageType": "physical",
      "unitCost": 150.00,
      "notes": "Damaged during transport"
    }
  ]
}
```

**Report Types:** `over`, `short`, `damage` (array)
**Damage Types:** `physical`, `water`, `missing_parts`, `wrong_item`, `expired`, `other`

**Business Rules:**
- Auto-calculates `totalOverValue`, `totalShortValue`, `totalDamageValue`
- Creates with `status: 'draft'`

---

#### PUT `/api/osd/:id`

Update OSD report.

---

#### POST `/api/osd/:id/send-claim`

Send claim to supplier.

**Permissions:** `admin`, `warehouse_supervisor`, `qc_officer`
**Restriction:** Can send from: `draft`, `under_review`

**Request Body:**

```json
{
  "claimReference": "CLAIM-2026-001"
}
```

**Business Logic:**
- Changes status to `claim_sent`
- Sets `claimSentDate`

---

#### POST `/api/osd/:id/resolve`

Resolve OSD report.

**Permissions:** `admin`, `warehouse_supervisor`, `qc_officer`
**Restriction:** Can resolve from: `claim_sent`, `awaiting_response`, `negotiating`

**Request Body:**

```json
{
  "resolutionType": "credit_note",
  "resolutionAmount": 750.00,
  "supplierResponse": "Credit note issued"
}
```

**Resolution Types:** `credit_note`, `replacement`, `price_adjustment`, `insurance_claim`, `write_off`, `returned`

---

## Logistics Operations

### Job Orders

**Base Path:** `/api/job-orders`
**Authentication:** Required

Job Orders support 7 types, each with type-specific details stored in separate tables.

---

#### GET `/api/job-orders`

List Job Orders with filtering.

**Query Parameters:**
- Standard pagination params
- `status` - Filter by status
- `joType` - Filter by job order type
- `projectId` - Filter by project

**Response includes counts:** `approvals`, `payments`, `equipmentLines`

---

#### GET `/api/job-orders/:id`

Get single Job Order with all subtables.

**Response includes:**
- `transportDetails` (for `transport` type)
- `rentalDetails` (for `rental_monthly` and `rental_daily` types)
- `generatorDetails` (for `generator_rental` and `generator_maintenance` types)
- `scrapDetails` (for `scrap` type)
- `equipmentLines` (for `equipment` type)
- `slaTracking`
- `approvals`
- `payments`
- `stockTransfers`
- `shipments`

---

#### POST `/api/job-orders`

Create Job Order with type-specific details.

**Permissions:** `admin`, `manager`, `logistics_coordinator`, `site_engineer`

**Request Body:**

```json
{
  "joType": "transport",
  "entityId": "uuid",
  "projectId": "uuid",
  "supplierId": "uuid",
  "requestDate": "2026-02-08T10:00:00Z",
  "requiredDate": "2026-02-10",
  "priority": "normal",
  "description": "Transport materials from warehouse to site",
  "notes": null,
  "totalAmount": 5000.00,
  "transportDetails": {
    "pickupLocation": "Warehouse A",
    "pickupLocationUrl": "https://maps.google.com/?q=24.7136,46.6753",
    "pickupContactName": "John",
    "pickupContactPhone": "+966501234567",
    "deliveryLocation": "Site B",
    "deliveryLocationUrl": "https://maps.google.com/?q=24.8136,46.7753",
    "deliveryContactName": "Ahmed",
    "deliveryContactPhone": "+966501234568",
    "cargoType": "construction_materials",
    "cargoWeightTons": 25.5,
    "numberOfTrailers": 2,
    "numberOfTrips": 1,
    "includeLoadingEquipment": true,
    "loadingEquipmentType": "forklift",
    "insuranceRequired": true,
    "materialPriceSar": 1000.00
  }
}
```

**Job Order Types:** `transport`, `equipment`, `rental_monthly`, `rental_daily`, `scrap`, `generator_rental`, `generator_maintenance`
**Priority Values:** `low`, `normal`, `high`, `urgent`

**Business Rules:**
- Auto-generates document number: `JO-YYYY-NNNN`
- Creates with `status: 'draft'`
- Creates SLA tracking record

---

#### PUT `/api/job-orders/:id`

Update Job Order base fields (draft only).

---

#### POST `/api/job-orders/:id/submit`

Submit Job Order for approval.

**Restriction:** Only `draft` Job Orders can be submitted.

**Business Logic:**
- Changes status to `pending_approval`
- Submits to approval workflow based on `totalAmount`
- Sets SLA due date in `jo_sla_tracking`

---

#### POST `/api/job-orders/:id/approve`

Approve Job Order.

**Permissions:** `admin`, `manager`
**Restriction:** Can approve from: `pending_approval`, `quoted`

**Request Body:**

```json
{
  "approved": true,
  "quoteAmount": 5500.00,
  "comments": "Approved with quoted amount"
}
```

**Business Logic:**
- If `approved: true`: changes status to `approved`, checks SLA
- If `approved: false`: changes status to `rejected`
- Creates approval record in `jo_approvals`

---

#### POST `/api/job-orders/:id/reject`

Reject Job Order.

**Permissions:** `admin`, `manager`

---

#### POST `/api/job-orders/:id/assign`

Assign supplier to Job Order.

**Permissions:** `admin`, `manager`, `logistics_coordinator`
**Restriction:** Only `approved` Job Orders can be assigned.

**Request Body:**

```json
{
  "supplierId": "uuid"
}
```

**Business Logic:**
- Changes status to `assigned`

---

#### POST `/api/job-orders/:id/start`

Start work on Job Order.

**Permissions:** `admin`, `manager`, `logistics_coordinator`
**Restriction:** Only `assigned` Job Orders can be started.

**Business Logic:**
- Changes status to `in_progress`
- Sets `startDate`

---

#### POST `/api/job-orders/:id/hold`

Put Job Order on hold (stops SLA clock).

**Permissions:** `admin`, `manager`, `logistics_coordinator`
**Restriction:** Only `in_progress` Job Orders can be put on hold.

**Request Body:**

```json
{
  "reason": "Waiting for client approval"
}
```

**Business Logic:**
- Changes status to `on_hold`
- Sets `stopClockStart` in SLA tracking

---

#### POST `/api/job-orders/:id/resume`

Resume Job Order from hold.

**Permissions:** `admin`, `manager`, `logistics_coordinator`
**Restriction:** Only `on_hold` Job Orders can be resumed.

**Business Logic:**
- Changes status to `in_progress`
- Calculates paused duration and adjusts SLA due date

---

#### POST `/api/job-orders/:id/complete`

Complete Job Order.

**Permissions:** `admin`, `manager`, `logistics_coordinator`
**Restriction:** Only `in_progress` Job Orders can be completed.

**Business Logic:**
- Changes status to `completed`
- Sets `completionDate` and `completedById`
- Calculates `slaMet` (true/false)

---

#### POST `/api/job-orders/:id/invoice`

Mark Job Order as invoiced and create payment record.

**Permissions:** `admin`, `manager`, `logistics_coordinator`
**Restriction:** Only `completed` Job Orders can be invoiced.

**Request Body:**

```json
{
  "invoiceNumber": "INV-2026-001",
  "invoiceReceiptDate": "2026-02-08",
  "costExclVat": 5000.00,
  "vatAmount": 750.00,
  "grandTotal": 5750.00,
  "paymentStatus": "pending",
  "oracleVoucher": null,
  "attachmentUrl": "/uploads/invoice.pdf"
}
```

**Payment Status Values:** `pending`, `approved`, `paid`, `disputed`

**Business Logic:**
- Changes status to `invoiced`
- Creates payment record in `jo_payments`

---

#### POST `/api/job-orders/:id/cancel`

Cancel Job Order.

**Permissions:** `admin`, `manager`
**Restriction:** Cannot cancel from: `completed`, `invoiced`, `cancelled`

---

#### POST `/api/job-orders/:id/payments`

Add payment record to Job Order.

**Permissions:** `admin`, `manager`, `logistics_coordinator`

---

#### PUT `/api/job-orders/:id/payments/:pid`

Update payment record.

**Permissions:** `admin`, `manager`, `logistics_coordinator`

**Business Logic:**
- If `paymentStatus` changed to `approved`: sets `paymentApprovedDate`
- If `paymentStatus` changed to `paid`: sets `actualPaymentDate`

---

### Other Logistics Endpoints

The following endpoints follow similar patterns:

- **Gate Passes:** `/api/gate-passes`
- **Stock Transfers:** `/api/stock-transfers`
- **Material Requisition Forms (MRF):** `/api/mrf`
- **Shipments:** `/api/shipments`

Each supports the standard CRUD operations with role-based access control.

---

## Dashboard & Reporting

### Base Path: `/api/dashboard`

All dashboard endpoints require authentication.

---

#### GET `/api/dashboard/stats`

Get overall dashboard statistics.

**Response:**

```json
{
  "success": true,
  "data": {
    "totalProjects": 65,
    "totalItems": 5578,
    "totalWarehouses": 82,
    "totalEmployees": 219,
    "pendingApprovals": 42,
    "lowStockAlerts": 18
  }
}
```

---

#### GET `/api/dashboard/recent-activity`

Get recent audit log entries grouped by day.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-02-08",
      "entries": [
        {
          "id": "uuid",
          "tableName": "mrrv",
          "recordId": "uuid",
          "action": "create",
          "performedAt": "2026-02-08T10:00:00Z",
          "performedBy": {
            "fullName": "John Doe",
            "email": "john@nit.com"
          }
        }
      ]
    }
  ]
}
```

---

#### GET `/api/dashboard/inventory-summary`

Get inventory overview statistics.

**Response:**

```json
{
  "success": true,
  "data": {
    "totalValue": 5250000.00,
    "totalItems": 5578,
    "lowStockCount": 18,
    "expiringCount": 3
  }
}
```

---

#### GET `/api/dashboard/document-counts`

Get document counts with status breakdowns.

**Response:**

```json
{
  "success": true,
  "data": {
    "mrrv": {
      "total": 1250,
      "breakdown": {
        "draft": 45,
        "pending_qc": 12,
        "qc_approved": 8,
        "received": 5,
        "stored": 1180
      }
    },
    "mirv": {
      "total": 2100,
      "breakdown": { /* status breakdown */ }
    },
    "mrv": { /* ... */ },
    "jo": { /* ... */ }
  }
}
```

---

#### GET `/api/dashboard/sla-compliance`

Get SLA metrics per document type.

**Response:**

```json
{
  "success": true,
  "data": {
    "mirv": {
      "total": 2100,
      "onTime": 85,
      "breached": 10,
      "pending": 5
    },
    "jo": {
      "total": 3882,
      "onTime": 88,
      "breached": 8,
      "pending": 4
    }
  }
}
```

---

#### GET `/api/dashboard/top-projects`

Get top 5 projects by active documents.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "projectCode": "PRJ-2026-001",
      "projectName": "Highway Construction",
      "activeDocuments": 125
    }
  ]
}
```

---

## System Endpoints

### Notifications

**Base Path:** `/api/notifications`
**Authentication:** Required

#### GET `/api/notifications`

Get notifications for current user.

---

#### PUT `/api/notifications/:id/read`

Mark notification as read.

---

### Audit Log

**Base Path:** `/api/audit`
**Authentication:** Required

#### GET `/api/audit`

Get audit log entries with filtering.

**Query Parameters:**
- Standard pagination params
- `tableName` - Filter by table
- `recordId` - Filter by record ID
- `action` - Filter by action (create/update/delete)

---

### Settings

**Base Path:** `/api/settings`
**Authentication:** Required

#### GET `/api/settings`

Get system settings.

**Response:**

```json
{
  "success": true,
  "data": {
    "vatRate": 15,
    "currency": "SAR",
    "timezone": "Asia/Riyadh",
    "dateFormat": "DD/MM/YYYY",
    "overDeliveryTolerance": 10,
    "backdateLimit": 7
  }
}
```

---

#### PUT `/api/settings`

Update system settings.

**Permissions:** `admin`, `manager`

---

### File Upload

**Base Path:** `/api/upload`
**Authentication:** Required

#### POST `/api/upload`

Upload a single file.

**Request:**
- Content-Type: `multipart/form-data`
- Field name: `file`
- Max size: 10 MB

**Allowed file types:** `.pdf`, `.jpg`, `.jpeg`, `.png`, `.xlsx`, `.xls`, `.doc`, `.docx`, `.csv`

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "url": "/uploads/abc-123-def-456.pdf",
    "originalName": "invoice.pdf",
    "size": 2048576,
    "mimeType": "application/pdf"
  }
}
```

---

### Permissions

**Base Path:** `/api/permissions`
**Authentication:** Required

#### GET `/api/permissions`

Get permission matrix for current user's role.

---

### Tasks

**Base Path:** `/api/tasks`
**Authentication:** Required

Standard CRUD operations for task management.

---

### Company Documents

**Base Path:** `/api/documents`
**Authentication:** Required

Standard CRUD operations for company document library.

---

### Reports

**Base Path:** `/api/reports`
**Authentication:** Required

Report generation endpoints (implementation varies by report type).

---

## WebSocket Events

The API includes real-time capabilities via Socket.IO.

**Connection URL:** `ws://localhost:4000` (Development) | `wss://your-domain.com` (Production)

### Authentication

Socket connections require JWT authentication via query parameter:

```javascript
const socket = io('http://localhost:4000', {
  query: { token: 'your_access_token' }
});
```

### Event Types

#### Generic Entity Events

- `entity:created` - Entity created
- `entity:updated` - Entity updated
- `entity:deleted` - Entity deleted

**Payload:**

```json
{
  "entity": "mrrv"
}
```

#### Document Status Events

- `document:status` - Document status changed

**Payload:**

```json
{
  "documentType": "mirv",
  "documentId": "uuid",
  "status": "approved"
}
```

#### Document-Specific Events

- `mrrv:created`, `mrrv:submitted`, `mrrv:qc_approved`, `mrrv:received`, `mrrv:stored`
- `mirv:created`, `mirv:submitted`, `mirv:approved`, `mirv:issued`, `mirv:cancelled`
- `mrv:created`, `mrv:submitted`, `mrv:received`, `mrv:completed`
- `rfim:started`, `rfim:completed`
- `osd:created`, `osd:claim_sent`, `osd:resolved`
- `jo:created`, `jo:approved`, `jo:rejected`, `jo:assigned`, `jo:started`, `jo:on_hold`, `jo:resumed`, `jo:completed`, `jo:invoiced`, `jo:cancelled`

#### Inventory Events

- `inventory:updated` - Inventory levels changed
- `inventory:reserved` - Stock reserved for MIRV
- `inventory:released` - Reserved stock released

**Payload:**

```json
{
  "warehouseId": "uuid",
  "mirvId": "uuid"
}
```

---

## Rate Limiting

All `/api` endpoints are rate-limited to **200 requests per minute** per IP address.

**Rate Limit Headers:**

```http
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 195
X-RateLimit-Reset: 1707390000
```

**Error (429 Too Many Requests):**

```json
{
  "success": false,
  "message": "Too many requests, please try again later.",
  "code": "RATE_LIMIT_EXCEEDED"
}
```

---

## CORS Policy

The API supports CORS with the following allowed origins (configurable via environment variables):

- Development: `http://localhost:3000`, `http://localhost:5173`
- Production: Configured via `FRONTEND_URL` environment variable

---

## Health Check

#### GET `/api/health`

Check API health status (no authentication required).

**Response:**

```json
{
  "status": "ok",
  "timestamp": "2026-02-08T12:00:00.000Z"
}
```

---

## Appendix: Status Enumerations

### MRRV Status
`draft`, `pending_qc`, `qc_approved`, `received`, `stored`, `rejected`

### MIRV Status
`draft`, `pending_approval`, `approved`, `partially_issued`, `issued`, `completed`, `rejected`, `cancelled`

### MRV Status
`draft`, `pending`, `received`, `completed`, `rejected`

### RFIM Status
`pending`, `in_progress`, `completed`

### OSD Status
`draft`, `under_review`, `claim_sent`, `awaiting_response`, `negotiating`, `resolved`, `closed`

### Job Order Status
`draft`, `pending_approval`, `quoted`, `approved`, `assigned`, `in_progress`, `on_hold`, `completed`, `invoiced`, `rejected`, `cancelled`

### Gate Pass Status
`draft`, `pending`, `approved`, `released`, `returned`, `expired`, `cancelled`

### Stock Transfer Status
`draft`, `pending`, `approved`, `shipped`, `received`, `completed`, `cancelled`

### Shipment Status
`draft`, `po_issued`, `in_production`, `ready_to_ship`, `in_transit`, `at_port`, `customs_clearing`, `cleared`, `in_delivery`, `delivered`, `cancelled`

---

## Support

For API support and questions, contact the development team.

**Documentation Version:** 1.0
**Last Updated:** 2026-02-08
