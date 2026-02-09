-- CreateTable
CREATE TABLE "regions" (
    "id" UUID NOT NULL,
    "region_name" VARCHAR(100) NOT NULL,
    "region_name_ar" VARCHAR(100),

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "city_name" VARCHAR(100) NOT NULL,
    "city_name_ar" VARCHAR(100),
    "region_id" UUID NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ports" (
    "id" UUID NOT NULL,
    "port_name" VARCHAR(200) NOT NULL,
    "port_code" VARCHAR(20),
    "city_id" UUID,
    "port_type" VARCHAR(20),

    CONSTRAINT "ports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units_of_measure" (
    "id" UUID NOT NULL,
    "uom_code" VARCHAR(20) NOT NULL,
    "uom_name" VARCHAR(50) NOT NULL,
    "uom_name_ar" VARCHAR(50),
    "category" VARCHAR(30),

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_types" (
    "id" UUID NOT NULL,
    "type_name" VARCHAR(50) NOT NULL,
    "type_name_ar" VARCHAR(50),
    "description" TEXT,

    CONSTRAINT "warehouse_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_categories" (
    "id" UUID NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,
    "category_name_ar" VARCHAR(100),

    CONSTRAINT "equipment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_types" (
    "id" UUID NOT NULL,
    "type_name" VARCHAR(100) NOT NULL,
    "type_name_ar" VARCHAR(100),
    "category_id" UUID,

    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_workflows" (
    "id" UUID NOT NULL,
    "document_type" VARCHAR(30) NOT NULL,
    "min_amount" DECIMAL(15,2) NOT NULL,
    "max_amount" DECIMAL(15,2),
    "approver_role" VARCHAR(50) NOT NULL,
    "sla_hours" INTEGER NOT NULL,

    CONSTRAINT "approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entities" (
    "id" UUID NOT NULL,
    "entity_code" VARCHAR(20) NOT NULL,
    "entity_name" VARCHAR(200) NOT NULL,
    "entity_name_ar" VARCHAR(200),
    "parent_entity_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "project_code" VARCHAR(50) NOT NULL,
    "project_name" VARCHAR(300) NOT NULL,
    "project_name_ar" VARCHAR(300),
    "client" VARCHAR(200) NOT NULL,
    "entity_id" UUID,
    "region_id" UUID,
    "city_id" UUID,
    "project_manager_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "start_date" DATE,
    "end_date" DATE,
    "budget" DECIMAL(15,2),
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "employee_id_number" VARCHAR(20) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "full_name_ar" VARCHAR(200),
    "email" VARCHAR(200) NOT NULL,
    "phone" VARCHAR(20),
    "department" VARCHAR(50) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "system_role" VARCHAR(50) NOT NULL,
    "assigned_project_id" UUID,
    "assigned_warehouse_id" UUID,
    "manager_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "hire_date" DATE,
    "password_hash" VARCHAR(500),
    "last_login" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" UUID NOT NULL,
    "supplier_code" VARCHAR(50) NOT NULL,
    "supplier_name" VARCHAR(300) NOT NULL,
    "supplier_name_ar" VARCHAR(300),
    "types" VARCHAR(200)[],
    "contact_person" VARCHAR(200),
    "phone" VARCHAR(20),
    "email" VARCHAR(200),
    "address" TEXT,
    "city_id" UUID,
    "cr_number" VARCHAR(50),
    "vat_number" VARCHAR(50),
    "rating" SMALLINT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "payment_terms" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" UUID NOT NULL,
    "warehouse_code" VARCHAR(50) NOT NULL,
    "warehouse_name" VARCHAR(200) NOT NULL,
    "warehouse_name_ar" VARCHAR(200),
    "warehouse_type_id" UUID NOT NULL,
    "project_id" UUID,
    "region_id" UUID NOT NULL,
    "city_id" UUID,
    "address" TEXT,
    "manager_id" UUID,
    "contact_phone" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "item_code" VARCHAR(50) NOT NULL,
    "item_description" VARCHAR(500) NOT NULL,
    "item_description_ar" VARCHAR(500),
    "category" VARCHAR(50) NOT NULL,
    "sub_category" VARCHAR(100),
    "uom_id" UUID NOT NULL,
    "min_stock" DECIMAL(12,3) DEFAULT 0,
    "reorder_point" DECIMAL(12,3),
    "standard_cost" DECIMAL(15,2),
    "barcode" VARCHAR(100),
    "is_serialized" BOOLEAN DEFAULT false,
    "is_expirable" BOOLEAN DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generators" (
    "id" UUID NOT NULL,
    "generator_code" VARCHAR(50) NOT NULL,
    "generator_name" VARCHAR(200) NOT NULL,
    "capacity_kva" INTEGER NOT NULL,
    "equipment_type_id" UUID,
    "current_project_id" UUID,
    "current_warehouse_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'available',
    "purchase_date" DATE,
    "purchase_value" DECIMAL(15,2),
    "salvage_value" DECIMAL(15,2),
    "useful_life_months" INTEGER,
    "depreciation_method" VARCHAR(20),
    "in_service_date" DATE,
    "hours_total" DECIMAL(10,1) DEFAULT 0,
    "last_depreciation_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "generators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_fleet" (
    "id" UUID NOT NULL,
    "vehicle_code" VARCHAR(50) NOT NULL,
    "vehicle_type" VARCHAR(100) NOT NULL,
    "plate_number" VARCHAR(30),
    "equipment_type_id" UUID,
    "driver_id" UUID,
    "status" VARCHAR(30) NOT NULL DEFAULT 'available',
    "mileage_km" INTEGER DEFAULT 0,
    "next_maintenance_date" DATE,
    "insurance_expiry" DATE,
    "registration_expiry" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "equipment_fleet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mrrv" (
    "id" UUID NOT NULL,
    "mrrv_number" VARCHAR(20) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "po_number" VARCHAR(50),
    "warehouse_id" UUID NOT NULL,
    "project_id" UUID,
    "received_by_id" UUID NOT NULL,
    "receive_date" TIMESTAMPTZ NOT NULL,
    "invoice_number" VARCHAR(50),
    "delivery_note" VARCHAR(100),
    "total_value" DECIMAL(15,2) DEFAULT 0,
    "rfim_required" BOOLEAN DEFAULT false,
    "has_osd" BOOLEAN DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "qc_inspector_id" UUID,
    "qc_approved_date" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mrrv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mrrv_lines" (
    "id" UUID NOT NULL,
    "mrrv_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "qty_ordered" DECIMAL(12,3),
    "qty_received" DECIMAL(12,3) NOT NULL,
    "qty_damaged" DECIMAL(12,3) DEFAULT 0,
    "uom_id" UUID NOT NULL,
    "unit_cost" DECIMAL(15,2),
    "condition" VARCHAR(20) NOT NULL DEFAULT 'good',
    "storage_location" VARCHAR(100),
    "expiry_date" DATE,
    "notes" TEXT,

    CONSTRAINT "mrrv_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rfim" (
    "id" UUID NOT NULL,
    "rfim_number" VARCHAR(20) NOT NULL,
    "mrrv_id" UUID NOT NULL,
    "inspector_id" UUID,
    "request_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inspection_date" TIMESTAMPTZ,
    "result" VARCHAR(20),
    "comments" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rfim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "osd_reports" (
    "id" UUID NOT NULL,
    "osd_number" VARCHAR(20) NOT NULL,
    "mrrv_id" UUID NOT NULL,
    "po_number" VARCHAR(50),
    "supplier_id" UUID,
    "warehouse_id" UUID,
    "report_date" DATE NOT NULL,
    "report_types" VARCHAR(50)[],
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "total_over_value" DECIMAL(15,2) DEFAULT 0,
    "total_short_value" DECIMAL(15,2) DEFAULT 0,
    "total_damage_value" DECIMAL(15,2) DEFAULT 0,
    "claim_sent_date" DATE,
    "claim_reference" VARCHAR(100),
    "supplier_response" TEXT,
    "response_date" DATE,
    "resolution_type" VARCHAR(30),
    "resolution_amount" DECIMAL(15,2),
    "resolution_date" DATE,
    "resolved_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "osd_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "osd_lines" (
    "id" UUID NOT NULL,
    "osd_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "mrrv_line_id" UUID,
    "qty_invoice" DECIMAL(12,3) NOT NULL,
    "qty_received" DECIMAL(12,3) NOT NULL,
    "qty_damaged" DECIMAL(12,3) DEFAULT 0,
    "damage_type" VARCHAR(30),
    "unit_cost" DECIMAL(15,2),
    "notes" TEXT,

    CONSTRAINT "osd_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mirv" (
    "id" UUID NOT NULL,
    "mirv_number" VARCHAR(20) NOT NULL,
    "project_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "location_of_work" VARCHAR(200),
    "requested_by_id" UUID NOT NULL,
    "request_date" TIMESTAMPTZ NOT NULL,
    "required_date" DATE,
    "priority" VARCHAR(20) DEFAULT 'normal',
    "estimated_value" DECIMAL(15,2) DEFAULT 0,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "approved_by_id" UUID,
    "approved_date" TIMESTAMPTZ,
    "issued_by_id" UUID,
    "issued_date" TIMESTAMPTZ,
    "rejection_reason" TEXT,
    "reservation_status" VARCHAR(20) DEFAULT 'none',
    "mrf_id" UUID,
    "sla_due_date" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mirv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mirv_lines" (
    "id" UUID NOT NULL,
    "mirv_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "qty_requested" DECIMAL(12,3) NOT NULL,
    "qty_approved" DECIMAL(12,3),
    "qty_issued" DECIMAL(12,3),
    "unit_cost" DECIMAL(15,2),
    "storage_location" VARCHAR(100),
    "notes" TEXT,

    CONSTRAINT "mirv_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mrv" (
    "id" UUID NOT NULL,
    "mrv_number" VARCHAR(20) NOT NULL,
    "return_type" VARCHAR(30) NOT NULL,
    "project_id" UUID NOT NULL,
    "from_warehouse_id" UUID,
    "to_warehouse_id" UUID NOT NULL,
    "returned_by_id" UUID NOT NULL,
    "return_date" TIMESTAMPTZ NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "received_by_id" UUID,
    "received_date" TIMESTAMPTZ,
    "original_mirv_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "mrv_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mrv_lines" (
    "id" UUID NOT NULL,
    "mrv_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "qty_returned" DECIMAL(12,3) NOT NULL,
    "uom_id" UUID NOT NULL,
    "condition" VARCHAR(20) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "mrv_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_passes" (
    "id" UUID NOT NULL,
    "gate_pass_number" VARCHAR(20) NOT NULL,
    "pass_type" VARCHAR(20) NOT NULL,
    "mirv_id" UUID,
    "project_id" UUID,
    "warehouse_id" UUID NOT NULL,
    "vehicle_number" VARCHAR(30) NOT NULL,
    "driver_name" VARCHAR(200) NOT NULL,
    "driver_id_number" VARCHAR(30),
    "destination" VARCHAR(300) NOT NULL,
    "purpose" TEXT,
    "issue_date" TIMESTAMPTZ NOT NULL,
    "valid_until" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "issued_by_id" UUID,
    "security_officer" VARCHAR(200),
    "exit_time" TIMESTAMPTZ,
    "return_time" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "gate_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gate_pass_items" (
    "id" UUID NOT NULL,
    "gate_pass_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "uom_id" UUID NOT NULL,
    "description" VARCHAR(300),

    CONSTRAINT "gate_pass_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_requisitions" (
    "id" UUID NOT NULL,
    "mrf_number" VARCHAR(20) NOT NULL,
    "request_date" TIMESTAMPTZ NOT NULL,
    "required_date" DATE,
    "project_id" UUID NOT NULL,
    "department" VARCHAR(30),
    "requested_by_id" UUID NOT NULL,
    "delivery_point" VARCHAR(200),
    "work_order" VARCHAR(50),
    "drawing_reference" VARCHAR(100),
    "priority" VARCHAR(20) DEFAULT 'medium',
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "total_estimated_value" DECIMAL(15,2) DEFAULT 0,
    "mirv_id" UUID,
    "reviewed_by_id" UUID,
    "review_date" TIMESTAMPTZ,
    "approved_by_id" UUID,
    "approval_date" TIMESTAMPTZ,
    "fulfillment_date" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "material_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mrf_lines" (
    "id" UUID NOT NULL,
    "mrf_id" UUID NOT NULL,
    "item_id" UUID,
    "item_description" VARCHAR(500),
    "category" VARCHAR(30),
    "qty_requested" DECIMAL(12,3) NOT NULL,
    "uom_id" UUID,
    "source" VARCHAR(20) DEFAULT 'tbd',
    "qty_from_stock" DECIMAL(12,3) DEFAULT 0,
    "qty_from_purchase" DECIMAL(12,3) DEFAULT 0,
    "qty_issued" DECIMAL(12,3) DEFAULT 0,
    "unit_cost" DECIMAL(15,2),
    "mirv_line_id" UUID,
    "notes" TEXT,

    CONSTRAINT "mrf_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" UUID NOT NULL,
    "transfer_number" VARCHAR(20) NOT NULL,
    "transfer_type" VARCHAR(30) NOT NULL,
    "from_warehouse_id" UUID NOT NULL,
    "to_warehouse_id" UUID NOT NULL,
    "from_project_id" UUID,
    "to_project_id" UUID,
    "requested_by_id" UUID NOT NULL,
    "transfer_date" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "shipped_date" TIMESTAMPTZ,
    "received_date" TIMESTAMPTZ,
    "source_mrv_id" UUID,
    "destination_mirv_id" UUID,
    "transport_jo_id" UUID,
    "gate_pass_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_lines" (
    "id" UUID NOT NULL,
    "transfer_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "uom_id" UUID NOT NULL,
    "condition" VARCHAR(20) DEFAULT 'good',

    CONSTRAINT "stock_transfer_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_orders" (
    "id" UUID NOT NULL,
    "jo_number" VARCHAR(20) NOT NULL,
    "jo_type" VARCHAR(30) NOT NULL,
    "entity_id" UUID,
    "project_id" UUID NOT NULL,
    "supplier_id" UUID,
    "requested_by_id" UUID NOT NULL,
    "request_date" TIMESTAMPTZ NOT NULL,
    "required_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "priority" VARCHAR(20) DEFAULT 'normal',
    "description" TEXT NOT NULL,
    "notes" TEXT,
    "total_amount" DECIMAL(15,2) DEFAULT 0,
    "start_date" TIMESTAMPTZ,
    "completion_date" TIMESTAMPTZ,
    "completed_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "job_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jo_transport_details" (
    "id" UUID NOT NULL,
    "job_order_id" UUID NOT NULL,
    "pickup_location" VARCHAR(300) NOT NULL,
    "pickup_location_url" VARCHAR(500),
    "pickup_contact_name" VARCHAR(200),
    "pickup_contact_phone" VARCHAR(20),
    "delivery_location" VARCHAR(300) NOT NULL,
    "delivery_location_url" VARCHAR(500),
    "delivery_contact_name" VARCHAR(200),
    "delivery_contact_phone" VARCHAR(20),
    "cargo_type" VARCHAR(50) NOT NULL,
    "cargo_weight_tons" DECIMAL(10,2),
    "number_of_trailers" SMALLINT,
    "number_of_trips" SMALLINT,
    "include_loading_equipment" BOOLEAN DEFAULT false,
    "loading_equipment_type" VARCHAR(100),
    "insurance_required" BOOLEAN DEFAULT false,
    "material_price_sar" DECIMAL(15,2),

    CONSTRAINT "jo_transport_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jo_rental_details" (
    "id" UUID NOT NULL,
    "job_order_id" UUID NOT NULL,
    "rental_start_date" DATE NOT NULL,
    "rental_end_date" DATE NOT NULL,
    "monthly_rate" DECIMAL(15,2),
    "daily_rate" DECIMAL(15,2),
    "with_operator" BOOLEAN DEFAULT false,
    "overtime_hours" DECIMAL(8,2) DEFAULT 0,
    "overtime_approved" BOOLEAN DEFAULT false,

    CONSTRAINT "jo_rental_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jo_generator_details" (
    "id" UUID NOT NULL,
    "job_order_id" UUID NOT NULL,
    "generator_id" UUID,
    "capacity_kva" INTEGER,
    "maintenance_type" VARCHAR(30),
    "issue_description" TEXT,
    "shift_start_time" TIME(6),

    CONSTRAINT "jo_generator_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jo_scrap_details" (
    "id" UUID NOT NULL,
    "job_order_id" UUID NOT NULL,
    "scrap_type" VARCHAR(50) NOT NULL,
    "scrap_weight_tons" DECIMAL(10,2) NOT NULL,
    "scrap_description" TEXT,
    "scrap_destination" VARCHAR(300),
    "material_price_sar" DECIMAL(15,2),

    CONSTRAINT "jo_scrap_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jo_equipment_lines" (
    "id" UUID NOT NULL,
    "job_order_id" UUID NOT NULL,
    "equipment_type_id" UUID NOT NULL,
    "quantity" SMALLINT NOT NULL,
    "with_operator" BOOLEAN DEFAULT false,
    "site_location" VARCHAR(200),
    "daily_rate" DECIMAL(10,2),
    "duration_days" SMALLINT,

    CONSTRAINT "jo_equipment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jo_sla_tracking" (
    "id" UUID NOT NULL,
    "job_order_id" UUID NOT NULL,
    "sla_due_date" TIMESTAMPTZ,
    "sla_response_hours" INTEGER,
    "sla_business_days" INTEGER,
    "stop_clock_start" TIMESTAMPTZ,
    "stop_clock_end" TIMESTAMPTZ,
    "stop_clock_reason" TEXT,
    "sla_met" BOOLEAN,

    CONSTRAINT "jo_sla_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jo_approvals" (
    "id" UUID NOT NULL,
    "job_order_id" UUID NOT NULL,
    "approval_type" VARCHAR(30) NOT NULL,
    "approver_id" UUID NOT NULL,
    "approved_date" TIMESTAMPTZ,
    "approved" BOOLEAN,
    "quote_amount" DECIMAL(15,2),
    "comments" TEXT,

    CONSTRAINT "jo_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jo_payments" (
    "id" UUID NOT NULL,
    "job_order_id" UUID NOT NULL,
    "invoice_number" VARCHAR(50),
    "invoice_receipt_date" DATE,
    "cost_excl_vat" DECIMAL(15,2),
    "vat_amount" DECIMAL(15,2),
    "grand_total" DECIMAL(15,2),
    "payment_status" VARCHAR(20) DEFAULT 'pending',
    "payment_approved_date" DATE,
    "actual_payment_date" DATE,
    "oracle_voucher" VARCHAR(50),
    "attachment_url" VARCHAR(500),

    CONSTRAINT "jo_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_levels" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "qty_on_hand" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "qty_reserved" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "min_level" DECIMAL(12,3),
    "reorder_point" DECIMAL(12,3),
    "last_movement_date" TIMESTAMPTZ,
    "alert_sent" BOOLEAN DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inventory_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_lots" (
    "id" UUID NOT NULL,
    "lot_number" VARCHAR(20) NOT NULL,
    "item_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "mrrv_line_id" UUID,
    "receipt_date" TIMESTAMPTZ NOT NULL,
    "expiry_date" DATE,
    "initial_qty" DECIMAL(12,3) NOT NULL,
    "available_qty" DECIMAL(12,3) NOT NULL,
    "reserved_qty" DECIMAL(12,3) DEFAULT 0,
    "unit_cost" DECIMAL(15,2),
    "supplier_id" UUID,
    "bin_location" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_consumptions" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "mirv_line_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit_cost" DECIMAL(15,2),
    "consumption_date" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lot_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leftover_materials" (
    "id" UUID NOT NULL,
    "leftover_number" VARCHAR(20) NOT NULL,
    "item_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "original_mirv_id" UUID,
    "quantity" DECIMAL(12,3) NOT NULL,
    "uom_id" UUID NOT NULL,
    "condition" VARCHAR(20) NOT NULL,
    "ownership" VARCHAR(20) NOT NULL DEFAULT 'nit',
    "ownership_basis" VARCHAR(30),
    "unit_cost" DECIMAL(15,2),
    "disposition" VARCHAR(30),
    "status" VARCHAR(20) NOT NULL DEFAULT 'identified',
    "created_by_id" UUID,
    "approved_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "leftover_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL,
    "shipment_number" VARCHAR(20) NOT NULL,
    "po_number" VARCHAR(50),
    "supplier_id" UUID NOT NULL,
    "freight_forwarder_id" UUID,
    "project_id" UUID,
    "origin_country" VARCHAR(100),
    "mode_of_shipment" VARCHAR(30) NOT NULL,
    "port_of_loading" VARCHAR(200),
    "port_of_entry_id" UUID,
    "destination_warehouse_id" UUID,
    "order_date" DATE,
    "expected_ship_date" DATE,
    "actual_ship_date" DATE,
    "eta_port" DATE,
    "actual_arrival_date" DATE,
    "delivery_date" DATE,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "awb_bl_number" VARCHAR(100),
    "container_number" VARCHAR(50),
    "vessel_flight" VARCHAR(100),
    "tracking_url" VARCHAR(500),
    "commercial_value" DECIMAL(15,2),
    "freight_cost" DECIMAL(15,2),
    "insurance_cost" DECIMAL(15,2),
    "duties_estimated" DECIMAL(15,2),
    "description" TEXT,
    "mrrv_id" UUID,
    "transport_jo_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_tracking" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "stage" VARCHAR(30) NOT NULL,
    "stage_date" TIMESTAMPTZ NOT NULL,
    "stage_end_date" TIMESTAMPTZ,
    "customs_declaration" VARCHAR(50),
    "customs_ref" VARCHAR(50),
    "inspector_name" VARCHAR(200),
    "inspection_type" VARCHAR(30),
    "duties_amount" DECIMAL(15,2),
    "vat_amount" DECIMAL(15,2),
    "other_fees" DECIMAL(15,2),
    "payment_status" VARCHAR(20),
    "payment_date" DATE,
    "payment_reference" VARCHAR(100),
    "issues" TEXT,
    "resolution" TEXT,

    CONSTRAINT "customs_tracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_lines" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "item_id" UUID,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "uom_id" UUID,
    "unit_value" DECIMAL(15,2),
    "hs_code" VARCHAR(20),

    CONSTRAINT "shipment_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_equipment_rates" (
    "id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "equipment_type_id" UUID NOT NULL,
    "daily_rate" DECIMAL(10,2),
    "monthly_rate" DECIMAL(10,2),
    "with_operator_surcharge" DECIMAL(10,2) DEFAULT 0,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "notes" TEXT,

    CONSTRAINT "supplier_equipment_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "depreciation_entries" (
    "id" UUID NOT NULL,
    "generator_id" UUID NOT NULL,
    "period" DATE NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "method" VARCHAR(20) NOT NULL,
    "hours_used" DECIMAL(10,1),
    "running_total" DECIMAL(15,2),
    "posted_to_gl" BOOLEAN DEFAULT false,
    "gl_reference" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "depreciation_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_counters" (
    "id" UUID NOT NULL,
    "document_type" VARCHAR(30) NOT NULL,
    "prefix" VARCHAR(10) NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_counters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "table_name" VARCHAR(50) NOT NULL,
    "record_id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "changed_fields" JSONB,
    "old_values" JSONB,
    "new_values" JSONB,
    "performed_by_id" UUID,
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "title_ar" VARCHAR(200),
    "body" TEXT,
    "notification_type" VARCHAR(30) NOT NULL,
    "reference_table" VARCHAR(50),
    "reference_id" UUID,
    "is_read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "priority" VARCHAR(10) NOT NULL DEFAULT 'medium',
    "due_date" DATE,
    "assignee_id" UUID,
    "creator_id" UUID NOT NULL,
    "project_id" UUID,
    "tags" VARCHAR(50)[],
    "completed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comments" (
    "id" UUID NOT NULL,
    "task_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_codes" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_documents" (
    "id" UUID NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "title_ar" VARCHAR(300),
    "description" TEXT,
    "category" VARCHAR(20) NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(300) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "tags" VARCHAR(50)[],
    "uploaded_by_id" UUID NOT NULL,
    "visibility" VARCHAR(20) NOT NULL DEFAULT 'all',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "company_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "user_id" UUID,
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "entity_type" VARCHAR(50) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_rules" (
    "id" UUID NOT NULL,
    "workflow_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "trigger_event" VARCHAR(100) NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "stop_on_match" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_execution_logs" (
    "id" UUID NOT NULL,
    "rule_id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "matched" BOOLEAN NOT NULL DEFAULT false,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "event_data" JSONB,
    "actions_run" JSONB,
    "executed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL,
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "body_html" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL,
    "template_id" UUID,
    "to_email" VARCHAR(255) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "external_id" VARCHAR(200),
    "error" TEXT,
    "reference_table" VARCHAR(50),
    "reference_id" UUID,
    "sent_at" TIMESTAMPTZ,
    "delivered_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "default_for_role" VARCHAR(50),
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dashboard_widgets" (
    "id" UUID NOT NULL,
    "dashboard_id" UUID NOT NULL,
    "widget_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "data_source" VARCHAR(100) NOT NULL,
    "query_config" JSONB NOT NULL DEFAULT '{}',
    "display_config" JSONB NOT NULL DEFAULT '{}',
    "grid_position" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dashboard_widgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_reports" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "owner_id" UUID NOT NULL,
    "data_source" VARCHAR(100) NOT NULL,
    "columns" JSONB NOT NULL DEFAULT '[]',
    "filters" JSONB NOT NULL DEFAULT '{}',
    "visualization" VARCHAR(20) NOT NULL DEFAULT 'table',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_comments" (
    "id" UUID NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "document_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" UUID NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "document_id" UUID NOT NULL,
    "level" INTEGER NOT NULL,
    "approver_role" VARCHAR(50) NOT NULL,
    "approver_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "decided_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delegation_rules" (
    "id" UUID NOT NULL,
    "delegator_id" UUID NOT NULL,
    "delegate_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "scope" VARCHAR(50) NOT NULL DEFAULT 'all',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_region_name_key" ON "regions"("region_name");

-- CreateIndex
CREATE UNIQUE INDEX "ports_port_code_key" ON "ports"("port_code");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_uom_code_key" ON "units_of_measure"("uom_code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_types_type_name_key" ON "warehouse_types"("type_name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_categories_category_name_key" ON "equipment_categories"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_types_type_name_key" ON "equipment_types"("type_name");

-- CreateIndex
CREATE UNIQUE INDEX "entities_entity_code_key" ON "entities"("entity_code");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_code_key" ON "projects"("project_code");

-- CreateIndex
CREATE INDEX "idx_projects_code" ON "projects"("project_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_id_number_key" ON "employees"("employee_id_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_code_key" ON "suppliers"("supplier_code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_warehouse_code_key" ON "warehouses"("warehouse_code");

-- CreateIndex
CREATE UNIQUE INDEX "items_item_code_key" ON "items"("item_code");

-- CreateIndex
CREATE UNIQUE INDEX "items_barcode_key" ON "items"("barcode");

-- CreateIndex
CREATE INDEX "idx_items_code" ON "items"("item_code");

-- CreateIndex
CREATE UNIQUE INDEX "generators_generator_code_key" ON "generators"("generator_code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_fleet_vehicle_code_key" ON "equipment_fleet"("vehicle_code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_fleet_plate_number_key" ON "equipment_fleet"("plate_number");

-- CreateIndex
CREATE UNIQUE INDEX "mrrv_mrrv_number_key" ON "mrrv"("mrrv_number");

-- CreateIndex
CREATE INDEX "idx_mrrv_status" ON "mrrv"("status");

-- CreateIndex
CREATE INDEX "idx_mrrv_supplier" ON "mrrv"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_mrrv_number" ON "mrrv"("mrrv_number");

-- CreateIndex
CREATE UNIQUE INDEX "rfim_rfim_number_key" ON "rfim"("rfim_number");

-- CreateIndex
CREATE UNIQUE INDEX "osd_reports_osd_number_key" ON "osd_reports"("osd_number");

-- CreateIndex
CREATE UNIQUE INDEX "mirv_mirv_number_key" ON "mirv"("mirv_number");

-- CreateIndex
CREATE INDEX "idx_mirv_status" ON "mirv"("status");

-- CreateIndex
CREATE INDEX "idx_mirv_project" ON "mirv"("project_id");

-- CreateIndex
CREATE INDEX "idx_mirv_warehouse" ON "mirv"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_mirv_number" ON "mirv"("mirv_number");

-- CreateIndex
CREATE UNIQUE INDEX "mrv_mrv_number_key" ON "mrv"("mrv_number");

-- CreateIndex
CREATE INDEX "idx_mrv_number" ON "mrv"("mrv_number");

-- CreateIndex
CREATE UNIQUE INDEX "gate_passes_gate_pass_number_key" ON "gate_passes"("gate_pass_number");

-- CreateIndex
CREATE INDEX "idx_gate_passes_status" ON "gate_passes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "material_requisitions_mrf_number_key" ON "material_requisitions"("mrf_number");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_transfer_number_key" ON "stock_transfers"("transfer_number");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_status" ON "stock_transfers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "job_orders_jo_number_key" ON "job_orders"("jo_number");

-- CreateIndex
CREATE INDEX "idx_job_orders_type_status" ON "job_orders"("jo_type", "status");

-- CreateIndex
CREATE INDEX "idx_job_orders_project" ON "job_orders"("project_id");

-- CreateIndex
CREATE INDEX "idx_job_orders_date" ON "job_orders"("request_date" DESC);

-- CreateIndex
CREATE INDEX "idx_jo_number" ON "job_orders"("jo_number");

-- CreateIndex
CREATE UNIQUE INDEX "jo_transport_details_job_order_id_key" ON "jo_transport_details"("job_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "jo_rental_details_job_order_id_key" ON "jo_rental_details"("job_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "jo_generator_details_job_order_id_key" ON "jo_generator_details"("job_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "jo_scrap_details_job_order_id_key" ON "jo_scrap_details"("job_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "jo_sla_tracking_job_order_id_key" ON "jo_sla_tracking"("job_order_id");

-- CreateIndex
CREATE INDEX "idx_inventory_item_wh" ON "inventory_levels"("item_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_item_wh" ON "inventory_levels"("item_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lots_lot_number_key" ON "inventory_lots"("lot_number");

-- CreateIndex
CREATE INDEX "idx_inventory_lots_item" ON "inventory_lots"("item_id", "warehouse_id", "status");

-- CreateIndex
CREATE INDEX "idx_inventory_lots_fifo" ON "inventory_lots"("item_id", "warehouse_id", "receipt_date");

-- CreateIndex
CREATE UNIQUE INDEX "leftover_materials_leftover_number_key" ON "leftover_materials"("leftover_number");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipment_number_key" ON "shipments"("shipment_number");

-- CreateIndex
CREATE INDEX "idx_shipments_status" ON "shipments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_depreciation_gen_period" ON "depreciation_entries"("generator_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "uq_doc_counter_type_year" ON "document_counters"("document_type", "year");

-- CreateIndex
CREATE INDEX "idx_audit_log_table" ON "audit_log"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "idx_notifications_recipient" ON "notifications"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_tasks_status" ON "tasks"("status");

-- CreateIndex
CREATE INDEX "idx_tasks_assignee" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "idx_password_reset_email_code" ON "password_reset_codes"("email", "code");

-- CreateIndex
CREATE INDEX "idx_company_docs_category" ON "company_documents"("category");

-- CreateIndex
CREATE INDEX "idx_settings_category" ON "system_settings"("category");

-- CreateIndex
CREATE UNIQUE INDEX "uq_setting_key_user" ON "system_settings"("key", "user_id");

-- CreateIndex
CREATE INDEX "idx_workflows_entity_active" ON "workflows"("entity_type", "is_active");

-- CreateIndex
CREATE INDEX "idx_rules_workflow_active" ON "workflow_rules"("workflow_id", "is_active");

-- CreateIndex
CREATE INDEX "idx_rules_trigger" ON "workflow_rules"("trigger_event");

-- CreateIndex
CREATE INDEX "idx_exec_log_rule" ON "workflow_execution_logs"("rule_id");

-- CreateIndex
CREATE INDEX "idx_exec_log_entity" ON "workflow_execution_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_exec_log_date" ON "workflow_execution_logs"("executed_at");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_code_key" ON "email_templates"("code");

-- CreateIndex
CREATE INDEX "idx_email_log_status" ON "email_logs"("status");

-- CreateIndex
CREATE INDEX "idx_email_log_template" ON "email_logs"("template_id");

-- CreateIndex
CREATE INDEX "idx_email_log_date" ON "email_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_dashboards_owner" ON "dashboards"("owner_id");

-- CreateIndex
CREATE INDEX "idx_dashboards_role" ON "dashboards"("default_for_role");

-- CreateIndex
CREATE INDEX "idx_widgets_dashboard" ON "dashboard_widgets"("dashboard_id");

-- CreateIndex
CREATE INDEX "idx_reports_owner" ON "saved_reports"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_expiry" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_doc_comments_doc" ON "document_comments"("document_type", "document_id");

-- CreateIndex
CREATE INDEX "idx_doc_comments_author" ON "document_comments"("author_id");

-- CreateIndex
CREATE INDEX "idx_approval_steps_doc" ON "approval_steps"("document_type", "document_id");

-- CreateIndex
CREATE INDEX "idx_approval_steps_approver" ON "approval_steps"("approver_id");

-- CreateIndex
CREATE INDEX "idx_approval_steps_status" ON "approval_steps"("status");

-- CreateIndex
CREATE INDEX "idx_delegation_delegator" ON "delegation_rules"("delegator_id");

-- CreateIndex
CREATE INDEX "idx_delegation_delegate" ON "delegation_rules"("delegate_id");

-- CreateIndex
CREATE INDEX "idx_delegation_dates" ON "delegation_rules"("start_date", "end_date");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ports" ADD CONSTRAINT "ports_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_types" ADD CONSTRAINT "equipment_types_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "equipment_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_parent_entity_id_fkey" FOREIGN KEY ("parent_entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_assigned_project_id_fkey" FOREIGN KEY ("assigned_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_assigned_warehouse_id_fkey" FOREIGN KEY ("assigned_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_warehouse_type_id_fkey" FOREIGN KEY ("warehouse_type_id") REFERENCES "warehouse_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generators" ADD CONSTRAINT "generators_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generators" ADD CONSTRAINT "generators_current_project_id_fkey" FOREIGN KEY ("current_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generators" ADD CONSTRAINT "generators_current_warehouse_id_fkey" FOREIGN KEY ("current_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_fleet" ADD CONSTRAINT "equipment_fleet_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_fleet" ADD CONSTRAINT "equipment_fleet_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrrv" ADD CONSTRAINT "mrrv_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrrv" ADD CONSTRAINT "mrrv_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrrv" ADD CONSTRAINT "mrrv_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrrv" ADD CONSTRAINT "mrrv_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrrv" ADD CONSTRAINT "mrrv_qc_inspector_id_fkey" FOREIGN KEY ("qc_inspector_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrrv_lines" ADD CONSTRAINT "mrrv_lines_mrrv_id_fkey" FOREIGN KEY ("mrrv_id") REFERENCES "mrrv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrrv_lines" ADD CONSTRAINT "mrrv_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrrv_lines" ADD CONSTRAINT "mrrv_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfim" ADD CONSTRAINT "rfim_mrrv_id_fkey" FOREIGN KEY ("mrrv_id") REFERENCES "mrrv"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rfim" ADD CONSTRAINT "rfim_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osd_reports" ADD CONSTRAINT "osd_reports_mrrv_id_fkey" FOREIGN KEY ("mrrv_id") REFERENCES "mrrv"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osd_reports" ADD CONSTRAINT "osd_reports_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osd_reports" ADD CONSTRAINT "osd_reports_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osd_reports" ADD CONSTRAINT "osd_reports_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osd_lines" ADD CONSTRAINT "osd_lines_osd_id_fkey" FOREIGN KEY ("osd_id") REFERENCES "osd_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osd_lines" ADD CONSTRAINT "osd_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osd_lines" ADD CONSTRAINT "osd_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "osd_lines" ADD CONSTRAINT "osd_lines_mrrv_line_id_fkey" FOREIGN KEY ("mrrv_line_id") REFERENCES "mrrv_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirv" ADD CONSTRAINT "mirv_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirv" ADD CONSTRAINT "mirv_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirv" ADD CONSTRAINT "mirv_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirv" ADD CONSTRAINT "mirv_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirv" ADD CONSTRAINT "mirv_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirv" ADD CONSTRAINT "mirv_mrf_id_fkey" FOREIGN KEY ("mrf_id") REFERENCES "material_requisitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirv_lines" ADD CONSTRAINT "mirv_lines_mirv_id_fkey" FOREIGN KEY ("mirv_id") REFERENCES "mirv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mirv_lines" ADD CONSTRAINT "mirv_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrv" ADD CONSTRAINT "mrv_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrv" ADD CONSTRAINT "mrv_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrv" ADD CONSTRAINT "mrv_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrv" ADD CONSTRAINT "mrv_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrv" ADD CONSTRAINT "mrv_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrv" ADD CONSTRAINT "mrv_original_mirv_id_fkey" FOREIGN KEY ("original_mirv_id") REFERENCES "mirv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrv_lines" ADD CONSTRAINT "mrv_lines_mrv_id_fkey" FOREIGN KEY ("mrv_id") REFERENCES "mrv"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrv_lines" ADD CONSTRAINT "mrv_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrv_lines" ADD CONSTRAINT "mrv_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_mirv_id_fkey" FOREIGN KEY ("mirv_id") REFERENCES "mirv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_items" ADD CONSTRAINT "gate_pass_items_gate_pass_id_fkey" FOREIGN KEY ("gate_pass_id") REFERENCES "gate_passes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_items" ADD CONSTRAINT "gate_pass_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_pass_items" ADD CONSTRAINT "gate_pass_items_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_mirv_id_fkey" FOREIGN KEY ("mirv_id") REFERENCES "mirv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requisitions" ADD CONSTRAINT "material_requisitions_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrf_lines" ADD CONSTRAINT "mrf_lines_mrf_id_fkey" FOREIGN KEY ("mrf_id") REFERENCES "material_requisitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrf_lines" ADD CONSTRAINT "mrf_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrf_lines" ADD CONSTRAINT "mrf_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mrf_lines" ADD CONSTRAINT "mrf_lines_mirv_line_id_fkey" FOREIGN KEY ("mirv_line_id") REFERENCES "mirv_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_from_project_id_fkey" FOREIGN KEY ("from_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_to_project_id_fkey" FOREIGN KEY ("to_project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_source_mrv_id_fkey" FOREIGN KEY ("source_mrv_id") REFERENCES "mrv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destination_mirv_id_fkey" FOREIGN KEY ("destination_mirv_id") REFERENCES "mirv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_transport_jo_id_fkey" FOREIGN KEY ("transport_jo_id") REFERENCES "job_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_gate_pass_id_fkey" FOREIGN KEY ("gate_pass_id") REFERENCES "gate_passes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_transfer_id_fkey" FOREIGN KEY ("transfer_id") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_lines" ADD CONSTRAINT "stock_transfer_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_orders" ADD CONSTRAINT "job_orders_completed_by_id_fkey" FOREIGN KEY ("completed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_transport_details" ADD CONSTRAINT "jo_transport_details_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_rental_details" ADD CONSTRAINT "jo_rental_details_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_generator_details" ADD CONSTRAINT "jo_generator_details_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_generator_details" ADD CONSTRAINT "jo_generator_details_generator_id_fkey" FOREIGN KEY ("generator_id") REFERENCES "generators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_scrap_details" ADD CONSTRAINT "jo_scrap_details_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_equipment_lines" ADD CONSTRAINT "jo_equipment_lines_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_equipment_lines" ADD CONSTRAINT "jo_equipment_lines_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_sla_tracking" ADD CONSTRAINT "jo_sla_tracking_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_approvals" ADD CONSTRAINT "jo_approvals_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_approvals" ADD CONSTRAINT "jo_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jo_payments" ADD CONSTRAINT "jo_payments_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_levels" ADD CONSTRAINT "inventory_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_mrrv_line_id_fkey" FOREIGN KEY ("mrrv_line_id") REFERENCES "mrrv_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_consumptions" ADD CONSTRAINT "lot_consumptions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_consumptions" ADD CONSTRAINT "lot_consumptions_mirv_line_id_fkey" FOREIGN KEY ("mirv_line_id") REFERENCES "mirv_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leftover_materials" ADD CONSTRAINT "leftover_materials_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leftover_materials" ADD CONSTRAINT "leftover_materials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leftover_materials" ADD CONSTRAINT "leftover_materials_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leftover_materials" ADD CONSTRAINT "leftover_materials_original_mirv_id_fkey" FOREIGN KEY ("original_mirv_id") REFERENCES "mirv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leftover_materials" ADD CONSTRAINT "leftover_materials_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leftover_materials" ADD CONSTRAINT "leftover_materials_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leftover_materials" ADD CONSTRAINT "leftover_materials_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_freight_forwarder_id_fkey" FOREIGN KEY ("freight_forwarder_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_port_of_entry_id_fkey" FOREIGN KEY ("port_of_entry_id") REFERENCES "ports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_mrrv_id_fkey" FOREIGN KEY ("mrrv_id") REFERENCES "mrrv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_transport_jo_id_fkey" FOREIGN KEY ("transport_jo_id") REFERENCES "job_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_tracking" ADD CONSTRAINT "customs_tracking_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_equipment_rates" ADD CONSTRAINT "supplier_equipment_rates_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_equipment_rates" ADD CONSTRAINT "supplier_equipment_rates_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "depreciation_entries" ADD CONSTRAINT "depreciation_entries_generator_id_fkey" FOREIGN KEY ("generator_id") REFERENCES "generators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comments" ADD CONSTRAINT "task_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_documents" ADD CONSTRAINT "company_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_rules" ADD CONSTRAINT "workflow_rules_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_execution_logs" ADD CONSTRAINT "workflow_execution_logs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "workflow_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "email_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboard_widgets" ADD CONSTRAINT "dashboard_widgets_dashboard_id_fkey" FOREIGN KEY ("dashboard_id") REFERENCES "dashboards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_comments" ADD CONSTRAINT "document_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_rules" ADD CONSTRAINT "delegation_rules_delegator_id_fkey" FOREIGN KEY ("delegator_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delegation_rules" ADD CONSTRAINT "delegation_rules_delegate_id_fkey" FOREIGN KEY ("delegate_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
