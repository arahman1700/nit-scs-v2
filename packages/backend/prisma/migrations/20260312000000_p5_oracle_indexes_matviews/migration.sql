-- P5: Oracle-Aligned Composite Indexes + Materialized Views
-- ============================================================================
-- This migration:
-- 1. Adds composite indexes for heavy logistics operations
-- 2. Creates 4 materialized views for reporting
-- ============================================================================

-- ============================================================================
-- PART 1: COMPOSITE INDEXES (already declared in Prisma schema @@index)
-- Prisma will create these on next `prisma db push` / `prisma migrate deploy`.
-- The indexes below are listed for documentation; Prisma manages them.
-- ============================================================================

-- ============================================================================
-- PART 2: MATERIALIZED VIEWS
-- ============================================================================

-- MV1: Daily Stock Summary — per-item, per-warehouse aggregation
CREATE MATERIALIZED VIEW IF NOT EXISTS "MV_DAILY_STOCK_SUMMARY" AS
SELECT
    il."item_id",
    il."warehouse_id",
    i."item_code",
    i."name" AS "item_name",
    w."name" AS "warehouse_name",
    il."qty_on_hand",
    il."qty_reserved",
    (il."qty_on_hand" - il."qty_reserved") AS "qty_available",
    il."min_level",
    il."reorder_point",
    CASE
        WHEN il."qty_on_hand" <= 0 THEN 'out_of_stock'
        WHEN il."reorder_point" IS NOT NULL AND il."qty_on_hand" <= il."reorder_point" THEN 'reorder'
        WHEN il."min_level" IS NOT NULL AND il."qty_on_hand" <= il."min_level" THEN 'low'
        ELSE 'adequate'
    END AS "stock_status",
    COALESCE(lots."lot_count", 0) AS "active_lot_count",
    lots."earliest_expiry",
    il."last_movement_date",
    il."updated_at" AS "snapshot_at"
FROM "MTL_ONHAND_QUANTITIES" il
JOIN "MTL_SYSTEM_ITEMS" i ON i."id" = il."item_id"
JOIN "WMS_WAREHOUSES" w ON w."id" = il."warehouse_id"
LEFT JOIN LATERAL (
    SELECT
        COUNT(*) AS "lot_count",
        MIN("expiry_date") AS "earliest_expiry"
    FROM "MTL_LOT_NUMBERS" lot
    WHERE lot."item_id" = il."item_id"
      AND lot."warehouse_id" = il."warehouse_id"
      AND lot."status" = 'active'
) lots ON true
WITH DATA;

CREATE UNIQUE INDEX "uq_mv_stock_summary_item_wh"
    ON "MV_DAILY_STOCK_SUMMARY" ("item_id", "warehouse_id");
CREATE INDEX "idx_mv_stock_summary_status"
    ON "MV_DAILY_STOCK_SUMMARY" ("stock_status");
CREATE INDEX "idx_mv_stock_summary_warehouse"
    ON "MV_DAILY_STOCK_SUMMARY" ("warehouse_id");

-- MV2: Open GRN/ASN — pending inbound documents for dock scheduling
CREATE MATERIALIZED VIEW IF NOT EXISTS "MV_OPEN_INBOUND_DOCS" AS
SELECT
    'GRN' AS "doc_type",
    m."id" AS "doc_id",
    m."mrrv_number" AS "doc_number",
    m."status",
    m."supplier_id",
    s."name" AS "supplier_name",
    m."warehouse_id",
    w."name" AS "warehouse_name",
    m."receive_date" AS "expected_date",
    m."total_value",
    (SELECT COUNT(*) FROM "RCV_RECEIPT_LINES" rl WHERE rl."mrrv_id" = m."id") AS "line_count",
    m."created_at"
FROM "RCV_RECEIPT_HEADERS" m
JOIN "AP_SUPPLIERS" s ON s."id" = m."supplier_id"
JOIN "WMS_WAREHOUSES" w ON w."id" = m."warehouse_id"
WHERE m."status" IN ('draft', 'pending_qc', 'qc_approved', 'received')

UNION ALL

SELECT
    'ASN' AS "doc_type",
    a."id" AS "doc_id",
    a."asn_number" AS "doc_number",
    a."status",
    a."supplier_id",
    s."name" AS "supplier_name",
    a."warehouse_id",
    w."name" AS "warehouse_name",
    a."expected_arrival" AS "expected_date",
    NULL AS "total_value",
    (SELECT COUNT(*) FROM "RCV_ASN_LINES" al WHERE al."asn_id" = a."id") AS "line_count",
    a."created_at"
FROM "RCV_ASN_HEADERS" a
JOIN "AP_SUPPLIERS" s ON s."id" = a."supplier_id"
JOIN "WMS_WAREHOUSES" w ON w."id" = a."warehouse_id"
WHERE a."status" IN ('pending', 'in_transit')
WITH DATA;

CREATE INDEX "idx_mv_open_inbound_type"
    ON "MV_OPEN_INBOUND_DOCS" ("doc_type");
CREATE INDEX "idx_mv_open_inbound_warehouse"
    ON "MV_OPEN_INBOUND_DOCS" ("warehouse_id");
CREATE INDEX "idx_mv_open_inbound_status"
    ON "MV_OPEN_INBOUND_DOCS" ("status");

-- MV3: Pending Customs — shipments awaiting customs clearance
CREATE MATERIALIZED VIEW IF NOT EXISTS "MV_PENDING_CUSTOMS" AS
SELECT
    sh."id" AS "shipment_id",
    sh."shipment_number",
    sh."status" AS "shipment_status",
    sh."supplier_id",
    s."name" AS "supplier_name",
    sh."destination_warehouse_id" AS "warehouse_id",
    w."name" AS "warehouse_name",
    sh."mode_of_shipment",
    sh."awb_bl_number",
    sh."container_number",
    sh."eta_port",
    sh."commercial_value",
    sh."duties_estimated",
    ct."stage" AS "customs_stage",
    ct."customs_declaration",
    ct."duties_amount",
    ct."vat_amount",
    ct."other_fees",
    ct."payment_status",
    (COALESCE(ct."duties_amount", 0) + COALESCE(ct."vat_amount", 0) + COALESCE(ct."other_fees", 0)) AS "total_customs_cost",
    ct."stage_date" AS "last_stage_date",
    (SELECT COUNT(*) FROM "WSH_CUSTOMS_DOCUMENTS" cd
     WHERE cd."shipment_id" = sh."id" AND cd."status" = 'pending') AS "pending_doc_count",
    (SELECT COUNT(*) FROM "WSH_CUSTOMS_DOCUMENTS" cd
     WHERE cd."shipment_id" = sh."id") AS "total_doc_count"
FROM "WSH_DELIVERY_HEADERS" sh
JOIN "AP_SUPPLIERS" s ON s."id" = sh."supplier_id"
LEFT JOIN "WMS_WAREHOUSES" w ON w."id" = sh."destination_warehouse_id"
LEFT JOIN LATERAL (
    SELECT *
    FROM "WSH_CUSTOMS_TRACKING" t
    WHERE t."shipment_id" = sh."id"
    ORDER BY t."stage_date" DESC
    LIMIT 1
) ct ON true
WHERE sh."status" IN ('at_port', 'customs_clearing')
WITH DATA;

CREATE UNIQUE INDEX "uq_mv_pending_customs_shipment"
    ON "MV_PENDING_CUSTOMS" ("shipment_id");
CREATE INDEX "idx_mv_pending_customs_stage"
    ON "MV_PENDING_CUSTOMS" ("customs_stage");
CREATE INDEX "idx_mv_pending_customs_warehouse"
    ON "MV_PENDING_CUSTOMS" ("warehouse_id");

-- MV4: Warehouse Utilization — capacity and occupancy per warehouse/zone
CREATE MATERIALIZED VIEW IF NOT EXISTS "MV_WAREHOUSE_UTILIZATION" AS
SELECT
    w."id" AS "warehouse_id",
    w."name" AS "warehouse_name",
    w."code" AS "warehouse_code",
    w."type_id" AS "warehouse_type_id",
    wt."name" AS "warehouse_type_name",
    z."id" AS "zone_id",
    z."zone_name",
    z."zone_code",
    z."zone_type",
    z."capacity" AS "zone_capacity",
    z."current_occupancy" AS "zone_occupancy",
    CASE
        WHEN z."capacity" IS NOT NULL AND z."capacity" > 0
        THEN ROUND((z."current_occupancy"::decimal / z."capacity") * 100, 1)
        ELSE NULL
    END AS "utilization_pct",
    (SELECT COUNT(*) FROM "WMS_BIN_LOCATIONS" bl
     WHERE bl."zone_id" = z."id" AND bl."is_active" = true) AS "active_bin_count",
    (SELECT COUNT(*) FROM "WMS_BIN_LOCATIONS" bl
     WHERE bl."zone_id" = z."id" AND bl."is_active" = true
     AND bl."current_occupancy" > 0) AS "occupied_bin_count",
    (SELECT COALESCE(SUM(il."qty_on_hand"), 0)
     FROM "MTL_ONHAND_QUANTITIES" il
     WHERE il."warehouse_id" = w."id") AS "total_qty_on_hand",
    (SELECT COUNT(DISTINCT il."item_id")
     FROM "MTL_ONHAND_QUANTITIES" il
     WHERE il."warehouse_id" = w."id"
     AND il."qty_on_hand" > 0) AS "unique_item_count"
FROM "WMS_WAREHOUSES" w
LEFT JOIN "WMS_WAREHOUSE_TYPES" wt ON wt."id" = w."type_id"
LEFT JOIN "WMS_ZONES" z ON z."warehouse_id" = w."id"
WHERE w."is_active" = true
WITH DATA;

CREATE INDEX "idx_mv_wh_util_warehouse"
    ON "MV_WAREHOUSE_UTILIZATION" ("warehouse_id");
CREATE INDEX "idx_mv_wh_util_zone"
    ON "MV_WAREHOUSE_UTILIZATION" ("zone_id");
CREATE INDEX "idx_mv_wh_util_pct"
    ON "MV_WAREHOUSE_UTILIZATION" ("utilization_pct");

-- ============================================================================
-- REFRESH FUNCTIONS (for cron/scheduler integration)
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_mv_daily_stock_summary()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY "MV_DAILY_STOCK_SUMMARY";
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_mv_open_inbound_docs()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW "MV_OPEN_INBOUND_DOCS";
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_mv_pending_customs()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY "MV_PENDING_CUSTOMS";
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_mv_warehouse_utilization()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW "MV_WAREHOUSE_UTILIZATION";
END;
$$ LANGUAGE plpgsql;

-- Combined refresh — call from scheduler
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    PERFORM refresh_mv_daily_stock_summary();
    PERFORM refresh_mv_open_inbound_docs();
    PERFORM refresh_mv_pending_customs();
    PERFORM refresh_mv_warehouse_utilization();
END;
$$ LANGUAGE plpgsql;
