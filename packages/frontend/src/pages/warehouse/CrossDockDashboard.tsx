import React, { useState, useMemo } from 'react';
import {
  ArrowRightLeft,
  Search,
  CheckCircle2,
  Clock,
  Package,
  TrendingUp,
  Play,
  XCircle,
  ChevronRight,
  Loader2,
  Plus,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import {
  useCrossDockOpportunities,
  useCrossDockStats,
  useCrossDockList,
  useCreateCrossDock,
  useApproveCrossDock,
  useExecuteCrossDock,
  useCompleteCrossDock,
  useCancelCrossDock,
} from '@/api/hooks/useCrossDock';
import { useWarehouses } from '@/api/hooks/useMasterData';
import type { CrossDock, CrossDockOpportunity } from '@/api/hooks/useCrossDock';

// ── Status config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  identified: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    label: 'Identified',
    icon: <Search className="w-3 h-3" />,
  },
  approved: {
    bg: 'bg-cyan-500/20',
    text: 'text-cyan-400',
    label: 'Approved',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  in_progress: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    label: 'In Progress',
    icon: <Play className="w-3 h-3" />,
  },
  completed: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    label: 'Completed',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  cancelled: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    label: 'Cancelled',
    icon: <XCircle className="w-3 h-3" />,
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Tab = 'opportunities' | 'active' | 'history';

// ── Component ───────────────────────────────────────────────────────────

export const CrossDockDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('opportunities');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');

  // Queries
  const { data: warehousesRes } = useWarehouses();
  const warehouses =
    (warehousesRes as unknown as { data?: Array<{ id: string; warehouseName: string; warehouseCode: string }> })
      ?.data ?? [];

  const { data: statsRes, isLoading: statsLoading } = useCrossDockStats(selectedWarehouse || undefined);
  const stats = (statsRes as unknown as { data?: import('@/api/hooks/useCrossDock').CrossDockStats })?.data ?? null;

  const { data: opportunitiesRes, isLoading: oppsLoading } = useCrossDockOpportunities(
    activeTab === 'opportunities' ? selectedWarehouse || undefined : undefined,
  );
  const opportunities = (opportunitiesRes as unknown as { data?: CrossDockOpportunity[] })?.data ?? [];

  const activeStatusFilter =
    activeTab === 'active'
      ? undefined // we'll filter client-side for identified+approved+in_progress
      : activeTab === 'history'
        ? 'completed'
        : undefined;

  const { data: listRes, isLoading: listLoading } = useCrossDockList(
    activeTab !== 'opportunities'
      ? {
          warehouseId: selectedWarehouse || undefined,
          status: activeStatusFilter,
          pageSize: 100,
        }
      : undefined,
  );
  const allRecords = (listRes as unknown as { data?: CrossDock[] })?.data ?? [];

  const displayedRecords = useMemo(() => {
    if (activeTab === 'active') {
      return allRecords.filter(r => r.status === 'identified' || r.status === 'approved' || r.status === 'in_progress');
    }
    return allRecords;
  }, [allRecords, activeTab]);

  // Mutations
  const createMutation = useCreateCrossDock();
  const approveMutation = useApproveCrossDock();
  const executeMutation = useExecuteCrossDock();
  const completeMutation = useCompleteCrossDock();
  const cancelMutation = useCancelCrossDock();

  function handleCreateFromOpportunity(opp: CrossDockOpportunity) {
    const target = opp.targets[0];
    if (!target) return;

    createMutation.mutate({
      warehouseId: opp.warehouseId,
      itemId: opp.itemId,
      sourceGrnId: opp.sourceGrnId,
      targetMiId: target.type === 'mi' ? target.id : undefined,
      targetWtId: target.type === 'wt' ? target.id : undefined,
      quantity: opp.suggestedQuantity,
    });
  }

  // ── KPI Cards ──────────────────────────────────────────────────────────

  const kpiCards = [
    {
      label: 'Opportunities',
      value: stats?.totalIdentified ?? 0,
      icon: <Search className="w-5 h-5" />,
      color: 'text-blue-400',
      bg: 'bg-blue-500/20',
    },
    {
      label: 'Active',
      value: stats?.totalActive ?? 0,
      icon: <Play className="w-5 h-5" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/20',
    },
    {
      label: 'Completed',
      value: stats?.totalCompleted ?? 0,
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/20',
    },
    {
      label: 'Time Saved',
      value: stats ? `${stats.avgCompletionHours}h avg` : '--',
      icon: <Clock className="w-5 h-5" />,
      color: 'text-purple-400',
      bg: 'bg-purple-500/20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
            <ArrowRightLeft className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Cross-Docking</h1>
            <p className="text-sm text-gray-400">Bypass put-away by routing inbound to outbound</p>
          </div>
        </div>
      </div>

      {/* Warehouse filter */}
      <div className="glass-card rounded-2xl p-4 border border-white/10">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <label className="text-sm text-gray-400 whitespace-nowrap">Warehouse:</label>
          <select
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
            className="input-field w-full sm:w-72"
          >
            <option value="">All Warehouses</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.warehouseCode} - {w.warehouseName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      {statsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map(kpi => (
            <div key={kpi.label} className="glass-card rounded-2xl p-5 border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-500 uppercase tracking-wider">{kpi.label}</span>
                <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center ${kpi.color}`}>
                  {kpi.icon}
                </div>
              </div>
              <div className="text-2xl font-bold text-white">{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Extra stats row */}
      {stats && (stats.totalItemsBypassed > 0 || stats.totalCancelled > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="glass-card rounded-2xl p-4 border border-white/10 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Items Bypassed</div>
              <div className="text-xl font-bold text-white">{stats.totalItemsBypassed}</div>
            </div>
          </div>
          <div className="glass-card rounded-2xl p-4 border border-white/10 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wider">Cancelled</div>
              <div className="text-xl font-bold text-white">{stats.totalCancelled}</div>
            </div>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
        {(['opportunities', 'active', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === tab
                ? 'bg-nesma-primary text-white shadow-lg'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'opportunities' && (
        <OpportunitiesTab
          opportunities={opportunities}
          loading={oppsLoading}
          noWarehouse={!selectedWarehouse}
          onCreateCrossDock={handleCreateFromOpportunity}
          creating={createMutation.isPending}
        />
      )}

      {activeTab === 'active' && (
        <ActiveTab
          records={displayedRecords}
          loading={listLoading}
          onApprove={id => approveMutation.mutate(id)}
          onExecute={id => executeMutation.mutate(id)}
          onComplete={id => completeMutation.mutate(id)}
          onCancel={id => cancelMutation.mutate(id)}
          approving={approveMutation.isPending}
          executing={executeMutation.isPending}
          completing={completeMutation.isPending}
          cancelling={cancelMutation.isPending}
        />
      )}

      {activeTab === 'history' && <HistoryTab records={displayedRecords} loading={listLoading} />}
    </div>
  );
};

// ── Opportunities Tab ───────────────────────────────────────────────────

interface OpportunitiesTabProps {
  opportunities: CrossDockOpportunity[];
  loading: boolean;
  noWarehouse: boolean;
  onCreateCrossDock: (opp: CrossDockOpportunity) => void;
  creating: boolean;
}

function OpportunitiesTab({ opportunities, loading, noWarehouse, onCreateCrossDock, creating }: OpportunitiesTabProps) {
  if (noWarehouse) {
    return (
      <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500/50 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">Select a warehouse to scan for cross-dock opportunities.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (opportunities.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
        <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">
          No cross-dock opportunities found. Opportunities appear when a pending GRN has items matching a pending MI or
          WT.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {opportunities.map((opp, idx) => (
        <div
          key={`${opp.sourceGrnId}-${opp.itemId}-${idx}`}
          className="glass-card rounded-2xl border border-white/10 p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            {/* Left: Item + GRN info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-white">{opp.itemCode}</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span className="text-sm text-gray-400 truncate">{opp.itemDescription}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Source GRN: <span className="text-gray-300">{opp.sourceGrnNumber}</span>
                <span className="mx-2">|</span>
                Available: <span className="text-gray-300">{opp.grnQuantity}</span>
              </div>

              {/* Targets */}
              <div className="mt-3 space-y-1.5">
                {opp.targets.map(target => (
                  <div key={target.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        target.type === 'mi' ? 'bg-violet-500/20 text-violet-400' : 'bg-orange-500/20 text-orange-400'
                      }`}
                    >
                      {target.type}
                    </span>
                    <span className="text-gray-300">{target.documentNumber}</span>
                    <span className="text-gray-500">needs {target.quantityNeeded}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Suggested qty + create button */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <div className="text-right">
                <div className="text-xs text-gray-500">Suggested Qty</div>
                <div className="text-lg font-bold text-white">{opp.suggestedQuantity}</div>
              </div>
              <button
                onClick={() => onCreateCrossDock(opp)}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-xl hover:bg-nesma-accent transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Cross-Dock
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Active Tab ──────────────────────────────────────────────────────────

interface ActiveTabProps {
  records: CrossDock[];
  loading: boolean;
  onApprove: (id: string) => void;
  onExecute: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  approving: boolean;
  executing: boolean;
  completing: boolean;
  cancelling: boolean;
}

function ActiveTab({
  records,
  loading,
  onApprove,
  onExecute,
  onComplete,
  onCancel,
  approving,
  executing,
  completing,
  cancelling,
}: ActiveTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
        <ArrowRightLeft className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No active cross-docks. Create one from the Opportunities tab.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {records.map(record => {
        const sc = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.identified!;
        return (
          <div key={record.id} className="glass-card rounded-2xl border border-white/10 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Left: Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs text-gray-500 font-mono">{record.id.slice(0, 8)}...</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                  >
                    {sc.icon}
                    {sc.label}
                  </span>
                </div>
                <div className="text-sm font-medium text-white mt-1">
                  {record.item?.itemCode ?? '--'} - {record.item?.itemDescription ?? 'Unknown item'}
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                  <span>
                    Warehouse: <span className="text-gray-300">{record.warehouse?.warehouseCode ?? '--'}</span>
                  </span>
                  <span>
                    Qty: <span className="text-gray-300 font-semibold">{record.quantity}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(record.createdAt)}
                  </span>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {record.status === 'identified' && (
                  <button
                    onClick={() => onApprove(record.id)}
                    disabled={approving}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/20 text-cyan-400 rounded-xl hover:bg-cyan-500/30 transition-colors border border-cyan-500/30 text-xs font-medium"
                  >
                    {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Approve
                  </button>
                )}
                {record.status === 'approved' && (
                  <button
                    onClick={() => onExecute(record.id)}
                    disabled={executing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-colors border border-amber-500/30 text-xs font-medium"
                  >
                    {executing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                    Execute
                  </button>
                )}
                {record.status === 'in_progress' && (
                  <button
                    onClick={() => onComplete(record.id)}
                    disabled={completing}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-colors border border-emerald-500/30 text-xs font-medium"
                  >
                    {completing ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                    Complete
                  </button>
                )}
                {record.status !== 'completed' && record.status !== 'cancelled' && (
                  <button
                    onClick={() => onCancel(record.id)}
                    disabled={cancelling}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors border border-red-500/30 text-xs font-medium"
                  >
                    {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── History Tab ─────────────────────────────────────────────────────────

interface HistoryTabProps {
  records: CrossDock[];
  loading: boolean;
}

function HistoryTab({ records, loading }: HistoryTabProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
        <CheckCircle2 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No completed cross-docks yet.</p>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5">
            <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Item</th>
            <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
              Warehouse
            </th>
            <th className="text-right px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
              Quantity
            </th>
            <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">Status</th>
            <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wider font-medium">
              Completed
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {records.map(record => {
            const sc = STATUS_CONFIG[record.status] ?? STATUS_CONFIG.completed!;
            return (
              <tr key={record.id} className="hover:bg-white/5 transition-colors">
                <td className="px-5 py-3">
                  <div className="text-white font-medium">{record.item?.itemCode ?? '--'}</div>
                  <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]">
                    {record.item?.itemDescription ?? ''}
                  </div>
                </td>
                <td className="px-5 py-3 text-gray-300">{record.warehouse?.warehouseCode ?? '--'}</td>
                <td className="px-5 py-3 text-right text-white font-semibold">{record.quantity}</td>
                <td className="px-5 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                  >
                    {sc.icon}
                    {sc.label}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-400">
                  {record.completedAt ? formatDate(record.completedAt) : '--'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
