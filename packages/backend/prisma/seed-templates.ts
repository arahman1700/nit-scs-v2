/**
 * Seed data for default email templates and example workflows.
 * Run: npx tsx prisma/seed-templates.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EMAIL_TEMPLATES = [
  {
    code: 'approval_requested',
    name: 'Approval Requested',
    subject: '[NIT] Approval Required: {{entityType}} #{{entityId}}',
    bodyHtml: `<h2>Approval Required</h2>
<p>A <strong>{{entityType}}</strong> document requires your approval.</p>
<p><strong>Document ID:</strong> {{entityId}}</p>
<p><strong>Submitted by:</strong> {{performedById}}</p>
{{#if amount}}<p><strong>Amount:</strong> {{amount}} SAR</p>{{/if}}
<p>Please review and approve/reject this document at your earliest convenience.</p>
<p style="color:#888;font-size:12px">This is an automated notification from NIT Logistics.</p>`,
    variables: ['entityType', 'entityId', 'performedById', 'amount', 'approverRole'],
  },
  {
    code: 'approval_approved',
    name: 'Document Approved',
    subject: '[NIT] Approved: {{entityType}} #{{entityId}}',
    bodyHtml: `<h2>Document Approved</h2>
<p>Your <strong>{{entityType}}</strong> document has been approved.</p>
<p><strong>Document ID:</strong> {{entityId}}</p>
<p><strong>Approved by:</strong> {{approvedById}}</p>
{{#if comments}}<p><strong>Comments:</strong> {{comments}}</p>{{/if}}
<p style="color:#888;font-size:12px">This is an automated notification from NIT Logistics.</p>`,
    variables: ['entityType', 'entityId', 'approvedById', 'comments'],
  },
  {
    code: 'approval_rejected',
    name: 'Document Rejected',
    subject: '[NIT] Rejected: {{entityType}} #{{entityId}}',
    bodyHtml: `<h2>Document Rejected</h2>
<p>Your <strong>{{entityType}}</strong> document has been rejected.</p>
<p><strong>Document ID:</strong> {{entityId}}</p>
<p><strong>Rejected by:</strong> {{rejectedById}}</p>
{{#if reason}}<p><strong>Reason:</strong> {{reason}}</p>{{/if}}
<p>Please review the feedback and resubmit if appropriate.</p>
<p style="color:#888;font-size:12px">This is an automated notification from NIT Logistics.</p>`,
    variables: ['entityType', 'entityId', 'rejectedById', 'reason'],
  },
  {
    code: 'sla_at_risk',
    name: 'SLA At Risk',
    subject: '[NIT] SLA At Risk: {{entityType}} #{{entityId}}',
    bodyHtml: `<h2>⚠️ SLA At Risk</h2>
<p>A document is approaching its SLA deadline.</p>
<p><strong>Document Type:</strong> {{entityType}}</p>
<p><strong>Document ID:</strong> {{entityId}}</p>
<p><strong>SLA Due:</strong> {{slaDueDate}}</p>
<p>Please take action to resolve this before the deadline.</p>
<p style="color:#888;font-size:12px">This is an automated notification from NIT Logistics.</p>`,
    variables: ['entityType', 'entityId', 'slaDueDate'],
  },
  {
    code: 'sla_breached',
    name: 'SLA Breached',
    subject: '[NIT] SLA BREACHED: {{entityType}} #{{entityId}}',
    bodyHtml: `<h2>🔴 SLA Breached</h2>
<p>A document has exceeded its SLA deadline.</p>
<p><strong>Document Type:</strong> {{entityType}}</p>
<p><strong>Document ID:</strong> {{entityId}}</p>
<p><strong>Was Due:</strong> {{slaDueDate}}</p>
<p>Immediate action is required.</p>
<p style="color:#888;font-size:12px">This is an automated notification from NIT Logistics.</p>`,
    variables: ['entityType', 'entityId', 'slaDueDate'],
  },
  {
    code: 'low_stock_alert',
    name: 'Low Stock Alert',
    subject: '[NIT] Low Stock Alert: {{itemName}}',
    bodyHtml: `<h2>📦 Low Stock Alert</h2>
<p>An item has fallen below its reorder point.</p>
<p><strong>Item:</strong> {{itemName}}</p>
<p><strong>Current Quantity:</strong> {{currentQty}}</p>
<p><strong>Reorder Point:</strong> {{reorderPoint}}</p>
<p><strong>Warehouse:</strong> {{warehouseName}}</p>
<p>Please initiate a purchase order or stock transfer.</p>
<p style="color:#888;font-size:12px">This is an automated notification from NIT Logistics.</p>`,
    variables: ['itemName', 'currentQty', 'reorderPoint', 'warehouseName'],
  },
  {
    code: 'password_reset',
    name: 'Password Reset',
    subject: '[NIT] Password Reset Code',
    bodyHtml: `<h2>Password Reset</h2>
<p>You requested a password reset for your NIT Logistics account.</p>
<p>Your reset code is: <strong style="font-size:24px;letter-spacing:4px">{{code}}</strong></p>
<p>This code expires in 15 minutes.</p>
<p>If you did not request this reset, please ignore this email.</p>
<p style="color:#888;font-size:12px">This is an automated notification from NIT Logistics.</p>`,
    variables: ['code', 'email'],
  },
  {
    code: 'jo_assigned',
    name: 'Job Order Assigned',
    subject: '[NIT] Job Order Assigned: {{joNumber}}',
    bodyHtml: `<h2>Job Order Assigned</h2>
<p>A job order has been assigned.</p>
<p><strong>JO Number:</strong> {{joNumber}}</p>
<p><strong>Type:</strong> {{joType}}</p>
<p><strong>Project:</strong> {{projectName}}</p>
{{#if supplierName}}<p><strong>Supplier:</strong> {{supplierName}}</p>{{/if}}
<p>Please review and begin work at your earliest convenience.</p>
<p style="color:#888;font-size:12px">This is an automated notification from NIT Logistics.</p>`,
    variables: ['joNumber', 'joType', 'projectName', 'supplierName', 'entityId'],
  },
  {
    code: 'jo_completed',
    name: 'Job Order Completed',
    subject: '[NIT] Job Order Completed: {{joNumber}}',
    bodyHtml: `<h2>Job Order Completed</h2>
<p>A job order has been marked as completed.</p>
<p><strong>JO Number:</strong> {{joNumber}}</p>
<p><strong>Type:</strong> {{joType}}</p>
<p><strong>Project:</strong> {{projectName}}</p>
<p>The job order is now ready for invoicing.</p>
<p style="color:#888;font-size:12px">This is an automated notification from NIT Logistics.</p>`,
    variables: ['joNumber', 'joType', 'projectName', 'entityId'],
  },
];

const DEFAULT_WORKFLOWS = [
  {
    name: 'Approval Email Notifications',
    description: 'Send email notifications when approvals are requested, approved, or rejected',
    entityType: '*',
    rules: [
      {
        name: 'Email approver on approval request',
        triggerEvent: 'approval:requested',
        conditions: {},
        actions: [
          {
            type: 'send_email',
            params: { templateCode: 'approval_requested', to: 'role:manager' },
          },
        ],
      },
      {
        name: 'Email submitter on approval',
        triggerEvent: 'approval:approved',
        conditions: {},
        actions: [
          {
            type: 'send_email',
            params: { templateCode: 'approval_approved', to: 'role:logistics_coordinator' },
          },
        ],
      },
      {
        name: 'Email submitter on rejection',
        triggerEvent: 'approval:rejected',
        conditions: {},
        actions: [
          {
            type: 'send_email',
            params: { templateCode: 'approval_rejected', to: 'role:logistics_coordinator' },
          },
        ],
      },
    ],
  },
  {
    name: 'SLA Alert System',
    description: 'Send notifications when SLA deadlines are at risk or breached',
    entityType: '*',
    rules: [
      {
        name: 'SLA at risk notification',
        triggerEvent: 'sla:at_risk',
        conditions: {},
        actions: [
          {
            type: 'send_email',
            params: { templateCode: 'sla_at_risk', to: 'role:manager' },
          },
          {
            type: 'create_notification',
            params: { title: 'SLA At Risk', recipientRole: 'manager', notificationType: 'sla_warning' },
          },
        ],
      },
    ],
  },
  {
    name: 'Low Stock Alerts',
    description: 'Notify warehouse supervisors when stock falls below reorder point',
    entityType: '*',
    rules: [
      {
        name: 'Low stock email + notification',
        triggerEvent: 'inventory:low_stock',
        conditions: {},
        actions: [
          {
            type: 'send_email',
            params: { templateCode: 'low_stock_alert', to: 'role:warehouse_supervisor' },
          },
          {
            type: 'create_notification',
            params: { title: 'Low Stock Alert', recipientRole: 'warehouse_supervisor', notificationType: 'low_stock' },
          },
        ],
      },
    ],
  },
];

async function main() {
  console.log('Seeding email templates...');

  for (const tmpl of EMAIL_TEMPLATES) {
    await prisma.emailTemplate.upsert({
      where: { code: tmpl.code },
      create: { ...tmpl, variables: tmpl.variables },
      update: { name: tmpl.name, subject: tmpl.subject, bodyHtml: tmpl.bodyHtml, variables: tmpl.variables },
    });
    console.log(`  ✓ ${tmpl.code}`);
  }

  console.log('\nSeeding default workflows...');

  for (const wf of DEFAULT_WORKFLOWS) {
    const existing = await prisma.workflow.findFirst({ where: { name: wf.name } });
    if (existing) {
      console.log(`  ⊘ ${wf.name} (already exists)`);
      continue;
    }

    const workflow = await prisma.workflow.create({
      data: {
        name: wf.name,
        description: wf.description,
        entityType: wf.entityType,
      },
    });

    for (const rule of wf.rules) {
      await prisma.workflowRule.create({
        data: {
          workflowId: workflow.id,
          name: rule.name,
          triggerEvent: rule.triggerEvent,
          conditions: rule.conditions,
          actions: rule.actions,
        },
      });
    }

    console.log(`  ✓ ${wf.name} (${wf.rules.length} rules)`);
  }

  console.log('\nDone!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
