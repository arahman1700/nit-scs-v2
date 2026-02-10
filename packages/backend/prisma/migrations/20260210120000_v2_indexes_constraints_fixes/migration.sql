-- =============================================================================
-- Migration: v2_indexes_constraints_fixes
-- Date: 2026-02-10
-- Description: Add missing FK indexes, remove redundant indexes, add unique
--              constraints, fix cascade delete deadlock, add CHECK constraints.
-- =============================================================================

-- ─── 1. ADD MISSING FK INDEXES ──────────────────────────────────────────────

-- MrrvLine
CREATE INDEX IF NOT EXISTS "idx_mrrv_lines_mrrv" ON "mrrv_lines" ("mrrv_id");
CREATE INDEX IF NOT EXISTS "idx_mrrv_lines_item" ON "mrrv_lines" ("item_id");
CREATE INDEX IF NOT EXISTS "idx_mrrv_lines_uom" ON "mrrv_lines" ("uom_id");

-- MirvLine
CREATE INDEX IF NOT EXISTS "idx_mirv_lines_mirv" ON "mirv_lines" ("mirv_id");
CREATE INDEX IF NOT EXISTS "idx_mirv_lines_item" ON "mirv_lines" ("item_id");

-- MrvLine
CREATE INDEX IF NOT EXISTS "idx_mrv_lines_mrv" ON "mrv_lines" ("mrv_id");
CREATE INDEX IF NOT EXISTS "idx_mrv_lines_item" ON "mrv_lines" ("item_id");
CREATE INDEX IF NOT EXISTS "idx_mrv_lines_uom" ON "mrv_lines" ("uom_id");

-- OsdLine
CREATE INDEX IF NOT EXISTS "idx_osd_lines_osd" ON "osd_lines" ("osd_id");
CREATE INDEX IF NOT EXISTS "idx_osd_lines_item" ON "osd_lines" ("item_id");

-- GatePassItem
CREATE INDEX IF NOT EXISTS "idx_gate_pass_items_gp" ON "gate_pass_items" ("gate_pass_id");
CREATE INDEX IF NOT EXISTS "idx_gate_pass_items_item" ON "gate_pass_items" ("item_id");

-- MrfLine
CREATE INDEX IF NOT EXISTS "idx_mrf_lines_mrf" ON "mrf_lines" ("mrf_id");
CREATE INDEX IF NOT EXISTS "idx_mrf_lines_item" ON "mrf_lines" ("item_id");

-- StockTransferLine
CREATE INDEX IF NOT EXISTS "idx_stock_transfer_lines_transfer" ON "stock_transfer_lines" ("transfer_id");
CREATE INDEX IF NOT EXISTS "idx_stock_transfer_lines_item" ON "stock_transfer_lines" ("item_id");

-- ShipmentLine
CREATE INDEX IF NOT EXISTS "idx_shipment_lines_shipment" ON "shipment_lines" ("shipment_id");

-- ImsfLine
CREATE INDEX IF NOT EXISTS "idx_imsf_lines_imsf" ON "imsf_lines" ("imsf_id");

-- JoEquipmentLine
CREATE INDEX IF NOT EXISTS "idx_jo_equipment_lines_jo" ON "jo_equipment_lines" ("job_order_id");

-- JoApproval
CREATE INDEX IF NOT EXISTS "idx_jo_approvals_jo" ON "jo_approvals" ("job_order_id");

-- JoPayment
CREATE INDEX IF NOT EXISTS "idx_jo_payments_jo" ON "jo_payments" ("job_order_id");

-- CustomsTracking
CREATE INDEX IF NOT EXISTS "idx_customs_tracking_shipment" ON "customs_tracking" ("shipment_id");

-- Port
CREATE INDEX IF NOT EXISTS "idx_ports_city" ON "ports" ("city_id");

-- EquipmentType
CREATE INDEX IF NOT EXISTS "idx_equipment_types_category" ON "equipment_types" ("category_id");

-- Supplier
CREATE INDEX IF NOT EXISTS "idx_suppliers_city" ON "suppliers" ("city_id");

-- Generator
CREATE INDEX IF NOT EXISTS "idx_generators_project" ON "generators" ("current_project_id");
CREATE INDEX IF NOT EXISTS "idx_generators_warehouse" ON "generators" ("current_warehouse_id");
CREATE INDEX IF NOT EXISTS "idx_generators_equipment_type" ON "generators" ("equipment_type_id");

-- EquipmentFleet
CREATE INDEX IF NOT EXISTS "idx_equipment_fleet_type" ON "equipment_fleet" ("equipment_type_id");
CREATE INDEX IF NOT EXISTS "idx_equipment_fleet_driver" ON "equipment_fleet" ("driver_id");

-- Warehouse (5 FK columns, zero indexes previously)
CREATE INDEX IF NOT EXISTS "idx_warehouses_type" ON "warehouses" ("warehouse_type_id");
CREATE INDEX IF NOT EXISTS "idx_warehouses_project" ON "warehouses" ("project_id");
CREATE INDEX IF NOT EXISTS "idx_warehouses_region" ON "warehouses" ("region_id");
CREATE INDEX IF NOT EXISTS "idx_warehouses_city" ON "warehouses" ("city_id");
CREATE INDEX IF NOT EXISTS "idx_warehouses_manager" ON "warehouses" ("manager_id");

-- RentalContractLine
CREATE INDEX IF NOT EXISTS "idx_rental_contract_lines_contract" ON "rental_contract_lines" ("contract_id");


-- ─── 2. REMOVE REDUNDANT INDEXES (unique constraints already create indexes) ─

DROP INDEX IF EXISTS "idx_inventory_levels_item_wh";
DROP INDEX IF EXISTS "idx_items_code";
DROP INDEX IF EXISTS "idx_projects_code";
DROP INDEX IF EXISTS "idx_mrrv_number";
DROP INDEX IF EXISTS "idx_mirv_number";
DROP INDEX IF EXISTS "idx_mrv_number";
DROP INDEX IF EXISTS "idx_jo_number";


-- ─── 3. ADD MISSING UNIQUE CONSTRAINTS ───────────────────────────────────────

-- Prevent duplicate approval levels per document
CREATE UNIQUE INDEX IF NOT EXISTS "uq_approval_steps_doc_level"
  ON "approval_steps" ("document_type", "document_id", "level");

-- Prevent duplicate city names within a region
CREATE UNIQUE INDEX IF NOT EXISTS "uq_cities_name_region"
  ON "cities" ("city_name", "region_id");


-- ─── 4. FIX CASCADE DELETE DEADLOCK ──────────────────────────────────────────
-- Change lot_consumptions.mirv_line_id FK from RESTRICT to SET NULL

ALTER TABLE "lot_consumptions"
  DROP CONSTRAINT IF EXISTS "lot_consumptions_mirv_line_id_fkey";
ALTER TABLE "lot_consumptions"
  ADD CONSTRAINT "lot_consumptions_mirv_line_id_fkey"
  FOREIGN KEY ("mirv_line_id") REFERENCES "mirv_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── 5. ADD CHECK CONSTRAINTS FOR DATA INTEGRITY ────────────────────────────

-- Document status constraints
ALTER TABLE "mrrvs" ADD CONSTRAINT "chk_mrrv_status"
  CHECK ("status" IN ('draft', 'pending_qc', 'qc_approved', 'received', 'stored', 'rejected'));

ALTER TABLE "mirvs" ADD CONSTRAINT "chk_mirv_status"
  CHECK ("status" IN ('draft', 'pending_approval', 'approved', 'rejected', 'partially_issued', 'issued', 'completed', 'cancelled'));

ALTER TABLE "mrvs" ADD CONSTRAINT "chk_mrv_status"
  CHECK ("status" IN ('draft', 'pending', 'received', 'rejected', 'completed'));

ALTER TABLE "job_orders" ADD CONSTRAINT "chk_jo_status"
  CHECK ("status" IN ('draft', 'pending_approval', 'quoted', 'approved', 'assigned', 'in_progress', 'on_hold', 'completed', 'invoiced', 'rejected', 'cancelled'));

ALTER TABLE "gate_passes" ADD CONSTRAINT "chk_gate_pass_status"
  CHECK ("status" IN ('draft', 'pending', 'approved', 'released', 'returned', 'expired', 'cancelled'));

ALTER TABLE "stock_transfers" ADD CONSTRAINT "chk_stock_transfer_status"
  CHECK ("status" IN ('draft', 'pending', 'approved', 'shipped', 'received', 'completed', 'cancelled'));

ALTER TABLE "shipments" ADD CONSTRAINT "chk_shipment_status"
  CHECK ("status" IN ('draft', 'po_issued', 'in_production', 'ready_to_ship', 'in_transit', 'at_port', 'customs_clearing', 'cleared', 'in_delivery', 'delivered', 'cancelled'));

-- Role constraint
ALTER TABLE "employees" ADD CONSTRAINT "chk_employee_role"
  CHECK ("system_role" IN ('admin', 'manager', 'warehouse_supervisor', 'warehouse_staff', 'logistics_coordinator', 'site_engineer', 'qc_officer', 'freight_forwarder', 'transport_supervisor', 'scrap_committee_member'));

-- Inventory constraints
ALTER TABLE "inventory_levels" ADD CONSTRAINT "chk_inv_qty_positive"
  CHECK ("qty_on_hand" >= 0);

ALTER TABLE "inventory_levels" ADD CONSTRAINT "chk_inv_reserved_positive"
  CHECK ("qty_reserved" >= 0);

ALTER TABLE "inventory_lots" ADD CONSTRAINT "chk_lot_status"
  CHECK ("status" IN ('active', 'expired', 'consumed', 'damaged'));

-- Approval step constraints
ALTER TABLE "approval_steps" ADD CONSTRAINT "chk_approval_step_status"
  CHECK ("status" IN ('pending', 'approved', 'rejected', 'skipped'));

-- Job order type constraint
ALTER TABLE "job_orders" ADD CONSTRAINT "chk_jo_type"
  CHECK ("jo_type" IN ('transport', 'equipment', 'generator_rental', 'generator_maintenance', 'rental_monthly', 'rental_daily', 'scrap'));

-- Port type constraint
ALTER TABLE "ports" ADD CONSTRAINT "chk_port_type"
  CHECK ("port_type" IN ('sea', 'air', 'land'));

-- Notification type constraint
ALTER TABLE "notifications" ADD CONSTRAINT "chk_notification_type"
  CHECK ("notification_type" IN ('info', 'success', 'warning', 'alert', 'approval_request', 'sla_breach'));
