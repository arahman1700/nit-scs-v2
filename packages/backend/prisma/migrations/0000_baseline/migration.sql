Loaded Prisma config from prisma.config.ts.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "regions" (
    "id" UUID NOT NULL,
    "region_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "city_name" VARCHAR(100) NOT NULL,
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
    "category" VARCHAR(30),

    CONSTRAINT "units_of_measure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_types" (
    "id" UUID NOT NULL,
    "type_name" VARCHAR(50) NOT NULL,
    "description" TEXT,

    CONSTRAINT "warehouse_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_categories" (
    "id" UUID NOT NULL,
    "category_name" VARCHAR(100) NOT NULL,

    CONSTRAINT "equipment_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_types" (
    "id" UUID NOT NULL,
    "type_name" VARCHAR(100) NOT NULL,
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
    "master_item_code" VARCHAR(20),
    "main_category" VARCHAR(50),
    "commodity" VARCHAR(100),
    "template_name" VARCHAR(100),
    "abc_class" VARCHAR(1),
    "abc_updated_at" TIMESTAMPTZ,
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
    "bin_location" VARCHAR(30),
    "receiving_dock" VARCHAR(50),
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
    "bin_location_id" UUID,
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
    "inspection_type" VARCHAR(30),
    "priority" VARCHAR(20) DEFAULT 'Normal',
    "items_description" TEXT,
    "specifications" TEXT,
    "result" VARCHAR(20),
    "comments" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "pm_approval_required" BOOLEAN NOT NULL DEFAULT false,
    "pm_approval_date" TIMESTAMPTZ,
    "pm_approval_by_id" UUID,
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
    "qc_signature_id" UUID,
    "gate_pass_auto_created" BOOLEAN NOT NULL DEFAULT false,
    "pick_wave_id" VARCHAR(50),
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
    "bin_location_id" UUID,
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
    "imsf_id" UUID,
    "job_order_id" UUID,
    "asn_id" UUID,
    "expected_mrrv_id" UUID,
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
    "vehicle_type" VARCHAR(50),
    "gross_weight" DECIMAL(12,3),
    "tare_weight" DECIMAL(12,3),
    "net_weight" DECIMAL(12,3),
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
    "stock_verification_sla" TIMESTAMPTZ,
    "sla_breached" BOOLEAN NOT NULL DEFAULT false,
    "converted_to_imsf_id" UUID,
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
    "google_maps_pickup" VARCHAR(500),
    "google_maps_delivery" VARCHAR(500),
    "driver_name" VARCHAR(200),
    "driver_nationality" VARCHAR(50),
    "driver_id_number" VARCHAR(30),
    "vehicle_brand" VARCHAR(100),
    "vehicle_year" INTEGER,
    "vehicle_plate" VARCHAR(30),
    "insurance_value" DECIMAL(15,2),
    "insurance_required" BOOLEAN NOT NULL DEFAULT false,
    "project_budget_approved" BOOLEAN,
    "cn_number" VARCHAR(50),
    "coa_approval_required" BOOLEAN NOT NULL DEFAULT false,
    "shift_start_time" TIMESTAMPTZ,
    "completed_by_id" UUID,
    "gate_pass_auto_created" BOOLEAN NOT NULL DEFAULT false,
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
    "bin_location_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lot_consumptions" (
    "id" UUID NOT NULL,
    "lot_id" UUID NOT NULL,
    "mirv_line_id" UUID,
    "reference_type" VARCHAR(50),
    "reference_id" UUID,
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
    "saber_pcoc_number" VARCHAR(50),
    "saber_scoc_number" VARCHAR(50),
    "release_checklist" JSONB,
    "released_by_id" UUID,
    "released_at" TIMESTAMPTZ,
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
    "capacity" VARCHAR(100),
    "daily_rate" DECIMAL(10,2),
    "weekly_rate" DECIMAL(10,2),
    "monthly_rate" DECIMAL(10,2),
    "with_operator_surcharge" DECIMAL(10,2) DEFAULT 0,
    "operator_included" BOOLEAN NOT NULL DEFAULT false,
    "fuel_included" BOOLEAN NOT NULL DEFAULT false,
    "insurance_included" BOOLEAN NOT NULL DEFAULT false,
    "valid_from" DATE NOT NULL,
    "valid_until" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

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
CREATE TABLE "tariff_rates" (
    "id" UUID NOT NULL,
    "hs_code" VARCHAR(20) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "duty_rate" DECIMAL(5,4) NOT NULL,
    "vat_rate" DECIMAL(5,4) NOT NULL,
    "exemption_code" VARCHAR(20),
    "exemption_description" TEXT,
    "country" VARCHAR(100) NOT NULL DEFAULT 'Saudi Arabia',
    "effective_from" DATE NOT NULL,
    "effective_until" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tariff_rates_pkey" PRIMARY KEY ("id")
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
    "body" TEXT,
    "notification_type" VARCHAR(30) NOT NULL,
    "reference_table" VARCHAR(50),
    "reference_id" UUID,
    "is_read" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" VARCHAR(200) NOT NULL,
    "auth" VARCHAR(50) NOT NULL,
    "user_agent" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
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
    "started_at" TIMESTAMPTZ,
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
    "cron_expression" VARCHAR(50),
    "next_run_at" TIMESTAMPTZ,
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
    "body_html" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
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
    "is_template" BOOLEAN NOT NULL DEFAULT false,
    "category" VARCHAR(50),
    "schedule_frequency" VARCHAR(20),
    "next_run_at" TIMESTAMPTZ,
    "last_run_at" TIMESTAMPTZ,
    "schedule_recipients" JSONB,
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

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "record_id" UUID NOT NULL,
    "file_name" VARCHAR(500) NOT NULL,
    "original_name" VARCHAR(500) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "storage_path" VARCHAR(1000) NOT NULL,
    "uploaded_by_id" UUID NOT NULL,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_views" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL DEFAULT 'Default',
    "view_type" VARCHAR(20) NOT NULL DEFAULT 'grid',
    "config" JSONB NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "user_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imsf" (
    "id" UUID NOT NULL,
    "imsf_number" VARCHAR(20) NOT NULL,
    "sender_project_id" UUID NOT NULL,
    "receiver_project_id" UUID NOT NULL,
    "material_type" VARCHAR(20) NOT NULL DEFAULT 'normal',
    "status" VARCHAR(20) NOT NULL DEFAULT 'created',
    "origin_mr_id" UUID,
    "required_date" DATE,
    "notes" TEXT,
    "gate_pass_auto_created" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "imsf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imsf_lines" (
    "id" UUID NOT NULL,
    "imsf_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "description" VARCHAR(500),
    "qty" DECIMAL(12,3) NOT NULL,
    "uom_id" UUID NOT NULL,
    "po_number" VARCHAR(50),
    "mrf_number" VARCHAR(50),

    CONSTRAINT "imsf_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_cards" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "bin_number" VARCHAR(30) NOT NULL,
    "current_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "last_verified_at" TIMESTAMPTZ,
    "last_verified_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bin_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_card_transactions" (
    "id" UUID NOT NULL,
    "bin_card_id" UUID NOT NULL,
    "transaction_type" VARCHAR(20) NOT NULL,
    "reference_type" VARCHAR(20) NOT NULL,
    "reference_id" UUID NOT NULL,
    "reference_number" VARCHAR(30),
    "qty_in" DECIMAL(12,3) DEFAULT 0,
    "qty_out" DECIMAL(12,3) DEFAULT 0,
    "running_balance" DECIMAL(12,3) NOT NULL,
    "performed_by_id" UUID NOT NULL,
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bin_card_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_contracts" (
    "id" UUID NOT NULL,
    "contract_number" VARCHAR(30) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "equipment_type" VARCHAR(100) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "monthly_rate" DECIMAL(15,2),
    "daily_rate" DECIMAL(15,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "chamber_of_commerce_stamped" BOOLEAN DEFAULT false,
    "insurance_value" DECIMAL(15,2),
    "insurance_expiry" DATE,
    "notes" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "rental_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_contract_lines" (
    "id" UUID NOT NULL,
    "contract_id" UUID NOT NULL,
    "equipment_description" VARCHAR(300) NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_rate" DECIMAL(15,2) NOT NULL,
    "total_rate" DECIMAL(15,2) NOT NULL,

    CONSTRAINT "rental_contract_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generator_fuel_logs" (
    "id" UUID NOT NULL,
    "generator_id" UUID NOT NULL,
    "fuel_date" DATE NOT NULL,
    "fuel_qty_liters" DECIMAL(10,2) NOT NULL,
    "meter_reading" DECIMAL(12,1),
    "fuel_supplier" VARCHAR(200),
    "cost_per_liter" DECIMAL(8,4),
    "total_cost" DECIMAL(15,2),
    "logged_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generator_fuel_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generator_maintenance" (
    "id" UUID NOT NULL,
    "generator_id" UUID NOT NULL,
    "maintenance_type" VARCHAR(20) NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "completed_date" TIMESTAMPTZ,
    "performed_by_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "findings" TEXT,
    "parts_replaced" TEXT,
    "cost" DECIMAL(15,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "generator_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surplus_items" (
    "id" UUID NOT NULL,
    "surplus_number" VARCHAR(20) NOT NULL,
    "item_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "project_id" UUID,
    "qty" DECIMAL(12,3) NOT NULL,
    "condition" VARCHAR(50) NOT NULL,
    "estimated_value" DECIMAL(15,2),
    "disposition" VARCHAR(20),
    "status" VARCHAR(20) NOT NULL DEFAULT 'identified',
    "ou_head_approval_date" TIMESTAMPTZ,
    "scm_approval_date" TIMESTAMPTZ,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "surplus_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrap_items" (
    "id" UUID NOT NULL,
    "scrap_number" VARCHAR(20) NOT NULL,
    "project_id" UUID NOT NULL,
    "warehouse_id" UUID,
    "material_type" VARCHAR(30) NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(12,3) NOT NULL,
    "packaging" VARCHAR(100),
    "condition" VARCHAR(50),
    "estimated_value" DECIMAL(15,2),
    "actual_sale_value" DECIMAL(15,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'identified',
    "photos" JSONB DEFAULT '[]',
    "site_manager_approval" BOOLEAN DEFAULT false,
    "qc_approval" BOOLEAN DEFAULT false,
    "storekeeper_approval" BOOLEAN DEFAULT false,
    "buyer_name" VARCHAR(200),
    "buyer_pickup_deadline" TIMESTAMPTZ,
    "smart_container_id" VARCHAR(50),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "scrap_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ssc_bids" (
    "id" UUID NOT NULL,
    "scrap_item_id" UUID NOT NULL,
    "bidder_name" VARCHAR(200) NOT NULL,
    "bidder_contact" VARCHAR(100),
    "bid_amount" DECIMAL(15,2) NOT NULL,
    "bid_date" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'submitted',
    "ssc_memo_signed" BOOLEAN DEFAULT false,
    "finance_copy_date" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ssc_bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tools" (
    "id" UUID NOT NULL,
    "tool_code" VARCHAR(50) NOT NULL,
    "tool_name" VARCHAR(200) NOT NULL,
    "category" VARCHAR(100),
    "serial_number" VARCHAR(100),
    "condition" VARCHAR(30) NOT NULL DEFAULT 'good',
    "owner_id" UUID,
    "warehouse_id" UUID,
    "purchase_date" DATE,
    "warranty_expiry" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tool_issues" (
    "id" UUID NOT NULL,
    "tool_id" UUID NOT NULL,
    "issued_to_id" UUID NOT NULL,
    "issued_by_id" UUID NOT NULL,
    "issued_date" TIMESTAMPTZ NOT NULL,
    "expected_return_date" DATE,
    "actual_return_date" TIMESTAMPTZ,
    "return_condition" VARCHAR(30),
    "return_verified_by_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'issued',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "tool_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouse_zones" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "zone_name" VARCHAR(100) NOT NULL,
    "zone_code" VARCHAR(10) NOT NULL,
    "zone_type" VARCHAR(30) NOT NULL,
    "capacity" INTEGER,
    "current_occupancy" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "warehouse_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bin_locations" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "location_code" VARCHAR(30) NOT NULL,
    "aisle" VARCHAR(10),
    "rack" VARCHAR(10),
    "shelf" VARCHAR(10),
    "bin" VARCHAR(10),
    "location_type" VARCHAR(20) NOT NULL DEFAULT 'picking',
    "max_capacity" DECIMAL(12,3),
    "current_occupancy" DECIMAL(12,3) DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "bin_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storekeeper_handovers" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "outgoing_employee_id" UUID NOT NULL,
    "incoming_employee_id" UUID NOT NULL,
    "handover_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'initiated',
    "inventory_verified" BOOLEAN DEFAULT false,
    "discrepancies_found" BOOLEAN DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "storekeeper_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "put_away_rules" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "warehouse_id" UUID NOT NULL,
    "target_zone_id" UUID,
    "item_category" VARCHAR(50),
    "is_hazardous" BOOLEAN NOT NULL DEFAULT false,
    "max_weight" DECIMAL(12,3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "put_away_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_counts" (
    "id" UUID NOT NULL,
    "count_number" VARCHAR(30) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "count_type" VARCHAR(20) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "zone_id" UUID,
    "scheduled_date" DATE NOT NULL,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "created_by_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cycle_counts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cycle_count_lines" (
    "id" UUID NOT NULL,
    "cycle_count_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "expected_qty" DECIMAL(12,3) NOT NULL,
    "counted_qty" DECIMAL(12,3),
    "variance_qty" DECIMAL(12,3),
    "variance_percent" DECIMAL(8,4),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "counted_by_id" UUID,
    "counted_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cycle_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "advance_shipping_notices" (
    "id" UUID NOT NULL,
    "asn_number" VARCHAR(20) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "expected_arrival" TIMESTAMPTZ NOT NULL,
    "actual_arrival" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "carrier_name" VARCHAR(200),
    "tracking_number" VARCHAR(100),
    "purchase_order_ref" VARCHAR(50),
    "notes" TEXT,
    "grn_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "advance_shipping_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asn_lines" (
    "id" UUID NOT NULL,
    "asn_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "qty_expected" DECIMAL(12,3) NOT NULL,
    "qty_received" DECIMAL(12,3),
    "lot_number" VARCHAR(50),
    "expiry_date" DATE,

    CONSTRAINT "asn_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cross_docks" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "source_grn_id" UUID,
    "target_mi_id" UUID,
    "target_wt_id" UUID,
    "quantity" DECIMAL(12,3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'identified',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "cross_docks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_checklists" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inspection_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection_checklist_items" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "item_order" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "inspection_type" VARCHAR(30) NOT NULL DEFAULT 'visual',

    CONSTRAINT "inspection_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parallel_approval_groups" (
    "id" UUID NOT NULL,
    "document_type" VARCHAR(30) NOT NULL,
    "document_id" UUID NOT NULL,
    "approval_level" INTEGER NOT NULL,
    "mode" VARCHAR(10) NOT NULL DEFAULT 'all',
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ,

    CONSTRAINT "parallel_approval_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parallel_approval_responses" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "approver_id" UUID NOT NULL,
    "decision" VARCHAR(10) NOT NULL,
    "comments" TEXT,
    "decided_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parallel_approval_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dock_doors" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "door_number" VARCHAR(10) NOT NULL,
    "door_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dock_doors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yard_appointments" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "dock_door_id" UUID,
    "appointment_type" VARCHAR(20) NOT NULL,
    "scheduled_start" TIMESTAMPTZ NOT NULL,
    "scheduled_end" TIMESTAMPTZ NOT NULL,
    "carrier_name" VARCHAR(200),
    "driver_name" VARCHAR(200),
    "vehicle_plate" VARCHAR(20),
    "reference_type" VARCHAR(20),
    "reference_id" UUID,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "yard_appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "truck_visits" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "dock_door_id" UUID,
    "vehicle_plate" VARCHAR(20) NOT NULL,
    "driver_name" VARCHAR(200),
    "carrier_name" VARCHAR(200),
    "purpose" VARCHAR(20) NOT NULL,
    "check_in_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "check_out_at" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'in_yard',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "truck_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensors" (
    "id" UUID NOT NULL,
    "sensor_code" VARCHAR(30) NOT NULL,
    "sensor_type" VARCHAR(30) NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "zone_id" UUID,
    "location" VARCHAR(200),
    "min_threshold" DECIMAL(8,2),
    "max_threshold" DECIMAL(8,2),
    "unit" VARCHAR(10) NOT NULL DEFAULT '°C',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_reading_at" TIMESTAMPTZ,
    "last_value" DECIMAL(8,2),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "sensors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" UUID NOT NULL,
    "sensor_id" UUID NOT NULL,
    "value" DECIMAL(8,2) NOT NULL,
    "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_alerts" (
    "id" UUID NOT NULL,
    "sensor_id" UUID NOT NULL,
    "alert_type" VARCHAR(20) NOT NULL,
    "value" DECIMAL(8,2),
    "threshold" DECIMAL(8,2),
    "message" TEXT NOT NULL,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by_id" UUID,
    "acknowledged_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "actions" JSONB NOT NULL DEFAULT '[]',
    "updated_at" TIMESTAMPTZ NOT NULL,
    "updated_by" VARCHAR(100),

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_document_types" (
    "id" UUID NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(50),
    "category" VARCHAR(50) NOT NULL DEFAULT 'custom',
    "status_flow" JSONB NOT NULL DEFAULT '{}',
    "approval_config" JSONB,
    "permission_config" JSONB,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "visible_to_roles" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dynamic_document_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_field_definitions" (
    "id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "field_key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "field_type" VARCHAR(30) NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "show_in_grid" BOOLEAN NOT NULL DEFAULT false,
    "show_in_form" BOOLEAN NOT NULL DEFAULT true,
    "section_name" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "validation_rules" JSONB,
    "default_value" TEXT,
    "col_span" INTEGER NOT NULL DEFAULT 2,
    "is_line_item" BOOLEAN NOT NULL DEFAULT false,
    "is_read_only" BOOLEAN NOT NULL DEFAULT false,
    "conditional_display" JSONB,

    CONSTRAINT "dynamic_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_documents" (
    "id" UUID NOT NULL,
    "document_type_id" UUID NOT NULL,
    "document_number" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'draft',
    "data" JSONB NOT NULL DEFAULT '{}',
    "project_id" UUID,
    "warehouse_id" UUID,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "dynamic_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_document_lines" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "dynamic_document_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dynamic_document_history" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "from_status" VARCHAR(30),
    "to_status" VARCHAR(30) NOT NULL,
    "performed_by_id" UUID,
    "comment" TEXT,
    "performed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dynamic_document_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_data_sources" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "source_key" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "aggregation" VARCHAR(20) NOT NULL,
    "query_template" JSONB NOT NULL,
    "output_type" VARCHAR(20) NOT NULL,
    "created_by_id" UUID,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "custom_data_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "field_key" VARCHAR(50) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "field_type" VARCHAR(30) NOT NULL,
    "options" JSONB,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "show_in_grid" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "validation_rules" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "id" UUID NOT NULL,
    "definition_id" UUID NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" UUID NOT NULL,
    "value" JSONB NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_templates" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(50) NOT NULL DEFAULT 'general',
    "template" JSONB NOT NULL,
    "source" VARCHAR(20) NOT NULL DEFAULT 'system',
    "install_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "workflow_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "content" TEXT NOT NULL,
    "generated_query" TEXT,
    "result_data" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" UUID NOT NULL,
    "suggestion_type" VARCHAR(30) NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "title" VARCHAR(300) NOT NULL,
    "description" TEXT,
    "action_payload" JSONB,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "fingerprint" VARCHAR(200) NOT NULL,
    "expires_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_sessions" (
    "id" UUID NOT NULL,
    "session_number" VARCHAR(30) NOT NULL,
    "mirv_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "packed_by_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    "total_weight" DECIMAL(12,3),
    "total_volume" DECIMAL(12,3),
    "carton_count" INTEGER NOT NULL DEFAULT 0,
    "pallet_count" INTEGER NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "packing_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packing_lines" (
    "id" UUID NOT NULL,
    "packing_session_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "qty_packed" DECIMAL(12,3) NOT NULL,
    "container_type" VARCHAR(20) NOT NULL,
    "container_label" VARCHAR(50),
    "weight" DECIMAL(12,3),
    "volume" DECIMAL(12,3),
    "scanned_barcode" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packing_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staging_assignments" (
    "id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "source_doc_type" VARCHAR(20) NOT NULL,
    "source_doc_id" UUID NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "assigned_by_id" UUID NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'staged',
    "staged_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "moved_at" TIMESTAMPTZ,
    "max_dwell_hours" INTEGER DEFAULT 24,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "staging_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "labor_standards" (
    "id" UUID NOT NULL,
    "task_type" VARCHAR(30) NOT NULL,
    "description" TEXT,
    "standard_minutes" DECIMAL(8,2) NOT NULL,
    "unit_of_measure" VARCHAR(20) NOT NULL DEFAULT 'document',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "labor_standards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "navigation_overrides" (
    "id" UUID NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "path" VARCHAR(200) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "parent_path" VARCHAR(200),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "navigation_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semantic_measures" (
    "id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "category" VARCHAR(40) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "aggregation" VARCHAR(20) NOT NULL,
    "field" VARCHAR(60),
    "default_filters" JSONB,
    "unit" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "semantic_measures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semantic_dimensions" (
    "id" UUID NOT NULL,
    "key" VARCHAR(60) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "entity_types" JSONB NOT NULL,
    "field" VARCHAR(60) NOT NULL,
    "dimension_type" VARCHAR(20) NOT NULL,
    "hierarchy" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "semantic_dimensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "template_code" VARCHAR(50) NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_delivery_notes" (
    "id" UUID NOT NULL,
    "note_number" VARCHAR(30) NOT NULL,
    "job_order_id" UUID NOT NULL,
    "rental_contract_id" UUID,
    "delivery_date" TIMESTAMPTZ NOT NULL,
    "received_by_id" UUID NOT NULL,
    "equipment_description" TEXT NOT NULL,
    "serial_number" VARCHAR(100),
    "hours_on_delivery" DECIMAL(12,2),
    "mileage_on_delivery" DECIMAL(12,2),
    "condition_on_delivery" VARCHAR(20) NOT NULL,
    "condition_notes" TEXT,
    "safety_certificate_verified" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "confirmed_at" TIMESTAMPTZ,
    "confirmed_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "equipment_delivery_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_return_notes" (
    "id" UUID NOT NULL,
    "note_number" VARCHAR(30) NOT NULL,
    "job_order_id" UUID NOT NULL,
    "delivery_note_id" UUID NOT NULL,
    "return_date" TIMESTAMPTZ NOT NULL,
    "returned_by_id" UUID NOT NULL,
    "hours_on_return" DECIMAL(12,2),
    "mileage_on_return" DECIMAL(12,2),
    "condition_on_return" VARCHAR(20) NOT NULL,
    "condition_notes" TEXT,
    "damage_description" TEXT,
    "damage_estimated_cost" DECIMAL(15,2),
    "fuel_level" VARCHAR(20),
    "actual_days" INTEGER,
    "actual_cost" DECIMAL(15,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "inspected_at" TIMESTAMPTZ,
    "inspected_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "confirmed_by_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "equipment_return_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_evaluations" (
    "id" UUID NOT NULL,
    "evaluation_number" VARCHAR(30) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "evaluator_id" UUID NOT NULL,
    "period_start" TIMESTAMPTZ NOT NULL,
    "period_end" TIMESTAMPTZ NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "overall_score" DECIMAL(5,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_evaluation_metrics" (
    "id" UUID NOT NULL,
    "evaluation_id" UUID NOT NULL,
    "metric_name" VARCHAR(50) NOT NULL,
    "weight" DECIMAL(5,2) NOT NULL,
    "raw_score" DECIMAL(5,2) NOT NULL,
    "weighted_score" DECIMAL(5,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "supplier_evaluation_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_orders" (
    "id" UUID NOT NULL,
    "order_number" VARCHAR(30) NOT NULL,
    "job_order_id" UUID,
    "origin_warehouse_id" UUID NOT NULL,
    "destination_warehouse_id" UUID,
    "destination_address" TEXT,
    "project_id" UUID,
    "load_description" TEXT NOT NULL,
    "vehicle_type" VARCHAR(50),
    "vehicle_number" VARCHAR(30),
    "driver_name" VARCHAR(200),
    "driver_phone" VARCHAR(30),
    "driver_id_number" VARCHAR(50),
    "scheduled_date" TIMESTAMPTZ NOT NULL,
    "actual_pickup_date" TIMESTAMPTZ,
    "actual_delivery_date" TIMESTAMPTZ,
    "estimated_weight" DECIMAL(12,3),
    "actual_weight" DECIMAL(12,3),
    "gate_pass_id" UUID,
    "requested_by_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "transport_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transport_order_items" (
    "id" UUID NOT NULL,
    "transport_order_id" UUID NOT NULL,
    "item_id" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "uom_id" UUID,
    "weight" DECIMAL(12,3),

    CONSTRAINT "transport_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "visitor_passes" (
    "id" UUID NOT NULL,
    "pass_number" VARCHAR(30) NOT NULL,
    "visitor_name" VARCHAR(200) NOT NULL,
    "visitor_company" VARCHAR(200),
    "visitor_id_number" VARCHAR(50) NOT NULL,
    "visitor_phone" VARCHAR(30),
    "visitor_email" VARCHAR(200),
    "host_employee_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "visit_date" TIMESTAMPTZ NOT NULL,
    "expected_duration" INTEGER NOT NULL,
    "check_in_time" TIMESTAMPTZ,
    "check_out_time" TIMESTAMPTZ,
    "vehicle_number" VARCHAR(30),
    "vehicle_type" VARCHAR(30),
    "badge_number" VARCHAR(30),
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "registered_by_id" UUID NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "visitor_passes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_attempts" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "ip_address" VARCHAR(45) NOT NULL,
    "user_agent" VARCHAR(500),
    "success" BOOLEAN NOT NULL,
    "failure_reason" VARCHAR(100),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "annual_maintenance_contracts" (
    "id" UUID NOT NULL,
    "contract_number" VARCHAR(20) NOT NULL,
    "supplier_id" UUID NOT NULL,
    "equipment_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "contract_value" DECIMAL(15,2) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "coverage_type" VARCHAR(50) NOT NULL,
    "response_time_sla_hours" INTEGER NOT NULL,
    "preventive_maintenance_frequency" VARCHAR(30) NOT NULL,
    "includes_spares" BOOLEAN NOT NULL DEFAULT false,
    "max_callouts" INTEGER,
    "notes" TEXT,
    "termination_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "annual_maintenance_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL,
    "asset_code" VARCHAR(30) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "serial_number" VARCHAR(100),
    "manufacturer" VARCHAR(200),
    "model" VARCHAR(200),
    "purchase_date" DATE,
    "purchase_cost" DECIMAL(15,2),
    "current_value" DECIMAL(15,2),
    "depreciation_method" VARCHAR(30),
    "useful_life_years" INTEGER,
    "salvage_value" DECIMAL(15,2),
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "location_warehouse_id" UUID,
    "assigned_to_id" UUID,
    "condition" VARCHAR(20),
    "last_audit_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_transfers" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "from_warehouse_id" UUID,
    "to_warehouse_id" UUID,
    "from_employee_id" UUID,
    "to_employee_id" UUID,
    "transfer_date" DATE NOT NULL,
    "reason" TEXT,
    "transferred_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_depreciations" (
    "id" UUID NOT NULL,
    "asset_id" UUID NOT NULL,
    "period" VARCHAR(10) NOT NULL,
    "opening_value" DECIMAL(15,2) NOT NULL,
    "depreciation_amount" DECIMAL(15,2) NOT NULL,
    "closing_value" DECIMAL(15,2) NOT NULL,
    "calculated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_depreciations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customs_documents" (
    "id" UUID NOT NULL,
    "shipment_id" UUID NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "document_number" VARCHAR(100),
    "issue_date" DATE,
    "expiry_date" DATE,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "file_path" VARCHAR(500),
    "verified_by_id" UUID,
    "verified_at" TIMESTAMPTZ,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customs_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_maintenance" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "maintenance_number" VARCHAR(20) NOT NULL,
    "maintenance_type" VARCHAR(30) NOT NULL,
    "scheduled_date" DATE NOT NULL,
    "completed_date" TIMESTAMPTZ,
    "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    "current_hours_at_service" DECIMAL(10,2),
    "current_mileage_at_service" DECIMAL(12,2),
    "description" TEXT NOT NULL,
    "work_performed" TEXT,
    "parts_used" TEXT,
    "cost" DECIMAL(15,2),
    "vendor_name" VARCHAR(200),
    "performed_by_id" UUID,
    "next_service_hours" DECIMAL(10,2),
    "next_service_mileage" DECIMAL(12,2),
    "next_service_date" DATE,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "vehicle_maintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_checklists" (
    "id" UUID NOT NULL,
    "checklist_code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "standard" VARCHAR(50) NOT NULL,
    "category" VARCHAR(50) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "compliance_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_checklist_items" (
    "id" UUID NOT NULL,
    "checklist_id" UUID NOT NULL,
    "item_number" INTEGER NOT NULL,
    "question" TEXT NOT NULL,
    "category" VARCHAR(50),
    "required_evidence" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "compliance_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_audits" (
    "id" UUID NOT NULL,
    "audit_number" VARCHAR(20) NOT NULL,
    "checklist_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "auditor_id" UUID NOT NULL,
    "audit_date" DATE NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "overall_score" DECIMAL(5,2),
    "findings" TEXT,
    "corrective_actions" TEXT,
    "due_date" DATE,
    "completed_date" DATE,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "compliance_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_audit_responses" (
    "id" UUID NOT NULL,
    "audit_id" UUID NOT NULL,
    "checklist_item_id" UUID NOT NULL,
    "response" VARCHAR(20) NOT NULL,
    "evidence" TEXT,
    "notes" TEXT,
    "score" INTEGER,

    CONSTRAINT "compliance_audit_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "digital_signatures" (
    "id" UUID NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "document_id" UUID NOT NULL,
    "signed_by_id" UUID NOT NULL,
    "signature_data" TEXT NOT NULL,
    "signed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" VARCHAR(45),
    "purpose" VARCHAR(50) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "digital_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_region_name_key" ON "regions"("region_name");

-- CreateIndex
CREATE INDEX "idx_cities_region" ON "cities"("region_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_city_name_region" ON "cities"("city_name", "region_id");

-- CreateIndex
CREATE UNIQUE INDEX "ports_port_code_key" ON "ports"("port_code");

-- CreateIndex
CREATE INDEX "idx_ports_city" ON "ports"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "units_of_measure_uom_code_key" ON "units_of_measure"("uom_code");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_types_type_name_key" ON "warehouse_types"("type_name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_categories_category_name_key" ON "equipment_categories"("category_name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_types_type_name_key" ON "equipment_types"("type_name");

-- CreateIndex
CREATE INDEX "idx_equipment_types_category" ON "equipment_types"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "entities_entity_code_key" ON "entities"("entity_code");

-- CreateIndex
CREATE UNIQUE INDEX "projects_project_code_key" ON "projects"("project_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_id_number_key" ON "employees"("employee_id_number");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "idx_employees_system_role" ON "employees"("system_role");

-- CreateIndex
CREATE INDEX "idx_employees_active" ON "employees"("is_active");

-- CreateIndex
CREATE INDEX "idx_employees_project" ON "employees"("assigned_project_id");

-- CreateIndex
CREATE INDEX "idx_employees_warehouse" ON "employees"("assigned_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_employees_department" ON "employees"("department");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_code_key" ON "suppliers"("supplier_code");

-- CreateIndex
CREATE INDEX "idx_suppliers_city" ON "suppliers"("city_id");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_warehouse_code_key" ON "warehouses"("warehouse_code");

-- CreateIndex
CREATE INDEX "idx_warehouses_type" ON "warehouses"("warehouse_type_id");

-- CreateIndex
CREATE INDEX "idx_warehouses_project" ON "warehouses"("project_id");

-- CreateIndex
CREATE INDEX "idx_warehouses_region" ON "warehouses"("region_id");

-- CreateIndex
CREATE INDEX "idx_warehouses_city" ON "warehouses"("city_id");

-- CreateIndex
CREATE INDEX "idx_warehouses_manager" ON "warehouses"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "items_item_code_key" ON "items"("item_code");

-- CreateIndex
CREATE UNIQUE INDEX "items_barcode_key" ON "items"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "items_master_item_code_key" ON "items"("master_item_code");

-- CreateIndex
CREATE INDEX "idx_items_status" ON "items"("status");

-- CreateIndex
CREATE INDEX "idx_items_category" ON "items"("category");

-- CreateIndex
CREATE INDEX "idx_items_uom" ON "items"("uom_id");

-- CreateIndex
CREATE UNIQUE INDEX "generators_generator_code_key" ON "generators"("generator_code");

-- CreateIndex
CREATE INDEX "idx_generators_project" ON "generators"("current_project_id");

-- CreateIndex
CREATE INDEX "idx_generators_warehouse" ON "generators"("current_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_generators_equipment_type" ON "generators"("equipment_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_fleet_vehicle_code_key" ON "equipment_fleet"("vehicle_code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_fleet_plate_number_key" ON "equipment_fleet"("plate_number");

-- CreateIndex
CREATE INDEX "idx_equipment_fleet_type" ON "equipment_fleet"("equipment_type_id");

-- CreateIndex
CREATE INDEX "idx_equipment_fleet_driver" ON "equipment_fleet"("driver_id");

-- CreateIndex
CREATE UNIQUE INDEX "mrrv_mrrv_number_key" ON "mrrv"("mrrv_number");

-- CreateIndex
CREATE INDEX "idx_mrrv_status" ON "mrrv"("status");

-- CreateIndex
CREATE INDEX "idx_mrrv_supplier" ON "mrrv"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_mrrv_warehouse" ON "mrrv"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_mrrv_project" ON "mrrv"("project_id");

-- CreateIndex
CREATE INDEX "idx_mrrv_received_by" ON "mrrv"("received_by_id");

-- CreateIndex
CREATE INDEX "idx_mrrv_created" ON "mrrv"("created_at");

-- CreateIndex
CREATE INDEX "idx_mrrv_warehouse_status" ON "mrrv"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "idx_mrrv_supplier_created" ON "mrrv"("supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_mrrv_status_created" ON "mrrv"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_mrrv_lines_mrrv" ON "mrrv_lines"("mrrv_id");

-- CreateIndex
CREATE INDEX "idx_mrrv_lines_item" ON "mrrv_lines"("item_id");

-- CreateIndex
CREATE INDEX "idx_mrrv_lines_uom" ON "mrrv_lines"("uom_id");

-- CreateIndex
CREATE UNIQUE INDEX "rfim_rfim_number_key" ON "rfim"("rfim_number");

-- CreateIndex
CREATE INDEX "idx_rfim_mrrv" ON "rfim"("mrrv_id");

-- CreateIndex
CREATE INDEX "idx_rfim_status" ON "rfim"("status");

-- CreateIndex
CREATE INDEX "idx_rfim_status_created" ON "rfim"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "osd_reports_osd_number_key" ON "osd_reports"("osd_number");

-- CreateIndex
CREATE INDEX "idx_osd_mrrv" ON "osd_reports"("mrrv_id");

-- CreateIndex
CREATE INDEX "idx_osd_status" ON "osd_reports"("status");

-- CreateIndex
CREATE INDEX "idx_osd_supplier" ON "osd_reports"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_osd_warehouse" ON "osd_reports"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_osd_created" ON "osd_reports"("created_at");

-- CreateIndex
CREATE INDEX "idx_osd_status_created" ON "osd_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_osd_warehouse_status" ON "osd_reports"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "idx_osd_lines_osd" ON "osd_lines"("osd_id");

-- CreateIndex
CREATE INDEX "idx_osd_lines_item" ON "osd_lines"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "mirv_mirv_number_key" ON "mirv"("mirv_number");

-- CreateIndex
CREATE INDEX "idx_mirv_status" ON "mirv"("status");

-- CreateIndex
CREATE INDEX "idx_mirv_project" ON "mirv"("project_id");

-- CreateIndex
CREATE INDEX "idx_mirv_warehouse" ON "mirv"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_mirv_requested_by" ON "mirv"("requested_by_id");

-- CreateIndex
CREATE INDEX "idx_mirv_created" ON "mirv"("created_at");

-- CreateIndex
CREATE INDEX "idx_mirv_warehouse_status" ON "mirv"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "idx_mirv_project_status" ON "mirv"("project_id", "status");

-- CreateIndex
CREATE INDEX "idx_mirv_status_created" ON "mirv"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_mirv_lines_mirv" ON "mirv_lines"("mirv_id");

-- CreateIndex
CREATE INDEX "idx_mirv_lines_item" ON "mirv_lines"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "mrv_mrv_number_key" ON "mrv"("mrv_number");

-- CreateIndex
CREATE INDEX "idx_mrv_status" ON "mrv"("status");

-- CreateIndex
CREATE INDEX "idx_mrv_project" ON "mrv"("project_id");

-- CreateIndex
CREATE INDEX "idx_mrv_to_warehouse" ON "mrv"("to_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_mrv_returned_by" ON "mrv"("returned_by_id");

-- CreateIndex
CREATE INDEX "idx_mrv_created" ON "mrv"("created_at");

-- CreateIndex
CREATE INDEX "idx_mrv_status_created" ON "mrv"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_mrv_lines_mrv" ON "mrv_lines"("mrv_id");

-- CreateIndex
CREATE INDEX "idx_mrv_lines_item" ON "mrv_lines"("item_id");

-- CreateIndex
CREATE INDEX "idx_mrv_lines_uom" ON "mrv_lines"("uom_id");

-- CreateIndex
CREATE UNIQUE INDEX "gate_passes_gate_pass_number_key" ON "gate_passes"("gate_pass_number");

-- CreateIndex
CREATE INDEX "idx_gate_passes_status" ON "gate_passes"("status");

-- CreateIndex
CREATE INDEX "idx_gate_passes_warehouse" ON "gate_passes"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_gate_passes_mirv" ON "gate_passes"("mirv_id");

-- CreateIndex
CREATE INDEX "idx_gate_passes_imsf" ON "gate_passes"("imsf_id");

-- CreateIndex
CREATE INDEX "idx_gate_passes_jo" ON "gate_passes"("job_order_id");

-- CreateIndex
CREATE INDEX "idx_gate_passes_asn" ON "gate_passes"("asn_id");

-- CreateIndex
CREATE INDEX "idx_gate_passes_expected_mrrv" ON "gate_passes"("expected_mrrv_id");

-- CreateIndex
CREATE INDEX "idx_gate_passes_project" ON "gate_passes"("project_id");

-- CreateIndex
CREATE INDEX "idx_gate_passes_created" ON "gate_passes"("created_at");

-- CreateIndex
CREATE INDEX "idx_gate_passes_warehouse_status" ON "gate_passes"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "idx_gate_passes_status_created" ON "gate_passes"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_gate_pass_items_gate_pass" ON "gate_pass_items"("gate_pass_id");

-- CreateIndex
CREATE INDEX "idx_gate_pass_items_item" ON "gate_pass_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_requisitions_mrf_number_key" ON "material_requisitions"("mrf_number");

-- CreateIndex
CREATE INDEX "idx_mrf_project" ON "material_requisitions"("project_id");

-- CreateIndex
CREATE INDEX "idx_mrf_status" ON "material_requisitions"("status");

-- CreateIndex
CREATE INDEX "idx_mrf_requested_by" ON "material_requisitions"("requested_by_id");

-- CreateIndex
CREATE INDEX "idx_mrf_status_created" ON "material_requisitions"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_mrf_lines_mrf" ON "mrf_lines"("mrf_id");

-- CreateIndex
CREATE INDEX "idx_mrf_lines_item" ON "mrf_lines"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_transfer_number_key" ON "stock_transfers"("transfer_number");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_status" ON "stock_transfers"("status");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_from_wh" ON "stock_transfers"("from_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_to_wh" ON "stock_transfers"("to_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_created" ON "stock_transfers"("created_at");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_status_created" ON "stock_transfers"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_from_wh_status" ON "stock_transfers"("from_warehouse_id", "status");

-- CreateIndex
CREATE INDEX "idx_stock_transfer_lines_transfer" ON "stock_transfer_lines"("transfer_id");

-- CreateIndex
CREATE INDEX "idx_stock_transfer_lines_item" ON "stock_transfer_lines"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_orders_jo_number_key" ON "job_orders"("jo_number");

-- CreateIndex
CREATE INDEX "idx_job_orders_type_status" ON "job_orders"("jo_type", "status");

-- CreateIndex
CREATE INDEX "idx_job_orders_project" ON "job_orders"("project_id");

-- CreateIndex
CREATE INDEX "idx_job_orders_date" ON "job_orders"("request_date" DESC);

-- CreateIndex
CREATE INDEX "idx_job_orders_supplier" ON "job_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_job_orders_requested_by" ON "job_orders"("requested_by_id");

-- CreateIndex
CREATE INDEX "idx_job_orders_status" ON "job_orders"("status");

-- CreateIndex
CREATE INDEX "idx_job_orders_created" ON "job_orders"("created_at");

-- CreateIndex
CREATE INDEX "idx_job_orders_project_status" ON "job_orders"("project_id", "status");

-- CreateIndex
CREATE INDEX "idx_job_orders_status_created" ON "job_orders"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "jo_transport_details_job_order_id_key" ON "jo_transport_details"("job_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "jo_rental_details_job_order_id_key" ON "jo_rental_details"("job_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "jo_generator_details_job_order_id_key" ON "jo_generator_details"("job_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "jo_scrap_details_job_order_id_key" ON "jo_scrap_details"("job_order_id");

-- CreateIndex
CREATE INDEX "idx_jo_equipment_lines_jo" ON "jo_equipment_lines"("job_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "jo_sla_tracking_job_order_id_key" ON "jo_sla_tracking"("job_order_id");

-- CreateIndex
CREATE INDEX "idx_jo_approvals_jo" ON "jo_approvals"("job_order_id");

-- CreateIndex
CREATE INDEX "idx_jo_payments_jo" ON "jo_payments"("job_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_inventory_item_wh" ON "inventory_levels"("item_id", "warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_lots_lot_number_key" ON "inventory_lots"("lot_number");

-- CreateIndex
CREATE INDEX "idx_inventory_lots_item" ON "inventory_lots"("item_id", "warehouse_id", "status");

-- CreateIndex
CREATE INDEX "idx_inventory_lots_fifo" ON "inventory_lots"("item_id", "warehouse_id", "receipt_date");

-- CreateIndex
CREATE INDEX "idx_inventory_lots_status" ON "inventory_lots"("status");

-- CreateIndex
CREATE INDEX "idx_lot_consumption_ref" ON "lot_consumptions"("reference_type", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "leftover_materials_leftover_number_key" ON "leftover_materials"("leftover_number");

-- CreateIndex
CREATE INDEX "idx_leftover_status_created" ON "leftover_materials"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_leftover_project" ON "leftover_materials"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipment_number_key" ON "shipments"("shipment_number");

-- CreateIndex
CREATE INDEX "idx_shipments_status" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "idx_shipments_supplier" ON "shipments"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_shipments_project" ON "shipments"("project_id");

-- CreateIndex
CREATE INDEX "idx_shipments_created" ON "shipments"("created_at");

-- CreateIndex
CREATE INDEX "idx_shipments_status_created" ON "shipments"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_shipments_supplier_created" ON "shipments"("supplier_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_customs_tracking_shipment" ON "customs_tracking"("shipment_id");

-- CreateIndex
CREATE INDEX "idx_shipment_lines_shipment" ON "shipment_lines"("shipment_id");

-- CreateIndex
CREATE INDEX "idx_supplier_equipment_rates_lookup" ON "supplier_equipment_rates"("supplier_id", "equipment_type_id");

-- CreateIndex
CREATE INDEX "idx_supplier_equipment_rates_status" ON "supplier_equipment_rates"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_depreciation_gen_period" ON "depreciation_entries"("generator_id", "period");

-- CreateIndex
CREATE INDEX "idx_tariff_rates_hs_code" ON "tariff_rates"("hs_code");

-- CreateIndex
CREATE INDEX "idx_tariff_rates_active" ON "tariff_rates"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_tariff_hs_country_effective" ON "tariff_rates"("hs_code", "country", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "uq_doc_counter_type_year" ON "document_counters"("document_type", "year");

-- CreateIndex
CREATE INDEX "idx_audit_log_table" ON "audit_log"("table_name", "record_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_date" ON "audit_log"("performed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_user" ON "audit_log"("performed_by_id");

-- CreateIndex
CREATE INDEX "idx_notifications_recipient" ON "notifications"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "idx_notifications_date" ON "notifications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_reference" ON "notifications"("reference_table", "reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_user_id_endpoint_key" ON "push_subscriptions"("user_id", "endpoint");

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
CREATE INDEX "idx_reports_template_category" ON "saved_reports"("is_template", "category");

-- CreateIndex
CREATE INDEX "idx_reports_schedule" ON "saved_reports"("schedule_frequency", "next_run_at");

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
CREATE UNIQUE INDEX "uq_approval_step_doc_level" ON "approval_steps"("document_type", "document_id", "level");

-- CreateIndex
CREATE INDEX "idx_delegation_delegator" ON "delegation_rules"("delegator_id");

-- CreateIndex
CREATE INDEX "idx_delegation_delegate" ON "delegation_rules"("delegate_id");

-- CreateIndex
CREATE INDEX "idx_delegation_dates" ON "delegation_rules"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "idx_attachment_entity" ON "attachments"("entity_type", "record_id");

-- CreateIndex
CREATE INDEX "idx_attachment_uploader" ON "attachments"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "idx_user_view_user_entity" ON "user_views"("user_id", "entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "imsf_imsf_number_key" ON "imsf"("imsf_number");

-- CreateIndex
CREATE INDEX "idx_imsf_status" ON "imsf"("status");

-- CreateIndex
CREATE INDEX "idx_imsf_sender" ON "imsf"("sender_project_id");

-- CreateIndex
CREATE INDEX "idx_imsf_receiver" ON "imsf"("receiver_project_id");

-- CreateIndex
CREATE INDEX "idx_imsf_status_created" ON "imsf"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_imsf_lines_imsf" ON "imsf_lines"("imsf_id");

-- CreateIndex
CREATE UNIQUE INDEX "bin_cards_item_id_warehouse_id_bin_number_key" ON "bin_cards"("item_id", "warehouse_id", "bin_number");

-- CreateIndex
CREATE INDEX "idx_bin_card_tx_card_date" ON "bin_card_transactions"("bin_card_id", "performed_at");

-- CreateIndex
CREATE UNIQUE INDEX "rental_contracts_contract_number_key" ON "rental_contracts"("contract_number");

-- CreateIndex
CREATE INDEX "idx_rental_contracts_status" ON "rental_contracts"("status");

-- CreateIndex
CREATE INDEX "idx_rental_contracts_status_end" ON "rental_contracts"("status", "end_date");

-- CreateIndex
CREATE INDEX "idx_rental_contract_lines_contract" ON "rental_contract_lines"("contract_id");

-- CreateIndex
CREATE INDEX "idx_fuel_log_gen_date" ON "generator_fuel_logs"("generator_id", "fuel_date");

-- CreateIndex
CREATE INDEX "idx_gen_maint_gen_date" ON "generator_maintenance"("generator_id", "scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "surplus_items_surplus_number_key" ON "surplus_items"("surplus_number");

-- CreateIndex
CREATE INDEX "idx_surplus_status" ON "surplus_items"("status");

-- CreateIndex
CREATE INDEX "idx_surplus_status_created" ON "surplus_items"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_surplus_warehouse_status" ON "surplus_items"("warehouse_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "scrap_items_scrap_number_key" ON "scrap_items"("scrap_number");

-- CreateIndex
CREATE INDEX "idx_scrap_status" ON "scrap_items"("status");

-- CreateIndex
CREATE INDEX "idx_scrap_project" ON "scrap_items"("project_id");

-- CreateIndex
CREATE INDEX "idx_scrap_status_created" ON "scrap_items"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_ssc_bids_scrap" ON "ssc_bids"("scrap_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "tools_tool_code_key" ON "tools"("tool_code");

-- CreateIndex
CREATE UNIQUE INDEX "tools_serial_number_key" ON "tools"("serial_number");

-- CreateIndex
CREATE INDEX "idx_tool_issues_tool" ON "tool_issues"("tool_id");

-- CreateIndex
CREATE INDEX "idx_tool_issues_status" ON "tool_issues"("status");

-- CreateIndex
CREATE INDEX "idx_tool_issues_user_status" ON "tool_issues"("issued_to_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "warehouse_zones_warehouse_id_zone_code_key" ON "warehouse_zones"("warehouse_id", "zone_code");

-- CreateIndex
CREATE INDEX "idx_bin_location_zone_type" ON "bin_locations"("zone_id", "location_type");

-- CreateIndex
CREATE INDEX "idx_bin_location_active" ON "bin_locations"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "uq_bin_location_zone_code" ON "bin_locations"("zone_id", "location_code");

-- CreateIndex
CREATE INDEX "idx_put_away_rules_wh_priority" ON "put_away_rules"("warehouse_id", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "cycle_counts_count_number_key" ON "cycle_counts"("count_number");

-- CreateIndex
CREATE INDEX "idx_cycle_count_status" ON "cycle_counts"("status");

-- CreateIndex
CREATE INDEX "idx_cycle_count_warehouse" ON "cycle_counts"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_cycle_count_status_scheduled" ON "cycle_counts"("status", "scheduled_date");

-- CreateIndex
CREATE INDEX "idx_ccl_cycle_count" ON "cycle_count_lines"("cycle_count_id");

-- CreateIndex
CREATE UNIQUE INDEX "advance_shipping_notices_asn_number_key" ON "advance_shipping_notices"("asn_number");

-- CreateIndex
CREATE INDEX "idx_asn_supplier" ON "advance_shipping_notices"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_asn_warehouse" ON "advance_shipping_notices"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_asn_status" ON "advance_shipping_notices"("status");

-- CreateIndex
CREATE INDEX "idx_asn_line_asn" ON "asn_lines"("asn_id");

-- CreateIndex
CREATE INDEX "idx_cross_dock_warehouse" ON "cross_docks"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_cross_dock_status" ON "cross_docks"("status");

-- CreateIndex
CREATE INDEX "idx_checklist_items_checklist" ON "inspection_checklist_items"("checklist_id");

-- CreateIndex
CREATE INDEX "idx_parallel_approval_doc" ON "parallel_approval_groups"("document_type", "document_id");

-- CreateIndex
CREATE INDEX "idx_parallel_approval_status" ON "parallel_approval_groups"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_parallel_approval_doc_level" ON "parallel_approval_groups"("document_type", "document_id", "approval_level");

-- CreateIndex
CREATE INDEX "idx_parallel_response_group" ON "parallel_approval_responses"("group_id");

-- CreateIndex
CREATE INDEX "idx_parallel_response_approver" ON "parallel_approval_responses"("approver_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_parallel_response_group_approver" ON "parallel_approval_responses"("group_id", "approver_id");

-- CreateIndex
CREATE INDEX "idx_dock_door_warehouse" ON "dock_doors"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "dock_doors_warehouse_id_door_number_key" ON "dock_doors"("warehouse_id", "door_number");

-- CreateIndex
CREATE INDEX "idx_yard_appt_warehouse" ON "yard_appointments"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_yard_appt_status" ON "yard_appointments"("status");

-- CreateIndex
CREATE INDEX "idx_yard_appt_start" ON "yard_appointments"("scheduled_start");

-- CreateIndex
CREATE INDEX "idx_truck_visit_warehouse" ON "truck_visits"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_truck_visit_status" ON "truck_visits"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sensors_sensor_code_key" ON "sensors"("sensor_code");

-- CreateIndex
CREATE INDEX "idx_sensors_warehouse" ON "sensors"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_sensors_zone" ON "sensors"("zone_id");

-- CreateIndex
CREATE INDEX "idx_sensor_readings_sensor_time" ON "sensor_readings"("sensor_id", "recorded_at");

-- CreateIndex
CREATE INDEX "idx_sensor_alerts_sensor" ON "sensor_alerts"("sensor_id");

-- CreateIndex
CREATE INDEX "idx_sensor_alerts_ack" ON "sensor_alerts"("acknowledged");

-- CreateIndex
CREATE INDEX "idx_role_permissions_role" ON "role_permissions"("role");

-- CreateIndex
CREATE UNIQUE INDEX "uq_role_permission" ON "role_permissions"("role", "resource");

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_document_types_code_key" ON "dynamic_document_types"("code");

-- CreateIndex
CREATE INDEX "idx_dyn_types_category_active" ON "dynamic_document_types"("category", "is_active");

-- CreateIndex
CREATE INDEX "idx_dyn_fields_type_order" ON "dynamic_field_definitions"("document_type_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dyn_field_type_key" ON "dynamic_field_definitions"("document_type_id", "field_key");

-- CreateIndex
CREATE UNIQUE INDEX "dynamic_documents_document_number_key" ON "dynamic_documents"("document_number");

-- CreateIndex
CREATE INDEX "idx_dyn_docs_type_status" ON "dynamic_documents"("document_type_id", "status");

-- CreateIndex
CREATE INDEX "idx_dyn_docs_project" ON "dynamic_documents"("project_id");

-- CreateIndex
CREATE INDEX "idx_dyn_docs_warehouse" ON "dynamic_documents"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_dyn_docs_created_by" ON "dynamic_documents"("created_by_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_dyn_line_doc_num" ON "dynamic_document_lines"("document_id", "line_number");

-- CreateIndex
CREATE INDEX "idx_dyn_history_doc" ON "dynamic_document_history"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_data_sources_source_key_key" ON "custom_data_sources"("source_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_custom_field_entity_key" ON "custom_field_definitions"("entity_type", "field_key");

-- CreateIndex
CREATE INDEX "idx_custom_field_values_entity" ON "custom_field_values"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_custom_field_value" ON "custom_field_values"("definition_id", "entity_id");

-- CreateIndex
CREATE INDEX "idx_ai_conv_user" ON "ai_conversations"("user_id");

-- CreateIndex
CREATE INDEX "idx_ai_msg_conv" ON "ai_messages"("conversation_id");

-- CreateIndex
CREATE UNIQUE INDEX "ai_suggestions_fingerprint_key" ON "ai_suggestions"("fingerprint");

-- CreateIndex
CREATE INDEX "idx_ai_suggestions_status" ON "ai_suggestions"("status", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "packing_sessions_session_number_key" ON "packing_sessions"("session_number");

-- CreateIndex
CREATE INDEX "idx_packing_session_mirv" ON "packing_sessions"("mirv_id");

-- CreateIndex
CREATE INDEX "idx_packing_session_warehouse" ON "packing_sessions"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_packing_session_status" ON "packing_sessions"("status");

-- CreateIndex
CREATE INDEX "idx_packing_line_session" ON "packing_lines"("packing_session_id");

-- CreateIndex
CREATE INDEX "idx_staging_warehouse_status" ON "staging_assignments"("warehouse_id", "status");

-- CreateIndex
CREATE INDEX "idx_staging_zone" ON "staging_assignments"("zone_id");

-- CreateIndex
CREATE INDEX "idx_staging_direction" ON "staging_assignments"("direction");

-- CreateIndex
CREATE UNIQUE INDEX "labor_standards_task_type_key" ON "labor_standards"("task_type");

-- CreateIndex
CREATE UNIQUE INDEX "navigation_overrides_role_path_key" ON "navigation_overrides"("role", "path");

-- CreateIndex
CREATE UNIQUE INDEX "semantic_measures_key_key" ON "semantic_measures"("key");

-- CreateIndex
CREATE UNIQUE INDEX "semantic_dimensions_key_key" ON "semantic_dimensions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_employee_id_template_code_key" ON "notification_preferences"("employee_id", "template_code");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_delivery_notes_note_number_key" ON "equipment_delivery_notes"("note_number");

-- CreateIndex
CREATE INDEX "idx_equip_delivery_notes_jo" ON "equipment_delivery_notes"("job_order_id");

-- CreateIndex
CREATE INDEX "idx_equip_delivery_notes_rental" ON "equipment_delivery_notes"("rental_contract_id");

-- CreateIndex
CREATE INDEX "idx_equip_delivery_notes_status" ON "equipment_delivery_notes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_return_notes_note_number_key" ON "equipment_return_notes"("note_number");

-- CreateIndex
CREATE INDEX "idx_equip_return_notes_jo" ON "equipment_return_notes"("job_order_id");

-- CreateIndex
CREATE INDEX "idx_equip_return_notes_delivery" ON "equipment_return_notes"("delivery_note_id");

-- CreateIndex
CREATE INDEX "idx_equip_return_notes_status" ON "equipment_return_notes"("status");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_evaluations_evaluation_number_key" ON "supplier_evaluations"("evaluation_number");

-- CreateIndex
CREATE INDEX "idx_supplier_eval_supplier" ON "supplier_evaluations"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_supplier_eval_evaluator" ON "supplier_evaluations"("evaluator_id");

-- CreateIndex
CREATE INDEX "idx_supplier_eval_status" ON "supplier_evaluations"("status");

-- CreateIndex
CREATE INDEX "idx_supplier_eval_period" ON "supplier_evaluations"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "idx_supplier_eval_created" ON "supplier_evaluations"("created_at");

-- CreateIndex
CREATE INDEX "idx_supplier_eval_metric_eval" ON "supplier_evaluation_metrics"("evaluation_id");

-- CreateIndex
CREATE UNIQUE INDEX "transport_orders_order_number_key" ON "transport_orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_transport_orders_status" ON "transport_orders"("status");

-- CreateIndex
CREATE INDEX "idx_transport_orders_origin" ON "transport_orders"("origin_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_transport_orders_scheduled" ON "transport_orders"("scheduled_date");

-- CreateIndex
CREATE INDEX "idx_transport_orders_destination" ON "transport_orders"("destination_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_transport_orders_project" ON "transport_orders"("project_id");

-- CreateIndex
CREATE INDEX "idx_transport_orders_jo" ON "transport_orders"("job_order_id");

-- CreateIndex
CREATE INDEX "idx_transport_orders_gate_pass" ON "transport_orders"("gate_pass_id");

-- CreateIndex
CREATE INDEX "idx_transport_orders_created" ON "transport_orders"("created_at");

-- CreateIndex
CREATE INDEX "idx_transport_order_items_order" ON "transport_order_items"("transport_order_id");

-- CreateIndex
CREATE INDEX "idx_transport_order_items_item" ON "transport_order_items"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "visitor_passes_pass_number_key" ON "visitor_passes"("pass_number");

-- CreateIndex
CREATE INDEX "idx_visitor_passes_status" ON "visitor_passes"("status");

-- CreateIndex
CREATE INDEX "idx_visitor_passes_warehouse" ON "visitor_passes"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_visitor_passes_visit_date" ON "visitor_passes"("visit_date");

-- CreateIndex
CREATE INDEX "idx_visitor_passes_host" ON "visitor_passes"("host_employee_id");

-- CreateIndex
CREATE INDEX "idx_login_attempts_employee" ON "login_attempts"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_login_attempts_ip" ON "login_attempts"("ip_address", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "annual_maintenance_contracts_contract_number_key" ON "annual_maintenance_contracts"("contract_number");

-- CreateIndex
CREATE INDEX "idx_amc_status" ON "annual_maintenance_contracts"("status");

-- CreateIndex
CREATE INDEX "idx_amc_supplier" ON "annual_maintenance_contracts"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_amc_end_date" ON "annual_maintenance_contracts"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_code_key" ON "assets"("asset_code");

-- CreateIndex
CREATE INDEX "idx_assets_status" ON "assets"("status");

-- CreateIndex
CREATE INDEX "idx_assets_category" ON "assets"("category");

-- CreateIndex
CREATE INDEX "idx_assets_warehouse" ON "assets"("location_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_assets_assigned_to" ON "assets"("assigned_to_id");

-- CreateIndex
CREATE INDEX "idx_asset_transfers_asset" ON "asset_transfers"("asset_id");

-- CreateIndex
CREATE INDEX "idx_asset_transfers_date" ON "asset_transfers"("transfer_date");

-- CreateIndex
CREATE INDEX "idx_asset_depreciations_asset" ON "asset_depreciations"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_asset_depreciation_period" ON "asset_depreciations"("asset_id", "period");

-- CreateIndex
CREATE INDEX "idx_customs_documents_shipment" ON "customs_documents"("shipment_id");

-- CreateIndex
CREATE INDEX "idx_customs_documents_status" ON "customs_documents"("status");

-- CreateIndex
CREATE INDEX "idx_customs_documents_type" ON "customs_documents"("document_type");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_maintenance_maintenance_number_key" ON "vehicle_maintenance"("maintenance_number");

-- CreateIndex
CREATE INDEX "idx_vehicle_maint_vehicle" ON "vehicle_maintenance"("vehicle_id");

-- CreateIndex
CREATE INDEX "idx_vehicle_maint_status" ON "vehicle_maintenance"("status");

-- CreateIndex
CREATE INDEX "idx_vehicle_maint_scheduled" ON "vehicle_maintenance"("scheduled_date");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_checklists_checklist_code_key" ON "compliance_checklists"("checklist_code");

-- CreateIndex
CREATE INDEX "idx_compliance_checklists_standard" ON "compliance_checklists"("standard");

-- CreateIndex
CREATE INDEX "idx_compliance_checklists_category" ON "compliance_checklists"("category");

-- CreateIndex
CREATE INDEX "idx_compliance_checklists_active" ON "compliance_checklists"("is_active");

-- CreateIndex
CREATE INDEX "idx_compliance_checklist_items_checklist" ON "compliance_checklist_items"("checklist_id");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_audits_audit_number_key" ON "compliance_audits"("audit_number");

-- CreateIndex
CREATE INDEX "idx_compliance_audits_checklist" ON "compliance_audits"("checklist_id");

-- CreateIndex
CREATE INDEX "idx_compliance_audits_warehouse" ON "compliance_audits"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_compliance_audits_auditor" ON "compliance_audits"("auditor_id");

-- CreateIndex
CREATE INDEX "idx_compliance_audits_status" ON "compliance_audits"("status");

-- CreateIndex
CREATE INDEX "idx_compliance_audits_date" ON "compliance_audits"("audit_date");

-- CreateIndex
CREATE INDEX "idx_compliance_audit_responses_audit" ON "compliance_audit_responses"("audit_id");

-- CreateIndex
CREATE INDEX "idx_compliance_audit_responses_item" ON "compliance_audit_responses"("checklist_item_id");

-- CreateIndex
CREATE INDEX "idx_digital_signatures_document" ON "digital_signatures"("document_type", "document_id");

-- CreateIndex
CREATE INDEX "idx_digital_signatures_signed_by" ON "digital_signatures"("signed_by_id");

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
ALTER TABLE "rfim" ADD CONSTRAINT "rfim_pm_approval_by_id_fkey" FOREIGN KEY ("pm_approval_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_imsf_id_fkey" FOREIGN KEY ("imsf_id") REFERENCES "imsf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_asn_id_fkey" FOREIGN KEY ("asn_id") REFERENCES "advance_shipping_notices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gate_passes" ADD CONSTRAINT "gate_passes_expected_mrrv_id_fkey" FOREIGN KEY ("expected_mrrv_id") REFERENCES "mrrv"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_bin_location_id_fkey" FOREIGN KEY ("bin_location_id") REFERENCES "bin_locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_consumptions" ADD CONSTRAINT "lot_consumptions_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lot_consumptions" ADD CONSTRAINT "lot_consumptions_mirv_line_id_fkey" FOREIGN KEY ("mirv_line_id") REFERENCES "mirv_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_released_by_id_fkey" FOREIGN KEY ("released_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_views" ADD CONSTRAINT "user_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imsf" ADD CONSTRAINT "imsf_sender_project_id_fkey" FOREIGN KEY ("sender_project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imsf" ADD CONSTRAINT "imsf_receiver_project_id_fkey" FOREIGN KEY ("receiver_project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imsf" ADD CONSTRAINT "imsf_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imsf_lines" ADD CONSTRAINT "imsf_lines_imsf_id_fkey" FOREIGN KEY ("imsf_id") REFERENCES "imsf"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imsf_lines" ADD CONSTRAINT "imsf_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imsf_lines" ADD CONSTRAINT "imsf_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_cards" ADD CONSTRAINT "bin_cards_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_cards" ADD CONSTRAINT "bin_cards_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_cards" ADD CONSTRAINT "bin_cards_last_verified_by_id_fkey" FOREIGN KEY ("last_verified_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_card_transactions" ADD CONSTRAINT "bin_card_transactions_bin_card_id_fkey" FOREIGN KEY ("bin_card_id") REFERENCES "bin_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_card_transactions" ADD CONSTRAINT "bin_card_transactions_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contract_lines" ADD CONSTRAINT "rental_contract_lines_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "rental_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generator_fuel_logs" ADD CONSTRAINT "generator_fuel_logs_generator_id_fkey" FOREIGN KEY ("generator_id") REFERENCES "generators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generator_fuel_logs" ADD CONSTRAINT "generator_fuel_logs_logged_by_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generator_maintenance" ADD CONSTRAINT "generator_maintenance_generator_id_fkey" FOREIGN KEY ("generator_id") REFERENCES "generators"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generator_maintenance" ADD CONSTRAINT "generator_maintenance_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surplus_items" ADD CONSTRAINT "surplus_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surplus_items" ADD CONSTRAINT "surplus_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surplus_items" ADD CONSTRAINT "surplus_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surplus_items" ADD CONSTRAINT "surplus_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrap_items" ADD CONSTRAINT "scrap_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrap_items" ADD CONSTRAINT "scrap_items_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrap_items" ADD CONSTRAINT "scrap_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssc_bids" ADD CONSTRAINT "ssc_bids_scrap_item_id_fkey" FOREIGN KEY ("scrap_item_id") REFERENCES "scrap_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tools" ADD CONSTRAINT "tools_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_issues" ADD CONSTRAINT "tool_issues_tool_id_fkey" FOREIGN KEY ("tool_id") REFERENCES "tools"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_issues" ADD CONSTRAINT "tool_issues_issued_to_id_fkey" FOREIGN KEY ("issued_to_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_issues" ADD CONSTRAINT "tool_issues_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tool_issues" ADD CONSTRAINT "tool_issues_return_verified_by_id_fkey" FOREIGN KEY ("return_verified_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouse_zones" ADD CONSTRAINT "warehouse_zones_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bin_locations" ADD CONSTRAINT "bin_locations_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storekeeper_handovers" ADD CONSTRAINT "storekeeper_handovers_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storekeeper_handovers" ADD CONSTRAINT "storekeeper_handovers_outgoing_employee_id_fkey" FOREIGN KEY ("outgoing_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storekeeper_handovers" ADD CONSTRAINT "storekeeper_handovers_incoming_employee_id_fkey" FOREIGN KEY ("incoming_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "put_away_rules" ADD CONSTRAINT "put_away_rules_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "put_away_rules" ADD CONSTRAINT "put_away_rules_target_zone_id_fkey" FOREIGN KEY ("target_zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_counts" ADD CONSTRAINT "cycle_counts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_cycle_count_id_fkey" FOREIGN KEY ("cycle_count_id") REFERENCES "cycle_counts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cycle_count_lines" ADD CONSTRAINT "cycle_count_lines_counted_by_id_fkey" FOREIGN KEY ("counted_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_shipping_notices" ADD CONSTRAINT "advance_shipping_notices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "advance_shipping_notices" ADD CONSTRAINT "advance_shipping_notices_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asn_lines" ADD CONSTRAINT "asn_lines_asn_id_fkey" FOREIGN KEY ("asn_id") REFERENCES "advance_shipping_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asn_lines" ADD CONSTRAINT "asn_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_docks" ADD CONSTRAINT "cross_docks_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cross_docks" ADD CONSTRAINT "cross_docks_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection_checklist_items" ADD CONSTRAINT "inspection_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "inspection_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_approval_responses" ADD CONSTRAINT "parallel_approval_responses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "parallel_approval_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parallel_approval_responses" ADD CONSTRAINT "parallel_approval_responses_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dock_doors" ADD CONSTRAINT "dock_doors_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_appointments" ADD CONSTRAINT "yard_appointments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yard_appointments" ADD CONSTRAINT "yard_appointments_dock_door_id_fkey" FOREIGN KEY ("dock_door_id") REFERENCES "dock_doors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_visits" ADD CONSTRAINT "truck_visits_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "truck_visits" ADD CONSTRAINT "truck_visits_dock_door_id_fkey" FOREIGN KEY ("dock_door_id") REFERENCES "dock_doors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensors" ADD CONSTRAINT "sensors_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_readings" ADD CONSTRAINT "sensor_readings_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_alerts" ADD CONSTRAINT "sensor_alerts_sensor_id_fkey" FOREIGN KEY ("sensor_id") REFERENCES "sensors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_document_types" ADD CONSTRAINT "dynamic_document_types_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_field_definitions" ADD CONSTRAINT "dynamic_field_definitions_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "dynamic_document_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_documents" ADD CONSTRAINT "dynamic_documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "dynamic_document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_documents" ADD CONSTRAINT "dynamic_documents_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_documents" ADD CONSTRAINT "dynamic_documents_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_documents" ADD CONSTRAINT "dynamic_documents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_documents" ADD CONSTRAINT "dynamic_documents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_document_lines" ADD CONSTRAINT "dynamic_document_lines_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "dynamic_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_document_history" ADD CONSTRAINT "dynamic_document_history_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "dynamic_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dynamic_document_history" ADD CONSTRAINT "dynamic_document_history_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_data_sources" ADD CONSTRAINT "custom_data_sources_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "custom_field_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_sessions" ADD CONSTRAINT "packing_sessions_mirv_id_fkey" FOREIGN KEY ("mirv_id") REFERENCES "mirv"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_sessions" ADD CONSTRAINT "packing_sessions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_sessions" ADD CONSTRAINT "packing_sessions_packed_by_id_fkey" FOREIGN KEY ("packed_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_lines" ADD CONSTRAINT "packing_lines_packing_session_id_fkey" FOREIGN KEY ("packing_session_id") REFERENCES "packing_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packing_lines" ADD CONSTRAINT "packing_lines_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging_assignments" ADD CONSTRAINT "staging_assignments_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "warehouse_zones"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging_assignments" ADD CONSTRAINT "staging_assignments_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging_assignments" ADD CONSTRAINT "staging_assignments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging_assignments" ADD CONSTRAINT "staging_assignments_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_delivery_notes" ADD CONSTRAINT "equipment_delivery_notes_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_delivery_notes" ADD CONSTRAINT "equipment_delivery_notes_rental_contract_id_fkey" FOREIGN KEY ("rental_contract_id") REFERENCES "rental_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_delivery_notes" ADD CONSTRAINT "equipment_delivery_notes_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_delivery_notes" ADD CONSTRAINT "equipment_delivery_notes_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_return_notes" ADD CONSTRAINT "equipment_return_notes_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_return_notes" ADD CONSTRAINT "equipment_return_notes_delivery_note_id_fkey" FOREIGN KEY ("delivery_note_id") REFERENCES "equipment_delivery_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_return_notes" ADD CONSTRAINT "equipment_return_notes_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_return_notes" ADD CONSTRAINT "equipment_return_notes_inspected_by_id_fkey" FOREIGN KEY ("inspected_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_return_notes" ADD CONSTRAINT "equipment_return_notes_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_evaluator_id_fkey" FOREIGN KEY ("evaluator_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluation_metrics" ADD CONSTRAINT "supplier_evaluation_metrics_evaluation_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "supplier_evaluations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_orders" ADD CONSTRAINT "transport_orders_job_order_id_fkey" FOREIGN KEY ("job_order_id") REFERENCES "job_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_orders" ADD CONSTRAINT "transport_orders_origin_warehouse_id_fkey" FOREIGN KEY ("origin_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_orders" ADD CONSTRAINT "transport_orders_destination_warehouse_id_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_orders" ADD CONSTRAINT "transport_orders_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_orders" ADD CONSTRAINT "transport_orders_gate_pass_id_fkey" FOREIGN KEY ("gate_pass_id") REFERENCES "gate_passes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_orders" ADD CONSTRAINT "transport_orders_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_order_items" ADD CONSTRAINT "transport_order_items_transport_order_id_fkey" FOREIGN KEY ("transport_order_id") REFERENCES "transport_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_order_items" ADD CONSTRAINT "transport_order_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transport_order_items" ADD CONSTRAINT "transport_order_items_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_host_employee_id_fkey" FOREIGN KEY ("host_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitor_passes" ADD CONSTRAINT "visitor_passes_registered_by_id_fkey" FOREIGN KEY ("registered_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_attempts" ADD CONSTRAINT "login_attempts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_maintenance_contracts" ADD CONSTRAINT "annual_maintenance_contracts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_maintenance_contracts" ADD CONSTRAINT "annual_maintenance_contracts_equipment_type_id_fkey" FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "annual_maintenance_contracts" ADD CONSTRAINT "annual_maintenance_contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_location_warehouse_id_fkey" FOREIGN KEY ("location_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_from_warehouse_id_fkey" FOREIGN KEY ("from_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_to_warehouse_id_fkey" FOREIGN KEY ("to_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_from_employee_id_fkey" FOREIGN KEY ("from_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_to_employee_id_fkey" FOREIGN KEY ("to_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_transfers" ADD CONSTRAINT "asset_transfers_transferred_by_id_fkey" FOREIGN KEY ("transferred_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_depreciations" ADD CONSTRAINT "asset_depreciations_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_documents" ADD CONSTRAINT "customs_documents_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customs_documents" ADD CONSTRAINT "customs_documents_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "equipment_fleet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_maintenance" ADD CONSTRAINT "vehicle_maintenance_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_checklist_items" ADD CONSTRAINT "compliance_checklist_items_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "compliance_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audits" ADD CONSTRAINT "compliance_audits_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "compliance_checklists"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audits" ADD CONSTRAINT "compliance_audits_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audits" ADD CONSTRAINT "compliance_audits_auditor_id_fkey" FOREIGN KEY ("auditor_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_responses" ADD CONSTRAINT "compliance_audit_responses_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "compliance_audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_audit_responses" ADD CONSTRAINT "compliance_audit_responses_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "compliance_checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "digital_signatures" ADD CONSTRAINT "digital_signatures_signed_by_id_fkey" FOREIGN KEY ("signed_by_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
┌─────────────────────────────────────────────────────────┐
│  Update available 6.19.2 -> 7.4.2                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘

