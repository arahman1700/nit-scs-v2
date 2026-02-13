/**
 * Chain Notification Handler
 * Subscribes to document:status_changed events and creates targeted
 * notifications for downstream roles in the supply chain workflow.
 */
import { eventBus, type SystemEvent } from './event-bus.js';
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';
import { sendTemplatedEmail } from '../services/email.service.js';

// ── Notification Rule Definitions ──────────────────────────────────────

interface ChainNotificationRule {
  /** Entity types this rule applies to */
  entityTypes: string[];
  /** Status the document has transitioned TO (from event.payload.to) */
  targetStatus: string | string[];
  /** Who to notify — by systemRole */
  recipientRoles: string[];
  /** Notification title template (supports {docType}, {docNumber}, {status}) */
  titleTemplate: string;
  /** Notification body template */
  bodyTemplate?: string;
  /** Notification type for categorization */
  notificationType: string;
  /** Optional email template code to fire off a templated email */
  emailTemplateCode?: string;
}

const CHAIN_RULES: ChainNotificationRule[] = [
  // GRN stored → notify project manager that materials are available
  {
    entityTypes: ['mrrv'],
    targetStatus: 'stored',
    recipientRoles: ['manager', 'project_manager'],
    titleTemplate: 'GRN Stored — Materials Available',
    bodyTemplate: 'A GRN has been stored. Materials are now available in the warehouse.',
    notificationType: 'chain_update',
    emailTemplateCode: 'document_chain_created',
  },
  // GRN QC approved → notify warehouse supervisor to proceed with storage
  {
    entityTypes: ['mrrv'],
    targetStatus: 'qc_approved',
    recipientRoles: ['warehouse_supervisor'],
    titleTemplate: 'GRN QC Approved — Ready for Storage',
    bodyTemplate: 'Quality inspection passed. Materials can now be stored.',
    notificationType: 'chain_update',
    emailTemplateCode: 'qci_completed',
  },
  // MI approved → notify warehouse staff to prepare materials
  {
    entityTypes: ['mirv'],
    targetStatus: 'approved',
    recipientRoles: ['warehouse_supervisor', 'warehouse_clerk'],
    titleTemplate: 'MI Approved — Prepare Materials for Issue',
    bodyTemplate: 'A Material Issue has been approved. Please prepare items for issuance.',
    notificationType: 'chain_update',
  },
  // MI issued → notify project engineer that materials are on the way
  {
    entityTypes: ['mirv'],
    targetStatus: 'issued',
    recipientRoles: ['manager', 'project_manager'],
    titleTemplate: 'MI Issued — Materials Dispatched',
    bodyTemplate: 'Materials have been issued and dispatched from the warehouse.',
    notificationType: 'chain_update',
  },
  // QCI completed → notify warehouse supervisor of inspection result
  {
    entityTypes: ['rfim'],
    targetStatus: 'completed',
    recipientRoles: ['warehouse_supervisor'],
    titleTemplate: 'QCI Completed — Inspection Result Available',
    bodyTemplate: 'A Quality Control Inspection has been completed. Review the results.',
    notificationType: 'chain_update',
    emailTemplateCode: 'qci_completed',
  },
  // Shipment delivered → notify receiving team
  {
    entityTypes: ['shipment'],
    targetStatus: 'delivered',
    recipientRoles: ['warehouse_supervisor', 'warehouse_clerk'],
    titleTemplate: 'Shipment Delivered — Ready for Receiving',
    bodyTemplate: 'A shipment has been delivered. Please process the goods receipt.',
    notificationType: 'chain_update',
    emailTemplateCode: 'shipment_delivered',
  },
  // Shipment in transit → notify logistics coordinator
  {
    entityTypes: ['shipment'],
    targetStatus: 'in_transit',
    recipientRoles: ['logistics_coordinator'],
    titleTemplate: 'Shipment In Transit',
    bodyTemplate: 'A shipment is now in transit to the destination.',
    notificationType: 'chain_update',
  },
  // Scrap approved → notify SSC committee
  {
    entityTypes: ['scrap_item'],
    targetStatus: 'approved',
    recipientRoles: ['scrap_committee_member', 'admin'],
    titleTemplate: 'Scrap Disposal Approved — Awaiting SSC Review',
    bodyTemplate: 'A scrap item has been approved for disposal. SSC review is required.',
    notificationType: 'chain_update',
  },
  // MRN completed → notify project engineer about returned materials
  {
    entityTypes: ['mrv'],
    targetStatus: 'completed',
    recipientRoles: ['manager', 'warehouse_supervisor'],
    titleTemplate: 'MRN Completed — Materials Returned',
    bodyTemplate: 'A Material Return has been completed and stock has been updated.',
    notificationType: 'chain_update',
    emailTemplateCode: 'mrn_completed',
  },
  // JO approved → notify transport supervisor
  {
    entityTypes: ['jo'],
    targetStatus: 'approved',
    recipientRoles: ['transport_supervisor'],
    titleTemplate: 'Job Order Approved — Schedule Required',
    bodyTemplate: 'A Job Order has been approved. Please schedule the transport.',
    notificationType: 'chain_update',
  },
  // MR submitted → notify warehouse supervisor for fulfillment
  {
    entityTypes: ['mrf'],
    targetStatus: ['submitted', 'pending_approval'],
    recipientRoles: ['warehouse_supervisor'],
    titleTemplate: 'Material Requisition Submitted',
    bodyTemplate: 'A new Material Requisition has been submitted for review.',
    notificationType: 'chain_update',
  },
  // IMSF confirmed → notify receiving warehouse
  {
    entityTypes: ['imsf'],
    targetStatus: 'confirmed',
    recipientRoles: ['warehouse_supervisor'],
    titleTemplate: 'IMSF Confirmed — Inter-Warehouse Transfer Initiated',
    bodyTemplate: 'An internal material shifting form has been confirmed. A warehouse transfer has been created.',
    notificationType: 'chain_update',
    emailTemplateCode: 'warehouse_transfer_created',
  },
];

// ── Event Handler ──────────────────────────────────────────────────────

async function handleDocumentStatusChange(event: SystemEvent): Promise<void> {
  // Only handle status_change events
  if (event.type !== 'document:status_changed' && event.action !== 'status_change') return;

  const toStatus = (event.payload.to as string) ?? (event.payload.status as string);
  if (!toStatus) return;

  // Find matching rules
  const matchingRules = CHAIN_RULES.filter(rule => {
    const entityMatch = rule.entityTypes.includes(event.entityType);
    const statusMatch = Array.isArray(rule.targetStatus)
      ? rule.targetStatus.includes(toStatus)
      : rule.targetStatus === toStatus;
    return entityMatch && statusMatch;
  });

  if (matchingRules.length === 0) return;

  for (const rule of matchingRules) {
    try {
      // Find recipients by role
      const recipients = await prisma.employee.findMany({
        where: {
          systemRole: { in: rule.recipientRoles },
          isActive: true,
        },
        select: { id: true },
      });

      if (recipients.length === 0) {
        log('debug', `[ChainNotification] No active recipients for roles: ${rule.recipientRoles.join(', ')}`);
        continue;
      }

      // Create notifications in batch
      await prisma.notification.createMany({
        data: recipients.map(r => ({
          recipientId: r.id,
          title: rule.titleTemplate,
          body: rule.bodyTemplate,
          notificationType: rule.notificationType,
          referenceTable: event.entityType,
          referenceId: event.entityId,
        })),
      });

      // Fire-and-forget email for rules with templates
      if (rule.emailTemplateCode) {
        const roleRecipients = rule.recipientRoles.map(r => `role:${r}`);
        sendTemplatedEmail({
          templateCode: rule.emailTemplateCode,
          to: roleRecipients,
          variables: {
            documentType: event.entityType,
            documentId: event.entityId,
            status: toStatus,
            documentNumber: (event.payload.documentNumber as string) ?? event.entityId,
          },
          referenceTable: event.entityType,
          referenceId: event.entityId,
        }).catch(err => log('error', `[ChainNotification] Email failed: ${err}`));
      }

      log(
        'info',
        `[ChainNotification] Created ${recipients.length} notification(s) for ${event.entityType}:${event.entityId} → ${toStatus}`,
      );
    } catch (err) {
      log(
        'error',
        `[ChainNotification] Failed to create notifications for ${event.entityType}:${event.entityId}: ${err}`,
      );
    }
  }
}

// ── Start / Stop ───────────────────────────────────────────────────────

let started = false;

export function startChainNotifications(): void {
  if (started) return;
  started = true;
  eventBus.on('document:status_changed', handleDocumentStatusChange);
  // Also listen on wildcard for events that use action: 'status_change' pattern
  eventBus.on('*', (event: SystemEvent) => {
    if (event.type !== 'document:status_changed' && event.action === 'status_change') {
      handleDocumentStatusChange(event).catch(err => {
        log('error', `[ChainNotification] Unhandled error: ${err}`);
      });
    }
  });
  log('info', '[ChainNotification] Started — listening for document status changes');
}

export function stopChainNotifications(): void {
  started = false;
  log('info', '[ChainNotification] Stopped');
}
