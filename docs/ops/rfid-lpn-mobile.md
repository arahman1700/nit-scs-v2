# RFID, LPN, and WMS Mobile Workflow Guide

Last updated: 2026-03-12

---

## 1. Overview

This guide covers the five interconnected WMS mobile subsystems in NIT-SCS V2:

- **LPN (License Plate Number)** -- container/pallet tracking through the warehouse lifecycle
- **RFID** -- radio-frequency identification tag management, scanning, and location tracking
- **WMS Task Queue** -- directed warehouse worker tasks for mobile handheld devices
- **Wave Picking** -- batch-optimized pick planning for outbound operations
- **Stock Allocation** -- real-time reservation engine for demand documents

All models are defined in `packages/backend/prisma/schema/16-logistics-enhancement.prisma` and mapped to Oracle WMS table names (e.g., `WMS_LICENSE_PLATES`, `WMS_RFID_TAGS`, `WMS_TASK_QUEUE`).

**Source files are under `packages/backend/src/domains/warehouse-ops/`:**

| Component | Service | Routes |
|---|---|---|
| LPN | `services/lpn.service.ts` | `routes/lpn.routes.ts` |
| RFID | `services/rfid.service.ts` | `routes/rfid.routes.ts` |
| WMS Task | `services/wms-task.service.ts` | `routes/wms-task.routes.ts` |
| Wave | `services/wave.service.ts` | `routes/wave.routes.ts` |
| Stock Alloc | `services/stock-allocation.service.ts` | `routes/stock-allocation.routes.ts` |

---

## 2. LPN (License Plate Number) Lifecycle

An LPN is a unique container identifier (pallet, carton, tote, or crate) that tracks items through the warehouse from receiving dock to shipping door.

### 2.1 LPN Types

| Type | Description | Typical Use |
|---|---|---|
| `pallet` | Standard warehouse pallet | Bulk storage, putaway |
| `carton` | Cardboard shipping carton | Outbound shipments |
| `tote` | Reusable plastic tote | Internal picks, replenishment |
| `crate` | Wooden/metal crate | Heavy items, equipment |
| `mixed` | Multi-item container | Cross-dock, consolidation |

### 2.2 State Machine (7 States)

```
                         dissolve()
              +---------------------------+
              |                           |
              v                           |
  +--------+    +--------------+    +--------+    +------------+
  |created | -> |in_receiving  | -> |stored  | -> |in_picking  |
  +--------+    +--------------+    +--------+    +------------+
                                                       |
                                                       v
                                    +------------+    +------------+
                                    |  shipped   | <- |in_packing  |
                                    +------------+    +------------+
                                          ^
                                          |
                                    +------------+
                                    | dissolved  |  (terminal, from any
                                    +------------+   non-terminal state
                                                     except shipped)
```

### 2.3 State Transitions

| Transition | Method | From State | To State | When |
|---|---|---|---|---|
| Create | `createLpn()` | -- | `created` | New container registered at receiving dock |
| Receive | `receiveLpn()` | `created` | `in_receiving` | GRN processing, items being unloaded |
| Store | `storeLpn()` | `in_receiving` | `stored` | Putaway complete, LPN in storage bin |
| Pick | `pickLpn()` | `stored` | `in_picking` | Wave pick or direct pick initiated |
| Pack | `packLpn()` | `in_picking` | `in_packing` | Items verified, packing started |
| Ship | `shipLpn()` | `in_packing` | `shipped` | Loaded on vehicle, gate pass released |
| Dissolve | `dissolveLpn()` | any (not shipped/dissolved) | `dissolved` | Container emptied, decommissioned |

### 2.4 LPN Data Model

```
LicensePlate (@@map "WMS_LICENSE_PLATES")
  |-- id            UUID (PK)
  |-- lpnNumber     VARCHAR(30) UNIQUE   e.g., "LPN-2026-00042"
  |-- warehouseId   FK -> Warehouse
  |-- zoneId        FK -> WarehouseZone (nullable)
  |-- binId         FK -> BinLocation (nullable)
  |-- lpnType       'pallet' | 'carton' | 'tote' | 'crate' | 'mixed'
  |-- status        7 states (see above)
  |-- parentLpnId   FK -> self (nullable, for nested LPNs)
  |-- weight        DECIMAL(12,3)
  |-- volume        DECIMAL(12,3)
  |-- sourceDocType e.g., 'grn', 'asn'
  |-- sourceDocId   FK to source document
  |
  +-- contents[]    LpnContent (item-level detail)
  |     |-- itemId, lotId, quantity, uomId, expiryDate
  |
  +-- rfidTags[]    RfidTag (associated RFID tags)
  +-- childLpns[]   LicensePlate[] (nested containers)
```

### 2.5 Content Management

LPN contents are managed at the item/lot level:

```
POST /api/v1/lpns/:id/contents
{
  "itemId": "uuid",
  "lotId": "uuid",          // optional
  "quantity": 100,
  "uomId": "uuid",          // optional
  "expiryDate": "2026-12-31" // optional
}

DELETE /api/v1/lpns/:id/contents/:contentId
```

### 2.6 LPN Move

Relocate an LPN to a different zone/bin without changing its status:

```
PUT /api/v1/lpns/:id/move
{
  "zoneId": "uuid",
  "binId": "uuid"
}
```

### 2.7 Mobile Flow: Receiving with LPN

```
1. Truck arrives at dock door
2. Gate officer scans GRN barcode
3. System auto-creates LPN:
   POST /api/v1/lpns { warehouseId, lpnType: 'pallet' }
4. Worker scans items into LPN:
   POST /api/v1/lpns/:id/contents { itemId, quantity }
5. System transitions LPN:
   POST /api/v1/lpns/:id/receive
6. Putaway task created:
   WMS Task type='putaway' linked to LPN
7. Worker moves to bin, scans bin barcode
8. System transitions LPN:
   POST /api/v1/lpns/:id/store
```

### 2.8 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/lpns` | Create new LPN |
| `GET` | `/api/v1/lpns` | List LPNs (filter: warehouse, status, type) |
| `GET` | `/api/v1/lpns/:id` | Get LPN with contents and RFID tags |
| `POST` | `/api/v1/lpns/:id/receive` | Transition: created -> in_receiving |
| `POST` | `/api/v1/lpns/:id/store` | Transition: in_receiving -> stored |
| `POST` | `/api/v1/lpns/:id/pick` | Transition: stored -> in_picking |
| `POST` | `/api/v1/lpns/:id/pack` | Transition: in_picking -> in_packing |
| `POST` | `/api/v1/lpns/:id/ship` | Transition: in_packing -> shipped |
| `POST` | `/api/v1/lpns/:id/dissolve` | Dissolve (terminal) |
| `PUT` | `/api/v1/lpns/:id/move` | Relocate to zone/bin |
| `POST` | `/api/v1/lpns/:id/contents` | Add content line |
| `DELETE` | `/api/v1/lpns/:id/contents/:cid` | Remove content line |
| `GET` | `/api/v1/lpns/stats` | Stats by status |

---

## 3. RFID Tag Management

RFID tags provide automatic identification and location tracking for LPNs, individual items, assets, and zone gates.

### 3.1 Tag Types

| Tag Type | Attached To | Purpose |
|---|---|---|
| `lpn` | LicensePlate | Track container movement through gate readers |
| `item` | Item | Individual high-value item tracking |
| `asset` | Asset | Fixed asset tracking (equipment, tools) |
| `zone_gate` | WarehouseZone | Zone transition detection (fixed readers) |

### 3.2 RFID Data Model

```
RfidTag (@@map "WMS_RFID_TAGS")
  |-- id            UUID (PK)
  |-- epc           VARCHAR(96) UNIQUE   -- Electronic Product Code
  |-- tagType       'lpn' | 'item' | 'asset' | 'zone_gate'
  |-- lpnId         FK -> LicensePlate (nullable)
  |-- itemId        FK -> Item (nullable)
  |-- assetId       FK -> Asset (nullable)
  |-- warehouseId   FK -> Warehouse
  |-- isActive      BOOLEAN (default true)
  |-- lastSeenAt    TIMESTAMPTZ (nullable)
  |-- lastReaderId  VARCHAR(50) (nullable, reader device ID)
  |-- createdAt     TIMESTAMPTZ
```

### 3.3 Tag Registration Flow

```
1. Admin registers tag
   POST /api/v1/rfid
   { "epc": "3034...", "tagType": "lpn", "warehouseId": "uuid" }

2. Associate tag with entity
   POST /api/v1/rfid/:id/associate-lpn
   { "lpnId": "uuid" }

3. Tag is now active and scannable
```

### 3.4 Single Scan Flow

When a reader detects a tag:

```
POST /api/v1/rfid/scan
{
  "epc": "3034257BF400...",
  "readerId": "GATE-A-READER-01"
}

Response:
{
  "epc": "3034257BF400...",
  "tagType": "lpn",
  "lastSeenAt": "2026-03-12T10:30:00Z",
  "lastReaderId": "GATE-A-READER-01",
  "lpn": { "id": "...", "lpnNumber": "LPN-2026-00042", "status": "stored" }
}
```

Scan validation:
- Tag must exist in the system (throws `NotFoundError` otherwise)
- Tag must be active (`isActive = true`; deactivated tags throw an error)
- Updates `lastSeenAt` and `lastReaderId` on every successful scan

### 3.5 Bulk Scan Flow

For dock-door or aisle-pass scenarios where a reader detects multiple tags simultaneously:

```
POST /api/v1/rfid/bulk-scan
{
  "scans": [
    { "epc": "3034257BF400...", "readerId": "GATE-A-READER-01" },
    { "epc": "3034257BF401...", "readerId": "GATE-A-READER-01" },
    { "epc": "UNKNOWN-EPC-999", "readerId": "GATE-A-READER-01" }
  ]
}

Response:
{
  "results": [
    { "epc": "3034257BF400...", "found": true, "tagType": "lpn" },
    { "epc": "3034257BF401...", "found": true, "tagType": "item" },
    { "epc": "UNKNOWN-EPC-999", "found": false }
  ]
}
```

Not-found or inactive EPCs are returned with `found: false` -- they do not cause errors. This allows the caller to flag unregistered tags for investigation.

### 3.6 Deactivation

Deactivated tags reject all future scan events:

```
POST /api/v1/rfid/:id/deactivate
```

### 3.7 Statistics

```
GET /api/v1/rfid/stats?warehouseId=uuid

{
  "totalActive": 1250,
  "totalInactive": 38,
  "byType": {
    "lpn": 890,
    "item": 215,
    "asset": 120,
    "zone_gate": 25
  }
}
```

### 3.8 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/rfid` | Register new RFID tag |
| `GET` | `/api/v1/rfid` | List tags (filter: warehouse, type, active, lpn) |
| `GET` | `/api/v1/rfid/:id` | Get tag by ID |
| `GET` | `/api/v1/rfid/epc/:epc` | Lookup tag by EPC code |
| `POST` | `/api/v1/rfid/scan` | Record single scan event |
| `POST` | `/api/v1/rfid/bulk-scan` | Batch scan (multiple EPCs) |
| `POST` | `/api/v1/rfid/:id/associate-lpn` | Link tag to LPN |
| `POST` | `/api/v1/rfid/:id/deactivate` | Deactivate tag |
| `GET` | `/api/v1/rfid/stats` | Stats by type (active/inactive) |

### 3.9 Guard Rails

- Cannot scan a deactivated tag (throws error)
- Duplicate EPC registration returns conflict error (EPC is unique)
- Bulk scan processes valid tags and returns `found: false` for invalid ones
- Association with LPN auto-sets `tagType` to `'lpn'`

---

## 4. WMS Task Queue

The WMS Task Queue provides directed work instructions for warehouse workers using mobile handheld devices. Each task represents a single unit of work with a specific type, priority, source/destination locations, and time tracking.

### 4.1 Task Types (9 Types)

| Type | Description | Typical Source |
|---|---|---|
| `receive` | Unload items from vehicle to receiving dock | GRN/ASN document |
| `putaway` | Move items from dock to storage bin | Put-away rules engine |
| `pick` | Retrieve items from storage bin for an order | Wave line / MI document |
| `pack` | Pack picked items into shipping containers | Packing station assignment |
| `replenish` | Move stock from reserve to forward pick zone | Low pick-face trigger |
| `count` | Perform cycle count at a bin location | Cycle count schedule |
| `move` | Relocate items between zones/bins | Manual request or slotting |
| `load` | Load packed LPNs onto vehicle at shipping dock | Shipment / transport order |
| `unload` | Unload LPNs from vehicle at receiving dock | Inbound ASN / GRN |

### 4.2 Task State Machine (6 States)

```
+----------+     assign()     +----------+     start()      +--------------+
| pending  | --------------> | assigned | --------------> | in_progress  |
+----------+                  +----------+                  +--------------+
                                                             |    |     |
                                                  complete() |    |     | hold()
                                                             v    |     v
                                                      +-----------+  +---------+
                                                      | completed |  | on_hold |
                                                      +-----------+  +---------+
                                                                         |
                                                              resume()   |
                                                                         v
                                                                   in_progress
                                                                   (loops back)

  cancel() is allowed from: pending, assigned, in_progress, on_hold
  cancel() is NOT allowed from: completed, cancelled
```

### 4.3 State Transitions Detail

| Transition | Method | From | To | Side Effects |
|---|---|---|---|---|
| Assign | `assignTask()` | `pending` | `assigned` | Sets `assignedToId`, `assignedAt` |
| Start | `startTask()` | `assigned` | `in_progress` | Records `startedAt` timestamp |
| Complete | `completeTask()` | `in_progress` | `completed` | Records `completedAt`, computes `actualMins` |
| Cancel | `cancelTask()` | any non-terminal | `cancelled` | No side effects |
| Hold | `holdTask()` | `in_progress` | `on_hold` | Pauses time tracking |
| Resume | `resumeTask()` | `on_hold` | `in_progress` | Resumes work |

### 4.4 Time Tracking

Each task can have two time values:

| Field | Source | Description |
|---|---|---|
| `estimatedMins` | Labor standards | Predicted time from task type + item + distance |
| `actualMins` | Auto-calculated | `(completedAt - startedAt)` in minutes, rounded to 2 decimals |

These feed into worker productivity analytics and labor standard calibration.

### 4.5 Priority Scale

| Priority | Label | Use Case |
|---|---|---|
| 1 | Urgent | Cross-dock, time-critical orders |
| 2 | High | Replenishment for empty pick faces |
| 3 | Normal | Standard picks and putaways (default) |
| 4 | Low | Inventory moves, reorganization |
| 5 | Batch | Bulk cycle counts, non-urgent moves |

Tasks are sorted by priority ascending (1 first), then creation date descending.

### 4.6 My Tasks (Mobile Endpoint)

Workers on handheld devices see only their assigned tasks:

```
GET /api/v1/wms-tasks/my-tasks?status=assigned
```

Returns tasks ordered by priority (ascending) then creation date (descending).

### 4.7 Bulk Assignment

Supervisors can assign multiple pending tasks to a single worker:

```
POST /api/v1/wms-tasks/bulk-assign
{
  "taskIds": ["uuid1", "uuid2", "uuid3"],
  "employeeId": "uuid"
}
```

All tasks must be in `pending` status. If any task is not pending, the entire operation fails.

### 4.8 Task Statistics

```
GET /api/v1/wms-tasks/stats?warehouseId=uuid

{
  "pending": 12,
  "assigned": 8,
  "inProgress": 5,
  "completed": 342,
  "cancelled": 3,
  "onHold": 1,
  "avgCompletionMins": 7.2
}
```

### 4.9 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/wms-tasks` | Create new task |
| `GET` | `/api/v1/wms-tasks` | List tasks (filter: warehouse, status, type, assignee, priority) |
| `GET` | `/api/v1/wms-tasks/:id` | Get task detail |
| `POST` | `/api/v1/wms-tasks/:id/assign` | Assign to employee |
| `POST` | `/api/v1/wms-tasks/:id/start` | Start task |
| `POST` | `/api/v1/wms-tasks/:id/complete` | Complete task |
| `POST` | `/api/v1/wms-tasks/:id/cancel` | Cancel task |
| `POST` | `/api/v1/wms-tasks/:id/hold` | Place on hold |
| `POST` | `/api/v1/wms-tasks/:id/resume` | Resume from hold |
| `POST` | `/api/v1/wms-tasks/bulk-assign` | Bulk assign tasks |
| `GET` | `/api/v1/wms-tasks/my-tasks` | Worker's own tasks |
| `GET` | `/api/v1/wms-tasks/stats` | Dashboard statistics |

---

## 5. Wave Picking

Wave picking groups multiple MI (Material Issue / MIRV) documents into batches for optimized warehouse traversal. A wave consolidates pick lines across orders and sequences them by zone/aisle/bin for minimum travel distance.

### 5.1 Wave State Machine (5 States)

```
+-----------+     release()    +----------+     (auto)      +---------+
| planning  | --------------> | released | --------------> | picking |
+-----------+                  +----------+                  +---------+
                                                                |
                                                     (all lines picked)
                                                                v
                                                          +-----------+
                                                          | completed |
                                                          +-----------+

  cancel() is allowed from: planning, released
```

| State | Description |
|---|---|
| `planning` | Wave is being built -- MI docs and lines being added |
| `released` | Wave released for execution -- pick tasks generated |
| `picking` | Workers actively picking lines |
| `completed` | All wave lines picked (or short-closed) |
| `cancelled` | Wave cancelled before completion |

### 5.2 Wave Types

| Type | Description |
|---|---|
| `manual` | Supervisor manually selects MIs for the wave |
| `auto` | System groups MIs by zone proximity automatically |
| `priority` | Urgent orders grouped for immediate execution |

### 5.3 Wave Data Model

```
WaveHeader (@@map "WMS_WAVE_HEADERS")
  |-- id, waveNumber, warehouseId
  |-- status       'planning' | 'released' | 'picking' | 'completed' | 'cancelled'
  |-- waveType     'manual' | 'auto' | 'priority'
  |-- totalLines   INT (count of all wave lines)
  |-- pickedLines  INT (count of completed lines)
  |-- releasedAt, completedAt
  |
  +-- lines[]  WaveLine (@@map "WMS_WAVE_LINES")
        |-- mirvId        FK -> MIRV (Material Issue doc)
        |-- mirvLineId    FK -> MIRV line (nullable)
        |-- itemId        FK -> Item
        |-- qtyRequired   DECIMAL(12,3)
        |-- qtyPicked     DECIMAL(12,3) (default 0)
        |-- fromZoneId, fromBinId, lotId
        |-- status        'pending' | 'picking' | 'picked' | 'short' | 'cancelled'
        |-- pickedById, pickedAt
        |-- sequence      INT (pick sequence for zone optimization)
```

### 5.4 Wave Line States

```
pending --> picking --> picked
               |
               +--> short (insufficient stock at bin)
               |
               +--> cancelled
```

### 5.5 Wave Planning Workflow

```
1. Create wave header
   POST /api/v1/waves
   { "warehouseId": "uuid", "waveType": "manual" }

2. Add MI documents to wave
   POST /api/v1/waves/:id/lines
   {
     "mirvId": "uuid",
     "itemId": "uuid",
     "qtyRequired": 100,
     "fromBinId": "uuid",
     "sequence": 1
   }

3. System sequences lines by zone/aisle/bin for optimal pick path

4. Release wave (generates WMS pick tasks)
   POST /api/v1/waves/:id/release

5. Workers pick using WMS task queue (mobile)

6. Wave auto-completes when all lines are picked/short/cancelled
```

### 5.6 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/waves` | Create new wave header |
| `GET` | `/api/v1/waves` | List waves (filter: warehouse, status) |
| `GET` | `/api/v1/waves/:id` | Get wave with lines |
| `POST` | `/api/v1/waves/:id/lines` | Add line to wave |
| `POST` | `/api/v1/waves/:id/release` | Release wave for picking |
| `POST` | `/api/v1/waves/:id/cancel` | Cancel wave |
| `GET` | `/api/v1/waves/stats` | Wave statistics |

---

## 6. Stock Allocation

The stock allocation engine provides real-time inventory reservation against demand documents (MI, MR, JO). Allocations can be soft (tentative) or hard (committed), and track through to pick confirmation.

### 6.1 Allocation Types

| Type | Description | When Used |
|---|---|---|
| `soft` | Tentative reservation, can be released | MR approved, stock check in progress |
| `hard` | Committed reservation, reduces available qty | MI created, wave released |
| `pick_confirmed` | Physically picked, awaiting shipment | Wave line picked |

### 6.2 Allocation Status (4 States)

```
+--------+    pick      +--------+
| active | ----------> | picked |
+--------+              +--------+
    |
    | release / cancel
    v
+-------------------+
| released/cancelled|
+-------------------+
```

| Status | Description |
|---|---|
| `active` | Allocation is live, qty is reserved |
| `picked` | Items physically picked |
| `released` | Allocation released (order cancelled, excess) |
| `cancelled` | Allocation voided |

### 6.3 Allocation Data Model

```
StockAllocation (@@map "WMS_STOCK_ALLOCATIONS")
  |-- id
  |-- warehouseId, itemId, lotId, binId, lpnId
  |-- qtyAllocated    DECIMAL(12,3)
  |-- allocType       'soft' | 'hard' | 'pick_confirmed'
  |-- demandDocType   'mi' | 'mr' | 'jo' | 'wt'
  |-- demandDocId     FK to demand document
  |-- status          'active' | 'picked' | 'released' | 'cancelled'
  |-- allocatedById, allocatedAt, releasedAt
```

### 6.4 API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/stock-allocations` | Create allocation |
| `GET` | `/api/v1/stock-allocations` | List allocations (filter: warehouse, item, status) |
| `GET` | `/api/v1/stock-allocations/:id` | Get allocation detail |
| `POST` | `/api/v1/stock-allocations/:id/release` | Release allocation |
| `POST` | `/api/v1/stock-allocations/:id/cancel` | Cancel allocation |
| `GET` | `/api/v1/stock-allocations/stats` | Allocation statistics |

---

## 7. Integration: End-to-End Outbound Flow

This section shows how LPN, RFID, WMS Tasks, Wave Picking, and Stock Allocation work together in a typical outbound (material issue) flow:

```
Step 1:  MR (Material Requisition) approved
         -> Stock allocation created (soft)

Step 2:  MR converted to MI (Material Issue)
         -> Stock allocation upgraded to hard

Step 3:  Wave planning groups multiple MIs
         -> Wave header created in 'planning' status
         -> Wave lines generated per item/bin

Step 4:  Wave released
         -> WMS pick tasks generated for each wave line
         -> Tasks assigned to available workers

Step 5:  Worker receives task on mobile device
         GET /api/v1/wms-tasks/my-tasks
         -> Task shows: item, from-bin, quantity

Step 6:  Worker navigates to bin, scans RFID
         POST /api/v1/rfid/scan { "epc": "...", "readerId": "HANDHELD-07" }
         -> Confirms correct location

Step 7:  Worker picks items, creates/loads LPN
         POST /api/v1/lpns/:id/pick
         POST /api/v1/wms-tasks/:id/complete

Step 8:  LPN moves to packing station
         POST /api/v1/lpns/:id/pack

Step 9:  LPN loaded onto vehicle
         POST /api/v1/wms-tasks (type: 'load')
         POST /api/v1/lpns/:id/ship

Step 10: Gate pass released, vehicle exits
         -> RFID gate reader performs bulk scan
         -> Confirms all expected LPNs are on vehicle
```

---

## 8. Cross-Dock Flow

Cross-docking bypasses putaway for items with immediate outbound demand:

```
GRN Received
     |
     v
[identifyCrossDockCandidates]  -- finds approved GRNs matching outbound demand
     |
     v
[createCrossDock]  -- links GRN item to outbound MI
     |
     v
[approveCrossDock]  -- manager approves bypass of putaway
     |
     v
[executeCrossDock]  -- atomic transaction:
     |                  1. Creates LPN for the item
     |                  2. Creates LPN content record
     |                  3. Creates WMS 'move' task (priority 1)
     |                  4. Updates cross-dock status to 'in_progress'
     |
     v
[completeCrossDock]  -- item reached outbound staging
```

---

## 9. Indexes and Performance

Key indexes on the logistics enhancement models:

| Index | Table | Columns | Purpose |
|---|---|---|---|
| `idx_wms_lpn_wh_status` | WMS_LICENSE_PLATES | warehouseId, status | Filter LPNs by warehouse and state |
| `idx_wms_lpn_zone` | WMS_LICENSE_PLATES | zoneId | Zone-level LPN queries |
| `idx_wms_lpn_bin` | WMS_LICENSE_PLATES | binId | Bin-level LPN queries |
| `idx_wms_lpn_parent` | WMS_LICENSE_PLATES | parentLpnId | Nested container lookups |
| `idx_wms_lpn_source` | WMS_LICENSE_PLATES | sourceDocType, sourceDocId | Trace LPN to source doc |
| `idx_wms_rfid_wh_active` | WMS_RFID_TAGS | warehouseId, isActive | Active tags per warehouse |
| `idx_wms_rfid_lpn` | WMS_RFID_TAGS | lpnId | Tags associated with an LPN |
| `idx_wms_rfid_type_active` | WMS_RFID_TAGS | tagType, isActive | Filter by tag type |
| `idx_wms_task_wh_status_pri` | WMS_TASK_QUEUE | warehouseId, status, priority | Task queue ordering |
| `idx_wms_task_assignee_status` | WMS_TASK_QUEUE | assignedToId, status | My tasks endpoint |
| `idx_wms_task_type_status` | WMS_TASK_QUEUE | taskType, status | Task type filtering |
| `idx_wms_task_source` | WMS_TASK_QUEUE | sourceDocType, sourceDocId | Trace task to source doc |
| `idx_wms_wave_wh_status` | WMS_WAVE_HEADERS | warehouseId, status | Wave dashboard |
| `idx_wms_wave_line_wave_status` | WMS_WAVE_LINES | waveId, status | Wave progress tracking |
| `idx_wms_wave_line_item` | WMS_WAVE_LINES | itemId | Item-level wave queries |
| `idx_wms_wave_line_mirv` | WMS_WAVE_LINES | mirvId | MI document wave queries |
| `idx_wms_alloc_wh_item_status` | WMS_STOCK_ALLOCATIONS | warehouseId, itemId, status | Available qty calculation |
| `idx_wms_alloc_demand` | WMS_STOCK_ALLOCATIONS | demandDocType, demandDocId | Allocations per demand doc |
| `idx_wms_alloc_lot_status` | WMS_STOCK_ALLOCATIONS | lotId, status | Lot-level allocation tracking |
| `idx_wms_alloc_status_date` | WMS_STOCK_ALLOCATIONS | status, allocatedAt | Allocation age queries |

---

## 10. Mobile Device Integration

### Supported Workflows

| Workflow | Scanner Type | Primary APIs |
|---|---|---|
| Receiving | Barcode + RFID | GRN + LPN + RFID |
| Putaway | Barcode (bin) | WMS Task + LPN |
| Picking | Barcode + RFID | Wave + WMS Task |
| Packing | Barcode | WMS Task + LPN |
| Cycle Count | Barcode | Inventory + WMS Task |
| Cross-Dock | Barcode | Cross-dock + LPN |
| Shipping | RFID (portal) | LPN + Gate Pass + Shipment |
| Loading/Unloading | RFID | WMS Task + LPN |

### PWA Support

The frontend is a Progressive Web App with:
- Offline queue for scan events (`useOfflineQueue` hook)
- Camera-based barcode scanning (`BarcodeScanner` component, lazy-loaded)
- Responsive layout for handheld devices
- Socket.IO real-time task updates
