/**
 * Offline Sync Handlers
 *
 * Registers API replay logic for each offline transaction type.
 * When the device comes back online, the queue engine calls these
 * handlers to replay queued warehouse transactions against the API.
 */

import { apiClient } from '@/api/client';
import { registerSyncHandler } from '@/lib/offlineQueue';
import type { OfflineTransaction } from '@/lib/offlineQueue';

function setupSyncHandlers() {
  // GRN Receive: POST /grn/:id/receive
  registerSyncHandler('grn-receive', async (tx: OfflineTransaction) => {
    const { grnId } = tx.payload;
    if (!grnId) throw new Error('Missing grnId in offline payload');
    await apiClient.post(`/grn/${grnId}/receive`);
  });

  // MI Issue: POST /mi/:id/issue
  registerSyncHandler('mi-issue', async (tx: OfflineTransaction) => {
    const { miId } = tx.payload;
    if (!miId) throw new Error('Missing miId in offline payload');
    await apiClient.post(`/mi/${miId}/issue`);
  });

  // WT Ship: POST /wt/:id/ship
  registerSyncHandler('wt-transfer', async (tx: OfflineTransaction) => {
    const { wtId } = tx.payload;
    if (!wtId) throw new Error('Missing wtId in offline payload');
    await apiClient.post(`/wt/${wtId}/ship`);
  });

  // MRN Request: POST /mrn
  registerSyncHandler('mrn-request', async (tx: OfflineTransaction) => {
    const { itemId, quantity, reason } = tx.payload;
    if (!itemId) throw new Error('Missing itemId in offline payload');
    await apiClient.post('/mrn', { itemId, quantity, reason });
  });

  // QCI Inspect: POST /qci
  registerSyncHandler('qci-inspect', async (tx: OfflineTransaction) => {
    const { grnId, inspectionResults } = tx.payload;
    if (!grnId) throw new Error('Missing grnId in offline payload');
    await apiClient.post('/qci', { grnId, inspectionResults });
  });

  // DR Report: POST /dr
  registerSyncHandler('dr-report', async (tx: OfflineTransaction) => {
    const { grnId, discrepancyType, quantity, notes } = tx.payload;
    if (!grnId) throw new Error('Missing grnId in offline payload');
    await apiClient.post('/dr', { grnId, discrepancyType, quantity, notes });
  });

  // MR Return: POST /mr
  registerSyncHandler('mr-return', async (tx: OfflineTransaction) => {
    const { itemId, quantity, reason, condition } = tx.payload;
    if (!itemId) throw new Error('Missing itemId in offline payload');
    await apiClient.post('/mr', { itemId, quantity, reason, condition });
  });

  // JO Execute: POST /jo/:id/execute
  registerSyncHandler('jo-execute', async (tx: OfflineTransaction) => {
    const { joId, taskResults, laborHours } = tx.payload;
    if (!joId) throw new Error('Missing joId in offline payload');
    await apiClient.post(`/jo/${joId}/execute`, { taskResults, laborHours });
  });

  // Scrap Dispose: POST /scrap
  registerSyncHandler('scrap-dispose', async (tx: OfflineTransaction) => {
    const { itemId, quantity, condition, notes } = tx.payload;
    if (!itemId) throw new Error('Missing itemId in offline payload');
    await apiClient.post('/scrap', { itemId, quantity, condition, notes });
  });
}

export { setupSyncHandlers };
