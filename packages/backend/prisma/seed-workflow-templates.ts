/**
 * Seed script: Workflow Templates (Marketplace)
 *
 * Pre-built automation templates that users can install with one click.
 * Each template contains a complete workflow + rules definition.
 *
 * Run: npx tsx prisma/seed-workflow-templates.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TemplateRule {
  name: string;
  triggerEvent: string;
  conditions: unknown;
  actions: unknown[];
}

interface WorkflowTemplateDef {
  name: string;
  nameAr: string;
  description: string;
  category: string;
  entityType: string;
  rules: TemplateRule[];
}

const TEMPLATES: WorkflowTemplateDef[] = [
  // ── Material Management ──────────────────────────────
  {
    name: 'GRN Auto-QCI',
    nameAr: 'فحص جودة تلقائي عند الاستلام',
    description: 'Automatically create a Quality Control Inspection when a GRN is stored.',
    category: 'material',
    entityType: 'mrrv',
    rules: [{
      name: 'GRN Stored → Create QCI',
      triggerEvent: 'document:status_changed',
      conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'stored' }] },
      actions: [{ type: 'create_follow_up', params: { targetDocType: 'qci' } }],
    }],
  },
  {
    name: 'MI Auto Gate Pass',
    nameAr: 'إصدار تصريح خروج تلقائي',
    description: 'Automatically create a Gate Pass when a Material Issue is marked as issued.',
    category: 'material',
    entityType: 'mirv',
    rules: [{
      name: 'MI Issued → Create Gate Pass',
      triggerEvent: 'document:status_changed',
      conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'issued' }] },
      actions: [{ type: 'create_follow_up', params: { targetDocType: 'gate_pass' } }],
    }],
  },
  {
    name: 'Low Stock Email Alert',
    nameAr: 'تنبيه نقص المخزون بالبريد',
    description: 'Send an email to the warehouse supervisor when stock drops below minimum level.',
    category: 'inventory',
    entityType: '*',
    rules: [{
      name: 'Low Stock → Email Warehouse',
      triggerEvent: 'inventory:low_stock',
      conditions: { operator: 'AND', conditions: [] },
      actions: [{
        type: 'send_email',
        params: {
          templateCode: 'low_stock_alert',
          to: 'role:warehouse_supervisor',
        },
      }],
    }],
  },
  {
    name: 'MR Approval Notifications',
    nameAr: 'إشعارات اعتماد طلبات المواد',
    description: 'Notify relevant parties when a Material Request changes status.',
    category: 'material',
    entityType: 'mrf',
    rules: [
      {
        name: 'MR Submitted → Notify Warehouse',
        triggerEvent: 'document:status_changed',
        conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'in', value: ['submitted', 'pending_approval'] }] },
        actions: [{ type: 'create_notification', params: { title: 'New Material Requisition', body: 'A new MR has been submitted for review.', recipientRole: 'warehouse_supervisor', notificationType: 'chain_update' } }],
      },
      {
        name: 'MR Approved → Notify Engineer',
        triggerEvent: 'document:status_changed',
        conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'approved' }] },
        actions: [{ type: 'create_notification', params: { title: 'Material Requisition Approved', body: 'Your MR has been approved.', recipientRole: 'site_engineer', notificationType: 'chain_update' } }],
      },
    ],
  },
  // ── Logistics ──────────────────────────────────
  {
    name: 'Shipment Tracking Notifications',
    nameAr: 'إشعارات تتبع الشحنات',
    description: 'Notify relevant teams when shipment status changes.',
    category: 'logistics',
    entityType: 'shipment',
    rules: [
      {
        name: 'Shipment In Transit → Notify Logistics',
        triggerEvent: 'document:status_changed',
        conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'in_transit' }] },
        actions: [{ type: 'create_notification', params: { title: 'Shipment In Transit', body: 'A shipment is now in transit.', recipientRole: 'logistics_coordinator', notificationType: 'chain_update' } }],
      },
      {
        name: 'Shipment Delivered → Notify Warehouse',
        triggerEvent: 'document:status_changed',
        conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'delivered' }] },
        actions: [{ type: 'create_notification', params: { title: 'Shipment Delivered', body: 'A shipment has been delivered. Process the GRN.', recipientRole: 'warehouse_supervisor', notificationType: 'chain_update' } }],
      },
    ],
  },
  {
    name: 'JO Approval Chain',
    nameAr: 'سلسلة اعتماد أوامر العمل',
    description: 'Notify transport supervisor when a Job Order is approved.',
    category: 'logistics',
    entityType: 'jo',
    rules: [{
      name: 'JO Approved → Notify Transport',
      triggerEvent: 'document:status_changed',
      conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'approved' }] },
      actions: [{ type: 'create_notification', params: { title: 'Job Order Approved', body: 'A Job Order needs scheduling.', recipientRole: 'transport_supervisor', notificationType: 'chain_update' } }],
    }],
  },
  // ── Quality ──────────────────────────────────
  {
    name: 'QCI Failed → Auto DR',
    nameAr: 'إنشاء تقرير تباين عند فشل الفحص',
    description: 'Automatically create a Discrepancy Report when a QCI fails.',
    category: 'quality',
    entityType: 'rfim',
    rules: [{
      name: 'QCI Failed → Create DR',
      triggerEvent: 'document:status_changed',
      conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'failed' }] },
      actions: [{ type: 'create_follow_up', params: { targetDocType: 'dr' } }],
    }],
  },
  // ── Scrap ──────────────────────────────────
  {
    name: 'Scrap Approval Notifications',
    nameAr: 'إشعارات اعتماد الخردة',
    description: 'Notify SSC committee when scrap is approved for disposal.',
    category: 'asset',
    entityType: 'scrap_item',
    rules: [{
      name: 'Scrap Approved → Notify SSC',
      triggerEvent: 'document:status_changed',
      conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'approved' }] },
      actions: [
        { type: 'create_notification', params: { title: 'Scrap Approved', body: 'A scrap item needs SSC review.', recipientRole: 'scrap_committee_member', notificationType: 'chain_update' } },
        { type: 'create_notification', params: { title: 'Scrap Approved', body: 'A scrap item has been approved for disposal.', recipientRole: 'admin', notificationType: 'chain_update' } },
      ],
    }],
  },
  // ── IMSF ──────────────────────────────────
  {
    name: 'IMSF Auto Warehouse Transfer',
    nameAr: 'نقل مخزون تلقائي عند تأكيد IMSF',
    description: 'Automatically create a Warehouse Transfer when IMSF is confirmed.',
    category: 'material',
    entityType: 'imsf',
    rules: [{
      name: 'IMSF Confirmed → Create WT',
      triggerEvent: 'document:status_changed',
      conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'confirmed' }] },
      actions: [{ type: 'create_follow_up', params: { targetDocType: 'wt' } }],
    }],
  },
  // ── Scheduled ──────────────────────────────────
  {
    name: 'Daily Pending Review Reminder',
    nameAr: 'تذكير يومي بالمراجعات المعلقة',
    description: 'Send daily notifications about pending approval documents.',
    category: 'admin',
    entityType: '*',
    rules: [{
      name: 'Daily Pending Reminder (8 AM)',
      triggerEvent: 'scheduled:rule_triggered',
      conditions: { operator: 'AND', conditions: [] },
      actions: [{ type: 'create_notification', params: { title: 'Daily Reminder: Pending Approvals', body: 'You have documents awaiting your approval. Please review them.', recipientRole: 'manager', notificationType: 'reminder' } }],
    }],
  },
  {
    name: 'Weekly Inventory Report',
    nameAr: 'تقرير المخزون الأسبوعي',
    description: 'Send weekly inventory summary notifications to management.',
    category: 'inventory',
    entityType: '*',
    rules: [{
      name: 'Weekly Inventory Summary (Sunday)',
      triggerEvent: 'scheduled:rule_triggered',
      conditions: { operator: 'AND', conditions: [] },
      actions: [{ type: 'create_notification', params: { title: 'Weekly Inventory Summary', body: 'Your weekly inventory report is ready for review.', recipientRole: 'admin', notificationType: 'report' } }],
    }],
  },
  // ── MRN ──────────────────────────────────
  {
    name: 'MRN Completion Notifications',
    nameAr: 'إشعارات إتمام إرجاع المواد',
    description: 'Notify manager and warehouse when a Material Return is completed.',
    category: 'material',
    entityType: 'mrv',
    rules: [{
      name: 'MRN Completed → Notify',
      triggerEvent: 'document:status_changed',
      conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'completed' }] },
      actions: [
        { type: 'create_notification', params: { title: 'MRN Completed', body: 'Materials returned and stock updated.', recipientRole: 'manager', notificationType: 'chain_update' } },
        { type: 'create_notification', params: { title: 'MRN Completed', body: 'Materials returned and stock updated.', recipientRole: 'warehouse_supervisor', notificationType: 'chain_update' } },
      ],
    }],
  },
  // ── Conditional Branch Example ──────────────────────────────────
  {
    name: 'GRN Conditional Routing',
    nameAr: 'توجيه شرطي للاستلام',
    description: 'Route GRN notifications based on QC requirement — if QC required, notify QC officer; otherwise notify warehouse directly.',
    category: 'material',
    entityType: 'mrrv',
    rules: [{
      name: 'GRN Received → Conditional Route',
      triggerEvent: 'document:status_changed',
      conditions: { operator: 'AND', conditions: [{ field: 'payload.to', op: 'eq', value: 'received' }] },
      actions: [{
        type: 'conditional_branch',
        params: {
          condition: { field: 'payload.rfimRequired', op: 'eq', value: true },
          trueActions: [{ type: 'create_notification', params: { title: 'GRN Requires QC Inspection', body: 'New GRN needs quality inspection.', recipientRole: 'qc_officer', notificationType: 'chain_update' } }],
          falseActions: [{ type: 'create_notification', params: { title: 'GRN Ready for Storage', body: 'New GRN ready for direct storage (no QC required).', recipientRole: 'warehouse_supervisor', notificationType: 'chain_update' } }],
        },
      }],
    }],
  },
];

async function main() {
  console.log('Seeding workflow templates...\n');

  let created = 0;
  let skipped = 0;

  for (const t of TEMPLATES) {
    const existing = await prisma.workflowTemplate.findFirst({
      where: { name: t.name },
    });

    if (existing) {
      console.log(`  [skip] ${t.name}`);
      skipped++;
      continue;
    }

    await prisma.workflowTemplate.create({
      data: {
        name: t.name,
        nameAr: t.nameAr,
        description: t.description,
        category: t.category,
        source: 'system',
        template: {
          workflow: { name: t.name, entityType: t.entityType },
          rules: t.rules,
        },
      },
    });

    console.log(`  [created] ${t.name}`);
    created++;
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`);
}

main()
  .catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
