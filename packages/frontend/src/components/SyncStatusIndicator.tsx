import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { RefreshCw, Wifi, WifiOff, Cloud } from 'lucide-react';

export function SyncStatusIndicator() {
  const { pendingCount, isSyncing, isOnline, triggerSync } = useOfflineQueue();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs">
      {/* Online/offline indicator */}
      {isOnline ? <Wifi size={14} className="text-emerald-400" /> : <WifiOff size={14} className="text-red-400" />}

      {/* Pending count badge */}
      {pendingCount > 0 && (
        <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">
          {pendingCount} pending
        </span>
      )}

      {/* Sync button */}
      {pendingCount > 0 && isOnline && (
        <button
          onClick={() => triggerSync()}
          disabled={isSyncing}
          className="p-1 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Sync pending transactions"
        >
          <RefreshCw size={14} className={isSyncing ? 'animate-spin text-nesma-secondary' : 'text-gray-400'} />
        </button>
      )}

      {/* All synced indicator */}
      {pendingCount === 0 && isOnline && <Cloud size={14} className="text-emerald-400" />}
    </div>
  );
}
