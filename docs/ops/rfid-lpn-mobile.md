# RFID + LPN + WMS Task — Mobile Workflow Guide

Last updated: 2026-03-12

---

## Overview

This guide covers the P6 logistics enhancement features designed for mobile warehouse
operations: License Plate Number (LPN) tracking, RFID tag scanning, WMS task queue
management, wave picking, and stock allocation.

---

## 1. LPN (License Plate Number) Tracking

### State Machine

```
created --> in_receiving --> stored --> in_picking --> picked --> shipped --> destroyed
   |                           |                                    |
   +--- (destroy) ----------->+------------- (destroy) -----------+
```

### 7 States

| State | Description | Allowed Transitions |
|-------|-------------|-------------------|
| `created` | LPN generated (label printed) | `in_receiving` |
| `in_receiving` | Being received at dock door | `stored` |
| `stored` | Put away in bin location | `in_picking` |
| `in_picking` | Being picked for outbound | `picked` |
| `picked` | Pick complete, awaiting ship | `shipped` |
| `shipped` | Left the warehouse | `destroyed` |
| `destroyed` | Scrapped / decommissioned | (terminal) |

### API Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/v1/lpn` | List LPNs (paginated, filterable) |
| GET | `/api/v1/lpn/:id` | Get LPN detail with contents |
| POST | `/api/v1/lpn` | Create new LPN |
| POST | `/api/v1/lpn/:id/receive` | Transition to `in_receiving` |
| POST | `/api/v1/lpn/:id/store` | Transition to `stored` |
| POST | `/api/v1/lpn/:id/pick` | Transition to `in_picking` |
| POST | `/api/v1/lpn/:id/ship` | Transition to `shipped` |
| POST | `/api/v1/lpn/:id/destroy` | Transition to `destroyed` |
| POST | `/api/v1/lpn/:id/content` | Add items to LPN |
| DELETE | `/api/v1/lpn/:id/content/:contentId` | Remove items from LPN |

### LPN Number Format

```
LPN-{warehouseCode}-{timestamp36}-{sequence}
Example: LPN-WH01-M3K2A-001
```

### Mobile Flow: Receiving with LPN

```
1. Truck arrives at dock door
2. Gate officer scans GRN barcode
3. System auto-creates LPN: POST /lpn { warehouseId, lpnType: 'pallet' }
4. Worker scans items into LPN: POST /lpn/:id/content { itemId, quantity }
5. System transitions LPN: POST /lpn/:id/receive
6. Putaway task created: WMS Task type='putaway' linked to LPN
7. Worker moves to bin, scans bin barcode
8. System transitions LPN: POST /lpn/:id/store
```

---

## 2. RFID Tag Management

### Tag Types

| Type | Use Case | Attached To |
|------|----------|-------------|
| `lpn` | Pallet/carton tracking | LPN label |
| `asset` | Equipment tracking | Tool/vehicle |
| `location` | Zone/bin identification | Rack/shelf |

### API Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/v1/rfid` | List tags (filterable by warehouse, type, status) |
| GET | `/api/v1/rfid/stats` | Tag statistics by warehouse |
| GET | `/api/v1/rfid/epc/:epc` | Lookup tag by EPC code |
| GET | `/api/v1/rfid/:id` | Get tag detail |
| POST | `/api/v1/rfid` | Register new tag |
| POST | `/api/v1/rfid/scan` | Record single scan event |
| POST | `/api/v1/rfid/bulk-scan` | Process multiple scan events |
| PATCH | `/api/v1/rfid/:id/associate-lpn` | Link tag to LPN |
| PATCH | `/api/v1/rfid/:id/deactivate` | Deactivate tag |

### Mobile Flow: RFID Scan

```
1. Handheld reader scans tags in range
2. Device sends bulk scan: POST /rfid/bulk-scan { scans: [{ epc, readerId }] }
3. System updates lastSeenAt, lastReaderId for each tag
4. Deactivated tags are flagged and returned as errors
5. New/unknown EPCs are returned for manual registration
```

### EPC Format

```
E200-{warehouseCode}-{sequence}
Example: E200-WH01-00001
```

### Guard Rails

- Cannot scan a deactivated tag (returns error)
- Duplicate EPC registration returns 409 Conflict
- Bulk scan processes valid tags and returns errors for invalid ones

---

## 3. WMS Task Queue

### Task Types (9)

| Type | Description | Source |
|------|-------------|--------|
| `receive` | Receive goods at dock | GRN/ASN |
| `putaway` | Move from staging to bin | Putaway rules |
| `pick` | Pick items for outbound | Wave/MI |
| `pack` | Pack items for shipment | Pick completion |
| `replenish` | Refill pick-face bin | Low stock trigger |
| `count` | Cycle count a location | Count schedule |
| `move` | Move between locations | Cross-dock/reorg |
| `load` | Load onto truck | Shipment |
| `unload` | Unload from truck | GRN receiving |

### State Machine

```
pending --> assigned --> in_progress --> completed
   |           |             |
   |           |             +---> cancelled
   |           +---> on_hold ---> in_progress (resume)
   +---> cancelled
```

### 6 States

| State | Description | Allowed Transitions |
|-------|-------------|-------------------|
| `pending` | Created, unassigned | `assigned`, `cancelled` |
| `assigned` | Assigned to employee | `in_progress`, `on_hold`, `cancelled` |
| `in_progress` | Work actively underway | `completed`, `on_hold`, `cancelled` |
| `on_hold` | Temporarily paused | `in_progress` (resume) |
| `completed` | Successfully finished | (terminal) |
| `cancelled` | Abandoned/cancelled | (terminal) |

### API Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/v1/wms-tasks` | List tasks (paginated, filterable) |
| GET | `/api/v1/wms-tasks/stats` | Task statistics |
| GET | `/api/v1/wms-tasks/my-tasks` | Tasks for logged-in user |
| GET | `/api/v1/wms-tasks/:id` | Task detail |
| POST | `/api/v1/wms-tasks` | Create task |
| PATCH | `/api/v1/wms-tasks/:id/assign` | Assign to employee |
| PATCH | `/api/v1/wms-tasks/:id/start` | Start task |
| PATCH | `/api/v1/wms-tasks/:id/complete` | Complete task |
| PATCH | `/api/v1/wms-tasks/:id/cancel` | Cancel task |
| PATCH | `/api/v1/wms-tasks/:id/hold` | Put on hold |
| PATCH | `/api/v1/wms-tasks/:id/resume` | Resume from hold |
| POST | `/api/v1/wms-tasks/bulk-assign` | Batch assign tasks |

### Guard Rails

- Cannot assign to non-existent employee (404 error)
- Cannot complete a task not in `in_progress` state
- Cannot skip states (pending -> completed is invalid)
- All state transitions are audited

---

## 4. Wave Picking

### State Machine

```
planning --> released --> picking --> completed
                |            |
                +-> cancelled +-> cancelled
```

### 5 States

| State | Description |
|-------|-------------|
| `planning` | Wave being configured, lines added |
| `released` | Wave released for picking |
| `picking` | Pickers actively working |
| `completed` | All lines picked or short-closed |
| `cancelled` | Wave cancelled before completion |

### API Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/v1/waves` | List waves |
| GET | `/api/v1/waves/:id` | Wave detail with lines |
| POST | `/api/v1/waves` | Create wave |
| POST | `/api/v1/waves/:id/lines` | Add lines to wave |
| POST | `/api/v1/waves/:id/release` | Release for picking |
| POST | `/api/v1/waves/:id/pick-line` | Mark line as picked |
| POST | `/api/v1/waves/:id/short-line` | Short-close a line |
| POST | `/api/v1/waves/:id/complete` | Complete wave |
| POST | `/api/v1/waves/:id/cancel` | Cancel wave |

### Wave Line States

```
pending --> picked
   |
   +--> short (not enough stock)
   |
   +--> cancelled
```

### Guard Rails

- Cannot release a wave with 0 lines
- Cannot release a wave with null totalLines
- Cannot complete a wave with unpicked (pending) lines
- Lines in `picked`, `short`, or `cancelled` are considered terminal

---

## 5. Stock Allocation

### State Machine

```
active --> released --> picked --> expired
```

### 4 States

| State | Description |
|-------|-------------|
| `active` | Stock reserved for demand |
| `released` | Allocation freed (demand cancelled) |
| `picked` | Physically picked from bin |
| `expired` | TTL expired, auto-released |

### API Endpoints

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/v1/stock-allocations` | List allocations |
| GET | `/api/v1/stock-allocations/:id` | Allocation detail |
| POST | `/api/v1/stock-allocations` | Create allocation |
| POST | `/api/v1/stock-allocations/:id/release` | Release allocation |
| POST | `/api/v1/stock-allocations/bulk-allocate` | Batch allocate |
| POST | `/api/v1/stock-allocations/bulk-release` | Batch release |
| GET | `/api/v1/stock-allocations/stats` | Allocation statistics |

### Guard Rails

- Cannot allocate zero or negative quantity
- Cannot double-release an already released allocation
- Cannot release a picked allocation
- Allocation type: `hard` (reserved) or `soft` (suggested)

---

## 6. Cross-Dock Flow

```
GRN Received
     |
     v
[identifyCrossDockCandidates] -- finds approved GRNs matching outbound demand
     |
     v
[createCrossDock] -- links GRN item to outbound MI
     |
     v
[approveCrossDock] -- manager approves bypass of putaway
     |
     v
[executeCrossDock] -- atomic transaction:
     |                 1. Creates LPN for the item
     |                 2. Creates LPN content record
     |                 3. Creates WMS 'move' task (priority 1)
     |                 4. Updates cross-dock status to 'in_progress'
     |
     v
[completeCrossDock] -- item reached outbound staging
```

---

## 7. Mobile Device Integration

### Supported Workflows

| Workflow | Scanner Type | Primary API |
|----------|-------------|-------------|
| Receiving | Barcode + RFID | GRN + LPN + RFID |
| Putaway | Barcode (bin) | WMS Task + LPN |
| Picking | Barcode + RFID | Wave + WMS Task |
| Cycle Count | Barcode | Inventory + WMS Task |
| Cross-Dock | Barcode | Cross-dock + LPN |
| Shipping | RFID (portal) | LPN + Shipment |

### PWA Support

The frontend is a Progressive Web App (PWA) with:
- Offline queue for scan events
- Service worker caching
- Camera-based barcode scanning (BarcodeScanner component)
- Responsive layout for handheld devices
