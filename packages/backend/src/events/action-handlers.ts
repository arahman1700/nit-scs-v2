import { prisma } from '../utils/prisma.js';
import { canTransition } from '@nit-scs-v2/shared';
import { log } from '../config/logger.js';
import { sendTemplatedEmail } from '../services/email.service.js';
import { reserveStock } from '../services/inventory.service.js';
import { generateDocumentNumber } from '../services/document-number.service.js';
import type { SystemEvent } from './event-bus.js';

// ── Action Registry ─────────────────────────────────────────────────────

type ActionHandler = (params: Record<string, unknown>, event: SystemEvent) => Promise<void>;

const handlers: Record<string, ActionHandler> = {
  send_email: handleSendEmail,
  create_notification: handleCreateNotification,
  change_status: handleChangeStatus,
  create_follow_up: handleCreateFollowUp,
  reserve_stock: handleReserveStock,
  assign_task: handleAssignTask,
  webhook: handleWebhook,
  conditional_branch: handleConditionalBranch,
};

/**
 * Execute a named action with params in the context of a system event.
 */
export async function executeActions(
  actionType: string,
  params: Record<string, unknown>,
  event: SystemEvent,
): Promise<void> {
  const handler = handlers[actionType];
  if (!handler) {
    throw new Error(`Unknown action type: ${actionType}`);
  }
  await handler(params, event);
}

// ── Individual Handlers ─────────────────────────────────────────────────

/**
 * Send an email using a template.
 * Params: { templateCode, to, variables?, referenceTable?, referenceId? }
 * `to` can be a direct email or "role:manager" to send to all users with that role.
 *
 * NOTE: The actual email sending is implemented in Phase C (email.service.ts).
 * This handler creates a queued EmailLog entry that the email service processes.
 */
async function handleSendEmail(params: Record<string, unknown>, event: SystemEvent): Promise<void> {
  const templateCode = params.templateCode as string;
  const to = params.to as string;

  if (!templateCode || !to) {
    throw new Error('send_email requires templateCode and to');
  }

  // Build template variables from event payload
  const variables = {
    ...event.payload,
    entityType: event.entityType,
    entityId: event.entityId,
    action: event.action,
    timestamp: event.timestamp,
    ...((params.variables as Record<string, unknown>) || {}),
  };

  await sendTemplatedEmail({
    templateCode,
    to,
    variables,
    referenceTable: (params.referenceTable as string) || event.entityType,
    referenceId: (params.referenceId as string) || event.entityId,
  });

  log('info', `[Action:send_email] Sent email using template '${templateCode}' to '${to}'`);
}

/**
 * Create a notification + push via Socket.IO.
 * Params: { title, body?, recipientRole?, recipientId?, notificationType? }
 */
async function handleCreateNotification(params: Record<string, unknown>, event: SystemEvent): Promise<void> {
  const title = (params.title as string) || `${event.entityType} ${event.action}`;
  const body = params.body as string | undefined;
  const notificationType = (params.notificationType as string) || 'workflow';
  const recipientRole = params.recipientRole as string | undefined;
  const recipientId = params.recipientId as string | undefined;

  let recipients: { id: string }[] = [];

  if (recipientId) {
    recipients = [{ id: recipientId }];
  } else if (recipientRole) {
    recipients = await prisma.employee.findMany({
      where: { systemRole: recipientRole, isActive: true },
      select: { id: true },
    });
  }

  // Create DB notifications — Socket.IO push is handled by notification service subscribers
  for (const recipient of recipients) {
    await prisma.notification.create({
      data: {
        recipientId: recipient.id,
        title,
        body,
        notificationType,
        referenceTable: event.entityType,
        referenceId: event.entityId,
      },
    });
  }

  log('info', `[Action:create_notification] Created ${recipients.length} notification(s)`);
}

/**
 * Transition a document to a new status.
 * Params: { targetStatus }
 */
async function handleChangeStatus(params: Record<string, unknown>, event: SystemEvent): Promise<void> {
  const targetStatus = params.targetStatus as string;
  if (!targetStatus) {
    throw new Error('change_status requires targetStatus');
  }

  // Get current status from event payload
  const currentStatus =
    ((event.payload.newValues as Record<string, unknown> | undefined)?.status as string) ||
    ((event.payload as Record<string, unknown>).status as string);

  if (currentStatus && !canTransition(event.entityType, currentStatus, targetStatus)) {
    throw new Error(`Cannot transition ${event.entityType} from '${currentStatus}' to '${targetStatus}'`);
  }

  // Dynamic Prisma model access
  const modelMap: Record<string, string> = {
    mrrv: 'mrrv',
    mirv: 'mirv',
    mrv: 'mrv',
    rfim: 'rfim',
    osd: 'osdReport',
    jo: 'jobOrder',
    gate_pass: 'gatePass',
    stock_transfer: 'stockTransfer',
    mrf: 'materialRequisition',
    shipment: 'shipment',
  };

  const modelName = modelMap[event.entityType];
  if (!modelName) {
    throw new Error(`Unknown entity type for status change: ${event.entityType}`);
  }

  const delegate = (prisma as unknown as Record<string, { update: (args: unknown) => Promise<unknown> }>)[modelName];
  await delegate.update({
    where: { id: event.entityId },
    data: { status: targetStatus },
  });

  log('info', `[Action:change_status] ${event.entityType}:${event.entityId} → ${targetStatus}`);
}

/**
 * Create a follow-up document automatically.
 * Params: { targetDocType, copyFields? }
 *
 * Supported chains:
 *   mrrv → qci (rfim)     — GRN stored → create QCI for inspection
 *   rfim → dr (osdReport)  — QCI failed → create Discrepancy Report
 *   mirv → gate_pass       — MI issued → create Gate Pass
 *   imsf → wt (stockTransfer) — IMSF confirmed → create Warehouse Transfer
 *   mrrv → dr (osdReport)  — GRN with damage → create DR
 */
async function handleCreateFollowUp(params: Record<string, unknown>, event: SystemEvent): Promise<void> {
  const targetDocType = params.targetDocType as string;
  if (!targetDocType) {
    throw new Error('create_follow_up requires targetDocType');
  }

  const sourceId = event.entityId;
  const userId = event.performedById;

  try {
    switch (`${event.entityType}→${targetDocType}`) {
      // GRN → QCI
      case 'mrrv→qci':
      case 'mrrv→rfim': {
        const grn = await prisma.mrrv.findUnique({ where: { id: sourceId } });
        if (!grn) throw new Error(`Source GRN ${sourceId} not found`);
        const qciNumber = await generateDocumentNumber('qci');
        const qci = await prisma.rfim.create({
          data: {
            rfimNumber: qciNumber,
            mrrvId: grn.id,
            requestDate: new Date(),
            status: 'pending',
            comments: `Auto-created from GRN ${grn.mrrvNumber} via workflow rule`,
          } as any,
        });
        log('info', `[Action:create_follow_up] Created QCI ${qci.id} from GRN ${sourceId}`);
        break;
      }

      // QCI → DR
      case 'rfim→dr':
      case 'rfim→osd': {
        const qci = await prisma.rfim.findUnique({ where: { id: sourceId } });
        if (!qci) throw new Error(`Source QCI ${sourceId} not found`);
        if (!qci.mrrvId) throw new Error(`QCI ${sourceId} has no parent GRN`);
        // Check if DR already exists for this GRN
        const existingDr = await prisma.osdReport.findFirst({ where: { mrrvId: qci.mrrvId } });
        if (existingDr) {
          log('info', `[Action:create_follow_up] DR already exists for GRN ${qci.mrrvId}, skipping`);
          break;
        }
        const drNumber = await generateDocumentNumber('dr');
        const dr = await prisma.osdReport.create({
          data: {
            osdNumber: drNumber,
            mrrvId: qci.mrrvId,
            reportDate: new Date(),
            reportTypes: ['quality_failure'],
            status: 'draft',
          },
        });
        log('info', `[Action:create_follow_up] Created DR ${dr.id} from QCI ${sourceId}`);
        break;
      }

      // MI → GatePass
      case 'mirv→gate_pass': {
        const mi = await prisma.mirv.findUnique({
          where: { id: sourceId },
          include: { mirvLines: { include: { item: { select: { uomId: true } } } } },
        });
        if (!mi) throw new Error(`Source MI ${sourceId} not found`);
        const gpNumber = await generateDocumentNumber('gate_pass');
        const gp = await prisma.gatePass.create({
          data: {
            gatePassNumber: gpNumber,
            passType: 'outbound',
            mirvId: mi.id,
            projectId: mi.projectId,
            warehouseId: mi.warehouseId,
            vehicleNumber: 'TBD',
            driverName: 'TBD',
            destination: 'Project Site',
            issueDate: new Date(),
            status: 'draft',
            gatePassItems: {
              create: mi.mirvLines.map(line => ({
                itemId: line.itemId,
                quantity: line.qtyIssued ?? line.qtyRequested,
                uomId: line.item.uomId,
              })),
            },
          },
        });
        log('info', `[Action:create_follow_up] Created GatePass ${gp.id} from MI ${sourceId}`);
        break;
      }

      // IMSF → WT (Stock Transfer)
      case 'imsf→wt':
      case 'imsf→stock_transfer': {
        const imsf = await prisma.imsf.findUnique({
          where: { id: sourceId },
          include: {
            imsfLines: true,
            senderProject: { select: { id: true, warehouses: { select: { id: true }, take: 1 } } },
            receiverProject: { select: { id: true, warehouses: { select: { id: true }, take: 1 } } },
          },
        });
        if (!imsf) throw new Error(`Source IMSF ${sourceId} not found`);
        const fromWarehouseId = imsf.senderProject?.warehouses[0]?.id;
        const toWarehouseId = imsf.receiverProject?.warehouses[0]?.id;
        if (!fromWarehouseId || !toWarehouseId) {
          throw new Error('Cannot create WT: sender or receiver project has no assigned warehouse');
        }
        const wtNumber = await generateDocumentNumber('wt');
        const wt = await prisma.stockTransfer.create({
          data: {
            transferNumber: wtNumber,
            transferType: 'project_to_project',
            fromWarehouseId,
            toWarehouseId,
            fromProjectId: imsf.senderProjectId,
            toProjectId: imsf.receiverProjectId,
            requestedById: userId ?? imsf.createdById,
            transferDate: new Date(),
            status: 'draft',
            notes: `Auto-created from IMSF ${imsf.imsfNumber} via workflow rule`,
            stockTransferLines: {
              create: imsf.imsfLines.map(line => ({
                itemId: line.itemId,
                quantity: line.qty,
                uomId: line.uomId,
              })),
            },
          },
        });
        log('info', `[Action:create_follow_up] Created WT ${wt.id} from IMSF ${sourceId}`);
        break;
      }

      // GRN → DR (for damaged goods)
      case 'mrrv→dr':
      case 'mrrv→osd': {
        const grn = await prisma.mrrv.findUnique({ where: { id: sourceId } });
        if (!grn) throw new Error(`Source GRN ${sourceId} not found`);
        const existingDr = await prisma.osdReport.findFirst({ where: { mrrvId: sourceId } });
        if (existingDr) {
          log('info', `[Action:create_follow_up] DR already exists for GRN ${sourceId}, skipping`);
          break;
        }
        const drNumber = await generateDocumentNumber('dr');
        const dr = await prisma.osdReport.create({
          data: {
            osdNumber: drNumber,
            mrrvId: grn.id,
            reportDate: new Date(),
            reportTypes: ['damage'],
            status: 'draft',
          },
        });
        log('info', `[Action:create_follow_up] Created DR ${dr.id} from GRN ${sourceId}`);
        break;
      }

      default:
        log(
          'warn',
          `[Action:create_follow_up] Unsupported chain: ${event.entityType}→${targetDocType}. ` +
            `Supported: mrrv→qci, rfim→dr, mirv→gate_pass, imsf→wt, mrrv→dr`,
        );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(
      'error',
      `[Action:create_follow_up] Failed to create ${targetDocType} from ${event.entityType}:${sourceId}: ${msg}`,
    );
    throw err;
  }
}

/**
 * Reserve inventory stock.
 * Params: { items: [{ itemId, warehouseId, quantity }] }
 */
async function handleReserveStock(params: Record<string, unknown>, event: SystemEvent): Promise<void> {
  const items = params.items as Array<{ itemId: string; warehouseId: string; quantity: number }>;
  if (!items || !Array.isArray(items)) {
    throw new Error('reserve_stock requires items array');
  }

  for (const item of items) {
    const success = await reserveStock(item.itemId, item.warehouseId, item.quantity);
    if (!success) {
      log('warn', `[Action:reserve_stock] Insufficient stock for item ${item.itemId} in warehouse ${item.warehouseId}`);
    }
  }

  log('info', `[Action:reserve_stock] Reserved ${items.length} item(s) for ${event.entityType}:${event.entityId}`);
}

/**
 * Create a task record.
 * Params: { title, assigneeRole?, assigneeId?, priority?, dueDate? }
 */
async function handleAssignTask(params: Record<string, unknown>, event: SystemEvent): Promise<void> {
  const title = (params.title as string) || `Follow up on ${event.entityType} ${event.entityId}`;
  const priority = (params.priority as string) || 'medium';

  let assigneeId = params.assigneeId as string | undefined;

  // If no specific assignee, find one by role
  if (!assigneeId && params.assigneeRole) {
    const employee = await prisma.employee.findFirst({
      where: { systemRole: params.assigneeRole as string, isActive: true },
      select: { id: true },
    });
    assigneeId = employee?.id;
  }

  await prisma.task.create({
    data: {
      title,
      description: `Auto-created by workflow rule for ${event.entityType}:${event.entityId}`,
      status: 'open',
      priority,
      assigneeId,
      creatorId: event.performedById || assigneeId || '',
      dueDate: params.dueDate ? new Date(params.dueDate as string) : undefined,
    },
  });

  log('info', `[Action:assign_task] Created task: "${title}"`);
}

/**
 * Send an HTTP POST webhook.
 * Params: { url, headers?, body? }
 */
async function handleWebhook(params: Record<string, unknown>, event: SystemEvent): Promise<void> {
  const url = params.url as string;
  if (!url) {
    throw new Error('webhook requires url');
  }

  const headers = (params.headers as Record<string, string>) || {};
  const body = params.body || event;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
  }

  log('info', `[Action:webhook] POST ${url} → ${response.status}`);
}

/**
 * Conditional branch: evaluate a condition and execute different actions.
 * Params: { condition: LeafCondition, trueActions: Action[], falseActions: Action[] }
 *
 * Example:
 * {
 *   "type": "conditional_branch",
 *   "params": {
 *     "condition": { "field": "payload.to", "op": "eq", "value": "approved" },
 *     "trueActions": [{ "type": "send_email", "params": {...} }],
 *     "falseActions": [{ "type": "create_notification", "params": {...} }]
 *   }
 * }
 */
async function handleConditionalBranch(params: Record<string, unknown>, event: SystemEvent): Promise<void> {
  const condition = params.condition as { field: string; op: string; value: unknown } | undefined;
  if (!condition) {
    throw new Error('conditional_branch requires a condition');
  }

  // Evaluate condition against event
  const fieldValue = getNestedValue(event as unknown as Record<string, unknown>, condition.field);
  let result = false;

  switch (condition.op) {
    case 'eq':
      result = fieldValue === condition.value || String(fieldValue) === String(condition.value);
      break;
    case 'ne':
      result = fieldValue !== condition.value && String(fieldValue) !== String(condition.value);
      break;
    case 'gt':
      result = Number(fieldValue) > Number(condition.value);
      break;
    case 'gte':
      result = Number(fieldValue) >= Number(condition.value);
      break;
    case 'lt':
      result = Number(fieldValue) < Number(condition.value);
      break;
    case 'lte':
      result = Number(fieldValue) <= Number(condition.value);
      break;
    case 'in':
      result = Array.isArray(condition.value) && condition.value.includes(fieldValue);
      break;
    case 'contains':
      result =
        typeof fieldValue === 'string' &&
        typeof condition.value === 'string' &&
        fieldValue.toLowerCase().includes(condition.value.toLowerCase());
      break;
  }

  const actionsToRun = result
    ? ((params.trueActions as Array<{ type: string; params: Record<string, unknown> }>) ?? [])
    : ((params.falseActions as Array<{ type: string; params: Record<string, unknown> }>) ?? []);

  log(
    'info',
    `[Action:conditional_branch] Condition ${condition.field} ${condition.op} ${JSON.stringify(condition.value)} → ${result} (${actionsToRun.length} actions)`,
  );

  for (const action of actionsToRun) {
    await executeActions(action.type, action.params, event);
  }
}

// ── Helper ──────────────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
