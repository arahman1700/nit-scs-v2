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
}

export { setupSyncHandlers };
