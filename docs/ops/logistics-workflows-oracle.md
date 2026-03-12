# P6 Logistics Enhancement -- Workflow Reference

This document covers the end-to-end warehouse and logistics workflows introduced in the P6 Logistics Enhancement phase. All workflows reference the 10 new Oracle-mapped Prisma models and their corresponding API endpoints.

---

## Oracle-Mapped Models

| Prisma Model          | Oracle Table            | Domain         | Purpose                              |
|----------------------|-------------------------|----------------|--------------------------------------|
| `LicensePlate`       | `WMS_LICENSE_PLATES`    | warehouse-ops  | Pallet/carton/tote tracking          |
| `LpnContent`         | `WMS_LPN_CONTENTS`     | warehouse-ops  | Item-level contents within an LPN    |
| `RfidTag`            | `WMS_RFID_TAGS`        | warehouse-ops  | RFID tag lifecycle and scan events   |
| `WmsTask`            | `WMS_TASK_QUEUE`        | warehouse-ops  | Directed warehouse task management   |
| `WaveHeader`         | `WMS_WAVE_HEADERS`     | warehouse-ops  | Batch pick wave headers              |
| `WaveLine`           | `WMS_WAVE_LINES`       | warehouse-ops  | Individual pick lines within a wave  |
| `StockAllocation`    | `WMS_STOCK_ALLOCATIONS`| warehouse-ops  | Hard/soft inventory reservations     |
| `ThirdPartyContract` | `WMS_3PL_CONTRACTS`    | logistics      | 3PL provider contract management     |
| `ThirdPartyCharge`   | `WMS_3PL_CHARGES`      | logistics      | 3PL billing charge line items        |
| `CarrierService`     | `WMS_CARRIER_SERVICES` | logistics      | Carrier rate and service definitions |

---

## 1. Inbound Workflow: GRN/ASN Receiving to Putaway

### Flow

```
ASN Created (pending)
  |
  v
ASN In Transit --> ASN Arrived --> ASN Received (auto-creates GRN)
                                       |
                                       v
                               GRN Approved (qc_approved)
                                       |
                                       v
                        generateReceivingPlan(grnId)
                                       |
                                       v
                        executeReceiving(plan)
                          |                    |
                    Create LPNs         Create WMS Tasks
                  (in_receiving)           (putaway, pending)
                          |                    |
                          v                    v
                     Add contents        Assign to employee
                          |                    |
                          v                    v
                     storeLpn()          startTask() --> completeTask()
                     (stored)            (in_progress)   (completed)
```

### Step-by-step

1. **ASN arrives** -- ASN status transitions: `pending` --> `in_transit` --> `arrived`.
2. **ASN received** -- `POST /api/v1/asn/:id/receive` creates a draft GRN (MRRV) with all ASN line quantities.
3. **GRN approval** -- GRN proceeds through normal approval workflow to `qc_approved` status.
4. **Generate receiving plan** -- `POST /api/v1/receiving-automation/:grnId/plan` evaluates each GRN line against active put-away rules, suggests LPN types based on quantity thresholds (>100 = pallet, >10 = carton, else tote), and identifies target zones/bins.
5. **Execute receiving** -- `POST /api/v1/receiving-automation/:grnId/execute` creates one `LicensePlate` (status: `in_receiving`) and one `WmsTask` (type: `putaway`, status: `pending`) per GRN line.
6. **Full automation** -- `POST /api/v1/receiving-automation/:grnId/auto-receive` combines plan + execute in a single call and transitions the GRN to `received`.

### LPN Creation During Receiving

LPNs are created with:
- `lpnNumber`: auto-generated as `LPN-{timestamp}-{seq}`
- `sourceDocType`: `grn`
- `sourceDocId`: the GRN ID
- `lpnType`: determined by quantity (pallet / carton / tote)
- Contents added via `LpnContent` with item, quantity, and optional lot/expiry

### WMS Putaway Task Generation

Each putaway task includes:
- `taskNumber`: auto-generated as `TSK-PA-{timestamp}-{seq}`
- `taskType`: `putaway`
- `priority`: 2 if inspection required, 3 otherwise
- `toZoneId` / `toBinId`: from the put-away rule match or first available bin
- `sourceDocType` / `sourceDocId`: linked back to the GRN

---

## 2. Outbound Workflow: Picking to Shipping

### Flow

```
MI (Material Issue) created
  |
  v
Stock Allocation (soft reservation)
  |
  v
Wave Planning (group MI lines)
  |
  v
Wave Released --> Wave Picking --> Wave Completed
                     |
              Pick WMS Tasks created
              (pending --> assigned --> in_progress --> completed)
                     |
                     v
              LPN status: stored --> in_picking --> in_packing --> shipped
                                        |
                                        v
                                  Packing station
                                        |
                                        v
                                  Shipping / Gate Pass
```

### Step-by-step

1. **Stock allocation** -- When an MI is approved, allocate inventory against demand:
   - `POST /api/v1/stock-allocations/` for single-line allocation
   - `POST /api/v1/stock-allocations/bulk` for FIFO bulk allocation across all MI lines
   - `allocType` can be `soft` (tentative hold) or `hard` (firm commitment)

2. **Wave creation** -- Group MI pick lines into waves for efficient floor execution:
   - `POST /api/v1/waves/` creates a wave header (status: `planning`)
   - `POST /api/v1/waves/:id/lines` adds pick lines referencing the MI (MIRV) and items

3. **Wave release** -- `PATCH /api/v1/waves/:id/release` transitions to `released`, making it available for floor execution.

4. **Wave picking** -- `PATCH /api/v1/waves/:id/start` transitions to `picking`. Warehouse staff confirm each line pick via `PATCH /api/v1/waves/lines/:lineId/confirm` with `qtyPicked` and `pickedById`.

5. **Wave completion** -- `PATCH /api/v1/waves/:id/complete` validates all lines are in a terminal state (`picked`, `short`, or `cancelled`) before completing.

6. **LPN transitions** -- During outbound, LPNs move through: `stored` --> `in_picking` --> `in_packing` --> `shipped`, each via a dedicated PATCH endpoint on `/api/v1/lpns/:id/{pick,pack,ship}`.

7. **Shipping** -- Once packed, shipment and gate pass processes finalize the outbound flow.

---

## 3. Stock Allocation Engine

### Allocation Types

| Type             | Behavior                                                   |
|------------------|------------------------------------------------------------|
| `soft`           | Tentative reservation. Can be released or overridden.      |
| `hard`           | Firm commitment. Blocks inventory for the demand document. |
| `pick_confirmed` | Set after physical pick confirms the allocated quantity.   |

### FIFO Bulk Allocation

`POST /api/v1/stock-allocations/bulk` accepts:
```json
{
  "demandDocType": "mi",
  "demandDocId": "<uuid>",
  "warehouseId": "<uuid>",
  "lines": [
    { "itemId": "<uuid>", "qty": 50 },
    { "itemId": "<uuid>", "qty": 25 }
  ]
}
```

The engine queries `InventoryLot` records ordered by `createdAt ASC` (FIFO), consuming `availableQty` across lots until demand is satisfied. Each allocation creates a `StockAllocation` record linked to the demand document.

### Allocation Lifecycle

```
active --> released    (inventory freed, no pick)
active --> picked      (physical pick confirmed)
active --> cancelled   (demand cancelled)
```

### Queries

- **Available-to-allocate**: `GET /api/v1/stock-allocations/available?warehouseId=&itemId=` -- returns total allocated qty for an item so callers can compute remaining availability.
- **By demand document**: `GET /api/v1/stock-allocations/by-demand?demandDocType=mi&demandDocId=` -- returns all allocations for a specific MI/WT/MR.

---

## 4. RFID Tag Lifecycle

### Tag Types

| Type        | Purpose                                        |
|-------------|------------------------------------------------|
| `lpn`       | Attached to a pallet, carton, or tote          |
| `item`      | Attached to an individual item (high-value)    |
| `asset`     | Attached to fixed assets (tools, equipment)    |
| `zone_gate` | Fixed reader at zone entry/exit points         |

### Lifecycle

```
Register tag (POST /api/v1/rfid)
  |
  v
Associate with LPN/item/asset (PATCH /api/v1/rfid/:id/associate-lpn)
  |
  v
Active -- scan events update lastSeenAt + lastReaderId
  |
  v
Deactivate (PATCH /api/v1/rfid/:id/deactivate)
```

### Scan Processing

- **Single scan**: `POST /api/v1/rfid/scan` with `{ epc, readerId }` -- updates `lastSeenAt` and `lastReaderId` on the tag. Rejects scans for inactive tags.
- **Bulk scan**: `POST /api/v1/rfid/bulk-scan` with `{ scans: [{ epc, readerId }, ...] }` -- processes multiple reader events. Returns `{ found: boolean, tagType? }` for each EPC.

### Statistics

`GET /api/v1/rfid/stats?warehouseId=` returns counts by active/inactive and by tag type.

---

## 5. 3PL Billing Workflow

### Contract Lifecycle

```
draft --> active --> suspended --> active (re-activate)
                 \-> terminated
```

| Transition   | Endpoint                                  | Precondition          |
|--------------|-------------------------------------------|-----------------------|
| Activate     | `PATCH /api/v1/3pl/contracts/:id/activate`   | Status must be `draft`  |
| Suspend      | `PATCH /api/v1/3pl/contracts/:id/suspend`    | Status must be `active` |
| Terminate    | `PATCH /api/v1/3pl/contracts/:id/terminate`  | Not already terminated  |

### Contract Fields

- `contractCode`: unique identifier
- `supplierId`: linked to the supplier (3PL provider)
- `serviceType`: one of `warehousing`, `transportation`, `customs_brokerage`, `freight_forwarding`, `full_3pl`
- `rateSchedule`: JSON object defining rates per charge type
- `slaTerms`: JSON object with SLA definitions
- `startDate` / `endDate`: contract validity period

### Charge Lifecycle

```
draft --> approved --> invoiced --> paid
                  \-> disputed (from draft or approved or invoiced)
```

| Transition | Endpoint                                | Precondition             |
|------------|----------------------------------------|--------------------------|
| Approve    | `PATCH /api/v1/3pl/charges/:id/approve`   | Status must be `draft`     |
| Invoice    | `PATCH /api/v1/3pl/charges/:id/invoice`   | Status must be `approved`  |
| Pay        | `PATCH /api/v1/3pl/charges/:id/pay`       | Status must be `invoiced`  |
| Dispute    | `PATCH /api/v1/3pl/charges/:id/dispute`   | Not `paid` or `disputed`  |

### Charge Types

`storage`, `handling_in`, `handling_out`, `transport`, `customs_fee`, `value_added`, `penalty`, `other`

### Contract Financial Summary

`GET /api/v1/3pl/contracts/:id/summary` returns aggregated charge amounts by status and total for the contract.

---

## 6. Carrier Service Rate Management

### Data Model

Each `CarrierService` record represents a service level offered by a carrier:

- `carrierName`: carrier company name
- `serviceName` / `serviceCode`: specific service (e.g., "Express", "Standard Ground")
- `mode`: transport mode (`air`, `sea`, `road`, `rail`)
- `transitDays`: estimated transit time
- `ratePerUnit`: cost per unit (typically per kg)
- `minCharge`: minimum charge threshold
- `currency`: 3-letter currency code (default: SAR)
- `isActive`: whether this rate is currently available

### Rate Lookup

`GET /api/v1/carriers/best-rate?mode=road&weightKg=500` returns all active carriers for the given mode, sorted by `ratePerUnit` ascending. For each carrier, an `estimatedCost` is calculated:

```
estimatedCost = max(ratePerUnit * weightKg, minCharge)
```

### CRUD Endpoints

| Method   | Endpoint                  | Description                          |
|----------|---------------------------|--------------------------------------|
| `GET`    | `/api/v1/carriers`        | List carriers with filters           |
| `GET`    | `/api/v1/carriers/:id`    | Get carrier detail                   |
| `POST`   | `/api/v1/carriers`        | Create carrier service               |
| `PUT`    | `/api/v1/carriers/:id`    | Update carrier service               |
| `DELETE` | `/api/v1/carriers/:id`    | Delete carrier service               |
| `GET`    | `/api/v1/carriers/best-rate` | Find cheapest carrier for a mode  |

---

## 7. WMS Task Queue

### Task Types

`receive`, `putaway`, `pick`, `pack`, `replenish`, `count`, `move`, `load`, `unload`

### Task Lifecycle

```
pending --> assigned --> in_progress --> completed
                    \-> cancelled
               in_progress --> on_hold --> in_progress (resume)
```

### Priority Scale

1 = highest (urgent), 5 = lowest. Tasks are always sorted by priority ascending, then creation date descending.

### Key Endpoints

| Method  | Endpoint                             | Description                    |
|---------|--------------------------------------|--------------------------------|
| `POST`  | `/api/v1/wms-tasks`                 | Create task                    |
| `PATCH` | `/api/v1/wms-tasks/:id/assign`      | Assign to employee             |
| `PATCH` | `/api/v1/wms-tasks/:id/start`       | Start task                     |
| `PATCH` | `/api/v1/wms-tasks/:id/complete`    | Complete task (records actual mins) |
| `PATCH` | `/api/v1/wms-tasks/:id/cancel`      | Cancel task                    |
| `PATCH` | `/api/v1/wms-tasks/:id/hold`        | Put on hold                    |
| `PATCH` | `/api/v1/wms-tasks/:id/resume`      | Resume from hold               |
| `POST`  | `/api/v1/wms-tasks/bulk-assign`     | Batch assign multiple tasks    |
| `GET`   | `/api/v1/wms-tasks/my-tasks`        | Tasks for logged-in user       |
| `GET`   | `/api/v1/wms-tasks/stats`           | Task count + avg completion time |

### Completion Tracking

When a task transitions to `completed`, the service calculates `actualMins` from the difference between `startedAt` and `completedAt`. The `/stats` endpoint aggregates this into `avgCompletionMins` across all completed tasks.

---

## 8. Wave Picking

### Wave Types

`manual`, `auto`, `priority`

### Wave Lifecycle

```
planning --> released --> picking --> completed
                     \-> cancelled (from any non-terminal state)
```

### Wave Line States

Each wave line (pick line) can be: `pending`, `picked`, `short`, `cancelled`. A wave cannot complete until all lines are in a terminal state.

### Key Endpoints

| Method  | Endpoint                                  | Description                      |
|---------|-------------------------------------------|----------------------------------|
| `POST`  | `/api/v1/waves`                           | Create wave header               |
| `POST`  | `/api/v1/waves/:id/lines`                 | Add pick lines to wave           |
| `PATCH` | `/api/v1/waves/:id/release`               | Release for floor picking        |
| `PATCH` | `/api/v1/waves/:id/start`                 | Begin picking                    |
| `PATCH` | `/api/v1/waves/:id/complete`              | Complete wave (all lines terminal)|
| `PATCH` | `/api/v1/waves/:id/cancel`                | Cancel wave                      |
| `PATCH` | `/api/v1/waves/lines/:lineId/confirm`     | Confirm pick on a single line    |
| `GET`   | `/api/v1/waves/stats`                     | Wave count by status             |

---

## Audit Trail

All state transitions across these models produce audit log entries via `createAuditLog()`, recording the Oracle table name, record ID, action, performing user, and IP address. This ensures full traceability for compliance and Oracle data sync.
