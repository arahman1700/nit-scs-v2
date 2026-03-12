# 3PL and Customs Integration Guide

Operational reference for third-party logistics (3PL) billing, carrier service management, and customs duty calculation in NIT Supply Chain V2.

---

## 3PL Contract Management

### Oracle Model Mapping

| Prisma Model          | Oracle Table          | Description                    |
|----------------------|-----------------------|--------------------------------|
| `ThirdPartyContract` | `WMS_3PL_CONTRACTS`  | Provider contracts             |
| `ThirdPartyCharge`   | `WMS_3PL_CHARGES`    | Individual charge line items   |

### Contract Lifecycle

```
draft --> active --> suspended --> active (re-activate possible via new contract)
                 \-> terminated (final state)
```

State transition rules:
- Only `draft` contracts can be activated
- Only `active` contracts can be suspended
- Any non-terminated contract can be terminated
- Suspended contracts cannot be re-activated through the current API (create a new contract instead)

### Contract API Endpoints

Base path: `/api/v1/3pl`

| Method  | Endpoint                          | Permission        | Description                       |
|---------|-----------------------------------|--------------------|-----------------------------------|
| `GET`   | `/3pl/contracts`                  | `shipment:read`   | List contracts (paginated)        |
| `GET`   | `/3pl/contracts/:id`              | `shipment:read`   | Get contract detail with charges  |
| `GET`   | `/3pl/contracts/:id/summary`      | `shipment:read`   | Financial summary by charge status|
| `POST`  | `/3pl/contracts`                  | `shipment:create` | Create new contract               |
| `PATCH` | `/3pl/contracts/:id/activate`     | `shipment:update` | Activate draft contract           |
| `PATCH` | `/3pl/contracts/:id/suspend`      | `shipment:update` | Suspend active contract           |
| `PATCH` | `/3pl/contracts/:id/terminate`    | `shipment:update` | Terminate contract                |

### Creating a Contract

```json
POST /api/v1/3pl/contracts
{
  "contractCode": "3PL-2026-001",
  "supplierId": "<uuid>",
  "serviceType": "warehousing",
  "startDate": "2026-04-01",
  "endDate": "2027-03-31",
  "rateSchedule": {
    "storage_per_pallet_day": 2.50,
    "handling_in_per_unit": 0.75,
    "handling_out_per_unit": 0.75
  },
  "slaTerms": {
    "receiving_sla_hours": 4,
    "shipping_sla_hours": 8,
    "accuracy_target_pct": 99.5
  },
  "notes": "Warehouse A operations contract"
}
```

**Service types**: `warehousing`, `transportation`, `customs_brokerage`, `freight_forwarding`, `full_3pl`

### Contract Filters

`GET /api/v1/3pl/contracts` supports query parameters:
- `supplierId` -- filter by 3PL provider
- `status` -- filter by contract status (`draft`, `active`, `suspended`, `terminated`)
- `serviceType` -- filter by service type
- `page` / `pageSize` -- pagination (default page size: 25)

### Financial Summary

`GET /api/v1/3pl/contracts/:id/summary` returns charge totals broken down by status:

```json
{
  "contractId": "<uuid>",
  "draft": 5000.00,
  "approved": 12500.00,
  "invoiced": 8000.00,
  "paid": 45000.00,
  "disputed": 1200.00,
  "totalAmount": 71700.00
}
```

---

## 3PL Charge Management

### Charge Lifecycle

```
draft --> approved --> invoiced --> paid
     \-> disputed (from draft, approved, or invoiced)
```

State transition rules:
- Only `draft` charges can be approved
- Only `approved` charges can be invoiced
- Only `invoiced` charges can be marked as paid
- Any charge that is not already `paid` or `disputed` can be disputed
- Paid charges cannot be disputed

### Charge API Endpoints

| Method  | Endpoint                        | Permission         | Description              |
|---------|---------------------------------|--------------------|--------------------------|
| `GET`   | `/3pl/charges`                  | `shipment:read`    | List charges (paginated) |
| `POST`  | `/3pl/charges`                  | `shipment:create`  | Create a charge          |
| `PATCH` | `/3pl/charges/:id/approve`      | `shipment:approve` | Approve charge           |
| `PATCH` | `/3pl/charges/:id/invoice`      | `shipment:update`  | Mark charge as invoiced  |
| `PATCH` | `/3pl/charges/:id/pay`          | `shipment:update`  | Mark charge as paid      |
| `PATCH` | `/3pl/charges/:id/dispute`      | `shipment:update`  | Dispute a charge         |

### Creating a Charge

```json
POST /api/v1/3pl/charges
{
  "contractId": "<uuid>",
  "warehouseId": "<uuid>",
  "chargeType": "storage",
  "description": "Pallet storage for March 2026",
  "quantity": 150,
  "unitRate": 2.50,
  "totalAmount": 375.00,
  "currency": "SAR",
  "refDocType": "grn",
  "refDocId": "<uuid>",
  "periodFrom": "2026-03-01",
  "periodTo": "2026-03-31"
}
```

**Charge types**: `storage`, `handling_in`, `handling_out`, `transport`, `customs_fee`, `value_added`, `penalty`, `other`

### Charge Filters

`GET /api/v1/3pl/charges` supports query parameters:
- `contractId` -- filter by parent contract
- `status` -- filter by charge status
- `chargeType` -- filter by charge type
- `warehouseId` -- filter by warehouse
- `page` / `pageSize` -- pagination

### Approval Workflow

When a charge is approved (`PATCH /3pl/charges/:id/approve`), the system:
1. Validates status is `draft`
2. Records `approvedById` (from the authenticated user's JWT) and `approvedAt` timestamp
3. Creates an audit log entry against `wms_3pl_charges`

### Dispute Handling

Disputes can be raised at any point before payment. Once disputed, the charge is frozen and requires manual resolution (create a new corrected charge or re-process through the approval workflow after resolution).

---

## Carrier Service Rate Management

### Oracle Model Mapping

| Prisma Model     | Oracle Table           | Description                      |
|-----------------|------------------------|----------------------------------|
| `CarrierService`| `WMS_CARRIER_SERVICES` | Carrier rate and service records |

### API Endpoints

Base path: `/api/v1/carriers`

| Method   | Endpoint                  | Description                                |
|----------|---------------------------|--------------------------------------------|
| `GET`    | `/carriers`               | List carriers with filters                 |
| `GET`    | `/carriers/best-rate`     | Find cheapest carriers for a transport mode|
| `GET`    | `/carriers/:id`           | Get carrier detail                         |
| `POST`   | `/carriers`               | Create carrier service record              |
| `PUT`    | `/carriers/:id`           | Update carrier service record              |
| `DELETE` | `/carriers/:id`           | Delete carrier service record              |

### Carrier Record Structure

```json
{
  "carrierName": "DHL Express",
  "serviceName": "Express International",
  "serviceCode": "DHL-EXP-INTL",
  "mode": "air",
  "transitDays": 3,
  "ratePerUnit": 12.50,
  "minCharge": 150.00,
  "currency": "SAR",
  "isActive": true
}
```

**Transport modes**: `air`, `sea`, `road`, `rail`

### Rate Lookup and Comparison

`GET /api/v1/carriers/best-rate?mode=road&weightKg=500`

Returns all active carriers for the specified mode, sorted by `ratePerUnit` ascending (cheapest first). When `weightKg` is provided, each result includes an `estimatedCost`:

```
estimatedCost = max(ratePerUnit * weightKg, minCharge)
```

Response:

```json
{
  "rates": [
    {
      "id": "<uuid>",
      "carrierName": "Al Jazirah Transport",
      "serviceName": "Standard Road",
      "serviceCode": "AJT-STD",
      "transitDays": 5,
      "ratePerUnit": 3.50,
      "minCharge": 200,
      "estimatedCost": 1750.00,
      "currency": "SAR"
    },
    {
      "id": "<uuid>",
      "carrierName": "Saudi Logistics",
      "serviceName": "Express Road",
      "serviceCode": "SL-EXP",
      "transitDays": 2,
      "ratePerUnit": 8.00,
      "minCharge": 500,
      "estimatedCost": 4000.00,
      "currency": "SAR"
    }
  ]
}
```

### Carrier Filters

`GET /api/v1/carriers` supports:
- `mode` -- filter by transport mode
- `isActive` -- filter by active status (`true`/`false`)
- `carrierName` -- case-insensitive partial match
- `page` / `pageSize` -- pagination

### Uniqueness Constraint

`serviceCode` must be unique across all carrier records. Creating a duplicate returns HTTP 409.

---

## Customs Duty Estimation

### Two Duty Calculation Paths

The system provides two complementary approaches to customs duty estimation:

#### 1. ASN-Based (Default Rates)

`GET /api/v1/receiving-automation/asn/:asnId/duties`

Uses item `standardCost` and fixed Saudi Arabia default rates:
- Duty rate: 5%
- VAT rate: 15% (applied on value + duty per Saudi customs rules)

Best for: Quick pre-arrival estimates before HS codes are assigned.

#### 2. Shipment-Based (HS Code Tariff Lookup)

`POST /api/v1/tariffs/tariff-rates/calculate/:shipmentId`

Uses HS codes on shipment lines to look up matching `TariffRate` records. Supports:
- Per-HS-code duty and VAT rates
- Exemption codes for duty-free categories
- Effective date range filtering (only active tariffs with valid dates apply)
- Fallback to Saudi standard 15% VAT when no tariff matches

Best for: Accurate duty calculation when HS codes are available.

### Tariff Rate Management

#### Endpoints

Base path: `/api/v1/tariffs`

| Method | Endpoint                                        | Permission       | Description                      |
|--------|--------------------------------------------------|-------------------|----------------------------------|
| `GET`  | `/tariffs/tariff-rates`                          | `customs:read`   | List tariff rates (paginated)    |
| `GET`  | `/tariffs/tariff-rates/:id`                      | `customs:read`   | Get tariff rate detail           |
| `POST` | `/tariffs/tariff-rates`                          | `customs:create` | Create tariff rate               |
| `PUT`  | `/tariffs/tariff-rates/:id`                      | `customs:update` | Update tariff rate               |
| `POST` | `/tariffs/tariff-rates/calculate/:shipmentId`    | `customs:read`   | Calculate duties (dry run)       |
| `POST` | `/tariffs/tariff-rates/apply/:shipmentId`        | `customs:update` | Calculate and persist to shipment|

#### Creating a Tariff Rate

```json
POST /api/v1/tariffs/tariff-rates
{
  "hsCode": "8471.30",
  "description": "Portable digital automatic data processing machines",
  "dutyRate": 0.05,
  "vatRate": 0.15,
  "exemptionCode": null,
  "country": "Saudi Arabia",
  "effectiveFrom": "2026-01-01",
  "effectiveUntil": null,
  "isActive": true
}
```

#### Duty Calculation Logic

For each shipment line:
1. Look up the line's `hsCode` against active `TariffRate` records where `effectiveFrom <= now` and (`effectiveUntil` is null or `>= now`)
2. If multiple rates match the same HS code, use the most recently effective one
3. Calculate: `dutyAmount = lineValue * dutyRate`
4. Calculate: `vatAmount = (lineValue + dutyAmount) * vatRate` (VAT on value + duty, per Saudi rules)
5. If no tariff matches, duty is 0 and VAT defaults to 15%

#### Applying Duties to a Shipment

`POST /api/v1/tariffs/tariff-rates/apply/:shipmentId` performs the same calculation as the dry-run endpoint but additionally persists the `grandTotal` (duties + VAT) to the shipment's `dutiesEstimated` field.

### Tariff Rate Filters

`GET /api/v1/tariffs/tariff-rates` supports:
- `search` -- searches across `hsCode`, `description`, `exemptionCode`, `country`
- `isActive` -- filter by active status
- `country` -- filter by country
- `hsCode` -- prefix match (e.g., `8471` matches `8471.30`, `8471.41`, etc.)
- `sortBy` / `sortDir` -- sort control (default: `updatedAt` descending)
- `page` / `pageSize` -- pagination

---

## Integration Patterns

### 3PL Charge from GRN Receiving

After goods are received via the receiving automation workflow, create a 3PL handling charge:

```json
POST /api/v1/3pl/charges
{
  "contractId": "<active-contract-uuid>",
  "warehouseId": "<uuid>",
  "chargeType": "handling_in",
  "description": "Inbound handling for GRN-2026-0042",
  "quantity": 150,
  "unitRate": 0.75,
  "totalAmount": 112.50,
  "refDocType": "grn",
  "refDocId": "<grn-uuid>"
}
```

### Carrier Selection for Shipment

1. Determine transport mode and estimated weight
2. Call `GET /api/v1/carriers/best-rate?mode=road&weightKg=1200`
3. Present options to the user sorted by cost
4. Assign selected carrier to the shipment/transport order

### End-to-End: ASN to Duty Estimate

1. Create ASN: `POST /api/v1/asn`
2. Estimate duties early: `GET /api/v1/receiving-automation/asn/:asnId/duties`
3. Track arrival: `POST /api/v1/asn/:id/in-transit`, then `POST /api/v1/asn/:id/arrived`
4. Receive: `POST /api/v1/asn/:id/receive` (creates GRN)
5. If a shipment exists with HS codes, refine: `POST /api/v1/tariffs/tariff-rates/calculate/:shipmentId`

---

## Permissions Reference

| Resource     | Actions                          | Used By                          |
|-------------|----------------------------------|----------------------------------|
| `shipment`  | `read`, `create`, `update`, `approve` | 3PL contracts and charges   |
| `customs`   | `read`, `create`, `update`       | Tariff rates and duty calculation|
| `grn`       | `read`, `create`, `update`, `approve`, `delete` | ASN management     |
| `warehouse_zone` | `read`, `create`, `update`, `delete` | LPN, WMS tasks, waves, allocations |
