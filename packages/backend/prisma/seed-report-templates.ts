// ============================================================================
// Seed: Report Templates — 15 pre-built report templates by category
// ============================================================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TemplateDefinition {
  name: string;
  description: string;
  dataSource: string;
  columns: string[];
  filters: Record<string, unknown>;
  visualization: string;
  category: string;
}

const templates: TemplateDefinition[] = [
  // ── Daily (4) ──────────────────────────────────────────────────────────
  {
    name: 'Daily GRN Summary',
    description: 'Overview of goods received notes created today with status breakdown.',
    dataSource: 'table/recent_mrrv',
    columns: ['mrrvNumber', 'status', 'receiveDate', 'project', 'supplier'],
    filters: { dateRange: 'today' },
    visualization: 'table',
    category: 'daily',
  },
  {
    name: 'Daily MI Activity',
    description: 'Material issue requests submitted or processed today.',
    dataSource: 'table/recent_mirv',
    columns: ['mirvNumber', 'status', 'requestDate', 'project', 'requestedBy'],
    filters: { dateRange: 'today' },
    visualization: 'table',
    category: 'daily',
  },
  {
    name: 'Daily Pending Approvals',
    description: 'All documents currently awaiting approval across departments.',
    dataSource: 'stats/pending_approvals',
    columns: ['documentType', 'documentNumber', 'status', 'submittedDate', 'assignedTo'],
    filters: { status: 'pending_approval' },
    visualization: 'table',
    category: 'daily',
  },
  {
    name: 'Daily SLA Status',
    description: 'SLA compliance snapshot showing on-time vs breached items.',
    dataSource: 'sla/compliance',
    columns: ['category', 'totalTracked', 'onTime', 'breached', 'percentage'],
    filters: { dateRange: 'today' },
    visualization: 'bar',
    category: 'daily',
  },

  // ── Weekly (4) ─────────────────────────────────────────────────────────
  {
    name: 'Weekly Material Movement',
    description: 'Summary of all material movements (GRN, MI, MRN) for the past week.',
    dataSource: 'cross-department/document_pipeline',
    columns: ['documentType', 'count', 'status'],
    filters: { dateRange: 'last_7_days' },
    visualization: 'bar',
    category: 'weekly',
  },
  {
    name: 'Weekly Exception Summary',
    description: 'Discrepancy reports and quality issues raised during the week.',
    dataSource: 'grouped/mrrv_by_status',
    columns: ['status', 'count', 'lastOccurrence'],
    filters: { dateRange: 'last_7_days', status: ['draft', 'pending', 'rejected'] },
    visualization: 'table',
    category: 'weekly',
  },
  {
    name: 'Weekly Supplier Delivery',
    description: 'Supplier delivery performance and shipment tracking for the week.',
    dataSource: 'table/recent_mrrv',
    columns: ['supplier', 'mrrvNumber', 'receiveDate', 'status', 'project'],
    filters: { dateRange: 'last_7_days' },
    visualization: 'table',
    category: 'weekly',
  },
  {
    name: 'Weekly Inventory Alerts',
    description: 'Items below reorder point or with unusual stock movements.',
    dataSource: 'stats/low_stock',
    columns: ['itemCode', 'itemName', 'warehouse', 'qtyOnHand', 'reorderPoint'],
    filters: { belowReorderPoint: true },
    visualization: 'table',
    category: 'weekly',
  },

  // ── Monthly (4) ────────────────────────────────────────────────────────
  {
    name: 'Monthly Inventory Valuation',
    description: 'Total inventory value breakdown by warehouse and category.',
    dataSource: 'cross-department/inventory_by_warehouse',
    columns: ['warehouse', 'totalValue', 'itemCount'],
    filters: { dateRange: 'this_month' },
    visualization: 'pie',
    category: 'monthly',
  },
  {
    name: 'Monthly Document Volume',
    description: 'Count of documents created per type over the past month.',
    dataSource: 'cross-department/document_pipeline',
    columns: ['documentType', 'created', 'completed', 'pending'],
    filters: { dateRange: 'this_month' },
    visualization: 'bar',
    category: 'monthly',
  },
  {
    name: 'Monthly QC Summary',
    description: 'Quality control inspection results — pass/fail rates and trends.',
    dataSource: 'grouped/mrrv_by_status',
    columns: ['status', 'count', 'passRate'],
    filters: { dateRange: 'this_month' },
    visualization: 'bar',
    category: 'monthly',
  },
  {
    name: 'Monthly Project Activity',
    description: 'Document activity and material consumption grouped by project.',
    dataSource: 'table/recent_activity',
    columns: ['project', 'documentType', 'action', 'performedBy', 'performedAt'],
    filters: { dateRange: 'this_month' },
    visualization: 'table',
    category: 'monthly',
  },

  // ── Ad-Hoc (3) ─────────────────────────────────────────────────────────
  {
    name: 'Warehouse Stock Report',
    description: 'Current stock levels across all warehouses with quantity and value.',
    dataSource: 'grouped/inventory_by_warehouse',
    columns: ['warehouse', 'totalQty', 'itemCount'],
    filters: {},
    visualization: 'table',
    category: 'adhoc',
  },
  {
    name: 'Supplier Performance Card',
    description: 'Supplier delivery history, lead times, and quality metrics.',
    dataSource: 'table/recent_mrrv',
    columns: ['supplier', 'deliveryCount', 'avgLeadTime', 'qualityRate'],
    filters: {},
    visualization: 'table',
    category: 'adhoc',
  },
  {
    name: 'Job Order Kanban',
    description: 'All job orders grouped by status for kanban-style tracking.',
    dataSource: 'grouped/jo_by_status',
    columns: ['status', 'count', 'priority'],
    filters: {},
    visualization: 'table',
    category: 'adhoc',
  },
];

export async function seedReportTemplates(adminId: string): Promise<void> {
  // Clear existing templates
  await prisma.savedReport.deleteMany({ where: { isTemplate: true } });

  // Create all templates
  await prisma.savedReport.createMany({
    data: templates.map(t => ({
      name: t.name,
      description: t.description,
      dataSource: t.dataSource,
      columns: t.columns,
      filters: t.filters,
      visualization: t.visualization,
      category: t.category,
      ownerId: adminId,
      isTemplate: true,
      isPublic: true,
    })),
  });

  console.log(`  Seeded ${templates.length} report templates`);
}
