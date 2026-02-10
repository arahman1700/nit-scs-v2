import { WifiOff, Wifi, Loader2, CloudUpload, AlertTriangle } from 'lucide-react';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

/**
 * Compact banner for mobile warehouse pages showing:
 * - Offline/online status
 * - Pending transaction count
 * - Manual sync trigger button
 */
export function OfflineQueueBanner() {
  const { pendingCount, isSyncing, isOnline, triggerSync } = useOfflineQueue();

  // Don't show if online and no pending items
  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl mb-4 text-sm ${
        !isOnline
          ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
          : pendingCount > 0
            ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
            : ''
      }`}
    >
      {/* Status icon */}
      {!isOnline ? (
        <WifiOff size={16} className="shrink-0" />
      ) : isSyncing ? (
        <Loader2 size={16} className="shrink-0 animate-spin" />
      ) : pendingCount > 0 ? (
        <CloudUpload size={16} className="shrink-0" />
      ) : (
        <Wifi size={16} className="shrink-0" />
      )}

      {/* Message */}
      <span className="flex-1">
        {!isOnline ? (
          <>Offline mode — {pendingCount > 0 ? `${pendingCount} queued` : 'transactions will queue'}</>
        ) : isSyncing ? (
          'Syncing transactions...'
        ) : pendingCount > 0 ? (
          <>
            {pendingCount} transaction{pendingCount > 1 ? 's' : ''} pending sync
          </>
        ) : null}
      </span>

      {/* Sync button — only show when online with pending items */}
      {isOnline && pendingCount > 0 && !isSyncing && (
        <button
          onClick={() => triggerSync()}
          className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors"
        >
          Sync Now
        </button>
      )}
    </div>
  );
}
