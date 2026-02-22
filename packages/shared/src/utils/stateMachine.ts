import { STATUS_FLOWS } from '../constants/index.js';

/**
 * Defines which statuses can transition to which for each document type.
 * Keys are document types, values are maps of current_status → allowed next statuses.
 */
const TRANSITION_MAP: Record<string, Record<string, string[]>> = {
  grn: {
    draft: ['pending_qc'],
    pending_qc: ['qc_approved', 'rejected'],
    qc_approved: ['received'],
    received: ['stored'],
    rejected: ['draft'],
  },
  mi: {
    draft: ['pending_approval'],
    pending_approval: ['approved', 'rejected'],
    approved: ['partially_issued', 'issued', 'cancelled'],
    partially_issued: ['issued'],
    issued: ['completed'],
    rejected: ['draft'],
    cancelled: [],
    completed: [],
  },
  mrn: {
    draft: ['pending'],
    pending: ['received', 'rejected'],
    received: ['completed'],
    rejected: ['draft'],
    completed: [],
  },
  qci: {
    pending: ['in_progress'],
    in_progress: ['completed', 'completed_conditional'],
    completed_conditional: ['completed'], // PM approval upgrades conditional → completed
    completed: [],
  },
  dr: {
    draft: ['under_review'],
    under_review: ['claim_sent', 'resolved'],
    claim_sent: ['awaiting_response'],
    awaiting_response: ['negotiating', 'resolved'],
    negotiating: ['resolved'],
    resolved: ['closed'],
    closed: [],
  },
  mr: {
    draft: ['submitted'],
    submitted: ['under_review', 'rejected'],
    under_review: ['approved', 'rejected'],
    approved: ['checking_stock'],
    checking_stock: ['from_stock', 'needs_purchase', 'not_available_locally'],
    from_stock: ['partially_fulfilled', 'fulfilled'],
    needs_purchase: ['partially_fulfilled', 'fulfilled'],
    not_available_locally: ['partially_fulfilled', 'fulfilled'],
    partially_fulfilled: ['fulfilled'],
    fulfilled: [],
    rejected: ['draft'],
    cancelled: [],
  },
  wt: {
    draft: ['pending'],
    pending: ['approved', 'cancelled'],
    approved: ['shipped'],
    shipped: ['received'],
    received: ['completed'],
    completed: [],
    cancelled: [],
  },
  jo: {
    draft: ['pending_approval'],
    pending_approval: ['quoted', 'approved', 'rejected'],
    quoted: ['approved', 'rejected'],
    approved: ['assigned', 'cancelled'],
    assigned: ['in_progress'],
    in_progress: ['on_hold', 'completed'],
    on_hold: ['in_progress', 'cancelled'],
    completed: ['invoiced', 'closure_pending'],
    closure_pending: ['closure_approved'],
    closure_approved: ['invoiced'],
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
  shipment: {
    draft: ['po_issued', 'cancelled'],
    po_issued: ['in_production', 'cancelled'],
    in_production: ['ready_to_ship', 'cancelled'],
    ready_to_ship: ['in_transit', 'cancelled'],
    in_transit: ['at_port', 'cancelled'],
    at_port: ['customs_clearing', 'cancelled'],
    customs_clearing: ['cleared', 'cancelled'],
    cleared: ['in_delivery', 'delivered', 'cancelled'],
    in_delivery: ['delivered', 'cancelled'],
    delivered: [],
    cancelled: [],
  },
  imsf: {
    created: ['sent'],
    sent: ['confirmed', 'rejected'],
    confirmed: ['in_transit'],
    in_transit: ['delivered'],
    delivered: ['completed'],
    rejected: [],
    completed: [],
  },
  surplus: {
    identified: ['evaluated'],
    evaluated: ['approved', 'rejected'],
    approved: ['actioned'],
    actioned: ['closed'],
    rejected: ['identified'],
    closed: [],
  },
  scrap: {
    identified: ['reported'],
    reported: ['approved', 'rejected'],
    approved: ['in_ssc'],
    in_ssc: ['sold', 'disposed'],
    sold: ['closed'],
    disposed: ['closed'],
    rejected: ['identified'],
    closed: [],
  },
  rental_contract: {
    draft: ['pending_approval'],
    pending_approval: ['active', 'rejected'],
    active: ['extended', 'terminated'],
    extended: ['active', 'terminated'],
    rejected: ['draft'],
    terminated: [],
  },
  tool_issue: {
    issued: ['returned', 'overdue'],
    overdue: ['returned'],
    returned: [],
  },
  generator_maintenance: {
    scheduled: ['in_progress', 'overdue'],
    in_progress: ['completed'],
    overdue: ['in_progress'],
    completed: [],
  },
  storekeeper_handover: {
    initiated: ['in_progress'],
    in_progress: ['completed'],
    completed: [],
  },
};

// V1 backward-compatibility aliases — shallow copies to prevent mutation cross-contamination
TRANSITION_MAP['mrrv'] = { ...TRANSITION_MAP['grn'] };
TRANSITION_MAP['rfim'] = { ...TRANSITION_MAP['qci'] };
TRANSITION_MAP['osd'] = { ...TRANSITION_MAP['dr'] };
TRANSITION_MAP['mirv'] = { ...TRANSITION_MAP['mi'] };
TRANSITION_MAP['mrv'] = { ...TRANSITION_MAP['mrn'] };
TRANSITION_MAP['mrf'] = { ...TRANSITION_MAP['mr'] };
TRANSITION_MAP['stock_transfer'] = { ...TRANSITION_MAP['wt'] };
TRANSITION_MAP['stock-transfers'] = { ...TRANSITION_MAP['wt'] };

// Freeze to prevent accidental mutation
Object.freeze(TRANSITION_MAP);
for (const key of Object.keys(TRANSITION_MAP)) {
  Object.freeze(TRANSITION_MAP[key]);
}

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
