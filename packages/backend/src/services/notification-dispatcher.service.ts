/**
 * SOW Notification Dispatcher (N-01 through N-14)
 *
 * Subscribes to event bus events and creates targeted notifications for
 * the 15 SOW notification types. Event-driven notifications listen to
 * specific event bus events, while time-based notifications expose helper
 * functions called by the scheduler service.
 *
 * N-01: MI submitted for approval       → approver role (event-driven)
 * N-02: Stock below minimum level        → warehouse_supervisor (event-driven)
 * N-03: Equipment return date approaching → logistics_coordinator (scheduler)
 * N-04: Shipment status change           → shipping_officer, logistics_coordinator (event-driven)
 * N-05: Shipment delayed                 → manager, logistics_coordinator (scheduler)
 * N-06: QC inspection required           → qc_officer (event-driven)
 * N-07: Approval SLA exceeded            → manager (event-driven)
 * N-08: Cycle count scheduled            → inventory_specialist, warehouse_staff (scheduler)
 * N-09: Rate card expiring               → finance_user, manager (scheduler)
 * N-10: Vehicle maintenance due          → transport_supervisor (scheduler)
 * N-11: Unauthorized gate exit attempt   → gate_officer, warehouse_supervisor (event-driven)
 * N-12: NCR/DR deadline approaching      → qc_officer (scheduler)
 * N-13: Contract/insurance renewal due   → manager, finance_user (scheduler)
 * N-14: Overdue tool return              → warehouse_supervisor (scheduler)
 */

import { eventBus, type SystemEvent } from '../events/event-bus.js';
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';
import { sendPushToRole } from './push-notification.service.js';
import { NOTIFICATION_EVENTS } from '@nit-scs-v2/shared';

const LOG_PREFIX = '[NotificationDispatcher]';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Fetch active employee IDs by one or more roles */
async function getRecipientsByRoles(roles: string[]): Promise<string[]> {
  const employees = await prisma.employee.findMany({
    where: { systemRole: { in: roles }, isActive: true },
    select: { id: true },
  });
  return employees.map(e => e.id);
}

/** Check for a duplicate notification within the last hour to avoid spam */
async function hasRecentNotification(
  referenceTable: string,
  referenceId: string | null,
  titleFragment: string,
  now: Date,
): Promise<boolean> {
  const existing = await prisma.notification.findFirst({
    where: {
      referenceTable,
      ...(referenceId ? { referenceId } : {}),
      title: { contains: titleFragment },
      createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) },
    },
  });
  return !!existing;
}

/** Create batch notifications for a list of recipient IDs */
async function notifyRecipients(params: {
  recipientIds: string[];
  title: string;
  body: string;
  notificationType: string;
  referenceTable?: string;
  referenceId?: string | null;
}): Promise<void> {
  if (params.recipientIds.length === 0) return;

  await prisma.notification.createMany({
    data: params.recipientIds.map(recipientId => ({
      recipientId,
      title: params.title.slice(0, 200),
      body: params.body,
      notificationType: params.notificationType,
      referenceTable: params.referenceTable ?? null,
      referenceId: params.referenceId ?? null,
    })),
  });
}

/** Push notification to roles (fire-and-forget) */
function pushToRoles(roles: string[], title: string, body: string, tag: string, url?: string): void {
  for (const role of roles) {
    sendPushToRole(role, { title, body, url: url ?? '/notifications', tag }).catch(err => {
      log('warn', `${LOG_PREFIX} Push to role ${role} failed: ${(err as Error).message}`);
    });
  }
}

// ── Event-Driven Handlers ──────────────────────────────────────────────────

/**
 * N-01: MI (MIRV) submitted for approval → notify approver role
 * Triggered when a MIRV document status changes to 'pending_approval'.
 */
async function handleMirvApprovalNeeded(event: SystemEvent): Promise<void> {
  if (event.entityType !== 'mirv') return;

  const toStatus = (event.payload.to as string) ?? (event.payload.status as string);
  if (toStatus !== 'pending_approval') return;

  const roles = ['warehouse_supervisor', 'manager'];
  const title = 'MI Requires Approval';
  const body = `Material Issue ${(event.payload.documentNumber as string) ?? event.entityId} has been submitted and requires your approval.`;

  try {
    const recipientIds = await getRecipientsByRoles(roles);
    await notifyRecipients({
      recipientIds,
      title,
      body,
      notificationType: 'mirv_approval',
      referenceTable: 'mirv',
      referenceId: event.entityId,
    });
    pushToRoles(roles, title, body, NOTIFICATION_EVENTS.MIRV_APPROVAL_NEEDED, `/mirv/${event.entityId}`);
    log('info', `${LOG_PREFIX} N-01: Created ${recipientIds.length} MIRV approval notification(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-01 failed: ${(err as Error).message}`);
  }
}

/**
 * N-02: Stock below minimum level → notify warehouse_supervisor
 * Triggered by inventory:low_stock events.
 */
async function handleLowStockNotification(event: SystemEvent): Promise<void> {
  const roles = ['warehouse_supervisor'];
  const title = (event.payload.title as string) ?? 'Low Stock Alert';
  const body = (event.payload.body as string) ?? 'An item has fallen below its minimum stock level.';

  try {
    const recipientIds = await getRecipientsByRoles(roles);
    await notifyRecipients({
      recipientIds,
      title,
      body,
      notificationType: 'low_stock_sow',
      referenceTable: 'inventory_levels',
      referenceId: null,
    });
    pushToRoles(roles, title, body, NOTIFICATION_EVENTS.LOW_STOCK_ALERT);
    log('info', `${LOG_PREFIX} N-02: Created ${recipientIds.length} low-stock notification(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-02 failed: ${(err as Error).message}`);
  }
}

/**
 * N-04: Shipment status change → notify shipping_officer, logistics_coordinator
 * Triggered when a shipment document status changes.
 */
async function handleShipmentStatusChange(event: SystemEvent): Promise<void> {
  if (event.entityType !== 'shipment') return;

  const toStatus = (event.payload.to as string) ?? (event.payload.status as string);
  if (!toStatus) return;

  const roles = ['shipping_officer', 'logistics_coordinator'];
  const title = `Shipment Status: ${toStatus.replace(/_/g, ' ')}`;
  const body = `Shipment ${(event.payload.documentNumber as string) ?? event.entityId} status changed to ${toStatus.replace(/_/g, ' ')}.`;

  try {
    const recipientIds = await getRecipientsByRoles(roles);
    await notifyRecipients({
      recipientIds,
      title,
      body,
      notificationType: 'shipment_status',
      referenceTable: 'shipment',
      referenceId: event.entityId,
    });
    pushToRoles(roles, title, body, NOTIFICATION_EVENTS.SHIPMENT_STATUS_CHANGE, `/shipments/${event.entityId}`);
    log('info', `${LOG_PREFIX} N-04: Created ${recipientIds.length} shipment status notification(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-04 failed: ${(err as Error).message}`);
  }
}

/**
 * N-06: QC inspection required → notify qc_officer
 * Triggered when a MRRV/GRN status changes to 'pending_qc'.
 */
async function handleQcInspectionRequired(event: SystemEvent): Promise<void> {
  if (event.entityType !== 'mrrv') return;

  const toStatus = (event.payload.to as string) ?? (event.payload.status as string);
  if (toStatus !== 'pending_qc') return;

  const roles = ['qc_officer'];
  const title = 'QC Inspection Required';
  const body = `GRN ${(event.payload.documentNumber as string) ?? event.entityId} requires quality control inspection.`;

  try {
    const recipientIds = await getRecipientsByRoles(roles);
    await notifyRecipients({
      recipientIds,
      title,
      body,
      notificationType: 'qc_inspection',
      referenceTable: 'mrrv',
      referenceId: event.entityId,
    });
    pushToRoles(roles, title, body, NOTIFICATION_EVENTS.QC_INSPECTION_REQUIRED, `/mrrv/${event.entityId}`);
    log('info', `${LOG_PREFIX} N-06: Created ${recipientIds.length} QC inspection notification(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-06 failed: ${(err as Error).message}`);
  }
}

/**
 * N-07: Approval SLA exceeded → notify manager
 * Triggered by sla:breached events.
 */
async function handleApprovalSlaExceeded(event: SystemEvent): Promise<void> {
  const roles = ['manager'];
  const title = `SLA Breached: ${event.entityType.toUpperCase()}`;
  const body = `${event.entityType.toUpperCase()} ${(event.payload.documentNumber as string) ?? event.entityId} has exceeded its approval SLA deadline.`;

  try {
    const recipientIds = await getRecipientsByRoles(roles);
    await notifyRecipients({
      recipientIds,
      title,
      body,
      notificationType: 'approval_sla',
      referenceTable: event.entityType,
      referenceId: event.entityId,
    });
    pushToRoles(roles, title, body, NOTIFICATION_EVENTS.APPROVAL_SLA_EXCEEDED);
    log('info', `${LOG_PREFIX} N-07: Created ${recipientIds.length} SLA breach notification(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-07 failed: ${(err as Error).message}`);
  }
}

/**
 * N-11: Unauthorized gate exit attempt → notify gate_officer, warehouse_supervisor
 * Listens on wildcard for gate-related events with action 'unauthorized_exit'.
 */
async function handleUnauthorizedGateExit(event: SystemEvent): Promise<void> {
  const roles = ['gate_officer', 'warehouse_supervisor'];
  const title = 'Unauthorized Gate Exit Attempt';
  const body = `An unauthorized exit attempt was detected at the gate. Gate pass: ${(event.payload.documentNumber as string) ?? event.entityId}.`;

  try {
    const recipientIds = await getRecipientsByRoles(roles);
    await notifyRecipients({
      recipientIds,
      title,
      body,
      notificationType: 'unauthorized_exit',
      referenceTable: event.entityType,
      referenceId: event.entityId,
    });
    pushToRoles(roles, title, body, NOTIFICATION_EVENTS.UNAUTHORIZED_GATE_EXIT);
    log('info', `${LOG_PREFIX} N-11: Created ${recipientIds.length} unauthorized exit notification(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-11 failed: ${(err as Error).message}`);
  }
}

// ── Scheduler-Callable Helpers (Time-Based Notifications) ──────────────────

/**
 * N-03: Equipment return date approaching → notify logistics_coordinator
 * Checks rental contracts with return dates within the next 7 days.
 */
export async function checkEquipmentReturnDue(): Promise<void> {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const dueSoon = await prisma.rentalContract.findMany({
      where: {
        status: 'active',
        endDate: { lte: sevenDaysFromNow, gte: now },
      },
      select: { id: true, contractNumber: true, endDate: true },
    });

    if (dueSoon.length === 0) return;

    const roles = ['logistics_coordinator'];
    const recipientIds = await getRecipientsByRoles(roles);
    if (recipientIds.length === 0) return;

    for (const contract of dueSoon) {
      const skip = await hasRecentNotification('rental_contract', contract.id, 'Equipment Return Due', now);
      if (skip) continue;

      const daysLeft = Math.ceil((contract.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const title = 'Equipment Return Due';
      const body = `Rental contract ${contract.contractNumber} equipment return is due in ${daysLeft} day(s).`;

      await notifyRecipients({
        recipientIds,
        title,
        body,
        notificationType: 'equipment_return',
        referenceTable: 'rental_contract',
        referenceId: contract.id,
      });
    }

    pushToRoles(
      roles,
      'Equipment Return Due',
      `${dueSoon.length} rental contract(s) have upcoming return dates.`,
      NOTIFICATION_EVENTS.EQUIPMENT_RETURN_DUE,
    );
    log('info', `${LOG_PREFIX} N-03: Checked ${dueSoon.length} upcoming equipment return(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-03 failed: ${(err as Error).message}`);
  }
}

/**
 * N-05: Shipment delayed → notify manager, logistics_coordinator
 * Checks shipments that are in_transit and past their estimated arrival date.
 */
export async function checkShipmentDelays(): Promise<void> {
  try {
    const now = new Date();

    const delayed = await prisma.shipment.findMany({
      where: {
        status: { in: ['in_transit', 'at_port', 'customs_clearing'] },
        etaPort: { lt: now },
      },
      select: { id: true, shipmentNumber: true, etaPort: true },
    });

    if (delayed.length === 0) return;

    const roles = ['manager', 'logistics_coordinator'];
    const recipientIds = await getRecipientsByRoles(roles);
    if (recipientIds.length === 0) return;

    for (const shipment of delayed) {
      const skip = await hasRecentNotification('shipment', shipment.id, 'Shipment Delayed', now);
      if (skip) continue;

      const daysLate = Math.ceil((now.getTime() - shipment.etaPort!.getTime()) / (24 * 60 * 60 * 1000));
      const title = 'Shipment Delayed';
      const body = `Shipment ${shipment.shipmentNumber} is ${daysLate} day(s) past its estimated arrival date.`;

      await notifyRecipients({
        recipientIds,
        title,
        body,
        notificationType: 'shipment_delayed',
        referenceTable: 'shipment',
        referenceId: shipment.id,
      });
    }

    pushToRoles(
      roles,
      'Shipment Delays Detected',
      `${delayed.length} shipment(s) are past their ETA.`,
      NOTIFICATION_EVENTS.SHIPMENT_DELAYED,
    );
    log('info', `${LOG_PREFIX} N-05: Found ${delayed.length} delayed shipment(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-05 failed: ${(err as Error).message}`);
  }
}

/**
 * N-08: Cycle count scheduled → notify inventory_specialist, warehouse_staff
 * Checks cycle counts scheduled for today or tomorrow.
 */
export async function checkScheduledCycleCounts(): Promise<void> {
  try {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const upcoming = await prisma.cycleCount.findMany({
      where: {
        status: 'scheduled',
        scheduledDate: { lte: tomorrow, gte: now },
      },
      select: { id: true, countNumber: true, scheduledDate: true },
    });

    if (upcoming.length === 0) return;

    const roles = ['inventory_specialist', 'warehouse_staff'];
    const recipientIds = await getRecipientsByRoles(roles);
    if (recipientIds.length === 0) return;

    for (const cc of upcoming) {
      const skip = await hasRecentNotification('cycle_count', cc.id, 'Cycle Count Scheduled', now);
      if (skip) continue;

      const title = 'Cycle Count Scheduled';
      const body = `Cycle count ${cc.countNumber} is scheduled for ${cc.scheduledDate.toLocaleDateString()}.`;

      await notifyRecipients({
        recipientIds,
        title,
        body,
        notificationType: 'cycle_count',
        referenceTable: 'cycle_count',
        referenceId: cc.id,
      });
    }

    pushToRoles(
      roles,
      'Cycle Count Reminder',
      `${upcoming.length} cycle count(s) are scheduled soon.`,
      NOTIFICATION_EVENTS.CYCLE_COUNT_SCHEDULED,
    );
    log('info', `${LOG_PREFIX} N-08: Found ${upcoming.length} upcoming cycle count(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-08 failed: ${(err as Error).message}`);
  }
}

/**
 * N-09: Rate card expiring → notify finance_user, manager
 * Checks supplier equipment rate cards with validity end dates within the next 30 days.
 */
export async function checkRateCardExpiry(): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiring = await prisma.supplierEquipmentRate.findMany({
      where: {
        validUntil: { lte: thirtyDaysFromNow, gte: now },
      },
      select: {
        id: true,
        validUntil: true,
        supplier: { select: { supplierName: true } },
        equipmentType: { select: { typeName: true } },
      },
    });

    if (expiring.length === 0) return;

    const roles = ['finance_user', 'manager'];
    const recipientIds = await getRecipientsByRoles(roles);
    if (recipientIds.length === 0) return;

    for (const rc of expiring) {
      const skip = await hasRecentNotification('supplier_equipment_rates', rc.id, 'Rate Card Expiring', now);
      if (skip) continue;

      const daysLeft = Math.ceil((rc.validUntil!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const label = `${rc.supplier.supplierName} - ${rc.equipmentType.typeName}`;
      const title = 'Rate Card Expiring';
      const body = `Rate card "${label}" expires in ${daysLeft} day(s).`;

      await notifyRecipients({
        recipientIds,
        title,
        body,
        notificationType: 'rate_card_expiry',
        referenceTable: 'supplier_equipment_rates',
        referenceId: rc.id,
      });
    }

    pushToRoles(
      roles,
      'Rate Card Expiry Warning',
      `${expiring.length} rate card(s) are expiring soon.`,
      NOTIFICATION_EVENTS.RATE_CARD_EXPIRING,
    );
    log('info', `${LOG_PREFIX} N-09: Found ${expiring.length} expiring rate card(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-09 failed: ${(err as Error).message}`);
  }
}

/**
 * N-10: Vehicle maintenance due → notify transport_supervisor
 * Checks generator maintenance records that are overdue or due soon.
 */
export async function checkVehicleMaintenanceDue(): Promise<void> {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const dueSoon = await prisma.generatorMaintenance.findMany({
      where: {
        status: { in: ['scheduled', 'overdue'] },
        scheduledDate: { lte: sevenDaysFromNow },
      },
      select: {
        id: true,
        maintenanceType: true,
        scheduledDate: true,
        status: true,
        generator: { select: { generatorName: true } },
      },
    });

    if (dueSoon.length === 0) return;

    const roles = ['transport_supervisor'];
    const recipientIds = await getRecipientsByRoles(roles);
    if (recipientIds.length === 0) return;

    for (const maint of dueSoon) {
      const skip = await hasRecentNotification('generator_maintenance', maint.id, 'Vehicle Maintenance', now);
      if (skip) continue;

      const isOverdue = maint.status === 'overdue' || maint.scheduledDate < now;
      const title = isOverdue ? 'Vehicle Maintenance Overdue' : 'Vehicle Maintenance Due';
      const label = `${maint.maintenanceType} for ${maint.generator.generatorName}`;
      const body = `Maintenance (${label}) is ${isOverdue ? 'overdue' : 'due soon'} (scheduled: ${maint.scheduledDate.toLocaleDateString()}).`;

      await notifyRecipients({
        recipientIds,
        title,
        body,
        notificationType: 'vehicle_maintenance',
        referenceTable: 'generator_maintenance',
        referenceId: maint.id,
      });
    }

    pushToRoles(
      roles,
      'Vehicle Maintenance Reminder',
      `${dueSoon.length} maintenance task(s) due or overdue.`,
      NOTIFICATION_EVENTS.VEHICLE_MAINTENANCE_DUE,
    );
    log('info', `${LOG_PREFIX} N-10: Found ${dueSoon.length} maintenance task(s) due`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-10 failed: ${(err as Error).message}`);
  }
}

/**
 * N-12: NCR/DR deadline approaching → notify qc_officer
 * Checks Discrepancy Reports (OSD/DR) that have been open for a long time.
 */
export async function checkNcrDeadlines(): Promise<void> {
  try {
    const now = new Date();
    // DR open for more than 14 days without resolution is approaching deadline
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const approaching = await prisma.osdReport.findMany({
      where: {
        status: { in: ['draft', 'under_review', 'claim_sent', 'awaiting_response', 'negotiating'] },
        createdAt: { lte: fourteenDaysAgo },
      },
      select: { id: true, osdNumber: true, createdAt: true },
    });

    if (approaching.length === 0) return;

    const roles = ['qc_officer'];
    const recipientIds = await getRecipientsByRoles(roles);
    if (recipientIds.length === 0) return;

    for (const dr of approaching) {
      const skip = await hasRecentNotification('osd', dr.id, 'NCR Deadline', now);
      if (skip) continue;

      const daysOpen = Math.ceil((now.getTime() - dr.createdAt.getTime()) / (24 * 60 * 60 * 1000));
      const title = 'NCR Deadline Approaching';
      const body = `Discrepancy Report ${dr.osdNumber} has been open for ${daysOpen} days and requires resolution.`;

      await notifyRecipients({
        recipientIds,
        title,
        body,
        notificationType: 'ncr_deadline',
        referenceTable: 'osd',
        referenceId: dr.id,
      });
    }

    pushToRoles(
      roles,
      'NCR Deadline Warning',
      `${approaching.length} DR(s) approaching resolution deadline.`,
      NOTIFICATION_EVENTS.NCR_DEADLINE_APPROACHING,
    );
    log('info', `${LOG_PREFIX} N-12: Found ${approaching.length} DR(s) approaching deadline`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-12 failed: ${(err as Error).message}`);
  }
}

/**
 * N-13: Contract/insurance renewal due → notify manager, finance_user
 * Checks rental contracts expiring within the next 30 days.
 */
export async function checkContractRenewals(): Promise<void> {
  try {
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiring = await prisma.rentalContract.findMany({
      where: {
        status: { in: ['active', 'extended'] },
        endDate: { lte: thirtyDaysFromNow, gte: now },
      },
      select: { id: true, contractNumber: true, endDate: true },
    });

    if (expiring.length === 0) return;

    const roles = ['manager', 'finance_user'];
    const recipientIds = await getRecipientsByRoles(roles);
    if (recipientIds.length === 0) return;

    for (const contract of expiring) {
      const skip = await hasRecentNotification('rental_contract', contract.id, 'Contract Renewal Due', now);
      if (skip) continue;

      const daysLeft = Math.ceil((contract.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      const title = 'Contract Renewal Due';
      const body = `Rental contract ${contract.contractNumber} expires in ${daysLeft} day(s) and may need renewal.`;

      await notifyRecipients({
        recipientIds,
        title,
        body,
        notificationType: 'contract_renewal',
        referenceTable: 'rental_contract',
        referenceId: contract.id,
      });
    }

    pushToRoles(
      roles,
      'Contract Renewal Reminder',
      `${expiring.length} contract(s) expiring within 30 days.`,
      NOTIFICATION_EVENTS.CONTRACT_RENEWAL_DUE,
    );
    log('info', `${LOG_PREFIX} N-13: Found ${expiring.length} contract(s) expiring`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-13 failed: ${(err as Error).message}`);
  }
}

/**
 * N-14: Overdue tool return → notify warehouse_supervisor
 * Checks tool issues that are overdue for return.
 */
export async function checkOverdueToolReturns(): Promise<void> {
  try {
    const now = new Date();

    const overdue = await prisma.toolIssue.findMany({
      where: {
        status: { in: ['issued', 'overdue'] },
        expectedReturnDate: { lt: now },
      },
      select: { id: true, expectedReturnDate: true, tool: { select: { toolName: true, toolCode: true } } },
    });

    if (overdue.length === 0) return;

    const roles = ['warehouse_supervisor'];
    const recipientIds = await getRecipientsByRoles(roles);
    if (recipientIds.length === 0) return;

    for (const ti of overdue) {
      const skip = await hasRecentNotification('tool_issue', ti.id, 'Overdue Tool Return', now);
      if (skip) continue;

      const daysOverdue = Math.ceil((now.getTime() - ti.expectedReturnDate!.getTime()) / (24 * 60 * 60 * 1000));
      const title = 'Overdue Tool Return';
      const body = `Tool "${ti.tool.toolName}" (${ti.tool.toolCode}) is ${daysOverdue} day(s) overdue for return.`;

      await notifyRecipients({
        recipientIds,
        title,
        body,
        notificationType: 'overdue_tool',
        referenceTable: 'tool_issue',
        referenceId: ti.id,
      });
    }

    // Also update status to 'overdue' for tools that are still 'issued'
    await prisma.toolIssue.updateMany({
      where: {
        status: 'issued',
        expectedReturnDate: { lt: now },
      },
      data: { status: 'overdue' },
    });

    pushToRoles(
      roles,
      'Overdue Tool Returns',
      `${overdue.length} tool(s) are overdue for return.`,
      NOTIFICATION_EVENTS.OVERDUE_TOOL_RETURN,
    );
    log('info', `${LOG_PREFIX} N-14: Found ${overdue.length} overdue tool return(s)`);
  } catch (err) {
    log('error', `${LOG_PREFIX} N-14 failed: ${(err as Error).message}`);
  }
}

// ── Event Bus Subscriber (document:status_changed dispatcher) ──────────────

/**
 * Main handler for document:status_changed events.
 * Dispatches to N-01, N-04, N-06 based on entity type and target status.
 */
async function handleDocumentStatusChanged(event: SystemEvent): Promise<void> {
  // N-01: MIRV → pending_approval
  await handleMirvApprovalNeeded(event);
  // N-04: Shipment status change
  await handleShipmentStatusChange(event);
  // N-06: GRN/MRRV → pending_qc
  await handleQcInspectionRequired(event);
}

/**
 * Wildcard handler for special event actions not covered by specific event types.
 */
async function handleWildcardEvent(event: SystemEvent): Promise<void> {
  // N-11: Unauthorized gate exit (custom action)
  if (event.action === 'unauthorized_exit') {
    await handleUnauthorizedGateExit(event);
  }

  // Catch status_change events that use action-based pattern (not type-based)
  if (event.type !== 'document:status_changed' && event.action === 'status_change') {
    await handleDocumentStatusChanged(event);
  }
}

// ── Start / Stop ───────────────────────────────────────────────────────────

let started = false;

export function startNotificationDispatcher(): void {
  if (started) return;
  started = true;

  // Event-driven listeners
  eventBus.on('document:status_changed', (event: SystemEvent) => {
    handleDocumentStatusChanged(event).catch(err => {
      log('error', `${LOG_PREFIX} status_changed handler error: ${(err as Error).message}`);
    });
  });

  eventBus.on('inventory:low_stock', (event: SystemEvent) => {
    handleLowStockNotification(event).catch(err => {
      log('error', `${LOG_PREFIX} low_stock handler error: ${(err as Error).message}`);
    });
  });

  eventBus.on('sla:breached', (event: SystemEvent) => {
    handleApprovalSlaExceeded(event).catch(err => {
      log('error', `${LOG_PREFIX} sla:breached handler error: ${(err as Error).message}`);
    });
  });

  // Wildcard for action-based events (N-11 unauthorized exit, fallback status_change)
  eventBus.on('*', (event: SystemEvent) => {
    handleWildcardEvent(event).catch(err => {
      log('error', `${LOG_PREFIX} wildcard handler error: ${(err as Error).message}`);
    });
  });

  log('info', `${LOG_PREFIX} Started — listening for SOW notification events (N-01 through N-14)`);
}

export function stopNotificationDispatcher(): void {
  started = false;
  log('info', `${LOG_PREFIX} Stopped`);
}
