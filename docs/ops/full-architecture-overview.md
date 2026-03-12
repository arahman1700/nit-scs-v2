# NIT Supply Chain V2 -- Full Architecture Overview

Last updated: 2026-03-12

---

## 1. System Summary

NIT-SCS V2 is an enterprise supply chain management system built as a pnpm monorepo with three packages:

| Package | Stack | Purpose |
|---------|-------|---------|
| `packages/frontend` | React 19, Vite 6, Tailwind CSS, React Query v5, Zustand | SPA UI with dark glassmorphism theme |
| `packages/backend` | Express 5, Prisma 6, BullMQ, Socket.IO, Pino | REST API, background jobs, real-time events |
| `packages/shared` | TypeScript | Shared types, permissions, validation, constants |

**Key stats:**

- 19 backend domains (+ scheduler as an internal domain)
- 155 Prisma models across 17 schema files, all `@@map`ped to Oracle table names
- 368+ composite indexes
- 114 route files, 105 service files
- 4,796+ backend tests
- 11 BullMQ queues + 1 dead-letter queue
- 28 scheduled background jobs

---

## 2. High-Level Architecture

```
                           +-----------------------+
                           |     Comet / Browser    |
                           |  (React 19 + Vite 6)  |
                           +----------+------------+
                                      |
                          HTTPS / WSS |
                                      v
                  +-----------------------------------+
                  |       Reverse Proxy / CDN         |
                  |     (Render / Nginx / Cloudflare) |
                  +-----------------------------------+
                          |                  |
                   HTTP   |                  | WebSocket
                          v                  v
            +----------------------------+  +------------------+
            |     Express 5 API Server   |  |   Socket.IO      |
            |     /api/v1/*              |  |   Server         |
            |     Rate limiter (500/min) |  |   (ws://)        |
            +----------------------------+  +------------------+
                          |                        |
            +-------------+----------+             |
            |             |          |             |
            v             v          v             v
     +----------+  +-----------+ +--------+ +------------+
     | Prisma 6 |  | BullMQ    | | Redis  | | Pino       |
     | ORM      |  | Workers   | | Cache  | | Logger     |
     +----------+  +-----------+ +--------+ +------------+
            |             |          |
            v             v          v
     +----------+  +-----------+ +--------+
     | PostgreSQL|  | Redis     | | Sentry |
     | (Oracle   |  | (Upstash) | | (APM)  |
     |  mapped)  |  |           | |        |
     +----------+  +-----------+ +--------+
```

---

## 3. Domain Map

The backend is organized into 19 functional domains, each with its own routes, services, and test files. The `scheduler` domain hosts background jobs but exposes no HTTP routes.

```
packages/backend/src/domains/
+------------------+------------------+-------------------+
|  CORE DOCUMENTS  |  WAREHOUSE OPS   |  SUPPORT          |
+------------------+------------------+-------------------+
| auth         (6) | warehouse-ops(26)| workflow      (16)|
| master-data  (2) | inventory    (16)| compliance     (6)|
| inbound     (15) | transfers     (7)| reporting     (28)|
| outbound    (12) |                  | system        (34)|
| job-orders   (4) |                  | notifications  (4)|
| logistics   (18) |                  | audit          (2)|
| equipment   (18) |                  | uploads        (4)|
+------------------+------------------+-------------------+
| ai-services  (2) | scheduler    (0) |                   |
+------------------+------------------+-------------------+
                        (route counts in parentheses)
```

### Domain Model Counts (Prisma schemas)

| Schema File | Models | Primary Domain(s) |
|---|---|---|
| `01-reference.prisma` | 8 | Master data (regions, cities, ports, UOMs, etc.) |
| `02-master-data.prisma` | 8 | Items, suppliers, employees, warehouses, projects |
| `03-inbound.prisma` | 5 | MRRV (GRN), RFIM (QCI), OSD (DR), ASN |
| `04-outbound.prisma` | 10 | MIRV (MI), MRV (MRN), MRF (MR), gate passes |
| `05-job-orders.prisma` | 9 | Job orders, labor standards, cost tracking |
| `06-inventory.prisma` | 4 | Inventory levels, lots, bin cards |
| `07-logistics.prisma` | 6 | Shipments, customs, freight, transport orders |
| `08-system.prisma` | 8 | Notifications, audit trail, settings, uploads |
| `09-workflow.prisma` | 4 | Approval steps, delegation, digital signatures |
| `10-email-dashboard.prisma` | 11 | Email queue, dashboard config, saved reports |
| `11-v2-modules.prisma` | 24 | Cycle counts, surplus, scrap, bin locations, zones |
| `12-advanced-ops.prisma` | 21 | Rate cards, tariffs, customs, SLA tracking |
| `13-warehouse-ops.prisma` | 8 | Put-away rules, slotting, staging, cross-dock |
| `14-equipment-compliance.prisma` | 7 | Assets, AMC, tools, generators, vehicles |
| `15-sow-modules.prisma` | 12 | Visitor passes, sensors, packing, yard management |
| `16-logistics-enhancement.prisma` | 10 | LPN, RFID tags, WMS tasks, wave picking, stock allocation, 3PL, carriers |
| **Total** | **155** | |

---

## 4. API Gateway Flow

All HTTP requests flow through the Express middleware stack in this order:

```
Request
  |
  v
1. Sentry request handler (error tracking)
2. Helmet (security headers + CSP)
3. Compression (gzip/brotli)
4. CORS (configurable origin list)
5. express.json (body parser, 10MB limit)
6. Cookie parser
7. Input sanitizer (XSS prevention)
8. Request ID middleware (x-request-id header)
9. Morgan + Pino request logger
10. Rate limiter (500 req/min per IP)
  |
  v
Route Registry (19 domains mounted in safe order)
  |
  v
Per-route middleware:
  - authenticate (JWT verification)
  - requireRole('admin' | 'manager' | ...)
  - applyScopeFilter (row-level security)
  - Zod validation (request body/params)
  |
  v
Route handler -> Service layer -> Prisma ORM -> PostgreSQL
  |
  v
Error handler (structured JSON errors + Sentry capture)
```

### Route Registry

The `RouteRegistry` class prevents Express route shadowing by:

1. Collecting all domain route registrations lazily
2. Dry-running each registrar to introspect paths
3. Detecting static-vs-param shadowing conflicts
4. Sorting domains so static segments precede parameter segments
5. Mounting in computed safe order

```typescript
const registry = new RouteRegistry();
registry.register('auth',          registerAuthRoutes);
registry.register('inventory',     registerInventoryRoutes);
registry.register('master-data',   registerMasterDataRoutes);
// ... 14 more domains
registry.mount(router);
```

### Row-Level Security (Scope Filter)

The `applyScopeFilter` middleware implements row-level access control across 17 user roles:

| Scope | Roles | Prisma Filter |
|---|---|---|
| Unrestricted | admin, manager, qc_officer, logistics_coordinator, freight_forwarder, transport_supervisor, scrap_committee_member, technical_manager, finance_user, compliance_officer, shipping_officer, customs_specialist | `{}` (no filter) |
| Warehouse-scoped | warehouse_supervisor, warehouse_staff, gate_officer, inventory_specialist | `{ warehouseId: assignedWarehouseId }` |
| Project-scoped | site_engineer | `{ projectId: assignedProjectId }` |

---

## 5. Domain Relationships and Data Flow

### Inbound Flow (Receiving)

```
Supplier -> ASN -> GRN (MRRV) -> QCI (RFIM) -> Put-away
                       |              |
                       v              v
                  Inventory      DR (OSD Report)
                  Level Update   (Discrepancy)
```

### Outbound Flow (Issuance)

```
MR (MRF) -> Approval -> MRN (MRV) -> MI (MIRV) -> Gate Pass -> Shipment
  (request)               (note)      (issue)       (exit)
                             |
                             v
                        Inventory
                        Level Update
```

### Transfer Flow

```
WT (Stock Transfer) -> Handover -> IMSF (Inter-Site)
       |
       v
  Source WH -qty / Dest WH +qty
```

### Wave Picking Flow

```
MI (MIRV) docs -> Wave Header -> Wave Lines -> Pick Tasks -> Pack -> Ship
                  (planning)     (pick list)   (WMS Tasks)
```

### Job Order Flow

```
Job Order -> Quotation -> Approval -> Assignment -> Execution -> Completion
                |                                      |
                v                                      v
           Cost Tracking                         SLA Tracking
```

---

## 6. Event Bus Topology (Socket.IO)

Socket.IO uses JWT-authenticated connections with three room types:

```
+------------------+     +------------------+     +-------------------+
| role:{roleName}  |     | user:{userId}    |     | doc:{documentId}  |
+------------------+     +------------------+     +-------------------+
| Broadcast to all |     | Direct user      |     | Live document     |
| users in a role  |     | notifications    |     | collaboration     |
+------------------+     +------------------+     +-------------------+
```

### Key Socket Events

| Event | Direction | Description |
|---|---|---|
| `sla:breached` | Server -> role rooms | SLA deadline exceeded |
| `sla:warning` | Server -> role rooms | SLA deadline approaching (1h) |
| `inventory:reconciliation` | Server -> role rooms | Daily reconciliation results |
| `inventory:gate-reconciliation` | Server -> role rooms | Gate-vs-MI mismatch |
| `auth:expired` | Server -> user | JWT expired, force re-login |
| `join:document` | Client -> Server | Subscribe to document updates |
| `leave:document` | Client -> Server | Unsubscribe from document |

### Security Features

- JWT verification on connection
- Rate limiting: 30 events per 10 seconds per socket
- Token re-validation every 5 minutes on long-lived connections
- Permission-based entity event broadcasting (`emitEntityEvent`)
- Input validation on document IDs (max 64 chars)

---

## 7. Queue Routing (BullMQ)

11 named queues plus a dead-letter queue, aligned with Oracle EBS module naming:

```
+-- WMS_QUEUE -------- SLA breach/warning, scheduled rules, reports,
|                      daily reconciliation, asset depreciation,
|                      AMC expiry, vehicle maintenance
|
+-- RCV_QUEUE -------- GRN processing, ASN processing, putaway
|
+-- INV_QUEUE -------- ABC classification, low stock, expired lots,
|                      cycle counts, gate pass expiry, anomaly detection,
|                      reorder points, expiry alerts, quarantine
|
+-- SHIP_QUEUE ------- Shipment processing, gate passes, dispatch
|
+-- CUST_QUEUE ------- Customs tariffs, compliance documents
|
+-- ASN_QUEUE -------- Advanced shipping notice processing
|
+-- GRN_QUEUE -------- Goods receipt note processing
|
+-- PICK_QUEUE ------- Wave planning, pick optimization
|
+-- PUT_QUEUE -------- Directed putaway, slotting
|
+-- AUD_QUEUE -------- Token cleanup, security monitor, visitor overstay
|
+-- NOTIF_QUEUE ------ Email retry, equipment return, shipment delays,
|                      cycle count alerts, rate card expiry, vehicle
|                      maintenance alerts, NCR deadlines, contract
|                      renewal, overdue tools
|
+-- DEAD_LETTER_QUEUE  Failed jobs after max retries
```

### Job Default Settings

- Max retries: 3 (configurable per job, up to 5)
- Backoff: exponential, starting at 5-120 seconds
- Completed job retention: 100 records
- Failed job retention: 500 records
- Priority scale: 1 (urgent) through 8 (batch)

---

## 8. Scheduled Jobs Summary

28 registered jobs across 4 job files:

| Job | Interval | Queue | Priority | Description |
|---|---|---|---|---|
| `sla_breach` | 5 min | WMS | 1 | Detect SLA breaches on approvals, MR, JO, gate passes, scrap, surplus, QCI |
| `sla_warning` | 5 min | WMS | 1 | 1-hour advance warning for approaching SLA deadlines |
| `scheduled_rules` | 1 min | WMS | 2 | Execute workflow automation rules |
| `email_retry` | 2 min | NOTIF | 1 | Retry failed email sends |
| `low_stock` | 30 min | INV | 2 | Alert on items below min level or reorder point |
| `visitor_overstay` | 30 min | AUD | 4 | Detect visitors exceeding expected duration |
| `expired_lots` | 1 hr | INV | 3 | Mark expired inventory lots |
| `gate_pass_expiry` | 1 hr | INV | 4 | Cancel gate passes past validUntil |
| `scheduled_reports` | 1 hr | WMS | 5 | Generate daily/weekly/monthly/quarterly reports |
| `security_monitor` | 1 hr | AUD | 2 | Detect suspicious login activity |
| `anomaly_detection` | 6 hr | INV | 5 | Statistical anomaly detection on inventory data |
| `token_cleanup` | 6 hr | AUD | 7 | Remove expired JWT refresh tokens |
| `sow_shipment_delays` | 6 hr | NOTIF | 3 | Alert on delayed shipments |
| `vehicle_maintenance` | 12 hr | WMS | 4 | Usage-based vehicle maintenance scheduling |
| `sow_vehicle_maint` | 12 hr | NOTIF | 4 | Vehicle maintenance due alerts |
| `sow_overdue_tools` | 12 hr | NOTIF | 4 | Overdue tool return alerts |
| `expiry_quarantine` | 12 hr | INV | 2 | Auto-quarantine expired lots |
| `cycle_count_auto` | 24 hr | INV | 5 | Auto-create cycle counts (ABC-based frequency) |
| `daily_reconciliation` | 24 hr | WMS | 3 | Lot totals + gate-vs-MI reconciliation |
| `asset_depreciation` | 24 hr | WMS | 6 | Calculate straight-line depreciation |
| `amc_expiry` | 24 hr | WMS | 5 | AMC/maintenance contract expiry check |
| `expiry_alerts` | 24 hr | INV | 3 | Expiry date approaching alerts |
| `sow_equipment_return` | 24 hr | NOTIF | 5 | Equipment return date approaching |
| `sow_cycle_count` | 24 hr | NOTIF | 5 | Scheduled cycle count alerts |
| `sow_rate_card_expiry` | 24 hr | NOTIF | 5 | Rate card expiring alerts |
| `sow_ncr_deadline` | 24 hr | NOTIF | 4 | NCR/DR deadline approaching |
| `sow_contract_renewal` | 24 hr | NOTIF | 5 | Contract/insurance renewal due |
| `abc_classification` | 7 days | INV | 8 | Recalculate ABC classification |
| `reorder_update` | 7 days | INV | 8 | Auto-update reorder points from forecast |

---

## 9. Infrastructure Layers

### Database Layer

- **ORM**: Prisma 6 with multi-file schema (`prisma/schema/*.prisma`)
- **Database**: PostgreSQL (tables `@@map`ped to Oracle naming conventions, e.g., `WMS_LICENSE_PLATES`)
- **Indexes**: 368+ composite indexes for query performance
- **Migrations**: `prisma migrate dev` / `prisma migrate deploy`
- **Connection pooling**: Prisma default (5 connections dev, configurable in production)

### Caching Layer

- **Redis** (ioredis): Rate limiting, token blacklisting, BullMQ backing store
- **Connection**: Exponential backoff with jitter, max 20 retry attempts, 30s cap
- **Health**: Periodic PING (every 30s), memory usage monitoring (alert at 85%)
- **TLS**: Auto-detected from `rediss://` protocol (Upstash compatible)

### Observability

- **Logging**: Pino structured JSON (production) / pino-pretty (development)
- **Error tracking**: Sentry (@sentry/node for backend, @sentry/react for frontend)
- **Queue monitoring**: Bull Board dashboard at `/admin/queues` (admin only)
- **Health checks**: `/api/v1/health` (public), `/api/v1/health/details` (admin), `/api/v1/live`, `/api/v1/ready`

### Frontend Build

- **Bundler**: Vite 6 with HMR
- **State**: React Query v5 (server state), Zustand (client state)
- **Forms**: React Hook Form + Zod validation
- **PDF**: jsPDF (lazy-loaded, ~400KB)
- **Icons**: Lucide React (exclusively)
- **Tables**: TanStack React Table v8

---

## 10. Security Architecture

```
+-- Authentication -------+-- Authorization ----------+-- Data Security --------+
| JWT access tokens (15m) | 17 system roles            | Row-level scope filter  |
| JWT refresh tokens (7d) | Resource-action RBAC       | Warehouse/project scope |
| Token blacklisting      | Route-level requireRole()  | Audit trail             |
| Rate limiting (500/min) | Socket permission checks   | Input sanitization      |
| Helmet security headers | Approval workflows         | Zod request validation  |
| CORS origin whitelist   | Digital signatures         | CSP headers             |
+-------------------------+--------------------------+-------------------------+
```

### V1 to V2 Name Mapping

Internal Prisma model names (V1) map to display names (V2) at the API boundary:

| V1 (Internal) | V2 (Display) | Document Type |
|---|---|---|
| MRRV | GRN | Goods Receipt Note |
| MIRV | MI | Material Issue |
| MRV | MRN | Material Return Note |
| RFIM | QCI | Quality Control Inspection |
| OSD | DR | Discrepancy Report |
| MRF | MR | Material Requisition |
| StockTransfer | WT | Warehouse Transfer |

---

## 11. Deployment Topology

```
+-------------------+
|   Load Balancer   |
+--------+----------+
         |
    +----+----+
    |         |
+---v---+ +---v---+
| App 1 | | App 2 |    Express + Socket.IO instances
+---+---+ +---+---+
    |         |
    +----+----+
         |
    +----v---------+     +------------+
    | PostgreSQL   |     | Redis      |
    | (Primary)    |     | (Upstash)  |
    +--------------+     +------------+
```

- Horizontal scaling: Socket.IO with Redis adapter for cross-instance communication
- Health probes: Kubernetes-compatible `/live` and `/ready` endpoints
- Graceful shutdown: Workers close before queues, Redis disconnects last
