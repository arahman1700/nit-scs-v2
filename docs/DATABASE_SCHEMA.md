# Database Schema Documentation - NIT Supply Chain System

**Version:** 1.0
**Database:** PostgreSQL
**ORM:** Prisma Client
**Date:** 2026-02-08
**Company:** Nesma Infrastructure & Technology (NIT) - Saudi Arabia

---

## Table of Contents

1. [Overview](#overview)
2. [Schema Design Principles](#schema-design-principles)
3. [Model Groups](#model-groups)
4. [Detailed Schema](#detailed-schema)
5. [Key Relationships](#key-relationships)
6. [Indexes and Constraints](#indexes-and-constraints)
7. [Special Features](#special-features)

---

## Overview

The NIT Supply Chain database consists of **53 Prisma models** mapping to PostgreSQL tables. The schema supports comprehensive warehouse management, logistics coordination, material tracking, and financial operations.

### Statistics

- **Total Models:** 53
- **Primary Key Type:** UUID (universally unique identifiers)
- **Timestamp Strategy:** Automatic via Prisma (`createdAt`, `updatedAt`)
- **Schema Lines:** ~1,600 lines

### Database Connection

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## Schema Design Principles

### 1. UUID Primary Keys

All tables use UUIDs as primary keys for:
- Global uniqueness across distributed systems
- No sequential enumeration security risk
- Easy data migration and replication

```prisma
id String @id @default(uuid()) @db.Uuid
```

### 2. Auto-Numbering System

Human-readable document numbers are generated via the `document_counters` table:

**Format:** `PREFIX-YYYY-NNNN`

Examples:
- `MRRV-2026-0001`
- `MIRV-2026-0542`
- `JO-2026-1234`

### 3. Audit Trail

All data changes are tracked in the `audit_log` table:
- Who performed the action
- What changed (old values → new values)
- When it happened
- IP address

### 4. Soft vs Hard Deletes

The system uses **hard deletes** with audit logging rather than soft deletes. Deleted records are permanently removed but logged in `audit_log`.

### 5. Status Fields

Most document tables include status enums with CHECK constraints:

```prisma
/// CHECK: status IN ('draft', 'pending', 'approved', 'completed')
status String @default("draft") @map("status") @db.VarChar(20)
```

### 6. Bilingual Support

Core entities support Arabic and English:

```prisma
regionName   String  @map("region_name") @db.VarChar(100)
regionNameAr String? @map("region_name_ar") @db.VarChar(100)
```

### 7. FIFO Inventory

Inventory uses lot-based FIFO tracking via `inventory_lots` and `lot_consumptions` tables.

---

## Model Groups

### Section 1: Lookup Tables (8 models)
Reference data for dropdowns and lookups.

1. `Region` - Saudi administrative regions
2. `City` - Cities within regions
3. `Port` - Ports of entry (sea, air, land)
4. `UnitOfMeasure` - Units of measurement (EA, KG, M, etc.)
5. `WarehouseType` - Warehouse classifications
6. `EquipmentCategory` - Equipment groupings
7. `EquipmentType` - Specific equipment types
8. `ApprovalWorkflow` - Approval rules per document type

### Section 2: Core Master Data (8 models)
Business entities and configuration.

9. `Entity` - Legal entities within Nesma group
10. `Project` - Construction projects and sites
11. `Employee` - System users and employees
12. `Supplier` - Suppliers, vendors, freight forwarders
13. `Warehouse` - Warehouse and storage locations
14. `Item` - Material and item master catalog
15. `Generator` - Generator asset register
16. `EquipmentFleet` - Vehicle and heavy equipment fleet

### Section 3: Material Management (15 models)
Document-based material flow tracking.

17. `Mrrv` - Material Receiving Report Voucher
18. `MrrvLine` - MRRV line items
19. `Rfim` - Request for Inspection of Materials
20. `OsdReport` - Over/Short/Damage reports
21. `OsdLine` - OSD line items
22. `Mirv` - Material Issue Report Voucher
23. `MirvLine` - MIRV line items
24. `Mrv` - Material Return Voucher
25. `MrvLine` - MRV line items
26. `GatePass` - Gate pass for entry/exit
27. `GatePassItem` - Gate pass line items
28. `MaterialRequisition` - Material Requisition Form (MRF)
29. `MrfLine` - MRF line items
30. `StockTransfer` - Inter-warehouse transfers
31. `StockTransferLine` - Stock transfer line items

### Section 4: Job Orders (9 models)
Logistics and service requests.

32. `JobOrder` - Job Orders base table
33. `JoTransportDetail` - Transport-specific details
34. `JoRentalDetail` - Rental-specific details
35. `JoGeneratorDetail` - Generator-specific details
36. `JoScrapDetail` - Scrap disposal details
37. `JoEquipmentLine` - Equipment request lines
38. `JoSlaTracking` - SLA tracking per job order
39. `JoApproval` - Job order approval records
40. `JoPayment` - Invoice and payment tracking

### Section 5: Inventory (4 models)
Real-time inventory management.

41. `InventoryLevel` - Aggregated qty per item per warehouse
42. `InventoryLot` - FIFO lot tracking with costs
43. `LotConsumption` - Lot consumption log
44. `LeftoverMaterial` - Project leftover materials

### Section 6: Shipping & Customs (3 models)
International shipment tracking.

45. `Shipment` - Shipment master records
46. `CustomsTracking` - Customs clearance stages
47. `ShipmentLine` - Shipment line items (packing list)

### Section 7: Finance (2 models)
Financial tracking and depreciation.

48. `SupplierEquipmentRate` - Supplier rate cards
49. `DepreciationEntry` - Generator depreciation journal

### Section 8: System (6 models)
System infrastructure tables.

50. `DocumentCounter` - Auto-numbering sequences
51. `AuditLog` - Comprehensive audit trail
52. `Notification` - User notifications
53. `Task` - Task management
54. `TaskComment` - Task comments
55. `CompanyDocument` - Document library

---

## Detailed Schema

### SECTION 1: LOOKUP TABLES

---

#### 1. Region

Administrative regions in Saudi Arabia.

```prisma
model Region {
  id           String  @id @default(uuid()) @db.Uuid
  regionName   String  @unique @map("region_name") @db.VarChar(100)
  regionNameAr String? @map("region_name_ar") @db.VarChar(100)

  // Relations
  cities     City[]
  projects   Project[]
  warehouses Warehouse[]

  @@map("regions")
}
```

**Purpose:** Top-level geographic classification
**Key Fields:**
- `regionName` - English name (unique)
- `regionNameAr` - Arabic name

---

#### 2. City

Cities within regions.

```prisma
model City {
  id         String  @id @default(uuid()) @db.Uuid
  cityName   String  @map("city_name") @db.VarChar(100)
  cityNameAr String? @map("city_name_ar") @db.VarChar(100)
  regionId   String  @map("region_id") @db.Uuid

  // Relations
  region     Region      @relation(fields: [regionId], references: [id], onDelete: Restrict)
  ports      Port[]
  projects   Project[]
  suppliers  Supplier[]
  warehouses Warehouse[]

  @@map("cities")
}
```

**Relationships:**
- Belongs to one Region (required)
- Has many Projects, Suppliers, Warehouses

---

#### 3. Port

Ports of entry (sea, air, land).

```prisma
model Port {
  id       String  @id @default(uuid()) @db.Uuid
  portName String  @map("port_name") @db.VarChar(200)
  portCode String? @unique @map("port_code") @db.VarChar(20)
  cityId   String? @map("city_id") @db.Uuid
  /// CHECK: port_type IN ('sea', 'air', 'land')
  portType String? @map("port_type") @db.VarChar(20)

  // Relations
  city      City?      @relation(fields: [cityId], references: [id], onDelete: SetNull)
  shipments Shipment[]

  @@map("ports")
}
```

**Port Types:** `sea`, `air`, `land`
**Usage:** Shipment tracking and customs clearance

---

#### 4. UnitOfMeasure

Standard units of measurement.

```prisma
model UnitOfMeasure {
  id        String  @id @default(uuid()) @db.Uuid
  uomCode   String  @unique @map("uom_code") @db.VarChar(20)
  uomName   String  @map("uom_name") @db.VarChar(50)
  uomNameAr String? @map("uom_name_ar") @db.VarChar(50)
  category  String? @db.VarChar(30)

  // Relations (extensive - used by many tables)
  items              Item[]
  mrrvLines          MrrvLine[]
  osdLines           OsdLine[]
  mrvLines           MrvLine[]
  gatePassItems      GatePassItem[]
  mrfLines           MrfLine[]
  stockTransferLines StockTransferLine[]
  leftoverMaterials  LeftoverMaterial[]
  shipmentLines      ShipmentLine[]

  @@map("units_of_measure")
}
```

**Common UOMs:** EA (Each), KG (Kilogram), M (Meter), L (Liter), M2 (Square Meter), M3 (Cubic Meter)

---

#### 5. WarehouseType

Warehouse classifications.

**Examples:** Main Warehouse, Project Site Warehouse, Transit Warehouse, Cold Storage

---

#### 6. EquipmentCategory

High-level equipment groupings.

**Examples:** Heavy Machinery, Generators, Vehicles, Lifting Equipment

---

#### 7. EquipmentType

Specific equipment types within categories.

**Examples:** Excavator, Forklift, 500 KVA Generator, Flatbed Truck

---

#### 8. ApprovalWorkflow

Approval workflow rules per document type and amount threshold.

```prisma
model ApprovalWorkflow {
  id           String   @id @default(uuid()) @db.Uuid
  documentType String   @map("document_type") @db.VarChar(30)
  minAmount    Decimal  @map("min_amount") @db.Decimal(15, 2)
  maxAmount    Decimal? @map("max_amount") @db.Decimal(15, 2)
  approverRole String   @map("approver_role") @db.VarChar(50)
  slaHours     Int      @map("sla_hours")

  @@map("approval_workflows")
}
```

**Purpose:** Define who approves documents based on monetary value
**Example:** MIRV with value 10,000-50,000 SAR requires `manager` approval within 24 hours

---

### SECTION 2: CORE MASTER DATA

---

#### 9. Entity

Legal entities within Nesma group (supports hierarchy).

```prisma
model Entity {
  id             String   @id @default(uuid()) @db.Uuid
  entityCode     String   @unique @map("entity_code") @db.VarChar(20)
  entityName     String   @map("entity_name") @db.VarChar(200)
  entityNameAr   String?  @map("entity_name_ar") @db.VarChar(200)
  parentEntityId String?  @map("parent_entity_id") @db.Uuid
  /// CHECK: status IN ('active', 'inactive')
  status         String   @default("active") @map("status") @db.VarChar(20)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // Self-referencing hierarchy
  parentEntity  Entity?  @relation("EntityHierarchy", fields: [parentEntityId], references: [id], onDelete: Restrict)
  childEntities Entity[] @relation("EntityHierarchy")

  // Relations
  projects  Project[]
  jobOrders JobOrder[]

  @@map("entities")
}
```

**Purpose:** Track legal entities for cost allocation and reporting
**Hierarchy:** Supports parent-child relationships (e.g., subsidiary under holding company)

---

#### 10. Project

Construction projects and sites.

```prisma
model Project {
  id               String    @id @default(uuid()) @db.Uuid
  projectCode      String    @unique @map("project_code") @db.VarChar(50)
  projectName      String    @map("project_name") @db.VarChar(300)
  projectNameAr    String?   @map("project_name_ar") @db.VarChar(300)
  client           String    @db.VarChar(200)
  entityId         String?   @map("entity_id") @db.Uuid
  regionId         String?   @map("region_id") @db.Uuid
  cityId           String?   @map("city_id") @db.Uuid
  projectManagerId String?   @map("project_manager_id") @db.Uuid
  /// CHECK: status IN ('active', 'on_hold', 'completed', 'cancelled')
  status           String    @default("active") @map("status") @db.VarChar(20)
  startDate        DateTime? @map("start_date") @db.Date
  endDate          DateTime? @map("end_date") @db.Date
  budget           Decimal?  @db.Decimal(15, 2)
  description      String?
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  entity         Entity?   @relation(fields: [entityId], references: [id], onDelete: Restrict)
  region         Region?   @relation(fields: [regionId], references: [id], onDelete: Restrict)
  city           City?     @relation(fields: [cityId], references: [id], onDelete: Restrict)
  projectManager Employee? @relation("ProjectManager", fields: [projectManagerId], references: [id], onDelete: SetNull)

  // Reverse relations (extensive)
  assignedEmployees    Employee[]            @relation("EmployeeProject")
  warehouses           Warehouse[]
  mrrv                 Mrrv[]
  mirv                 Mirv[]
  mrv                  Mrv[]
  gatePasses           GatePass[]
  materialRequisitions MaterialRequisition[]
  stockTransfersFrom   StockTransfer[]       @relation("StockTransferFromProject")
  stockTransfersTo     StockTransfer[]       @relation("StockTransferToProject")
  jobOrders            JobOrder[]
  generators           Generator[]
  leftoverMaterials    LeftoverMaterial[]
  shipments            Shipment[]
  tasks                Task[]

  @@index([projectCode], map: "idx_projects_code")
  @@map("projects")
}
```

**Status Values:** `active`, `on_hold`, `completed`, `cancelled`
**Key Index:** `projectCode` for fast lookups

---

#### 11. Employee

System users and employees.

```prisma
model Employee {
  id                  String    @id @default(uuid()) @db.Uuid
  employeeIdNumber    String    @unique @map("employee_id_number") @db.VarChar(20)
  fullName            String    @map("full_name") @db.VarChar(200)
  fullNameAr          String?   @map("full_name_ar") @db.VarChar(200)
  email               String    @unique @db.VarChar(200)
  phone               String?   @db.VarChar(20)
  /// CHECK: department IN ('logistics', 'warehouse', 'transport', 'projects', 'quality', 'finance', 'admin')
  department          String    @db.VarChar(50)
  role                String    @db.VarChar(50)
  /// CHECK: system_role IN ('admin', 'manager', 'warehouse_supervisor', 'warehouse_staff', 'logistics_coordinator', 'site_engineer', 'qc_officer', 'freight_forwarder')
  systemRole          String    @map("system_role") @db.VarChar(50)
  assignedProjectId   String?   @map("assigned_project_id") @db.Uuid
  assignedWarehouseId String?   @map("assigned_warehouse_id") @db.Uuid
  managerId           String?   @map("manager_id") @db.Uuid
  isActive            Boolean   @default(true) @map("is_active")
  hireDate            DateTime? @map("hire_date") @db.Date
  /// Hashed password (never store plain text)
  passwordHash        String?   @map("password_hash") @db.VarChar(500)
  lastLogin           DateTime? @map("last_login") @db.Timestamptz
  createdAt           DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt           DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  assignedProject   Project?   @relation("EmployeeProject", fields: [assignedProjectId], references: [id], onDelete: SetNull)
  assignedWarehouse Warehouse? @relation("EmployeeWarehouse", fields: [assignedWarehouseId], references: [id], onDelete: SetNull)
  manager           Employee?  @relation("EmployeeManager", fields: [managerId], references: [id], onDelete: SetNull)
  directReports     Employee[] @relation("EmployeeManager")

  // Reverse relations (extensive - 30+ relations)
  // ... (see schema file for full list)

  @@map("employees")
}
```

**System Roles:**
- `admin` - Full system access
- `manager` - Management operations
- `warehouse_supervisor` - Warehouse oversight
- `warehouse_staff` - Day-to-day warehouse tasks
- `logistics_coordinator` - Job orders and transport
- `site_engineer` - Project material requests
- `qc_officer` - Quality control
- `freight_forwarder` - Shipment tracking

**Security Note:** Passwords are hashed using bcrypt (handled in application layer)

---

#### 12. Supplier

Suppliers, vendors, and freight forwarders.

```prisma
model Supplier {
  id             String   @id @default(uuid()) @db.Uuid
  supplierCode   String   @unique @map("supplier_code") @db.VarChar(50)
  supplierName   String   @map("supplier_name") @db.VarChar(300)
  supplierNameAr String?  @map("supplier_name_ar") @db.VarChar(300)
  /// Supplier type tags (array)
  types          String[] @db.VarChar(200)
  contactPerson  String?  @map("contact_person") @db.VarChar(200)
  phone          String?  @db.VarChar(20)
  email          String?  @db.VarChar(200)
  address        String?
  cityId         String?  @map("city_id") @db.Uuid
  crNumber       String?  @map("cr_number") @db.VarChar(50)
  vatNumber      String?  @map("vat_number") @db.VarChar(50)
  /// CHECK: rating BETWEEN 1 AND 5
  rating         Int?     @db.SmallInt
  /// CHECK: status IN ('active', 'inactive', 'blocked')
  status         String   @default("active") @map("status") @db.VarChar(20)
  paymentTerms   String?  @map("payment_terms") @db.VarChar(50)
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  city City? @relation(fields: [cityId], references: [id], onDelete: SetNull)

  // Reverse relations
  mrrv                   Mrrv[]
  osdReports             OsdReport[]
  jobOrders              JobOrder[]
  inventoryLots          InventoryLot[]
  supplierEquipmentRates SupplierEquipmentRate[]
  shipmentsAsSupplier    Shipment[]              @relation("ShipmentSupplier")
  shipmentsAsForwarder   Shipment[]              @relation("ShipmentForwarder")

  @@map("suppliers")
}
```

**Types:** Array field supporting multiple types (e.g., `["material_supplier", "freight_forwarder"]`)
**Rating:** 1-5 star rating for supplier performance
**Status Values:** `active`, `inactive`, `blocked`

---

#### 13. Warehouse

Warehouse and storage locations.

```prisma
model Warehouse {
  id              String   @id @default(uuid()) @db.Uuid
  warehouseCode   String   @unique @map("warehouse_code") @db.VarChar(50)
  warehouseName   String   @map("warehouse_name") @db.VarChar(200)
  warehouseNameAr String?  @map("warehouse_name_ar") @db.VarChar(200)
  warehouseTypeId String   @map("warehouse_type_id") @db.Uuid
  projectId       String?  @map("project_id") @db.Uuid
  regionId        String   @map("region_id") @db.Uuid
  cityId          String?  @map("city_id") @db.Uuid
  address         String?
  managerId       String?  @map("manager_id") @db.Uuid
  contactPhone    String?  @map("contact_phone") @db.VarChar(20)
  /// CHECK: status IN ('active', 'inactive', 'closed')
  status          String   @default("active") @map("status") @db.VarChar(20)
  latitude        Decimal? @db.Decimal(10, 7)
  longitude       Decimal? @db.Decimal(10, 7)
  createdAt       DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  warehouseType WarehouseType @relation(fields: [warehouseTypeId], references: [id], onDelete: Restrict)
  project       Project?      @relation(fields: [projectId], references: [id], onDelete: SetNull)
  region        Region        @relation(fields: [regionId], references: [id], onDelete: Restrict)
  city          City?         @relation(fields: [cityId], references: [id], onDelete: SetNull)
  manager       Employee?     @relation("WarehouseManager", fields: [managerId], references: [id], onDelete: SetNull)

  // Reverse relations
  assignedEmployees    Employee[]         @relation("EmployeeWarehouse")
  generators           Generator[]
  mrrv                 Mrrv[]
  osdReports           OsdReport[]
  mirv                 Mirv[]
  mrvFrom              Mrv[]              @relation("MrvFromWarehouse")
  mrvTo                Mrv[]              @relation("MrvToWarehouse")
  gatePasses           GatePass[]
  stockTransfersFrom   StockTransfer[]    @relation("StockTransferFromWarehouse")
  stockTransfersTo     StockTransfer[]    @relation("StockTransferToWarehouse")
  inventoryLevels      InventoryLevel[]
  inventoryLots        InventoryLot[]
  leftoverMaterials    LeftoverMaterial[]
  shipmentsDestination Shipment[]

  @@map("warehouses")
}
```

**Geolocation:** Supports latitude/longitude for mapping features
**Hierarchy:** Can be linked to a specific project or standalone

---

#### 14. Item

Material and item master catalog.

```prisma
model Item {
  id                String   @id @default(uuid()) @db.Uuid
  itemCode          String   @unique @map("item_code") @db.VarChar(50)
  itemDescription   String   @map("item_description") @db.VarChar(500)
  itemDescriptionAr String?  @map("item_description_ar") @db.VarChar(500)
  /// CHECK: category IN ('construction', 'electrical', 'mechanical', 'safety', 'tools', 'consumables', 'spare_parts')
  category          String   @db.VarChar(50)
  subCategory       String?  @map("sub_category") @db.VarChar(100)
  uomId             String   @map("uom_id") @db.Uuid
  minStock          Decimal? @default(0) @map("min_stock") @db.Decimal(12, 3)
  reorderPoint      Decimal? @map("reorder_point") @db.Decimal(12, 3)
  standardCost      Decimal? @map("standard_cost") @db.Decimal(15, 2)
  barcode           String?  @db.VarChar(100)
  isSerialized      Boolean? @default(false) @map("is_serialized")
  isExpirable       Boolean? @default(false) @map("is_expirable")
  /// CHECK: status IN ('active', 'inactive', 'discontinued')
  status            String   @default("active") @map("status") @db.VarChar(20)
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  uom UnitOfMeasure @relation(fields: [uomId], references: [id], onDelete: Restrict)

  // Reverse relations (extensive)
  mrrvLines          MrrvLine[]
  osdLines           OsdLine[]
  mirvLines          MirvLine[]
  mrvLines           MrvLine[]
  gatePassItems      GatePassItem[]
  mrfLines           MrfLine[]
  stockTransferLines StockTransferLine[]
  inventoryLevels    InventoryLevel[]
  inventoryLots      InventoryLot[]
  leftoverMaterials  LeftoverMaterial[]
  shipmentLines      ShipmentLine[]

  @@index([itemCode], map: "idx_items_code")
  @@map("items")
}
```

**Categories:** `construction`, `electrical`, `mechanical`, `safety`, `tools`, `consumables`, `spare_parts`
**Inventory Alerts:** `minStock` triggers low stock alerts, `reorderPoint` triggers procurement
**Serialization:** `isSerialized` indicates if individual units are tracked (e.g., laptops, expensive equipment)
**Expiration:** `isExpirable` indicates if expiry date tracking is needed (e.g., chemicals, food items)

---

#### 15. Generator

Generator asset register with depreciation tracking.

```prisma
model Generator {
  id                   String    @id @default(uuid()) @db.Uuid
  generatorCode        String    @unique @map("generator_code") @db.VarChar(50)
  generatorName        String    @map("generator_name") @db.VarChar(200)
  capacityKva          Int       @map("capacity_kva")
  equipmentTypeId      String?   @map("equipment_type_id") @db.Uuid
  currentProjectId     String?   @map("current_project_id") @db.Uuid
  currentWarehouseId   String?   @map("current_warehouse_id") @db.Uuid
  /// CHECK: status IN ('available', 'assigned', 'maintenance', 'decommissioned')
  status               String    @default("available") @map("status") @db.VarChar(30)
  purchaseDate         DateTime? @map("purchase_date") @db.Date
  purchaseValue        Decimal?  @map("purchase_value") @db.Decimal(15, 2)
  salvageValue         Decimal?  @map("salvage_value") @db.Decimal(15, 2)
  usefulLifeMonths     Int?      @map("useful_life_months")
  /// CHECK: depreciation_method IN ('straight_line', 'usage_based')
  depreciationMethod   String?   @map("depreciation_method") @db.VarChar(20)
  inServiceDate        DateTime? @map("in_service_date") @db.Date
  hoursTotal           Decimal?  @default(0) @map("hours_total") @db.Decimal(10, 1)
  lastDepreciationDate DateTime? @map("last_depreciation_date") @db.Date
  createdAt            DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt            DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  equipmentType    EquipmentType? @relation(fields: [equipmentTypeId], references: [id], onDelete: SetNull)
  currentProject   Project?       @relation(fields: [currentProjectId], references: [id], onDelete: SetNull)
  currentWarehouse Warehouse?     @relation(fields: [currentWarehouseId], references: [id], onDelete: SetNull)

  // Reverse relations
  joGeneratorDetails  JoGeneratorDetail[]
  depreciationEntries DepreciationEntry[]

  @@map("generators")
}
```

**Asset Tracking:** Tracks location, status, and usage hours
**Depreciation:** Supports straight-line and usage-based depreciation methods
**Capacity:** Measured in KVA (kilovolt-amperes)

---

#### 16. EquipmentFleet

Vehicle and heavy equipment fleet.

**Similar structure to Generator but for vehicles, trucks, and mobile equipment**

---

### SECTION 3: MATERIAL MANAGEMENT

This section covers the document-based material flow workflow.

---

#### 17-18. MRRV (Material Receiving Report Voucher)

**Purpose:** Document materials received from suppliers

**Header Table (Mrrv):**

```prisma
model Mrrv {
  id             String    @id @default(uuid()) @db.Uuid
  mrrvNumber     String    @unique @map("mrrv_number") @db.VarChar(20)
  supplierId     String    @map("supplier_id") @db.Uuid
  poNumber       String?   @map("po_number") @db.VarChar(50)
  warehouseId    String    @map("warehouse_id") @db.Uuid
  projectId      String?   @map("project_id") @db.Uuid
  receivedById   String    @map("received_by_id") @db.Uuid
  receiveDate    DateTime  @map("receive_date") @db.Timestamptz
  invoiceNumber  String?   @map("invoice_number") @db.VarChar(50)
  deliveryNote   String?   @map("delivery_note") @db.VarChar(100)
  totalValue     Decimal?  @default(0) @map("total_value") @db.Decimal(15, 2)
  rfimRequired   Boolean?  @default(false) @map("rfim_required")
  hasOsd         Boolean?  @default(false) @map("has_osd")
  /// CHECK: status IN ('draft', 'pending_qc', 'qc_approved', 'received', 'stored', 'rejected')
  status         String    @default("draft") @map("status") @db.VarChar(20)
  qcInspectorId  String?   @map("qc_inspector_id") @db.Uuid
  qcApprovedDate DateTime? @map("qc_approved_date") @db.Timestamptz
  notes          String?
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  supplier    Supplier  @relation(fields: [supplierId], references: [id], onDelete: Restrict)
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)
  receivedBy  Employee  @relation("MrrvReceivedBy", fields: [receivedById], references: [id], onDelete: Restrict)
  qcInspector Employee? @relation("MrrvQcInspector", fields: [qcInspectorId], references: [id], onDelete: SetNull)

  // Reverse relations
  mrrvLines  MrrvLine[]
  rfims      Rfim[]
  osdReports OsdReport[]
  shipments  Shipment[]

  @@index([status], map: "idx_mrrv_status")
  @@index([supplierId], map: "idx_mrrv_supplier")
  @@index([mrrvNumber], map: "idx_mrrv_number")
  @@map("mrrv")
}
```

**Status Flow:** `draft` → `pending_qc` → `qc_approved` → `received` → `stored`

**Line Items Table (MrrvLine):**

```prisma
model MrrvLine {
  id              String    @id @default(uuid()) @db.Uuid
  mrrvId          String    @map("mrrv_id") @db.Uuid
  itemId          String    @map("item_id") @db.Uuid
  qtyOrdered      Decimal?  @map("qty_ordered") @db.Decimal(12, 3)
  /// CHECK: qty_received > 0
  qtyReceived     Decimal   @map("qty_received") @db.Decimal(12, 3)
  qtyDamaged      Decimal?  @default(0) @map("qty_damaged") @db.Decimal(12, 3)
  uomId           String    @map("uom_id") @db.Uuid
  unitCost        Decimal?  @map("unit_cost") @db.Decimal(15, 2)
  /// CHECK: condition IN ('good', 'damaged', 'mixed')
  condition       String    @default("good") @map("condition") @db.VarChar(20)
  storageLocation String?   @map("storage_location") @db.VarChar(100)
  expiryDate      DateTime? @map("expiry_date") @db.Date
  notes           String?

  // Relations
  mrrv Mrrv          @relation(fields: [mrrvId], references: [id], onDelete: Cascade)
  item Item          @relation(fields: [itemId], references: [id], onDelete: Restrict)
  uom  UnitOfMeasure @relation(fields: [uomId], references: [id], onDelete: Restrict)

  // Reverse relations
  osdLines      OsdLine[]
  inventoryLots InventoryLot[]

  @@map("mrrv_lines")
}
```

**Key Features:**
- Tracks ordered vs received quantities (for over/short detection)
- Tracks damaged quantities (triggers OSD)
- Supports expiry date tracking
- Storage location (bin/rack reference)
- Unit cost for inventory valuation

---

#### 19. RFIM (Request for Inspection of Materials)

Auto-created when MRRV has `rfimRequired: true`.

```prisma
model Rfim {
  id             String    @id @default(uuid()) @db.Uuid
  rfimNumber     String    @unique @map("rfim_number") @db.VarChar(20)
  mrrvId         String    @map("mrrv_id") @db.Uuid
  inspectorId    String?   @map("inspector_id") @db.Uuid
  requestDate    DateTime  @default(now()) @map("request_date") @db.Timestamptz
  inspectionDate DateTime? @map("inspection_date") @db.Timestamptz
  /// CHECK: result IN ('pass', 'fail', 'conditional')
  result         String?   @db.VarChar(20)
  comments       String?
  /// CHECK: status IN ('pending', 'in_progress', 'completed')
  status         String    @default("pending") @map("status") @db.VarChar(20)
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  mrrv      Mrrv      @relation(fields: [mrrvId], references: [id], onDelete: Restrict)
  inspector Employee? @relation("RfimInspector", fields: [inspectorId], references: [id], onDelete: SetNull)

  @@map("rfim")
}
```

**Results:** `pass`, `fail`, `conditional`
**Status Flow:** `pending` → `in_progress` → `completed`

---

#### 20-21. OSD (Over/Short/Damage Report)

Auto-created when MRRV has damaged quantities.

**Header Table (OsdReport):**

```prisma
model OsdReport {
  id               String    @id @default(uuid()) @db.Uuid
  osdNumber        String    @unique @map("osd_number") @db.VarChar(20)
  mrrvId           String    @map("mrrv_id") @db.Uuid
  poNumber         String?   @map("po_number") @db.VarChar(50)
  supplierId       String?   @map("supplier_id") @db.Uuid
  warehouseId      String?   @map("warehouse_id") @db.Uuid
  reportDate       DateTime  @map("report_date") @db.Date
  /// OSD type flags (over/short/damage) as VARCHAR(50)[] array
  reportTypes      String[]  @map("report_types") @db.VarChar(50)
  /// CHECK: status IN ('draft', 'under_review', 'claim_sent', 'awaiting_response', 'negotiating', 'resolved', 'closed')
  status           String    @default("draft") @map("status") @db.VarChar(30)
  totalOverValue   Decimal?  @default(0) @map("total_over_value") @db.Decimal(15, 2)
  totalShortValue  Decimal?  @default(0) @map("total_short_value") @db.Decimal(15, 2)
  totalDamageValue Decimal?  @default(0) @map("total_damage_value") @db.Decimal(15, 2)
  claimSentDate    DateTime? @map("claim_sent_date") @db.Date
  claimReference   String?   @map("claim_reference") @db.VarChar(100)
  supplierResponse String?   @map("supplier_response")
  responseDate     DateTime? @map("response_date") @db.Date
  /// CHECK: resolution_type IN ('credit_note', 'replacement', 'price_adjustment', 'insurance_claim', 'write_off', 'returned')
  resolutionType   String?   @map("resolution_type") @db.VarChar(30)
  resolutionAmount Decimal?  @map("resolution_amount") @db.Decimal(15, 2)
  resolutionDate   DateTime? @map("resolution_date") @db.Date
  resolvedById     String?   @map("resolved_by_id") @db.Uuid
  createdAt        DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  mrrv       Mrrv       @relation(fields: [mrrvId], references: [id], onDelete: Restrict)
  supplier   Supplier?  @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  warehouse  Warehouse? @relation(fields: [warehouseId], references: [id], onDelete: SetNull)
  resolvedBy Employee?  @relation("OsdResolvedBy", fields: [resolvedById], references: [id], onDelete: SetNull)

  // Reverse relations
  osdLines OsdLine[]

  @@map("osd_reports")
}
```

**Report Types:** Array field `['over']`, `['short']`, `['damage']`, or combinations
**Resolution Types:** `credit_note`, `replacement`, `price_adjustment`, `insurance_claim`, `write_off`, `returned`

---

#### 22-23. MIRV (Material Issue Report Voucher)

**Purpose:** Document materials issued from warehouse to project/site

**Header Table (Mirv):**

```prisma
model Mirv {
  id                String    @id @default(uuid()) @db.Uuid
  mirvNumber        String    @unique @map("mirv_number") @db.VarChar(20)
  projectId         String    @map("project_id") @db.Uuid
  warehouseId       String    @map("warehouse_id") @db.Uuid
  locationOfWork    String?   @map("location_of_work") @db.VarChar(200)
  requestedById     String    @map("requested_by_id") @db.Uuid
  requestDate       DateTime  @map("request_date") @db.Timestamptz
  requiredDate      DateTime? @map("required_date") @db.Date
  /// CHECK: priority IN ('normal', 'urgent', 'emergency')
  priority          String?   @default("normal") @map("priority") @db.VarChar(20)
  estimatedValue    Decimal?  @default(0) @map("estimated_value") @db.Decimal(15, 2)
  /// CHECK: status IN ('draft', 'pending_approval', 'approved', 'partially_issued', 'issued', 'completed', 'rejected', 'cancelled')
  status            String    @default("draft") @map("status") @db.VarChar(30)
  approvedById      String?   @map("approved_by_id") @db.Uuid
  approvedDate      DateTime? @map("approved_date") @db.Timestamptz
  issuedById        String?   @map("issued_by_id") @db.Uuid
  issuedDate        DateTime? @map("issued_date") @db.Timestamptz
  rejectionReason   String?   @map("rejection_reason")
  /// CHECK: reservation_status IN ('none', 'reserved', 'released')
  reservationStatus String?   @default("none") @map("reservation_status") @db.VarChar(20)
  mrfId             String?   @map("mrf_id") @db.Uuid
  slaDueDate        DateTime? @map("sla_due_date") @db.Timestamptz
  notes             String?
  createdAt         DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt         DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  project     Project              @relation(fields: [projectId], references: [id], onDelete: Restrict)
  warehouse   Warehouse            @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  requestedBy Employee             @relation("MirvRequestedBy", fields: [requestedById], references: [id], onDelete: Restrict)
  approvedBy  Employee?            @relation("MirvApprovedBy", fields: [approvedById], references: [id], onDelete: SetNull)
  issuedBy    Employee?            @relation("MirvIssuedBy", fields: [issuedById], references: [id], onDelete: SetNull)
  mrf         MaterialRequisition? @relation(fields: [mrfId], references: [id], onDelete: SetNull)

  // Reverse relations
  mirvLines            MirvLine[]
  mrv                  Mrv[]
  gatePasses           GatePass[]
  materialRequisitions MaterialRequisition[] @relation("MrfMirv")
  stockTransfersDest   StockTransfer[]       @relation("StockTransferDestMirv")
  leftoverMaterials    LeftoverMaterial[]

  @@index([status], map: "idx_mirv_status")
  @@index([projectId], map: "idx_mirv_project")
  @@index([warehouseId], map: "idx_mirv_warehouse")
  @@index([mirvNumber], map: "idx_mirv_number")
  @@map("mirv")
}
```

**Status Flow:** `draft` → `pending_approval` → `approved` → `issued`
**Reservation System:**
- `approved`: Stock is reserved (`reservationStatus: 'reserved'`)
- `issued`: Reservation consumed, stock deducted
- `cancelled`: Reservation released without deduction

**Line Items Table (MirvLine):**

```prisma
model MirvLine {
  id              String   @id @default(uuid()) @db.Uuid
  mirvId          String   @map("mirv_id") @db.Uuid
  itemId          String   @map("item_id") @db.Uuid
  /// CHECK: qty_requested > 0
  qtyRequested    Decimal  @map("qty_requested") @db.Decimal(12, 3)
  qtyApproved     Decimal? @map("qty_approved") @db.Decimal(12, 3)
  qtyIssued       Decimal? @map("qty_issued") @db.Decimal(12, 3)
  unitCost        Decimal? @map("unit_cost") @db.Decimal(15, 2)
  storageLocation String?  @map("storage_location") @db.VarChar(100)
  notes           String?

  // Relations
  mirv Mirv @relation(fields: [mirvId], references: [id], onDelete: Cascade)
  item Item @relation(fields: [itemId], references: [id], onDelete: Restrict)

  // Reverse relations
  mrfLines        MrfLine[]
  lotConsumptions LotConsumption[]

  @@map("mirv_lines")
}
```

**Quantity Progression:**
1. `qtyRequested` - Initial request
2. `qtyApproved` - May be different if adjusted during approval
3. `qtyIssued` - Actual quantity issued
4. `unitCost` - Calculated via FIFO on issuance

---

#### 24-25. MRV (Material Return Voucher)

**Purpose:** Document materials returned from project to warehouse

**Status Flow:** `draft` → `pending` → `received` → `completed`

**Return Types:** `return_to_warehouse`, `return_to_supplier`, `scrap`, `transfer_to_project`

---

#### 26-27. Gate Pass

**Purpose:** Control material entry/exit at gate

**Pass Types:** `inbound`, `outbound`, `transfer`
**Status Flow:** `draft` → `pending` → `approved` → `released` → `returned`

---

#### 28-29. Material Requisition Form (MRF)

**Purpose:** Request materials (precursor to MIRV, can trigger procurement)

**Status Flow:** `draft` → `submitted` → `under_review` → `approved` → `checking_stock` → `from_stock` / `needs_purchase` → `fulfilled`

---

#### 30-31. Stock Transfer

**Purpose:** Move materials between warehouses or projects

**Transfer Types:** `warehouse_to_warehouse`, `project_to_project`, `warehouse_to_project`, `project_to_warehouse`
**Status Flow:** `draft` → `pending` → `approved` → `shipped` → `received` → `completed`

---

### SECTION 4: JOB ORDERS

Job Orders support 7 types with a base table plus type-specific detail tables.

---

#### 32. JobOrder (Base Table)

```prisma
model JobOrder {
  id             String    @id @default(uuid()) @db.Uuid
  joNumber       String    @unique @map("jo_number") @db.VarChar(20)
  /// CHECK: jo_type IN ('transport', 'equipment', 'rental_monthly', 'rental_daily', 'scrap', 'generator_rental', 'generator_maintenance')
  joType         String    @map("jo_type") @db.VarChar(30)
  entityId       String?   @map("entity_id") @db.Uuid
  projectId      String    @map("project_id") @db.Uuid
  supplierId     String?   @map("supplier_id") @db.Uuid
  requestedById  String    @map("requested_by_id") @db.Uuid
  requestDate    DateTime  @map("request_date") @db.Timestamptz
  requiredDate   DateTime? @map("required_date") @db.Date
  /// CHECK: status IN ('draft', 'pending_approval', 'quoted', 'approved', 'assigned', 'in_progress', 'on_hold', 'completed', 'invoiced', 'rejected', 'cancelled')
  status         String    @default("draft") @map("status") @db.VarChar(20)
  /// CHECK: priority IN ('low', 'normal', 'high', 'urgent')
  priority       String?   @default("normal") @map("priority") @db.VarChar(20)
  description    String
  notes          String?
  totalAmount    Decimal?  @default(0) @map("total_amount") @db.Decimal(15, 2)
  startDate      DateTime? @map("start_date") @db.Timestamptz
  completionDate DateTime? @map("completion_date") @db.Timestamptz
  completedById  String?   @map("completed_by_id") @db.Uuid
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  entity      Entity?   @relation(fields: [entityId], references: [id], onDelete: Restrict)
  project     Project   @relation(fields: [projectId], references: [id], onDelete: Restrict)
  supplier    Supplier? @relation(fields: [supplierId], references: [id], onDelete: SetNull)
  requestedBy Employee  @relation("JoRequestedBy", fields: [requestedById], references: [id], onDelete: Restrict)
  completedBy Employee? @relation("JoCompletedBy", fields: [completedById], references: [id], onDelete: SetNull)

  // Reverse relations - subtype details (1:1)
  transportDetails JoTransportDetail?
  rentalDetails    JoRentalDetail?
  generatorDetails JoGeneratorDetail?
  scrapDetails     JoScrapDetail?

  // Reverse relations - child collections
  equipmentLines JoEquipmentLine[]
  slaTracking    JoSlaTracking?
  approvals      JoApproval[]
  payments       JoPayment[]
  stockTransfers StockTransfer[]
  shipments      Shipment[]

  @@index([joType, status], map: "idx_job_orders_type_status")
  @@index([projectId], map: "idx_job_orders_project")
  @@index([requestDate(sort: Desc)], map: "idx_job_orders_date")
  @@index([joNumber], map: "idx_jo_number")
  @@map("job_orders")
}
```

**Job Order Types:**
1. `transport` - Material transport between locations
2. `equipment` - Equipment rental/request
3. `rental_monthly` - Monthly equipment rental
4. `rental_daily` - Daily equipment rental
5. `scrap` - Scrap disposal
6. `generator_rental` - Generator rental
7. `generator_maintenance` - Generator maintenance

**Status Flow:** `draft` → `pending_approval` → `approved` → `assigned` → `in_progress` → `completed` → `invoiced`

**Design Note:** Previously a "God Table" with 105 fields. Refactored into base table (20 fields) + 8 subtype tables.

---

#### 33-37. Type-Specific Detail Tables

Each job order type has a dedicated 1:1 detail table:

- **JoTransportDetail** - Pickup/delivery locations, cargo details, insurance
- **JoRentalDetail** - Rental dates, rates, overtime tracking
- **JoGeneratorDetail** - Generator specs, maintenance type, shift times
- **JoScrapDetail** - Scrap type, weight, destination
- **JoEquipmentLine** - Equipment type requests (for multi-item equipment JOs)

---

#### 38. JoSlaTracking

SLA tracking with stop-the-clock support.

```prisma
model JoSlaTracking {
  id               String    @id @default(uuid()) @db.Uuid
  jobOrderId       String    @unique @map("job_order_id") @db.Uuid
  slaDueDate       DateTime? @map("sla_due_date") @db.Timestamptz
  slaResponseHours Int?      @map("sla_response_hours")
  slaBusinessDays  Int?      @map("sla_business_days")
  stopClockStart   DateTime? @map("stop_clock_start") @db.Timestamptz
  stopClockEnd     DateTime? @map("stop_clock_end") @db.Timestamptz
  stopClockReason  String?   @map("stop_clock_reason")
  slaMet           Boolean?  @map("sla_met")

  // Relations
  jobOrder JobOrder @relation(fields: [jobOrderId], references: [id], onDelete: Cascade)

  @@map("jo_sla_tracking")
}
```

**Stop-the-Clock:** When JO is put `on_hold`, SLA clock pauses and due date is extended by paused duration.

---

#### 39. JoApproval

Approval history for job orders.

**Approval Types:** `standard`, `emergency`, `change_order`

---

#### 40. JoPayment

Invoice and payment tracking.

**Payment Status:** `pending`, `approved`, `paid`, `disputed`

---

### SECTION 5: INVENTORY

---

#### 41. InventoryLevel

Real-time aggregated inventory per item per warehouse.

```prisma
model InventoryLevel {
  id               String    @id @default(uuid()) @db.Uuid
  itemId           String    @map("item_id") @db.Uuid
  warehouseId      String    @map("warehouse_id") @db.Uuid
  /// CHECK: qty_on_hand >= 0
  qtyOnHand        Decimal   @default(0) @map("qty_on_hand") @db.Decimal(12, 3)
  /// CHECK: qty_reserved >= 0
  qtyReserved      Decimal   @default(0) @map("qty_reserved") @db.Decimal(12, 3)
  minLevel         Decimal?  @map("min_level") @db.Decimal(12, 3)
  reorderPoint     Decimal?  @map("reorder_point") @db.Decimal(12, 3)
  lastMovementDate DateTime? @map("last_movement_date") @db.Timestamptz
  alertSent        Boolean?  @default(false) @map("alert_sent")
  updatedAt        DateTime  @updatedAt @map("updated_at") @db.Timestamptz

  // Relations
  item      Item      @relation(fields: [itemId], references: [id], onDelete: Restrict)
  warehouse Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Restrict)

  @@unique([itemId, warehouseId], map: "uq_inventory_item_wh")
  @@index([itemId, warehouseId], map: "idx_inventory_item_wh")
  @@map("inventory_levels")
}
```

**Available Quantity:** `qtyOnHand - qtyReserved`
**Constraint:** Both `qtyOnHand` and `qtyReserved` have CHECK >= 0 at database level

---

#### 42. InventoryLot

FIFO lot tracking with unit costs and expiry dates.

```prisma
model InventoryLot {
  id           String    @id @default(uuid()) @db.Uuid
  lotNumber    String    @unique @map("lot_number") @db.VarChar(20)
  itemId       String    @map("item_id") @db.Uuid
  warehouseId  String    @map("warehouse_id") @db.Uuid
  mrrvLineId   String?   @map("mrrv_line_id") @db.Uuid
  receiptDate  DateTime  @map("receipt_date") @db.Timestamptz
  expiryDate   DateTime? @map("expiry_date") @db.Date
  initialQty   Decimal   @map("initial_qty") @db.Decimal(12, 3)
  /// CHECK: available_qty >= 0
  availableQty Decimal   @map("available_qty") @db.Decimal(12, 3)
  /// CHECK: reserved_qty >= 0
  reservedQty  Decimal?  @default(0) @map("reserved_qty") @db.Decimal(12, 3)
  unitCost     Decimal?  @map("unit_cost") @db.Decimal(15, 2)
  supplierId   String?   @map("supplier_id") @db.Uuid
  binLocation  String?   @map("bin_location") @db.VarChar(50)
  /// CHECK: status IN ('active', 'depleted', 'expired', 'blocked')
  status       String    @default("active") @map("status") @db.VarChar(20)
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz

  // Relations
  item      Item      @relation(fields: [itemId], references: [id], onDelete: Restrict)
  warehouse Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Restrict)
  mrrvLine  MrrvLine? @relation(fields: [mrrvLineId], references: [id], onDelete: SetNull)
  supplier  Supplier? @relation(fields: [supplierId], references: [id], onDelete: SetNull)

  // Reverse relations
  lotConsumptions LotConsumption[]

  @@index([itemId, warehouseId, status], map: "idx_inventory_lots_item")
  @@index([itemId, warehouseId, receiptDate], map: "idx_inventory_lots_fifo")
  @@map("inventory_lots")
}
```

**FIFO Index:** `[itemId, warehouseId, receiptDate]` ensures oldest lots consumed first
**Status Progression:** `active` → `depleted` (when `availableQty = 0`) or `expired` (when `expiryDate` passed)

---

#### 43. LotConsumption

Tracks which lots were consumed for each MIRV issuance.

```prisma
model LotConsumption {
  id              String   @id @default(uuid()) @db.Uuid
  lotId           String   @map("lot_id") @db.Uuid
  mirvLineId      String   @map("mirv_line_id") @db.Uuid
  /// CHECK: quantity > 0
  quantity        Decimal  @db.Decimal(12, 3)
  unitCost        Decimal? @map("unit_cost") @db.Decimal(15, 2)
  consumptionDate DateTime @default(now()) @map("consumption_date") @db.Timestamptz

  // Relations
  lot      InventoryLot @relation(fields: [lotId], references: [id], onDelete: Restrict)
  mirvLine MirvLine     @relation(fields: [mirvLineId], references: [id], onDelete: Restrict)

  @@map("lot_consumptions")
}
```

**Purpose:** Maintain complete audit trail of FIFO consumption for cost accounting

---

#### 44. LeftoverMaterial

Project leftover materials requiring disposition.

**Disposition Types:** `return_to_warehouse`, `reuse`, `transfer_to_client`, `sell`, `scrap`
**Ownership:** `nit`, `client`, `third_party`

---

### SECTION 6: SHIPPING & CUSTOMS

---

#### 45. Shipment

International and domestic shipment tracking.

**Mode of Shipment:** `sea_fcl`, `sea_lcl`, `air`, `land`, `courier`
**Status Flow:** `draft` → `po_issued` → `in_production` → `ready_to_ship` → `in_transit` → `at_port` → `customs_clearing` → `cleared` → `in_delivery` → `delivered`

**Tracking Fields:**
- `awbBlNumber` - Air Waybill or Bill of Lading number
- `containerNumber` - For sea freight
- `vesselFlight` - Vessel name or flight number
- `trackingUrl` - External tracking link

---

#### 46. CustomsTracking

Detailed customs clearance stage tracking per shipment.

**Stages:** `docs_submitted`, `declaration_filed`, `under_inspection`, `awaiting_payment`, `duties_paid`, `ready_for_release`, `released`, `on_hold`, `rejected`

**Inspection Types:** `document_review`, `xray_scan`, `physical_inspection`, `lab_testing`, `green_channel`

**Financial Tracking:**
- `dutiesAmount` - Customs duties
- `vatAmount` - VAT on import
- `otherFees` - Other customs fees

---

#### 47. ShipmentLine

Packing list line items.

**HS Code:** Harmonized System tariff code for customs classification

---

### SECTION 7: FINANCE

---

#### 48. SupplierEquipmentRate

Supplier rate cards for equipment rental.

```prisma
model SupplierEquipmentRate {
  id                    String    @id @default(uuid()) @db.Uuid
  supplierId            String    @map("supplier_id") @db.Uuid
  equipmentTypeId       String    @map("equipment_type_id") @db.Uuid
  dailyRate             Decimal?  @map("daily_rate") @db.Decimal(10, 2)
  monthlyRate           Decimal?  @map("monthly_rate") @db.Decimal(10, 2)
  withOperatorSurcharge Decimal?  @default(0) @map("with_operator_surcharge") @db.Decimal(10, 2)
  validFrom             DateTime  @map("valid_from") @db.Date
  validUntil            DateTime? @map("valid_until") @db.Date
  notes                 String?

  // Relations
  supplier      Supplier      @relation(fields: [supplierId], references: [id], onDelete: Cascade)
  equipmentType EquipmentType @relation(fields: [equipmentTypeId], references: [id], onDelete: Cascade)

  @@map("supplier_equipment_rates")
}
```

**Purpose:** Pre-negotiated rates for quick job order costing

---

#### 49. DepreciationEntry

Generator depreciation journal entries.

**Methods:** `straight_line`, `usage_based`
**Purpose:** Track asset depreciation for financial reporting and Oracle GL integration

---

### SECTION 8: SYSTEM TABLES

---

#### 50. DocumentCounter

Sequential document number generation.

```prisma
model DocumentCounter {
  id           String @id @default(uuid()) @db.Uuid
  documentType String @map("document_type") @db.VarChar(30)
  prefix       String @db.VarChar(10)
  year         Int
  lastNumber   Int    @default(0) @map("last_number")

  @@unique([documentType, year], map: "uq_doc_counter_type_year")
  @@map("document_counters")
}
```

**Example Data:**

| documentType | prefix | year | lastNumber |
|--------------|--------|------|------------|
| mrrv | MRRV | 2026 | 542 |
| mirv | MIRV | 2026 | 1203 |
| jo | JO | 2026 | 3882 |

**Next Number:** `${prefix}-${year}-${String(lastNumber + 1).padStart(4, '0')}`

---

#### 51. AuditLog

Comprehensive audit trail for all data changes.

```prisma
model AuditLog {
  id            String   @id @default(uuid()) @db.Uuid
  tableName     String   @map("table_name") @db.VarChar(50)
  recordId      String   @map("record_id") @db.Uuid
  /// CHECK: action IN ('create', 'update', 'delete')
  action        String   @db.VarChar(20)
  changedFields Json?    @map("changed_fields") @db.JsonB
  oldValues     Json?    @map("old_values") @db.JsonB
  newValues     Json?    @map("new_values") @db.JsonB
  performedById String?  @map("performed_by_id") @db.Uuid
  performedAt   DateTime @default(now()) @map("performed_at") @db.Timestamptz
  ipAddress     String?  @map("ip_address") @db.VarChar(45)

  // Relations
  performedBy Employee? @relation(fields: [performedById], references: [id], onDelete: SetNull)

  @@index([tableName, recordId], map: "idx_audit_log_table")
  @@map("audit_log")
}
```

**Stores:**
- **changedFields:** Array of field names that changed
- **oldValues:** Previous values (for updates)
- **newValues:** New values (for creates/updates)
- **performedBy:** User who made the change
- **ipAddress:** Client IP address

---

#### 52. Notification

User notification messages.

**Notification Types:** `approval_required`, `document_status_change`, `inventory_alert`, `sla_warning`, `task_assigned`, `comment_added`

**Bilingual Support:** Includes both `title` and `titleAr` (Arabic)

---

#### 53-55. Task System

- **Task** - Task assignments
- **TaskComment** - Comments on tasks
- **CompanyDocument** - Company document library

---

## Key Relationships

### Many-to-One Relationships

All lookup and master data tables have many-to-one relationships with transactional tables.

**Example:**
- Many `Mrrv` → One `Supplier`
- Many `Mrrv` → One `Warehouse`
- Many `Mrrv` → One `Project`

### One-to-Many Relationships

Document headers have one-to-many relationships with their line items.

**Example:**
- One `Mrrv` → Many `MrrvLine`
- One `Mirv` → Many `MirvLine`
- One `JobOrder` → Many `JoEquipmentLine`

### One-to-One Relationships

Job order subtypes use one-to-one relationships.

**Example:**
- One `JobOrder` (type: `transport`) → One `JoTransportDetail`
- One `JobOrder` → One `JoSlaTracking`

### Self-Referencing Relationships

- **Entity:** Parent-child hierarchy
- **Employee:** Manager-directReport hierarchy

---

## Indexes and Constraints

### Primary Keys

All tables use UUID primary keys:

```prisma
@id @default(uuid()) @db.Uuid
```

### Unique Constraints

**Document Numbers:**

```prisma
mrrvNumber String @unique @map("mrrv_number") @db.VarChar(20)
```

**Composite Unique:**

```prisma
@@unique([itemId, warehouseId], map: "uq_inventory_item_wh")
```

### Foreign Keys

All foreign key fields use `@relation` with `onDelete` behavior:

- `Restrict` - Prevent delete if children exist (default for most)
- `Cascade` - Delete children when parent deleted (for line items)
- `SetNull` - Set FK to null when parent deleted (for optional references)

**Example:**

```prisma
supplier Supplier @relation(fields: [supplierId], references: [id], onDelete: Restrict)
```

### Indexes

**Single-Column Indexes:**

```prisma
@@index([status], map: "idx_mrrv_status")
```

**Composite Indexes:**

```prisma
@@index([itemId, warehouseId, receiptDate], map: "idx_inventory_lots_fifo")
```

**Multi-Column Indexes:**

```prisma
@@index([joType, status], map: "idx_job_orders_type_status")
```

### Check Constraints

Status and enum fields include CHECK constraints (documented in comments):

```prisma
/// CHECK: status IN ('draft', 'pending_qc', 'qc_approved', 'received', 'stored', 'rejected')
status String @default("draft") @map("status") @db.VarChar(20)
```

**Note:** Prisma doesn't generate CHECK constraints automatically. These must be added via migration SQL or managed at application level.

---

## Special Features

### 1. Bilingual Field Naming

All user-facing text fields support Arabic:

```prisma
regionName   String  @map("region_name")
regionNameAr String? @map("region_name_ar")
```

### 2. Soft vs Hard Deletes

The system uses **hard deletes** with audit logging:
- Records are permanently deleted from tables
- Deletion is logged in `audit_log` with `action: 'delete'`
- Old values are preserved in JSON format

### 3. Timestamp Automation

Prisma handles timestamps automatically:

```prisma
createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz
updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz
```

### 4. Array Fields

PostgreSQL array types are used for multi-value fields:

```prisma
types String[] @db.VarChar(200)  // Supplier types
reportTypes String[] @map("report_types") @db.VarChar(50)  // OSD types
```

### 5. JSON/JSONB Fields

Flexible data storage for audit trails:

```prisma
changedFields Json? @map("changed_fields") @db.JsonB
oldValues     Json? @map("old_values") @db.JsonB
newValues     Json? @map("new_values") @db.JsonB
```

### 6. Decimal Precision

Financial and quantity fields use precise decimals:

```prisma
totalAmount Decimal? @db.Decimal(15, 2)  // Money: 15 digits, 2 decimal places
qtyOnHand   Decimal  @db.Decimal(12, 3)  // Quantity: 12 digits, 3 decimal places
```

### 7. Geolocation Support

Warehouses support latitude/longitude:

```prisma
latitude  Decimal? @db.Decimal(10, 7)
longitude Decimal? @db.Decimal(10, 7)
```

---

## Migration Strategy

### Initial Setup

```bash
# Generate Prisma client
npx prisma generate

# Create database
npx prisma db push

# Or use migrations
npx prisma migrate dev --name init
```

### Data Seeding

Seed scripts should populate lookup tables first, then master data, then transactional data.

**Recommended Order:**
1. Regions, Cities, Ports
2. Units of Measure
3. Warehouse Types, Equipment Categories, Equipment Types
4. Approval Workflows
5. Entities, Projects, Employees, Suppliers, Warehouses, Items
6. Generators, Equipment Fleet
7. Document Counters (initialize to 0 for current year)

---

## Database Size Estimates

Based on live NIT data (as of Feb 2026):

| Table | Est. Rows | Growth Rate |
|-------|-----------|-------------|
| Project | 711 | 50/year |
| Employee | 219 | 30/year |
| Supplier | 1,933 | 100/year |
| Warehouse | 82 | 10/year |
| Item | 5,578 | 500/year |
| Mrrv | 1,250+ | 2,000/year |
| Mirv | 2,100+ | 3,000/year |
| JobOrder | 3,882 | 5,000/year |
| InventoryLevel | 457,396 (item × warehouse) | - |
| InventoryLot | 10,000+ | 5,000/year |
| AuditLog | 50,000+ | 100,000/year |

**Estimated Database Size:** ~5 GB after 5 years of operation

---

## Support

For schema questions and migration support, contact the development team.

**Documentation Version:** 1.0
**Last Updated:** 2026-02-08
