/**
 * Seed: Semantic Analytics Layer
 *
 * Seeds 33 measures and 15 dimensions for the semantic query builder.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MeasureSeed {
  key: string;
  name: string;
  description: string;
  category: string;
  entityType: string;
  aggregation: string;
  field?: string;
  defaultFilters?: unknown;
  unit?: string;
}

interface DimensionSeed {
  key: string;
  name: string;
  description: string;
  entityTypes: string[];
  field: string;
  dimensionType: string;
  hierarchy?: unknown;
}

const MEASURES: MeasureSeed[] = [
  // ── Warehouse (8) ─────────────────────────────────────────────────────
  { key: 'grn_count', name: 'GRN Count', description: 'Total goods received notes', category: 'warehouse', entityType: 'mrrv', aggregation: 'count' },
  { key: 'grn_avg_processing_time', name: 'GRN Avg Processing Time', description: 'Average days to process a GRN', category: 'warehouse', entityType: 'mrrv', aggregation: 'avg', field: 'processingDays', unit: 'days' },
  { key: 'mi_count', name: 'MI Count', description: 'Total material issues', category: 'warehouse', entityType: 'mirv', aggregation: 'count' },
  { key: 'mi_avg_lead_time', name: 'MI Avg Lead Time', description: 'Average lead time for material issues', category: 'warehouse', entityType: 'mirv', aggregation: 'avg', field: 'leadTimeDays', unit: 'days' },
  { key: 'mrn_count', name: 'MRN Count', description: 'Total material return notes', category: 'warehouse', entityType: 'mrv', aggregation: 'count' },
  { key: 'wt_count', name: 'Warehouse Transfer Count', description: 'Total warehouse transfers', category: 'warehouse', entityType: 'stock_transfer', aggregation: 'count' },
  { key: 'put_away_count', name: 'Put-Away Count', description: 'Total inventory lots put away', category: 'warehouse', entityType: 'inventory_lot', aggregation: 'count' },
  { key: 'packing_sessions', name: 'Packing Sessions', description: 'Total packing sessions', category: 'warehouse', entityType: 'mrrv', aggregation: 'count' },

  // ── Inventory (6) ─────────────────────────────────────────────────────
  { key: 'total_stock_value', name: 'Total Stock Value', description: 'Sum of all inventory value', category: 'inventory', entityType: 'inventory_level', aggregation: 'sum', field: 'totalValue', unit: 'SAR' },
  { key: 'low_stock_items', name: 'Low Stock Items', description: 'Items below reorder point', category: 'inventory', entityType: 'inventory_level', aggregation: 'count', defaultFilters: [{ field: 'qty', op: 'lt', value: 0 }] },
  { key: 'inventory_turnover', name: 'Inventory Turnover', description: 'Average inventory turnover rate', category: 'inventory', entityType: 'inventory_level', aggregation: 'avg', field: 'turnoverRate' },
  { key: 'lot_count', name: 'Inventory Lot Count', description: 'Total inventory lots', category: 'inventory', entityType: 'inventory_lot', aggregation: 'count' },
  { key: 'slow_moving_items', name: 'Slow Moving Items', description: 'Items with low movement', category: 'inventory', entityType: 'item', aggregation: 'count' },
  { key: 'stock_out_count', name: 'Stock-Out Count', description: 'Items with zero stock', category: 'inventory', entityType: 'inventory_level', aggregation: 'count', defaultFilters: [{ field: 'qty', op: 'eq', value: 0 }] },

  // ── Quality (4) ─────────────────────────────────────────────────────
  { key: 'qci_count', name: 'QCI Count', description: 'Total quality inspections', category: 'quality', entityType: 'rfim', aggregation: 'count' },
  { key: 'qci_pass_rate', name: 'QCI Pass Rate', description: 'Average QCI pass rate', category: 'quality', entityType: 'rfim', aggregation: 'count', defaultFilters: [{ field: 'status', op: 'eq', value: 'passed' }] },
  { key: 'dr_count', name: 'DR Count', description: 'Total discrepancy reports', category: 'quality', entityType: 'osd', aggregation: 'count' },
  { key: 'dr_avg_resolution_days', name: 'DR Avg Resolution Days', description: 'Average days to resolve a DR', category: 'quality', entityType: 'osd', aggregation: 'avg', field: 'resolutionDays', unit: 'days' },

  // ── Logistics (5) ──────────────────────────────────────────────────
  { key: 'jo_count', name: 'Job Order Count', description: 'Total job orders', category: 'logistics', entityType: 'jo', aggregation: 'count' },
  { key: 'jo_avg_completion_hours', name: 'JO Avg Completion Hours', description: 'Average hours to complete a JO', category: 'logistics', entityType: 'jo', aggregation: 'avg', field: 'completionHours', unit: 'hours' },
  { key: 'gate_pass_count', name: 'Gate Pass Count', description: 'Total gate passes issued', category: 'logistics', entityType: 'gate_pass', aggregation: 'count' },
  { key: 'shipment_count', name: 'Shipment Count', description: 'Total shipments', category: 'logistics', entityType: 'shipment', aggregation: 'count' },
  { key: 'shipment_avg_transit_days', name: 'Shipment Avg Transit Days', description: 'Average transit days per shipment', category: 'logistics', entityType: 'shipment', aggregation: 'avg', field: 'transitDays', unit: 'days' },

  // ── Procurement (4) ────────────────────────────────────────────────
  { key: 'mr_count', name: 'MR Count', description: 'Total material requests', category: 'procurement', entityType: 'mrf', aggregation: 'count' },
  { key: 'mr_avg_fulfillment_days', name: 'MR Avg Fulfillment Days', description: 'Average days to fulfill an MR', category: 'procurement', entityType: 'mrf', aggregation: 'avg', field: 'fulfillmentDays', unit: 'days' },
  { key: 'imsf_count', name: 'IMSF Count', description: 'Total inter-site material transfer forms', category: 'procurement', entityType: 'imsf', aggregation: 'count' },
  { key: 'supplier_delivery_rate', name: 'Supplier Delivery Rate', description: 'Average supplier on-time delivery rate', category: 'procurement', entityType: 'supplier', aggregation: 'avg' },

  // ── Labor (3) ─────────────────────────────────────────────────────
  { key: 'worker_throughput', name: 'Worker Throughput', description: 'Average worker throughput', category: 'labor', entityType: 'employee', aggregation: 'avg' },
  { key: 'avg_task_duration', name: 'Avg Task Duration', description: 'Average task duration per worker', category: 'labor', entityType: 'employee', aggregation: 'avg' },
  { key: 'tasks_completed_count', name: 'Tasks Completed', description: 'Total tasks completed', category: 'labor', entityType: 'employee', aggregation: 'count' },

  // ── Assets (3) ────────────────────────────────────────────────────
  { key: 'scrap_count', name: 'Scrap Count', description: 'Total scrap items', category: 'assets', entityType: 'scrap_item', aggregation: 'count' },
  { key: 'surplus_count', name: 'Surplus Count', description: 'Total surplus items', category: 'assets', entityType: 'surplus', aggregation: 'count' },
  { key: 'tool_issue_count', name: 'Tool Issue Count', description: 'Total tool issues', category: 'assets', entityType: 'tool_issue', aggregation: 'count' },
];

const DIMENSIONS: DimensionSeed[] = [
  // ── Temporal (3) ─────────────────────────────────────────────────────
  {
    key: 'date',
    name: 'Date',
    description: 'Created date',
    entityTypes: ['*'],
    field: 'createdAt',
    dimensionType: 'temporal',
  },
  {
    key: 'created_month',
    name: 'Created Month',
    description: 'Month of creation',
    entityTypes: ['*'],
    field: 'createdAt',
    dimensionType: 'temporal',
    hierarchy: { level: 'month' },
  },
  {
    key: 'completed_month',
    name: 'Completed Month',
    description: 'Month of completion',
    entityTypes: ['mrrv', 'mirv', 'mrv', 'rfim', 'osd', 'jo', 'shipment', 'stock_transfer'],
    field: 'completedAt',
    dimensionType: 'temporal',
  },

  // ── Categorical (12) ─────────────────────────────────────────────────
  {
    key: 'status',
    name: 'Status',
    description: 'Document status',
    entityTypes: ['mrrv', 'mirv', 'mrv', 'rfim', 'osd', 'jo', 'gate_pass', 'stock_transfer', 'mrf', 'shipment', 'imsf', 'scrap_item', 'surplus', 'rental_contract', 'tool_issue', 'generator_maintenance', 'storekeeper_handover'],
    field: 'status',
    dimensionType: 'categorical',
  },
  {
    key: 'warehouse',
    name: 'Warehouse',
    description: 'Warehouse',
    entityTypes: ['mrrv', 'mirv', 'mrv', 'rfim', 'osd', 'inventory_level', 'inventory_lot', 'stock_transfer', 'storekeeper_handover'],
    field: 'warehouseId',
    dimensionType: 'categorical',
  },
  {
    key: 'project',
    name: 'Project',
    description: 'Project',
    entityTypes: ['mrrv', 'mirv', 'mrv', 'mrf', 'jo', 'shipment', 'imsf', 'scrap_item', 'surplus'],
    field: 'projectId',
    dimensionType: 'categorical',
  },
  {
    key: 'department',
    name: 'Department',
    description: 'Department',
    entityTypes: ['employee', 'mrf'],
    field: 'departmentId',
    dimensionType: 'categorical',
  },
  {
    key: 'item_category',
    name: 'Item Category',
    description: 'Item category',
    entityTypes: ['item', 'inventory_level', 'inventory_lot'],
    field: 'category',
    dimensionType: 'categorical',
  },
  {
    key: 'supplier',
    name: 'Supplier',
    description: 'Supplier',
    entityTypes: ['mrrv', 'shipment', 'rental_contract'],
    field: 'supplierId',
    dimensionType: 'categorical',
  },
  {
    key: 'carrier',
    name: 'Carrier',
    description: 'Carrier name',
    entityTypes: ['shipment'],
    field: 'carrierName',
    dimensionType: 'categorical',
  },
  {
    key: 'document_type',
    name: 'Document Type',
    description: 'Type of document',
    entityTypes: ['gate_pass'],
    field: 'documentType',
    dimensionType: 'categorical',
  },
  {
    key: 'priority',
    name: 'Priority',
    description: 'Priority level',
    entityTypes: ['jo', 'mrf'],
    field: 'priority',
    dimensionType: 'categorical',
  },
  {
    key: 'employee',
    name: 'Employee',
    description: 'Created by employee',
    entityTypes: ['*'],
    field: 'createdById',
    dimensionType: 'categorical',
  },
  {
    key: 'zone_type',
    name: 'Zone Type',
    description: 'Warehouse zone type',
    entityTypes: ['inventory_lot'],
    field: 'zoneType',
    dimensionType: 'categorical',
  },
  {
    key: 'dock_door_type',
    name: 'Dock Door Type',
    description: 'Dock door type (inbound/outbound/both)',
    entityTypes: ['gate_pass'],
    field: 'doorType',
    dimensionType: 'categorical',
  },
];

export async function seedSemanticLayer() {
  console.log('Seeding semantic measures...');

  for (const m of MEASURES) {
    await prisma.semanticMeasure.upsert({
      where: { key: m.key },
      update: {
        name: m.name,
        description: m.description,
        category: m.category,
        entityType: m.entityType,
        aggregation: m.aggregation,
        field: m.field ?? null,
        defaultFilters: m.defaultFilters as any ?? Prisma.JsonNull,
        unit: m.unit ?? null,
        isActive: true,
      },
      create: {
        key: m.key,
        name: m.name,
        description: m.description,
        category: m.category,
        entityType: m.entityType,
        aggregation: m.aggregation,
        field: m.field ?? null,
        defaultFilters: m.defaultFilters as any ?? Prisma.JsonNull,
        unit: m.unit ?? null,
        isActive: true,
      },
    });
  }

  console.log(`  Seeded ${MEASURES.length} measures`);

  console.log('Seeding semantic dimensions...');

  for (const d of DIMENSIONS) {
    await prisma.semanticDimension.upsert({
      where: { key: d.key },
      update: {
        name: d.name,
        description: d.description,
        entityTypes: d.entityTypes,
        field: d.field,
        dimensionType: d.dimensionType,
        hierarchy: d.hierarchy as any ?? Prisma.JsonNull,
        isActive: true,
      },
      create: {
        key: d.key,
        name: d.name,
        description: d.description,
        entityTypes: d.entityTypes,
        field: d.field,
        dimensionType: d.dimensionType,
        hierarchy: d.hierarchy as any ?? Prisma.JsonNull,
        isActive: true,
      },
    });
  }

  console.log(`  Seeded ${DIMENSIONS.length} dimensions`);
  console.log('Semantic layer seed complete.');
}

// Allow standalone execution
if (process.argv[1]?.endsWith('seed-semantic-layer.ts') || process.argv[1]?.endsWith('seed-semantic-layer.js')) {
  seedSemanticLayer()
    .then(() => prisma.$disconnect())
    .catch(e => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
