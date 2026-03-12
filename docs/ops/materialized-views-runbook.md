# Materialized Views Runbook

> Phase 5 artifact — operational guide for the 4 materialized views.

## Overview

| View | Purpose | Refresh Strategy | Unique Index |
|---|---|---|---|
| `MV_DAILY_STOCK_SUMMARY` | Per-item, per-warehouse stock snapshot | CONCURRENTLY (has unique idx) | `item_id, warehouse_id` |
| `MV_OPEN_INBOUND_DOCS` | Open GRN + ASN documents | FULL (UNION, no unique idx) | — |
| `MV_PENDING_CUSTOMS` | Shipments awaiting customs clearance | CONCURRENTLY | `shipment_id` |
| `MV_WAREHOUSE_UTILIZATION` | Capacity/occupancy per warehouse/zone | FULL (composite, no unique on row) | — |

## View Details

### MV_DAILY_STOCK_SUMMARY

**Source tables:** `MTL_ONHAND_QUANTITIES`, `MTL_SYSTEM_ITEMS`, `WMS_WAREHOUSES`, `MTL_LOT_NUMBERS`

**Columns:**
- `item_id`, `warehouse_id` — composite key
- `item_code`, `item_name`, `warehouse_name` — display fields
- `qty_on_hand`, `qty_reserved`, `qty_available` — stock quantities
- `stock_status` — derived: `out_of_stock`, `reorder`, `low`, `adequate`
- `active_lot_count`, `earliest_expiry` — lot aggregations
- `last_movement_date`, `snapshot_at`

**Indexes:**
- `uq_mv_stock_summary_item_wh` (UNIQUE — enables CONCURRENTLY refresh)
- `idx_mv_stock_summary_status`
- `idx_mv_stock_summary_warehouse`

**Used by:** Inventory dashboard, reorder reports, stock status KPIs

### MV_OPEN_INBOUND_DOCS

**Source tables:** `RCV_RECEIPT_HEADERS`, `RCV_ASN_HEADERS`, `FND_SUPPLIERS`, `WMS_WAREHOUSES`

**Columns:**
- `doc_type` — `GRN` or `ASN`
- `doc_id`, `doc_number`, `status`
- `supplier_id`, `supplier_name`
- `warehouse_id`, `warehouse_name`
- `expected_date`, `total_value`, `line_count`
- `created_at`

**Filters:** Only open documents (GRN: draft/pending_qc/qc_approved/received; ASN: pending/in_transit)

**Indexes:**
- `idx_mv_open_inbound_type`
- `idx_mv_open_inbound_warehouse`
- `idx_mv_open_inbound_status`

**Used by:** Dock scheduling, receiving dashboard, inbound KPIs

### MV_PENDING_CUSTOMS

**Source tables:** `WSH_DELIVERY_HEADERS`, `CUST_TRACKING`, `CUST_DOCUMENTS`, `FND_SUPPLIERS`, `WMS_WAREHOUSES`

**Columns:**
- `shipment_id`, `shipment_number`, `shipment_status`
- `supplier_name`, `warehouse_name`
- `mode_of_shipment`, `awb_bl_number`, `container_number`
- `eta_port`, `commercial_value`, `duties_estimated`
- `customs_stage`, `customs_declaration`
- `duties_amount`, `vat_amount`, `other_fees`, `total_customs_cost`
- `payment_status`, `last_stage_date`
- `pending_doc_count`, `total_doc_count`

**Filters:** Shipments with status `at_port` or `customs_clearing`

**Indexes:**
- `uq_mv_pending_customs_shipment` (UNIQUE — enables CONCURRENTLY)
- `idx_mv_pending_customs_stage`
- `idx_mv_pending_customs_warehouse`

**Used by:** Customs clearance dashboard, logistics KPIs

### MV_WAREHOUSE_UTILIZATION

**Source tables:** `WMS_WAREHOUSES`, `WMS_WAREHOUSE_TYPES`, `WMS_ZONES`, `WMS_BIN_LOCATIONS`

**Columns:**
- `warehouse_id`, `warehouse_name`, `warehouse_code`
- `warehouse_type_id`, `warehouse_type_name`
- `zone_id`, `zone_name`, `zone_code`, `zone_type`
- `zone_capacity`, `zone_occupancy`, `utilization_pct`
- `active_bin_count`, `occupied_bin_count`
- `total_qty_on_hand`, `unique_item_count`

**Filters:** Active warehouses only (`is_active = true`)

**Indexes:**
- `idx_mv_wh_util_warehouse`
- `idx_mv_wh_util_zone`
- `idx_mv_wh_util_pct`

**Used by:** Warehouse utilization dashboard, capacity planning

## Refresh Operations

### Manual Refresh

```sql
-- Refresh a single view
SELECT refresh_mv_daily_stock_summary();
SELECT refresh_mv_open_inbound_docs();
SELECT refresh_mv_pending_customs();
SELECT refresh_mv_warehouse_utilization();

-- Refresh all views
SELECT refresh_all_materialized_views();
```

### Recommended Refresh Schedule

| View | Frequency | Reason |
|---|---|---|
| `MV_DAILY_STOCK_SUMMARY` | Every 15 minutes | Critical for inventory decisions |
| `MV_OPEN_INBOUND_DOCS` | Every 30 minutes | Dock scheduling needs |
| `MV_PENDING_CUSTOMS` | Every 1 hour | Customs stages change slowly |
| `MV_WAREHOUSE_UTILIZATION` | Every 1 hour | Capacity changes slowly |

### BullMQ Integration

Add refresh jobs to the existing BullMQ scheduler:

```typescript
// In sla-jobs.ts or a new mat-view-jobs.ts
import { getQueue } from '../infrastructure/queue/bullmq.config';

const queue = getQueue('INV_QUEUE');

// Stock summary — every 15 min
await queue.add('REFRESH_MV_STOCK_SUMMARY', {}, {
  repeat: { every: 15 * 60 * 1000 },
  removeOnComplete: true,
});

// Open inbound — every 30 min
await queue.add('REFRESH_MV_OPEN_INBOUND', {}, {
  repeat: { every: 30 * 60 * 1000 },
  removeOnComplete: true,
});
```

Worker handler:

```typescript
case 'REFRESH_MV_STOCK_SUMMARY':
  await prisma.$executeRaw`SELECT refresh_mv_daily_stock_summary()`;
  break;
```

## Monitoring

### Check View Freshness

```sql
-- Last refresh time (approximate via snapshot_at in stock summary)
SELECT MAX("snapshot_at") FROM "MV_DAILY_STOCK_SUMMARY";

-- Row counts
SELECT 'MV_DAILY_STOCK_SUMMARY' AS view, COUNT(*) FROM "MV_DAILY_STOCK_SUMMARY"
UNION ALL
SELECT 'MV_OPEN_INBOUND_DOCS', COUNT(*) FROM "MV_OPEN_INBOUND_DOCS"
UNION ALL
SELECT 'MV_PENDING_CUSTOMS', COUNT(*) FROM "MV_PENDING_CUSTOMS"
UNION ALL
SELECT 'MV_WAREHOUSE_UTILIZATION', COUNT(*) FROM "MV_WAREHOUSE_UTILIZATION";
```

### Troubleshooting

**"cannot refresh concurrently"**
→ View needs a UNIQUE index for CONCURRENTLY. MV_OPEN_INBOUND_DOCS and MV_WAREHOUSE_UTILIZATION use standard REFRESH (briefly locks reads).

**Refresh is slow**
→ Check underlying table sizes. Consider refreshing during off-peak hours. Monitor with `EXPLAIN ANALYZE` on the view definition query.

**Stale data**
→ Check BullMQ job status. Verify Redis connection. Check for failed refresh jobs in DLQ.
