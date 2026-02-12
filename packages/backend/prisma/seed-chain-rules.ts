/**
 * Seed script: Migrate chain notification rules → WorkflowRule DB
 *
 * Converts the 11 hardcoded rules from chain-notification-handler.ts
 * into Workflow + WorkflowRule records in the database so the rule engine
 * evaluates them just like any user-created rules.
 *
 * Run: npx tsx prisma/seed-chain-rules.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ChainRuleDef {
  entityType: string;
  triggerEvent: string;
  name: string;
  /** Condition: payload.to equals this status (or IN for array) */
  targetStatus: string | string[];
  /** One action per recipient role */
  recipientRoles: string[];
  title: string;
  body?: string;
  notificationType: string;
}

const CHAIN_RULES: ChainRuleDef[] = [
  {
    entityType: 'mrrv',
    triggerEvent: 'document:status_changed',
    name: 'GRN Stored → Notify Manager',
    targetStatus: 'stored',
    recipientRoles: ['manager', 'project_manager'],
    title: 'GRN Stored — Materials Available',
    body: 'A GRN has been stored. Materials are now available in the warehouse.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'mrrv',
    triggerEvent: 'document:status_changed',
    name: 'GRN QC Approved → Notify Warehouse',
    targetStatus: 'qc_approved',
    recipientRoles: ['warehouse_supervisor'],
    title: 'GRN QC Approved — Ready for Storage',
    body: 'Quality inspection passed. Materials can now be stored.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'mirv',
    triggerEvent: 'document:status_changed',
    name: 'MI Approved → Notify Warehouse',
    targetStatus: 'approved',
    recipientRoles: ['warehouse_supervisor', 'warehouse_clerk'],
    title: 'MI Approved — Prepare Materials for Issue',
    body: 'A Material Issue has been approved. Please prepare items for issuance.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'mirv',
    triggerEvent: 'document:status_changed',
    name: 'MI Issued → Notify Manager',
    targetStatus: 'issued',
    recipientRoles: ['manager', 'project_manager'],
    title: 'MI Issued — Materials Dispatched',
    body: 'Materials have been issued and dispatched from the warehouse.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'rfim',
    triggerEvent: 'document:status_changed',
    name: 'QCI Completed → Notify Warehouse',
    targetStatus: 'completed',
    recipientRoles: ['warehouse_supervisor'],
    title: 'QCI Completed — Inspection Result Available',
    body: 'A Quality Control Inspection has been completed. Review the results.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'shipment',
    triggerEvent: 'document:status_changed',
    name: 'Shipment Delivered → Notify Receiving',
    targetStatus: 'delivered',
    recipientRoles: ['warehouse_supervisor', 'warehouse_clerk'],
    title: 'Shipment Delivered — Ready for Receiving',
    body: 'A shipment has been delivered. Please process the goods receipt.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'shipment',
    triggerEvent: 'document:status_changed',
    name: 'Shipment In Transit → Notify Logistics',
    targetStatus: 'in_transit',
    recipientRoles: ['logistics_coordinator'],
    title: 'Shipment In Transit',
    body: 'A shipment is now in transit to the destination.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'scrap_item',
    triggerEvent: 'document:status_changed',
    name: 'Scrap Approved → Notify SSC',
    targetStatus: 'approved',
    recipientRoles: ['scrap_committee_member', 'admin'],
    title: 'Scrap Disposal Approved — Awaiting SSC Review',
    body: 'A scrap item has been approved for disposal. SSC review is required.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'mrv',
    triggerEvent: 'document:status_changed',
    name: 'MRN Completed → Notify Manager & Warehouse',
    targetStatus: 'completed',
    recipientRoles: ['manager', 'warehouse_supervisor'],
    title: 'MRN Completed — Materials Returned',
    body: 'A Material Return has been completed and stock has been updated.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'jo',
    triggerEvent: 'document:status_changed',
    name: 'JO Approved → Notify Transport',
    targetStatus: 'approved',
    recipientRoles: ['transport_supervisor'],
    title: 'Job Order Approved — Schedule Required',
    body: 'A Job Order has been approved. Please schedule the transport.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'mrf',
    triggerEvent: 'document:status_changed',
    name: 'MR Submitted → Notify Warehouse',
    targetStatus: ['submitted', 'pending_approval'],
    recipientRoles: ['warehouse_supervisor'],
    title: 'Material Requisition Submitted',
    body: 'A new Material Requisition has been submitted for review.',
    notificationType: 'chain_update',
  },
  {
    entityType: 'imsf',
    triggerEvent: 'document:status_changed',
    name: 'IMSF Confirmed → Notify Warehouse',
    targetStatus: 'confirmed',
    recipientRoles: ['warehouse_supervisor'],
    title: 'IMSF Confirmed — Inter-Warehouse Transfer Initiated',
    body: 'An internal material shifting form has been confirmed. A warehouse transfer has been created.',
    notificationType: 'chain_update',
  },
];

function buildCondition(targetStatus: string | string[]) {
  if (Array.isArray(targetStatus)) {
    return {
      operator: 'AND' as const,
      conditions: [
        { field: 'payload.to', op: 'in' as const, value: targetStatus },
      ],
    };
  }
  return {
    operator: 'AND' as const,
    conditions: [
      { field: 'payload.to', op: 'eq' as const, value: targetStatus },
    ],
  };
}

function buildActions(rule: ChainRuleDef) {
  return rule.recipientRoles.map(role => ({
    type: 'create_notification',
    params: {
      title: rule.title,
      body: rule.body,
      recipientRole: role,
      notificationType: rule.notificationType,
    },
  }));
}

async function main() {
  console.log('Seeding chain notification rules into WorkflowRule table...\n');

  // Group by entityType → one Workflow per entityType
  const byEntity = new Map<string, ChainRuleDef[]>();
  for (const rule of CHAIN_RULES) {
    const existing = byEntity.get(rule.entityType) ?? [];
    existing.push(rule);
    byEntity.set(rule.entityType, existing);
  }

  let workflowCount = 0;
  let ruleCount = 0;

  for (const [entityType, rules] of byEntity) {
    const workflowName = `Chain Notifications: ${entityType}`;

    // Upsert workflow
    const workflow = await prisma.workflow.upsert({
      where: {
        // Use compound lookup since there's no unique on name
        id: (
          await prisma.workflow.findFirst({
            where: { name: workflowName, entityType },
            select: { id: true },
          })
        )?.id ?? '00000000-0000-0000-0000-000000000000',
      },
      update: { isActive: true },
      create: {
        name: workflowName,
        description: `Auto-migrated chain notification rules for ${entityType}`,
        entityType,
        isActive: true,
        priority: 10, // Higher priority than default
      },
    });

    workflowCount++;

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];

      // Check if rule already exists
      const existing = await prisma.workflowRule.findFirst({
        where: { workflowId: workflow.id, name: rule.name },
      });

      if (existing) {
        console.log(`  [skip] Rule already exists: ${rule.name}`);
        continue;
      }

      await prisma.workflowRule.create({
        data: {
          workflowId: workflow.id,
          name: rule.name,
          triggerEvent: rule.triggerEvent,
          conditions: buildCondition(rule.targetStatus),
          actions: buildActions(rule),
          isActive: true,
          stopOnMatch: false,
          sortOrder: i * 10,
        },
      });

      ruleCount++;
      console.log(`  [created] ${rule.name}`);
    }
  }

  console.log(`\nDone: ${workflowCount} workflows, ${ruleCount} rules created.`);
  console.log('\nThe rule engine will now handle these notifications.');
  console.log('You can safely remove chain-notification-handler.ts after verifying.');
}

main()
  .catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
