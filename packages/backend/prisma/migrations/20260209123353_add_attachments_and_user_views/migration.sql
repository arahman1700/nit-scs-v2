-- AlterTable
ALTER TABLE "email_logs" ADD COLUMN     "body_html" TEXT,
ADD COLUMN     "retry_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "lot_consumptions" ADD COLUMN     "reference_id" UUID,
ADD COLUMN     "reference_type" VARCHAR(50),
ALTER COLUMN "mirv_line_id" DROP NOT NULL;

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

-- CreateIndex
CREATE INDEX "idx_attachment_entity" ON "attachments"("entity_type", "record_id");

-- CreateIndex
CREATE INDEX "idx_attachment_uploader" ON "attachments"("uploaded_by_id");

-- CreateIndex
CREATE INDEX "idx_user_view_user_entity" ON "user_views"("user_id", "entity_type");

-- CreateIndex
CREATE INDEX "idx_audit_log_date" ON "audit_log"("performed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_user" ON "audit_log"("performed_by_id");

-- CreateIndex
CREATE INDEX "idx_cities_region" ON "cities"("region_id");

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
CREATE INDEX "idx_gate_passes_warehouse" ON "gate_passes"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_gate_passes_created" ON "gate_passes"("created_at");

-- CreateIndex
CREATE INDEX "idx_inventory_lots_status" ON "inventory_lots"("status");

-- CreateIndex
CREATE INDEX "idx_job_orders_supplier" ON "job_orders"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_job_orders_requested_by" ON "job_orders"("requested_by_id");

-- CreateIndex
CREATE INDEX "idx_job_orders_status" ON "job_orders"("status");

-- CreateIndex
CREATE INDEX "idx_job_orders_created" ON "job_orders"("created_at");

-- CreateIndex
CREATE INDEX "idx_lot_consumption_ref" ON "lot_consumptions"("reference_type", "reference_id");

-- CreateIndex
CREATE INDEX "idx_mrf_project" ON "material_requisitions"("project_id");

-- CreateIndex
CREATE INDEX "idx_mrf_status" ON "material_requisitions"("status");

-- CreateIndex
CREATE INDEX "idx_mrf_requested_by" ON "material_requisitions"("requested_by_id");

-- CreateIndex
CREATE INDEX "idx_mirv_requested_by" ON "mirv"("requested_by_id");

-- CreateIndex
CREATE INDEX "idx_mirv_created" ON "mirv"("created_at");

-- CreateIndex
CREATE INDEX "idx_mrrv_warehouse" ON "mrrv"("warehouse_id");

-- CreateIndex
CREATE INDEX "idx_mrrv_created" ON "mrrv"("created_at");

-- CreateIndex
CREATE INDEX "idx_mrv_status" ON "mrv"("status");

-- CreateIndex
CREATE INDEX "idx_mrv_project" ON "mrv"("project_id");

-- CreateIndex
CREATE INDEX "idx_notifications_date" ON "notifications"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_osd_mrrv" ON "osd_reports"("mrrv_id");

-- CreateIndex
CREATE INDEX "idx_osd_status" ON "osd_reports"("status");

-- CreateIndex
CREATE INDEX "idx_rfim_mrrv" ON "rfim"("mrrv_id");

-- CreateIndex
CREATE INDEX "idx_rfim_status" ON "rfim"("status");

-- CreateIndex
CREATE INDEX "idx_shipments_supplier" ON "shipments"("supplier_id");

-- CreateIndex
CREATE INDEX "idx_shipments_project" ON "shipments"("project_id");

-- CreateIndex
CREATE INDEX "idx_shipments_created" ON "shipments"("created_at");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_from_wh" ON "stock_transfers"("from_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_to_wh" ON "stock_transfers"("to_warehouse_id");

-- CreateIndex
CREATE INDEX "idx_stock_transfers_created" ON "stock_transfers"("created_at");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_views" ADD CONSTRAINT "user_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
