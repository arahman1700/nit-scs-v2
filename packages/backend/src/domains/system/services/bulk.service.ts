import type { Server as SocketIOServer } from 'socket.io';

import * as grnService from '../../inbound/services/grn.service.js';
import * as miService from '../../outbound/services/mi.service.js';
import * as mrnService from '../../outbound/services/mrn.service.js';
import * as qciService from '../../inbound/services/qci.service.js';
import * as drService from '../../inbound/services/dr.service.js';
import * as joService from '../../job-orders/services/job-order.service.js';
import * as gatePassService from '../../logistics/services/gate-pass.service.js';
import * as stService from '../../transfers/services/stock-transfer.service.js';
import * as mrService from '../../outbound/services/mr.service.js';
import * as shipmentService from '../../logistics/services/shipment.service.js';

export interface BulkResult {
  id: string;
  success: boolean;
  error?: string;
}

type ActionFn = (id: string, userId: string, io?: SocketIOServer) => Promise<unknown>;

/**
 * Map of documentType -> action -> handler function.
 * Only simple actions that don't require complex payloads are supported in bulk.
 */
function getActionHandler(documentType: string, action: string): ActionFn | null {
  const grnActions: Record<string, ActionFn> = {
    submit: id => grnService.submit(id),
    'approve-qc': (id, userId) => grnService.approveQc(id, userId),
    receive: id => grnService.receive(id),
    store: (id, userId) => grnService.store(id, userId),
  };
  const miActions: Record<string, ActionFn> = {
    submit: (id, userId, io) => miService.submit(id, userId, io),
    issue: (id, userId) => miService.issue(id, userId),
    cancel: id => miService.cancel(id),
  };
  const mrnActions: Record<string, ActionFn> = {
    submit: id => mrnService.submit(id),
    receive: (id, userId) => mrnService.receive(id, userId),
    complete: (id, userId) => mrnService.complete(id, userId),
  };
  const qciActions: Record<string, ActionFn> = {
    start: (id, userId) => qciService.start(id, userId),
  };
  const drActions: Record<string, ActionFn> = {
    'send-claim': id => drService.sendClaim(id),
  };
  const mrActions: Record<string, ActionFn> = {
    submit: id => mrService.submit(id),
    cancel: id => mrService.cancel(id),
  };

  const handlers: Record<string, Record<string, ActionFn>> = {
    // V2 names (primary)
    grn: grnActions,
    mi: miActions,
    mrn: mrnActions,
    qci: qciActions,
    dr: drActions,
    mr: mrActions,
    // V1 aliases (backward compatibility)
    mrrv: grnActions,
    mirv: miActions,
    mrv: mrnActions,
    rfim: qciActions,
    osd: drActions,
    mrf: mrActions,
    // Non-aliased document types
    'job-order': {
      submit: (id, userId, io) => joService.submit(id, userId, io),
      start: id => joService.start(id),
      cancel: id => joService.cancel(id),
    },
    'gate-pass': {
      submit: id => gatePassService.submit(id),
      approve: id => gatePassService.approve(id),
      cancel: id => gatePassService.cancel(id),
    },
    'stock-transfer': {
      submit: id => stService.submit(id),
      approve: id => stService.approve(id),
      cancel: id => stService.cancel(id),
    },
    shipment: {
      deliver: id => shipmentService.deliver(id),
      cancel: id => shipmentService.cancel(id),
    },
  };

  return handlers[documentType]?.[action] ?? null;
}

/**
 * Execute a bulk action on multiple documents.
 * Returns results per ID (success/failure).
 */
export async function executeBulkAction(
  documentType: string,
  ids: string[],
  action: string,
  userId: string,
  io?: SocketIOServer,
): Promise<BulkResult[]> {
  const handler = getActionHandler(documentType, action);
  if (!handler) {
    return ids.map(id => ({
      id,
      success: false,
      error: `Action "${action}" is not supported for bulk operations on "${documentType}"`,
    }));
  }

  // Process in sequence to avoid race conditions with inventory
  const results: BulkResult[] = [];
  for (const id of ids) {
    try {
      await handler(id, userId, io);
      results.push({ id, success: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      results.push({ id, success: false, error: message });
    }
  }

  return results;
}

/**
 * Get available bulk actions for a document type.
 */
export function getAvailableBulkActions(documentType: string): string[] {
  const grnBulk = ['submit', 'approve-qc', 'receive', 'store'];
  const miBulk = ['submit', 'issue', 'cancel'];
  const mrnBulk = ['submit', 'receive', 'complete'];
  const qciBulk = ['start'];
  const drBulk = ['send-claim'];
  const mrBulk = ['submit', 'cancel'];

  const actionMap: Record<string, string[]> = {
    // V2 names (primary)
    grn: grnBulk,
    mi: miBulk,
    mrn: mrnBulk,
    qci: qciBulk,
    dr: drBulk,
    mr: mrBulk,
    // V1 aliases
    mrrv: grnBulk,
    mirv: miBulk,
    mrv: mrnBulk,
    rfim: qciBulk,
    osd: drBulk,
    mrf: mrBulk,
    // Non-aliased
    'job-order': ['submit', 'start', 'cancel'],
    'gate-pass': ['submit', 'approve', 'cancel'],
    'stock-transfer': ['submit', 'approve', 'cancel'],
    shipment: ['deliver', 'cancel'],
  };
  return actionMap[documentType] ?? [];
}
