# Config Layer Architecture — Design Document

**Date**: 2026-03-06
**Status**: Approved
**Author**: Abdulrahman Hussein + Claude (AI Architect)
**Approach**: A — "Config Layer" (Hard-coded core + Dynamic extensibility)

---

## 1. Problem Statement

NIT Supply Chain V2 must be an extraordinary, enterprise-grade WMS that:
- Covers all 43 SOW features across 5 modules
- Is dynamic and customizable from inside the system (no code changes)
- Is professionally built, extensible, and future-proof
- Has a customizable backend and database

The system must serve as both a production WMS and a configurable platform.

---

## 2. Architecture Decision

**Chosen: Approach A — Config Layer**

Hard-coded Phase 1 features (GRN, MI, MRN, QCI, DR, MR, WT, IMSF, Job Orders, etc.) provide reliability and performance. A dynamic configuration platform sits on top, allowing admins to extend, customize, and create new document types without code changes.

**Why not Approach B (Hybrid Engine)?** — Too risky for Phase 1 timeline. Converting existing hard-coded features to a unified engine would delay delivery.

**Why not Approach C (Plugin Architecture)?** — Over-engineered for current team size. Plugin isolation adds complexity without proportional benefit.

---

## 3. Existing Dynamic Platform (Already Built)

The V2 codebase already has significant dynamic infrastructure:

### 3.1 Custom Fields System
- **Models**: `CustomFieldDefinition`, `CustomFieldValue` (in `12-advanced-ops.prisma`)
- **How**: Admins define fields (text, number, date, select, etc.) per entity type. Values stored in `CustomFieldValue` linked by `definitionId` + `entityId`.
- **Extends**: mrrv, mirv, jo, and any entity type

### 3.2 Dynamic Document Types
- **Models**: `DynamicDocumentType`, `DynamicFieldDefinition`, `DynamicDocument`, `DynamicDocumentLine`, `DynamicDocumentHistory` (in `12-advanced-ops.prisma`)
- **Service**: `dynamic-document-type.service.ts`
- **How**: Admins create entirely new document types with custom field schemas, status flows, approval configs, permission configs, and settings — all stored as JSONB. Documents use header `data` (JSONB) + line items.

### 3.3 Workflow Engine
- **Models**: `Workflow`, `WorkflowRule`, `WorkflowExecutionLog`, `WorkflowTemplate` (in `09-workflow.prisma`, `12-advanced-ops.prisma`)
- **How**: Named workflows with IF-THEN rules (JSON conditions → JSON actions). Supports cron-based scheduling. Execution logged with entity snapshots. Rule cache invalidated on changes.

### 3.4 Dashboard Builder
- **Models**: `Dashboard`, `DashboardWidget`, `SavedReport` (in `10-email-dashboard.prisma`)
- **How**: Users create dashboards with configurable widgets. Widgets reference data sources, store query filters + display options in JSONB. Reports support scheduled generation.

### 3.5 System Settings
- **Model**: `SystemSetting` (in `09-workflow.prisma`)
- **Service**: `system-config.service.ts`
- **How**: Global key-value store with optional user-level overrides. Categories: `doc_prefix`, `sla`, `threshold`, `general`. In-memory cache with 2-minute TTL. Hardcoded fallbacks via `DOC_PREFIXES` constants.

### 3.6 Other Configurable Systems
- **Semantic Analytics Layer** — natural language → SQL query builder
- **Custom Data Sources** — connect external data to dashboards
- **Navigation Overrides** — per-role menu customization
- **Email Templates** — configurable notification templates
- **Approval Rules** — configurable approval levels and routing
- **Inspection Checklists** — customizable QCI checklists
- **User Views** — saved grid column/filter preferences

---

## 4. Config Layer Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Admin UI Layer                     │
│  (System Settings, Workflow Builder, Dashboard       │
│   Builder, Document Type Designer, Field Manager)    │
├─────────────────────────────────────────────────────┤
│              Configuration Platform                  │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐           │
│  │ Custom   │ │ Dynamic  │ │ Workflow  │           │
│  │ Fields   │ │ Doc Types│ │ Engine    │           │
│  ├──────────┤ ├──────────┤ ├───────────┤           │
│  │ Dashboard│ │ System   │ │ Semantic  │           │
│  │ Builder  │ │ Settings │ │ Layer     │           │
│  └──────────┘ └──────────┘ └───────────┘           │
├─────────────────────────────────────────────────────┤
│              Hard-Coded Feature Layer                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐      │
│  │Inbound │ │Outbound│ │Inv/WH  │ │Logistics│     │
│  │GRN,QCI │ │MI,MRN  │ │Bin,CC  │ │Ship,GP │      │
│  │DR,ASN  │ │MR,MRF  │ │Scrap   │ │Route   │      │
│  ├────────┤ ├────────┤ ├────────┤ ├────────┤      │
│  │Transfer│ │Job Ord │ │Equipmt │ │Complnce│      │
│  │WT,IMSF │ │JO,Labor│ │Tools   │ │Audit   │      │
│  │Handover│ │        │ │Assets  │ │Visitors│      │
│  └────────┘ └────────┘ └────────┘ └────────┘      │
├─────────────────────────────────────────────────────┤
│              Shared Infrastructure                    │
│  Prisma ORM │ CRUD Factory │ Document Factory │      │
│  Event Bus  │ Auth/RBAC    │ Audit Trail      │      │
│  Socket.IO  │ Rate Limiter │ Error Handling   │      │
└─────────────────────────────────────────────────────┘
```

### 4.1 Integration Points

Each hard-coded feature integrates with the config platform via:

1. **Custom Fields** — Every document form renders additional custom fields defined by admins
2. **Workflow Rules** — Status transitions trigger workflow rule evaluation
3. **System Settings** — Document prefixes, SLA thresholds, and approval levels read from settings
4. **Dashboard Widgets** — Hard-coded features expose data endpoints consumed by dashboard widgets
5. **Audit Trail** — All operations logged to `AuditLog` for compliance

### 4.2 Extensibility Path

When a new document type is needed that doesn't exist as hard-coded:

1. Admin creates a `DynamicDocumentType` with field schema, status flow, and approval config
2. The system auto-generates: list view, create/edit form, approval workflow, PDF export, audit trail
3. No developer intervention required

When a hard-coded feature needs customization:

1. Admin adds custom fields via `CustomFieldDefinition`
2. Admin configures workflow rules for automated actions
3. Admin adjusts system settings (prefixes, thresholds, SLA)
4. Admin customizes dashboards and reports

---

## 5. Phase 1 Feature Coverage

### Hard-Coded (16 features + 2 additions from meeting)

| # | Feature | Module | Models |
|---|---------|--------|--------|
| 1 | Master Data CRUD | Core | Item, Supplier, Project, Warehouse, Location, Category, UOM |
| 2 | Multi-Warehouse Locations | Core | Region, City, Warehouse, Zone, BinLocation |
| 3 | GRN (Goods Receiving Note) | Inbound | Mrrv, MrrvItem |
| 4 | QCI (Quality Control Inspection) | Inbound | Rfim, RfimItem |
| 5 | DR (Discrepancy Report) | Inbound | OsdReport, OsdItem |
| 6 | MI (Material Issue) | Outbound | Mirv, MirvItem |
| 7 | MRN (Material Return Note) | Outbound | Mrv, MrvItem |
| 8 | MR (Material Request) | Outbound | Mrf, MrfItem |
| 9 | WT (Warehouse Transfer) | Transfers | StockTransfer, StockTransferItem |
| 10 | IMSF (Inter-Material Store Form) | Transfers | Imsf, ImsfItem |
| 11 | JO (Job Order) | Job Orders | JobOrder, JobOrderItem |
| 12 | BinCard & Inventory Tracking | Inventory | BinCard, BinCardTransaction |
| 13 | Role-Based Access Control | Auth | User, Session, Permission |
| 14 | Approval Workflow | Workflow | Workflow, WorkflowRule, Approval |
| 15 | Notifications & Alerts | System | Notification, EmailTemplate, EmailLog |
| 16 | Reports & Dashboards | Reporting | Dashboard, DashboardWidget, SavedReport |
| 17 | Multi-Locations (added) | Core | Region, City hierarchy |
| 18 | MRV/MRN (moved from P2) | Outbound | Mrv, MrvItem |

### Dynamic Platform (available from Phase 1)

- Custom Fields on all document types
- Dynamic Document Types for ad-hoc needs
- Workflow automation rules
- Dashboard builder with widget library
- System settings management
- Semantic analytics queries

---

## 6. Data Architecture

### 6.1 Prisma Schema (157 models, 16 files)

```
prisma/schema/
├── 00-generators.prisma      — generator + datasource
├── 01-auth.prisma             — User, Session, LoginAttempt
├── 02-master-data.prisma      — Item, Supplier, Project, Warehouse
├── 03-inbound.prisma          — Mrrv, Rfim, OsdReport + items
├── 04-outbound.prisma         — Mirv, Mrv, Mrf + items
├── 05-inventory.prisma        — BinCard, CycleCount, Surplus, Scrap
├── 06-warehouse.prisma        — Zone, PutawayRule, SlottingConfig
├── 07-transfers.prisma        — StockTransfer, Handover, Imsf
├── 08-logistics.prisma        — Shipment, GatePass, TransportOrder
├── 09-workflow.prisma         — Workflow, WorkflowRule, SystemSetting
├── 10-email-dashboard.prisma  — Dashboard, Widget, EmailTemplate
├── 11-job-equipment.prisma    — JobOrder, Tool, Asset, Generator
├── 12-advanced-ops.prisma     — DynamicDocType, CustomField, Semantic
├── 13-compliance.prisma       — ComplianceAudit, SupplierEvaluation
├── 14-system.prisma           — AuditLog, Notification, Attachment
└── 15-enums.prisma            — all Prisma enums
```

### 6.2 Key JSONB Fields (Dynamic Storage)

| Model | Field | Purpose |
|-------|-------|---------|
| `DynamicDocumentType` | `statusFlow` | Configurable state machine |
| `DynamicDocumentType` | `approvalConfig` | Approval routing rules |
| `DynamicDocumentType` | `permissionConfig` | Role-permission matrix |
| `DynamicDocument` | `data` | Header field values |
| `WorkflowRule` | `conditions` | IF clause (JSON logic) |
| `WorkflowRule` | `actions` | THEN clause (action list) |
| `DashboardWidget` | `queryConfig` | Data query parameters |
| `DashboardWidget` | `displayConfig` | Visual display options |
| `CustomFieldDefinition` | `options` | Select/radio field options |
| `SystemSetting` | `value` | Setting value (any type) |

### 6.3 Location Hierarchy

```
Region → City → Warehouse → Zone → BinLocation
```

Each level has its own Prisma model. Warehouses are the primary scoping entity — all documents belong to a warehouse. Multi-warehouse support is built into the RBAC system via `userWarehouseAccess`.

---

## 7. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + Vite | 19 + 6 |
| Styling | Tailwind CSS | 3.4 |
| State (server) | React Query | v5 |
| State (client) | Zustand | latest |
| Forms | React Hook Form + Zod | latest |
| Backend | Express | 5 |
| ORM | Prisma | 6 |
| Database | PostgreSQL | 15+ |
| Real-time | Socket.IO | latest |
| Language | TypeScript | 5.x |
| Monorepo | pnpm workspaces | — |

---

## 8. Security Model

- **Authentication**: JWT + session-based, stored in `Session` model
- **Authorization**: Role-Based Access Control (14 roles)
- **Scope Filtering**: Warehouse-level data isolation via `scope-filter.ts`
- **Approval Routing**: SAR 200,000 threshold (WH Manager ≤200K, SC Manager >200K)
- **Audit Trail**: Every CUD operation logged to `AuditLog`
- **Rate Limiting**: 200 req/min per route group

---

## 9. What This Design Enables

1. **Phase 1 delivery on time** — Hard-coded features ship reliably
2. **Admin self-service** — New document types, fields, workflows, dashboards without code
3. **Future phases plug in** — Phase 2-4 features (ASN, Cross-Dock, Wave Picking, etc.) follow the same pattern
4. **Enterprise readiness** — Audit trail, RBAC, approval routing, multi-warehouse
5. **Continuous improvement** — Config platform grows independently of feature development

---

## 10. Implementation Strategy

See separate implementation plan (to be generated via writing-plans skill).

**High-level phases**:
1. Verify existing config platform completeness (Custom Fields rendering, Dynamic Doc CRUD, Workflow execution)
2. Ensure all Phase 1 hard-coded features integrate with config platform hooks
3. Build admin UI for config management (Settings, Field Manager, Doc Type Designer)
4. Polish and test end-to-end flows

---

## 11. Exclusions (Per SOW)

- Barcode hardware integration
- ERP/SAP integration
- Mobile native apps
- Data migration from legacy systems
- User training and change management
- Infrastructure hosting and DevOps
- Third-party API integrations (carrier APIs, customs)
- AI/ML predictive features (Phase 4)
- Multi-language UI (Phase 3)
- Offline mode (Phase 3)
- Advanced warehouse automation (conveyor, ASRS)
- Financial/accounting module
- Procurement module
- HR module
