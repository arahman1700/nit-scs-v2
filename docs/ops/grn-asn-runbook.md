# GRN/ASN Receiving Runbook

Operational guide for the GRN (MRRV) receiving automation and ASN lifecycle management in NIT Supply Chain V2.

---

## ASN Lifecycle

### Status Flow

```
pending --> in_transit --> arrived --> received
                      \-> cancelled (from pending or in_transit)
```

### API Endpoints

All ASN endpoints are mounted at `/api/v1/asn` and require authentication with the `grn` permission resource.

| Method   | Endpoint                    | Permission   | Description                             |
|----------|-----------------------------|--------------|-----------------------------------------|
| `GET`    | `/api/v1/asn`               | `grn:read`   | List ASNs (paginated, filterable)       |
| `GET`    | `/api/v1/asn/:id`           | `grn:read`   | Get ASN detail with lines               |
| `POST`   | `/api/v1/asn`               | `grn:create` | Create ASN with line items              |
| `PUT`    | `/api/v1/asn/:id`           | `grn:update` | Update pending ASN                      |
| `POST`   | `/api/v1/asn/:id/in-transit`| `grn:update` | Mark ASN as in transit                  |
| `POST`   | `/api/v1/asn/:id/arrived`   | `grn:update` | Mark ASN as arrived (sets actualArrival) |
| `POST`   | `/api/v1/asn/:id/receive`   | `grn:approve`| Receive ASN and auto-create GRN         |
| `DELETE` | `/api/v1/asn/:id`           | `grn:delete` | Cancel ASN                              |
| `GET`    | `/api/v1/asn/:id/variance`  | `grn:read`   | Expected vs received variance report    |

### Creating an ASN

```json
POST /api/v1/asn
{
  "supplierId": "<uuid>",
  "warehouseId": "<uuid>",
  "expectedArrival": "2026-03-15T08:00:00Z",
  "carrierName": "DHL Express",
  "trackingNumber": "1234567890",
  "purchaseOrderRef": "PO-2026-0042",
  "notes": "Fragile items included",
  "lines": [
    { "itemId": "<uuid>", "qtyExpected": 100, "lotNumber": "LOT-A1", "expiryDate": "2027-01-01" },
    { "itemId": "<uuid>", "qtyExpected": 50 }
  ]
}
```

### ASN Arrival Tracking

1. Supplier dispatches goods: `POST /api/v1/asn/:id/in-transit`
2. Goods arrive at warehouse gate: `POST /api/v1/asn/:id/arrived` (records `actualArrival` timestamp)
3. Warehouse confirms receipt: `POST /api/v1/asn/:id/receive` -- this auto-creates a draft GRN

### ASN-to-GRN Auto-Creation

When `POST /api/v1/asn/:id/receive` is called:

1. Validates ASN status is `arrived`
2. Generates a new GRN document number via `generateDocumentNumber('grn')`
3. Creates an MRRV (GRN) record with:
   - All ASN line items mapped to MRRV lines
   - `qtyReceived` set to `qtyExpected` (full receipt assumed)
   - Each item's default UOM resolved from the item master
   - `poNumber` set from `purchaseOrderRef`
   - Notes reference the source ASN number
4. Updates all ASN line `qtyReceived` values
5. Sets ASN status to `received` and links the GRN ID
6. Returns `{ asn, grnId, grnNumber }`

---

## GRN Receiving Automation

### Overview

The receiving automation service orchestrates the post-approval GRN workflow:

```
GRN Approved --> generateReceivingPlan --> executeReceiving
                                               |
                                          Creates LPNs (WMS_LICENSE_PLATES)
                                          Creates LPN contents (WMS_LPN_CONTENTS)
                                          Creates WMS tasks (WMS_TASK_QUEUE)
```

### API Endpoints

All receiving automation endpoints are mounted at `/api/v1/receiving-automation`.

| Method | Endpoint                                          | Description                              |
|--------|---------------------------------------------------|------------------------------------------|
| `POST` | `/api/v1/receiving-automation/:grnId/plan`        | Generate receiving plan (dry run)        |
| `POST` | `/api/v1/receiving-automation/:grnId/execute`     | Generate plan and execute it             |
| `POST` | `/api/v1/receiving-automation/:grnId/auto-receive`| Full automation: plan + execute + status |
| `GET`  | `/api/v1/receiving-automation/asn/:asnId/duties`  | Calculate customs duties for ASN         |

### Step 1: generateReceivingPlan(grnId)

**Precondition**: GRN status must be `qc_approved`, `received`, or `stored`.

The plan evaluates each GRN line and produces:

```json
{
  "grnId": "<uuid>",
  "grnNumber": "GRN-2026-0001",
  "warehouseId": "<uuid>",
  "lines": [
    {
      "lineId": "<uuid>",
      "itemId": "<uuid>",
      "itemCode": "ITEM-001",
      "quantity": 150,
      "suggestedLpnType": "pallet",
      "suggestedZoneId": "<uuid>",
      "suggestedBinId": "<uuid>",
      "putawayRuleId": "<uuid>",
      "requiresInspection": false
    }
  ]
}
```

**LPN type determination**:
- quantity > 100: `pallet`
- quantity > 10: `carton`
- quantity <= 10: `tote`

**Zone/bin assignment**:
1. Match active put-away rules by item category, ordered by priority
2. If a rule matches, use its `targetZoneId` and find the least-occupied bin in that zone
3. If no rule matches, fall back to the first zone with available bins

### Step 2: executeReceiving(plan, createdById)

For each line in the plan:

1. **Create LPN**: `LicensePlate` record with status `in_receiving`, linked to GRN via `sourceDocType`/`sourceDocId`
2. **Add content**: `LpnContent` record with the item and quantity
3. **Create putaway task**: `WmsTask` record with:
   - `taskType`: `putaway`
   - `status`: `pending`
   - `priority`: 2 if inspection required, 3 otherwise
   - `toZoneId`/`toBinId`: from the receiving plan
   - `sourceDocType`: `grn`

Returns array of `{ lpnId, lpnNumber, taskId, taskNumber, lineId }`.

### Step 3: autoReceiveGrn(grnId, createdById)

Combines plan + execute and additionally transitions the GRN status to `received` if not already. Returns:

```json
{
  "grnId": "<uuid>",
  "grnNumber": "GRN-2026-0001",
  "warehouseId": "<uuid>",
  "lpnsCreated": 3,
  "tasksCreated": 3,
  "details": [
    { "lpnId": "...", "lpnNumber": "LPN-M1ABC-001", "taskId": "...", "taskNumber": "TSK-PA-M1ABC-001", "lineId": "..." }
  ]
}
```

---

## Customs Duty Estimation

### ASN-Based Duty Calculation

`GET /api/v1/receiving-automation/asn/:asnId/duties`

Calculates estimated customs duties and VAT for an ASN using item `standardCost` values and default Saudi Arabia rates:

- Default duty rate: 5%
- Default VAT rate: 15% (applied on value + duty)

Response:

```json
{
  "asnId": "<uuid>",
  "asnNumber": "ASN-2026-0001",
  "lineCount": 2,
  "totalEstimatedDuty": 250.00,
  "totalEstimatedVat": 431.25,
  "totalEstimatedCost": 681.25,
  "lines": [
    {
      "itemId": "<uuid>",
      "itemCode": "ITEM-001",
      "dutyRate": 5,
      "vatRate": 15,
      "estimatedDuty": 200.00,
      "estimatedVat": 345.00
    }
  ]
}
```

For HS-code-based tariff lookups with exemption support, use the tariff rate service at `POST /api/v1/tariffs/tariff-rates/calculate/:shipmentId`.

### LPN Assignment During Receiving

LPNs created during receiving automation carry:
- `lpnNumber`: format `LPN-{base36-timestamp}-{3-digit-sequence}`
- `warehouseId`: from the GRN
- `lpnType`: auto-determined from quantity
- `status`: starts at `in_receiving`
- `sourceDocType`: `grn`
- `sourceDocId`: the GRN ID

After putaway tasks complete, LPNs should be transitioned to `stored` via `PATCH /api/v1/lpns/:id/store`.

---

## Troubleshooting

### GRN plan generation fails with "GRN must be qc_approved/received/stored"

The GRN has not completed its approval workflow. Verify the GRN status:
```
GET /api/v1/grn/:id
```
Ensure QCI (quality check) has been completed and approved before attempting receiving automation.

### No suggested zone/bin in the receiving plan

Causes:
- No active put-away rules exist for the warehouse. Check: `GET /api/v1/putaway-rules?warehouseId=`
- No zones with active bin locations exist. Check: `GET /api/v1/warehouse-zones?warehouseId=`
- All bins in matching zones are at full capacity (sorted by `currentOccupancy`)

Resolution: Create or activate put-away rules, or add bin locations to existing zones.

### LPN creation fails during executeReceiving

Possible causes:
- `lpnNumber` uniqueness conflict (extremely rare due to timestamp-based generation)
- Database connection timeout during batch creation

Resolution: Retry the execution. The plan itself is idempotent and can be regenerated. Check that previously created LPNs are cleaned up or accounted for.

### ASN receive fails with "Only arrived ASNs can be received"

The ASN must follow the full lifecycle. Verify:
1. ASN was marked as in-transit: `POST /api/v1/asn/:id/in-transit`
2. ASN was marked as arrived: `POST /api/v1/asn/:id/arrived`

Both transitions must complete before receiving.

### WMS putaway tasks not appearing for warehouse staff

Check:
- Task was created with the correct `warehouseId`
- Staff member has warehouse scope access for that warehouse
- Use `GET /api/v1/wms-tasks?warehouseId=&status=pending&taskType=putaway` to verify tasks exist
- Use `GET /api/v1/wms-tasks/my-tasks?employeeId=` to check assignment

### Customs duty estimate returns zero amounts

The `calculateAsnDuties` function uses `item.standardCost` for value calculation. If items have no `standardCost` set, all duty/VAT amounts will be zero. Update item master data with accurate standard costs.

### ASN variance report shows unexpected discrepancies

The variance report compares `qtyExpected` against `qtyReceived` on each ASN line. During auto-receive, `qtyReceived` is set equal to `qtyExpected`. Manual adjustments to the resulting GRN will not back-propagate to ASN lines. Check the GRN directly for actual received quantities.
