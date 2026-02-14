import type { Server as SocketIOServer } from 'socket.io';

import * as mrrvService from './mrrv.service.js';
import * as mirvService from './mirv.service.js';
import * as mrvService from './mrv.service.js';
import * as rfimService from './rfim.service.js';
import * as osdService from './osd.service.js';
import * as joService from './job-order.service.js';
import * as gatePassService from './gate-pass.service.js';
import * as stService from './stock-transfer.service.js';
import * as mrfService from './mrf.service.js';
import * as shipmentService from './shipment.service.js';

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
  const handlers: Record<string, Record<string, ActionFn>> = {
    mrrv: {
      submit: id => mrrvService.submit(id),
      'approve-qc': (id, userId) => mrrvService.approveQc(id, userId),
      receive: id => mrrvService.receive(id),
      store: (id, userId) => mrrvService.store(id, userId),
    },
    mirv: {
      submit: (id, userId, io) => mirvService.submit(id, userId, io),
      issue: (id, userId) => mirvService.issue(id, userId),
      cancel: id => mirvService.cancel(id),
    },
    mrv: {
      submit: id => mrvService.submit(id),
      receive: (id, userId) => mrvService.receive(id, userId),
      complete: (id, userId) => mrvService.complete(id, userId),
    },
    rfim: {
      start: (id, userId) => rfimService.start(id, userId),
    },
    osd: {
      'send-claim': id => osdService.sendClaim(id),
    },
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
    mrf: {
      submit: id => mrfService.submit(id),
      cancel: id => mrfService.cancel(id),
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
  const actionMap: Record<string, string[]> = {
    mrrv: ['submit', 'approve-qc', 'receive', 'store'],
    mirv: ['submit', 'issue', 'cancel'],
    mrv: ['submit', 'receive', 'complete'],
    rfim: ['start'],
    osd: ['send-claim'],
    'job-order': ['submit', 'start', 'cancel'],
    'gate-pass': ['submit', 'approve', 'cancel'],
    'stock-transfer': ['submit', 'approve', 'cancel'],
    mrf: ['submit', 'cancel'],
    shipment: ['deliver', 'cancel'],
  };
  return actionMap[documentType] ?? [];
}
