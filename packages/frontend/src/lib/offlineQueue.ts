/**
 * Offline Transaction Queue
 *
 * IndexedDB-backed queue for warehouse scan transactions that need to sync
 * when the device goes back online. Stores pending GRN receives, MI issues,
 * and WT transfers with automatic retry on reconnection.
 */

const DB_NAME = 'nit-scs-offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending-transactions';

// ── Types ───────────────────────────────────────────────────────────────

export type TransactionType = 'grn-receive' | 'mi-issue' | 'wt-transfer';

export type TransactionStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export interface OfflineTransaction {
  id: string;
  type: TransactionType;
  payload: Record<string, unknown>;
  status: TransactionStatus;
  createdAt: number; // Date.now()
  lastAttemptAt?: number;
  attempts: number;
  errorMessage?: string;
}

type SyncHandler = (tx: OfflineTransaction) => Promise<void>;

// ── IndexedDB Helpers ───────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txOperation<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    db =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const request = operation(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

// ── Queue Operations ────────────────────────────────────────────────────

/** Generate a unique ID for offline transactions */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Add a new transaction to the offline queue */
export async function enqueue(type: TransactionType, payload: Record<string, unknown>): Promise<string> {
  const tx: OfflineTransaction = {
    id: generateId(),
    type,
    payload,
    status: 'pending',
    createdAt: Date.now(),
    attempts: 0,
  };

  await txOperation('readwrite', store => store.put(tx));
  return tx.id;
}

/** Get all transactions with optional status filter */
export async function getAll(status?: TransactionStatus): Promise<OfflineTransaction[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    let request: IDBRequest<OfflineTransaction[]>;
    if (status) {
      const index = store.index('status');
      request = index.getAll(status);
    } else {
      request = store.getAll();
    }

    request.onsuccess = () => {
      const results = request.result.sort((a, b) => a.createdAt - b.createdAt);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

/** Update a transaction's status */
export async function updateStatus(id: string, status: TransactionStatus, errorMessage?: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getReq = store.get(id);

    getReq.onsuccess = () => {
      const item = getReq.result as OfflineTransaction | undefined;
      if (!item) {
        resolve();
        return;
      }

      item.status = status;
      item.lastAttemptAt = Date.now();
      item.attempts += 1;
      if (errorMessage) item.errorMessage = errorMessage;

      const putReq = store.put(item);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    };
    getReq.onerror = () => reject(getReq.error);
  });
}

/** Remove a synced transaction */
export async function remove(id: string): Promise<void> {
  await txOperation('readwrite', store => store.delete(id));
}

/** Remove all synced transactions */
export async function clearSynced(): Promise<void> {
  const synced = await getAll('synced');
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  for (const item of synced) {
    store.delete(item.id);
  }
}

/** Get count of pending transactions */
export async function getPendingCount(): Promise<number> {
  const pending = await getAll('pending');
  const failed = await getAll('failed');
  return pending.length + failed.length;
}

// ── Sync Engine ─────────────────────────────────────────────────────────

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

let syncing = false;
const syncHandlers = new Map<TransactionType, SyncHandler>();

/** Register a handler for a transaction type */
export function registerSyncHandler(type: TransactionType, handler: SyncHandler): void {
  syncHandlers.set(type, handler);
}

/** Sync all pending/failed transactions with exponential backoff */
export async function syncAll(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  syncing = true;
  let syncedCount = 0;
  let failedCount = 0;

  try {
    const pending = await getAll('pending');
    const retryable = (await getAll('failed')).filter(t => t.attempts < MAX_RETRIES);
    const toSync = [...pending, ...retryable];

    for (const tx of toSync) {
      const handler = syncHandlers.get(tx.type);
      if (!handler) {
        failedCount++;
        continue;
      }

      try {
        await updateStatus(tx.id, 'syncing');
        await handler(tx);
        await updateStatus(tx.id, 'synced');
        syncedCount++;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Sync failed';
        await updateStatus(tx.id, 'failed', message);
        failedCount++;

        // Exponential backoff delay between retries
        const delay = BASE_DELAY_MS * Math.pow(2, tx.attempts);
        await new Promise(r => setTimeout(r, Math.min(delay, 30000)));
      }
    }
  } finally {
    syncing = false;
  }

  // Clean up synced items after successful sync
  await clearSynced();

  return { synced: syncedCount, failed: failedCount };
}

// ── Auto-Sync on Online ─────────────────────────────────────────────────

let autoSyncSetup = false;

/** Initialize auto-sync: listen for online events and sync automatically */
export function initAutoSync(): void {
  if (autoSyncSetup) return;
  autoSyncSetup = true;

  window.addEventListener('online', () => {
    syncAll().catch(err => {
      console.warn('[OfflineQueue] Auto-sync on online failed:', err);
    });
  });

  // Also try to sync on page load if online
  if (navigator.onLine) {
    // Delay slightly to let handlers register
    setTimeout(() => {
      syncAll().catch(err => {
        console.warn('[OfflineQueue] Initial sync failed:', err);
      });
    }, 2000);
  }
}
