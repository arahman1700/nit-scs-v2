import { STATUS_FLOWS } from '../constants/index.js';

/**
 * Defines which statuses can transition to which for each document type.
 * Keys are document types, values are maps of current_status → allowed next statuses.
 */
const TRANSITION_MAP: Record<string, Record<string, string[]>> = {
  mrrv: {
    draft: ['pending_qc'],
    pending_qc: ['qc_approved', 'rejected'],
    qc_approved: ['received'],
    received: ['stored'],
    rejected: ['draft'],
  },
  mirv: {
    draft: ['pending_approval'],
    pending_approval: ['approved', 'rejected'],
    approved: ['partially_issued', 'issued', 'cancelled'],
    partially_issued: ['issued'],
    issued: ['completed'],
    rejected: ['draft'],
    cancelled: [],
    completed: [],
  },
  mrv: {
    draft: ['pending'],
    pending: ['received', 'rejected'],
    received: ['completed'],
    rejected: ['draft'],
    completed: [],
  },
  rfim: {
    pending: ['in_progress'],
    in_progress: ['completed'],
    completed: [],
  },
  osd: {
    draft: ['under_review'],
    under_review: ['claim_sent', 'resolved'],
    claim_sent: ['awaiting_response'],
    awaiting_response: ['negotiating', 'resolved'],
    negotiating: ['resolved'],
    resolved: ['closed'],
    closed: [],
  },
  jo: {
    draft: ['pending_approval'],
    pending_approval: ['quoted', 'approved', 'rejected'],
    quoted: ['approved', 'rejected'],
    approved: ['assigned', 'cancelled'],
    assigned: ['in_progress'],
    in_progress: ['on_hold', 'completed'],
    on_hold: ['in_progress', 'cancelled'],
    completed: ['invoiced'],
    invoiced: [],
    rejected: ['draft'],
    cancelled: [],
  },
  gate_pass: {
    draft: ['pending'],
    pending: ['approved', 'cancelled'],
    approved: ['released'],
    released: ['returned', 'expired'],
    returned: [],
    expired: [],
    cancelled: [],
  },
  stock_transfer: {
    draft: ['pending'],
    pending: ['approved', 'cancelled'],
    approved: ['shipped'],
    shipped: ['received'],
    received: ['completed'],
    completed: [],
    cancelled: [],
  },
  mrf: {
    draft: ['submitted'],
    submitted: ['under_review', 'rejected'],
    under_review: ['approved', 'rejected'],
    approved: ['checking_stock'],
    checking_stock: ['from_stock', 'needs_purchase'],
    from_stock: ['partially_fulfilled', 'fulfilled'],
    needs_purchase: ['partially_fulfilled', 'fulfilled'],
    partially_fulfilled: ['fulfilled'],
    fulfilled: [],
    rejected: ['draft'],
    cancelled: [],
  },
  shipment: {
    draft: ['po_issued'],
    po_issued: ['in_production'],
    in_production: ['ready_to_ship'],
    ready_to_ship: ['in_transit'],
    in_transit: ['at_port'],
    at_port: ['customs_clearing'],
    customs_clearing: ['cleared'],
    cleared: ['in_delivery'],
    in_delivery: ['delivered'],
    delivered: [],
    cancelled: [],
  },
};

/**
 * Check if a status transition is valid for a given document type.
 */
export function canTransition(docType: string, currentStatus: string, targetStatus: string): boolean {
  const transitions = TRANSITION_MAP[docType];
  if (!transitions) return false;
  const allowed = transitions[currentStatus];
  if (!allowed) return false;
  return allowed.includes(targetStatus);
}

/**
 * Get the list of valid next statuses from a given state.
 */
export function getNextStatuses(docType: string, currentStatus: string): string[] {
  const transitions = TRANSITION_MAP[docType];
  if (!transitions) return [];
  return transitions[currentStatus] || [];
}

/**
 * Get all valid statuses for a document type (from STATUS_FLOWS).
 */
export function getAllStatuses(docType: string): string[] {
  return STATUS_FLOWS[docType] || [];
}

/**
 * Check if a status is a terminal (no further transitions) state.
 */
export function isTerminalStatus(docType: string, status: string): boolean {
  return getNextStatuses(docType, status).length === 0;
}

/**
 * Validate and return the target status, or throw a descriptive error.
 */
export function assertTransition(docType: string, currentStatus: string, targetStatus: string): void {
  if (!canTransition(docType, currentStatus, targetStatus)) {
    const allowed = getNextStatuses(docType, currentStatus);
    throw new Error(
      `Invalid status transition for ${docType}: '${currentStatus}' → '${targetStatus}'. ` +
        `Allowed transitions: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}`,
    );
  }
}

export { TRANSITION_MAP };
