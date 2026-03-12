# Database Index Strategy

> Phase 5 artifact — documents all indexes including composite indexes added for logistics operations.

## Index Naming Convention

```
idx_{oracle_module}_{entity}_{column(s)}
```

Examples:
- `idx_mrrv_status` — single column on MRRV status
- `idx_rcv_lines_mrrv_item` — composite on RCV_RECEIPT_LINES (mrrvId, itemId)
- `idx_mtl_onhand_avail_lookup` — composite for inventory availability queries

## P5 Composite Indexes Added (35 new indexes)

### Inbound (RCV) — GRN Lookup & ASN Processing

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_rcv_lines_mrrv_item` | `RCV_RECEIPT_LINES` | mrrvId, itemId | GRN line item lookup |
| `idx_rcv_lines_item_expiry` | `RCV_RECEIPT_LINES` | itemId, expiryDate | Item expiry tracking |
| `idx_rcv_asn_wh_status` | `RCV_ASN_HEADERS` | warehouseId, status | ASN per warehouse |
| `idx_rcv_asn_supplier_arrival` | `RCV_ASN_HEADERS` | supplierId, expectedArrival | Supplier delivery tracking |
| `idx_rcv_asn_status_arrival` | `RCV_ASN_HEADERS` | status, expectedArrival | Pending ASN by arrival date |
| `idx_rcv_asn_line_asn_item` | `RCV_ASN_LINES` | asnId, itemId | ASN line item lookup |

### Outbound (ONT/WMS) — Gate Pass & Dispatch

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_wms_gp_wh_type_status` | `WMS_GATE_PASSES` | warehouseId, passType, status | Gate pass filtering |
| `idx_wms_gp_expiry_check` | `WMS_GATE_PASSES` | validUntil, status | Gate pass expiry monitoring |

### Inventory (MTL) — FIFO, Availability, Expiry

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_mtl_onhand_avail_lookup` | `MTL_ONHAND_QUANTITIES` | warehouseId, itemId, qtyOnHand | Inventory availability |
| `idx_mtl_onhand_reorder_alert` | `MTL_ONHAND_QUANTITIES` | itemId, alertSent | Reorder alert check |
| `idx_mtl_lots_expiry_check` | `MTL_LOT_NUMBERS` | expiryDate, status | Expiry monitoring |
| `idx_mtl_lots_wh_avail` | `MTL_LOT_NUMBERS` | warehouseId, status, availableQty | Warehouse lot availability |
| `idx_mtl_lots_supplier_receipt` | `MTL_LOT_NUMBERS` | supplierId, receiptDate | Supplier receipt tracking |

### Shipping (WSH)

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_wsh_ship_dest_status` | `WSH_DELIVERY_HEADERS` | destinationWarehouseId, status | Shipment arrival processing |
| `idx_wsh_ship_mode_status` | `WSH_DELIVERY_HEADERS` | modeOfShipment, status | Mode-based filtering |
| `idx_wsh_ship_eta_status` | `WSH_DELIVERY_HEADERS` | etaPort, status | ETA-based tracking |
| `idx_wsh_lines_shipment_item` | `WSH_DELIVERY_LINES` | shipmentId, itemId | Packing list lookup |

### Customs (CUST)

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_cust_shipment_stage` | `CUST_TRACKING` | shipmentId, stage | Customs stage lookup |
| `idx_cust_payment_status` | `CUST_TRACKING` | paymentStatus | Payment status filtering |
| `idx_cust_tariff_lookup` | `CUST_TARIFF_RATES` | hsCode, isActive, effectiveFrom | Tariff rate lookup |
| `idx_cust_docs_shipment_status` | `CUST_DOCUMENTS` | shipmentId, status | Customs doc status |
| `idx_cust_docs_shipment_type` | `CUST_DOCUMENTS` | shipmentId, documentType | Customs doc type filter |

### Warehouse Operations (WMS)

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_wms_crossdock_wh_status` | `WMS_CROSS_DOCKS` | warehouseId, status | Cross-dock operations |
| `idx_wms_crossdock_item_status` | `WMS_CROSS_DOCKS` | itemId, status | Cross-dock item tracking |
| `idx_wms_bin_loc_avail` | `WMS_BIN_LOCATIONS` | zoneId, isActive, currentOccupancy | Available bin lookup |
| `idx_wms_yard_wh_start_status` | `WMS_YARD_APPOINTMENTS` | warehouseId, scheduledStart, status | Yard scheduling |
| `idx_wms_yard_ref` | `WMS_YARD_APPOINTMENTS` | referenceType, referenceId | Yard appointment reference |
| `idx_wms_truck_wh_status` | `WMS_TRUCK_VISITS` | warehouseId, status | Truck tracking |
| `idx_wms_truck_wh_checkin` | `WMS_TRUCK_VISITS` | warehouseId, checkInAt | Truck check-in history |
| `idx_wms_alerts_sensor_ack` | `WMS_SENSOR_ALERTS` | sensorId, acknowledged | Unacknowledged alerts |
| `idx_wms_staging_wh_dir_status` | `WMS_STAGING_ASSIGNMENTS` | warehouseId, direction, status | Staging operations |
| `idx_wms_staging_source_ref` | `WMS_STAGING_ASSIGNMENTS` | sourceDocType, sourceDocId | Staging source lookup |
| `idx_wms_packing_wh_status` | `WMS_PACKING_SESSIONS` | warehouseId, status | Packing operations |

### Asset & Equipment (WMS)

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_wms_tool_issues_overdue` | `WMS_TOOL_ISSUES` | status, expectedReturnDate | Overdue tool detection |
| `idx_wms_vehicle_maint_vehicle_status` | `WMS_VEHICLE_MAINTENANCE` | vehicleId, status | Vehicle maintenance |
| `idx_wms_vehicle_maint_status_sched` | `WMS_VEHICLE_MAINTENANCE` | status, scheduledDate | Maintenance scheduling |
| `idx_wms_assets_status_category` | `WMS_ASSET_REGISTER` | status, category | Asset status/category |
| `idx_wms_assets_wh_status` | `WMS_ASSET_REGISTER` | locationWarehouseId, status | Asset warehouse status |

### Compliance (WMS)

| Index Name | Table | Columns | Purpose |
|---|---|---|---|
| `idx_wms_audit_wh_status` | `WMS_COMPLIANCE_AUDITS` | warehouseId, status | Audit filtering |
| `idx_wms_audit_wh_date` | `WMS_COMPLIANCE_AUDITS` | warehouseId, auditDate | Audit history |

## Index Design Principles

1. **Lead with high-cardinality column** — warehouseId before status
2. **Include filter + range columns** — status (equality) before date (range)
3. **Cover common queries** — avoid table scans for dashboard/report queries
4. **Avoid over-indexing** — each index has write overhead; only add for proven query patterns
5. **Oracle naming** — all index names use Oracle module prefix convention
