import { useState, useEffect, useCallback, useRef } from 'react';
import {
  enqueue,
  getAll,
  syncAll,
  getPendingCount,
  registerSyncHandler,
  initAutoSync,
  type TransactionType,
  type OfflineTransaction,
} from '@/lib/offlineQueue';

interface OfflineQueueState {
  /** Number of pending + failed transactions waiting to sync */
  pendingCount: number;
  /** Whether a sync cycle is currently running */
  isSyncing: boolean;
  /** Whether the browser is currently online */
  isOnline: boolean;
  /** All queued transactions (pending + failed + syncing) */
  transactions: OfflineTransaction[];
}

interface UseOfflineQueueReturn extends OfflineQueueState {
  /** Enqueue a new offline transaction */
  enqueueTransaction: (type: TransactionType, payload: Record<string, unknown>) => Promise<string>;
  /** Manually trigger sync of all pending transactions */
  triggerSync: () => Promise<{ synced: number; failed: number }>;
}

const POLL_INTERVAL = 5000;

/**
 * React hook wrapping the IndexedDB offline queue.
 * Provides reactive state (pending count, online status) and
 * actions (enqueue, triggerSync) for mobile scan workflows.
 */
export function useOfflineQueue(): UseOfflineQueueReturn {
  const [state, setState] = useState<OfflineQueueState>({
    pendingCount: 0,
    isSyncing: false,
    isOnline: navigator.onLine,
    transactions: [],
  });

  const syncingRef = useRef(false);

  // Refresh queue state from IndexedDB
  const refreshState = useCallback(async () => {
    try {
      const [count, txs] = await Promise.all([getPendingCount(), getAll()]);
      const nonSynced = txs.filter(t => t.status !== 'synced');
      setState(prev => ({
        ...prev,
        pendingCount: count,
        transactions: nonSynced,
        isOnline: navigator.onLine,
      }));
    } catch {
      // IndexedDB may not be available in some contexts
    }
  }, []);

  // Initialize auto-sync and set up event listeners
  useEffect(() => {
    initAutoSync();
    refreshState();

    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      refreshState();
    };
    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll for queue state changes
    const interval = setInterval(refreshState, POLL_INTERVAL);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [refreshState]);

  const enqueueTransaction = useCallback(
    async (type: TransactionType, payload: Record<string, unknown>) => {
      const id = await enqueue(type, payload);
      await refreshState();
      return id;
    },
    [refreshState],
  );

  const triggerSync = useCallback(async () => {
    if (syncingRef.current) return { synced: 0, failed: 0 };
    syncingRef.current = true;
    setState(prev => ({ ...prev, isSyncing: true }));

    try {
      const result = await syncAll();
      await refreshState();
      return result;
    } finally {
      syncingRef.current = false;
      setState(prev => ({ ...prev, isSyncing: false }));
    }
  }, [refreshState]);

  return {
    ...state,
    enqueueTransaction,
    triggerSync,
  };
}

export { registerSyncHandler, type TransactionType };
