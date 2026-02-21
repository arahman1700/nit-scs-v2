import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { SyncStatusIndicator } from '@/components/SyncStatusIndicator';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, RefreshCw, Clock, Smartphone } from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const ACTION_CARDS = [
  {
    label: 'Receive (GRN)',
    description: 'Scan barcodes to receive goods into warehouse',
    path: '/warehouse/mobile/grn-receive',
    icon: ArrowDownCircle,
    color: 'emerald',
    bgClass: 'bg-emerald-500/10 border-emerald-500/20',
    iconClass: 'text-emerald-400',
    hoverClass: 'hover:bg-emerald-500/15',
  },
  {
    label: 'Issue (MI)',
    description: 'Scan and issue materials to projects',
    path: '/warehouse/mobile/mi-issue',
    icon: ArrowUpCircle,
    color: 'blue',
    bgClass: 'bg-blue-500/10 border-blue-500/20',
    iconClass: 'text-blue-400',
    hoverClass: 'hover:bg-blue-500/15',
  },
  {
    label: 'Transfer (WT)',
    description: 'Transfer items between warehouses',
    path: '/warehouse/mobile/wt-transfer',
    icon: ArrowLeftRight,
    color: 'purple',
    bgClass: 'bg-purple-500/10 border-purple-500/20',
    iconClass: 'text-purple-400',
    hoverClass: 'hover:bg-purple-500/15',
  },
] as const;

export function MobileDashboard() {
  const { pendingCount, isSyncing, isOnline, triggerSync, transactions } = useOfflineQueue();

  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  return (
    <div className="min-h-screen bg-nesma-dark p-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-nesma-primary/20">
            <Smartphone size={22} className="text-nesma-secondary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{getGreeting()}</h1>
            <p className="text-xs text-gray-400">Mobile Warehouse Operations</p>
          </div>
        </div>
        <SyncStatusIndicator />
      </div>

      {/* Action Cards */}
      <div className="space-y-3 mb-6">
        <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Quick Actions</h2>
        {ACTION_CARDS.map(card => (
          <Link
            key={card.path}
            to={card.path}
            className={`block glass-card rounded-2xl p-5 border transition-all duration-300 ${card.bgClass} ${card.hoverClass}`}
          >
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/5">
                <card.icon size={28} className={card.iconClass} />
              </div>
              <div className="flex-1">
                <div className="text-white font-semibold text-base">{card.label}</div>
                <div className="text-sm text-gray-400 mt-0.5">{card.description}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Offline Queue Status */}
      <div className="glass-card rounded-2xl p-5 border border-white/10 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Sync Status</h2>
          {pendingCount > 0 && isOnline && (
            <button
              onClick={() => triggerSync()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium text-white transition-colors"
              aria-label="Retry sync"
            >
              <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-white">{pendingCount}</div>
            <div className="text-xs text-gray-400 mt-1">Pending</div>
          </div>
          <div className="bg-white/5 rounded-xl p-3 text-center">
            <div className={`text-2xl font-bold ${isOnline ? 'text-emerald-400' : 'text-red-400'}`}>
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <div className="text-xs text-gray-400 mt-1">Connection</div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {recentTransactions.length > 0 && (
        <div className="glass-card rounded-2xl p-5 border border-white/10">
          <h2 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">Recent Activity</h2>
          <div className="space-y-2">
            {recentTransactions.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <Clock size={14} className="text-gray-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{tx.type}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(tx.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    tx.status === 'synced'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : tx.status === 'failed'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {tx.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
