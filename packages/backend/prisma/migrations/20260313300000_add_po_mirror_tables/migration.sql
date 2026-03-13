-- CreateTable: Oracle PO Mirror Headers (read-only sync from Oracle WMS)
CREATE TABLE "RCV_PO_MIRROR_HEADERS" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "po_number" VARCHAR(50) NOT NULL,
    "supplier_code" VARCHAR(50) NOT NULL,
    "supplier_name" VARCHAR(200) NOT NULL,
    "order_date" DATE NOT NULL,
    "expected_date" DATE,
    "status" VARCHAR(30) NOT NULL DEFAULT 'open',
    "total_amount" DECIMAL(15,2),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'SAR',
    "synced_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RCV_PO_MIRROR_HEADERS_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Oracle PO Mirror Lines (read-only sync from Oracle WMS)
CREATE TABLE "RCV_PO_MIRROR_LINES" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "po_id" UUID NOT NULL,
    "line_number" INTEGER NOT NULL,
    "item_code" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "ordered_qty" DECIMAL(12,3) NOT NULL,
    "received_qty" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit_price" DECIMAL(15,2),
    "uom" VARCHAR(20) NOT NULL,

    CONSTRAINT "RCV_PO_MIRROR_LINES_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: unique po_number
CREATE UNIQUE INDEX "idx_po_mirror_po_number" ON "RCV_PO_MIRROR_HEADERS"("po_number");

-- CreateIndex: status index
CREATE INDEX "idx_po_mirror_status" ON "RCV_PO_MIRROR_HEADERS"("status");

-- CreateIndex: supplier_code index
CREATE INDEX "idx_po_mirror_supplier_code" ON "RCV_PO_MIRROR_HEADERS"("supplier_code");

-- CreateIndex: order_date index
CREATE INDEX "idx_po_mirror_order_date" ON "RCV_PO_MIRROR_HEADERS"("order_date");

-- CreateIndex: synced_at index
CREATE INDEX "idx_po_mirror_synced_at" ON "RCV_PO_MIRROR_HEADERS"("synced_at");

-- CreateIndex: po_id index on lines
CREATE INDEX "idx_po_mirror_lines_po" ON "RCV_PO_MIRROR_LINES"("po_id");

-- CreateIndex: item_code index on lines
CREATE INDEX "idx_po_mirror_lines_item_code" ON "RCV_PO_MIRROR_LINES"("item_code");

-- CreateIndex: composite po_id + line_number index on lines
CREATE INDEX "idx_po_mirror_lines_po_line" ON "RCV_PO_MIRROR_LINES"("po_id", "line_number");

-- AddForeignKey
ALTER TABLE "RCV_PO_MIRROR_LINES" ADD CONSTRAINT "RCV_PO_MIRROR_LINES_po_id_fkey" FOREIGN KEY ("po_id") REFERENCES "RCV_PO_MIRROR_HEADERS"("id") ON DELETE CASCADE ON UPDATE CASCADE;
