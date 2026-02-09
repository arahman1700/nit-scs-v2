import { prisma } from '../utils/prisma.js';
import { canTransition } from '@nit-scs/shared';
import { log } from '../config/logger.js';
import { sendTemplatedEmail } from '../services/email.service.js';
import { reserveStock } from '../services/inventory.service.js';
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
 */
async function handleCreateFollowUp(params: Record<string, unknown>, event: SystemEvent): Promise<void> {
  const targetDocType = params.targetDocType as string;
  if (!targetDocType) {
    throw new Error('create_follow_up requires targetDocType');
  }

  // This is a placeholder — actual implementation depends on the document creation logic
  // which varies by document type and requires specific field mapping
  log('info', `[Action:create_follow_up] Would create ${targetDocType} from ${event.entityType}:${event.entityId}`);
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
