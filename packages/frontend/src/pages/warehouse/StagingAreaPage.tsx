import React, { useState, useMemo } from 'react';
import {
  Layers,
  ArrowDownCircle,
  ArrowUpCircle,
  AlertTriangle,
  Plus,
  ArrowRight,
  Clock,
  Package,
  Loader2,
  X,
  BarChart3,
} from 'lucide-react';
import {
  useStagingZones,
  useStagingAssignments,
  useCreateStagingAssignment,
  useMoveFromStaging,
  useStagingAlerts,
  useStagingOccupancy,
} from '@/api/hooks/useStaging';
import { useWarehouses } from '@/api/hooks/useMasterData';
import type { StagingAssignment, StagingOccupancy } from '@/api/hooks/useStaging';

// ── Helpers ──────────────────────────────────────────────────────────

function getDwellTime(stagedAt: string): string {
  const ms = Date.now() - new Date(stagedAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function getDwellPct(stagedAt: string, maxDwellHours: number | null): number {
  const max = (maxDwellHours ?? 24) * 3_600_000;
  const elapsed = Date.now() - new Date(stagedAt).getTime();
  return Math.min(100, Math.round((elapsed / max) * 100));
}

function getDwellColor(pct: number): string {
  if (pct >= 80) return 'text-red-400';
  if (pct >= 50) return 'text-amber-400';
  return 'text-emerald-400';
}

function getDwellBarColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500';
  if (pct >= 50) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SOURCE_DOC_LABELS: Record<string, string> = {
  grn: 'GRN',
  mi: 'MI',
  wt: 'WT',
  cross_dock: 'Cross-Dock',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  staged: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Staged' },
  moved: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Moved' },
  expired: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Expired' },
};

// ── KPI Card ─────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
  badge?: { count: number; color: string };
}> = ({ label, value, icon, color = 'text-nesma-secondary', badge }) => (
  <div className="glass-card rounded-2xl p-4 hover:bg-white/10 transition-all duration-300">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        {badge && badge.count > 0 && (
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge.color}`}>{badge.count}</span>
        )}
        <span className={color}>{icon}</span>
      </div>
    </div>
    <div className="text-3xl font-bold text-white">{value}</div>
  </div>
);

// ── Zone Occupancy Bar ───────────────────────────────────────────────

const OccupancyBar: React.FC<{ zone: StagingOccupancy }> = ({ zone }) => {
  const pct = zone.utilizationPct;
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-nesma-secondary';

  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-sm font-medium text-white">{zone.zoneName}</span>
          <span className="text-xs text-gray-400 ml-2">{zone.zoneCode}</span>
        </div>
        <span className="text-xs text-gray-400">
          {zone.currentOccupancy} / {zone.capacity || '—'}
        </span>
      </div>
      <div className="w-full bg-white/10 rounded-full h-2">
        <div
          className={`${barColor} h-2 rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[10px] text-gray-500">{zone.stagedCount} items staged</span>
        <span className="text-[10px] text-gray-500">{pct}%</span>
      </div>
    </div>
  );
};

// ── Assignment Row ───────────────────────────────────────────────────

const AssignmentRow: React.FC<{
  assignment: StagingAssignment;
  onMove: (id: string) => void;
  isMoving: boolean;
}> = ({ assignment, onMove, isMoving }) => {
  const dwellPct = getDwellPct(assignment.stagedAt, assignment.maxDwellHours);
  const dwellColor = getDwellColor(dwellPct);
  const status = STATUS_COLORS[assignment.status] ?? STATUS_COLORS.staged;

  return (
    <div className="glass-card rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Package size={14} className="text-nesma-secondary flex-shrink-0" />
          <span className="text-sm font-medium text-white truncate">{assignment.item?.name ?? 'Unknown Item'}</span>
          <span className="text-xs text-gray-400">{assignment.item?.code}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>Qty: {assignment.quantity}</span>
          <span>{SOURCE_DOC_LABELS[assignment.sourceDocType] ?? assignment.sourceDocType}</span>
          <span>{assignment.zone?.zoneName}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className={`text-sm font-medium ${dwellColor}`}>
            <Clock size={12} className="inline mr-1" />
            {getDwellTime(assignment.stagedAt)}
          </div>
          <div className="w-20 bg-white/10 rounded-full h-1 mt-1">
            <div
              className={`${getDwellBarColor(dwellPct)} h-1 rounded-full`}
              style={{ width: `${Math.min(100, dwellPct)}%` }}
            />
          </div>
        </div>

        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${status.bg} ${status.text}`}>{status.label}</span>

        {assignment.status === 'staged' && (
          <button
            onClick={() => onMove(assignment.id)}
            disabled={isMoving}
            className="flex items-center gap-1 px-3 py-1.5 bg-nesma-primary hover:bg-nesma-primary/80 text-white rounded-lg text-xs transition-all disabled:opacity-50"
          >
            {isMoving ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
            Move
          </button>
        )}
      </div>
    </div>
  );
};

// ── Alert Row ────────────────────────────────────────────────────────

const AlertRow: React.FC<{ assignment: StagingAssignment }> = ({ assignment }) => {
  const maxMs = (assignment.maxDwellHours ?? 24) * 3_600_000;
  const elapsed = Date.now() - new Date(assignment.stagedAt).getTime();
  const overMs = elapsed - maxMs;
  const overHours = Math.floor(overMs / 3_600_000);
  const overMins = Math.floor((overMs % 3_600_000) / 60_000);
  const overText = overHours > 0 ? `${overHours}h ${overMins}m over` : `${overMins}m over`;

  return (
    <div className="glass-card rounded-xl p-4 border border-red-500/30">
      <div className="flex items-center gap-3">
        <AlertTriangle size={18} className="text-red-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{assignment.item?.name ?? 'Unknown Item'}</div>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
            <span>{assignment.zone?.zoneName}</span>
            <span>Qty: {assignment.quantity}</span>
            <span>Staged: {formatDateTime(assignment.stagedAt)}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold text-red-400">{overText}</span>
          <div className="text-[10px] text-gray-500">max {assignment.maxDwellHours ?? 24}h</div>
        </div>
      </div>
    </div>
  );
};

// ── New Assignment Modal ─────────────────────────────────────────────

const NewAssignmentModal: React.FC<{
  warehouseId: string;
  onClose: () => void;
}> = ({ warehouseId, onClose }) => {
  const { data: zonesResp } = useStagingZones(warehouseId);
  const zones = zonesResp?.data ?? [];
  const createMutation = useCreateStagingAssignment();

  const [form, setForm] = useState({
    zoneId: '',
    itemId: '',
    sourceDocType: 'grn',
    sourceDocId: '',
    quantity: 1,
    direction: 'inbound' as 'inbound' | 'outbound',
    maxDwellHours: 24,
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await createMutation.mutateAsync({
      ...form,
      warehouseId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="glass-panel rounded-2xl p-6 w-full max-w-lg border border-white/10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">New Staging Assignment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">Zone</label>
            <select
              value={form.zoneId}
              onChange={e => setForm(f => ({ ...f, zoneId: e.target.value }))}
              className="input-field w-full"
              required
            >
              <option value="">Select zone...</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>
                  {z.zoneName} ({z.zoneCode})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Direction</label>
              <select
                value={form.direction}
                onChange={e => setForm(f => ({ ...f, direction: e.target.value as 'inbound' | 'outbound' }))}
                className="input-field w-full"
              >
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Source Doc Type</label>
              <select
                value={form.sourceDocType}
                onChange={e => setForm(f => ({ ...f, sourceDocType: e.target.value }))}
                className="input-field w-full"
              >
                <option value="grn">GRN</option>
                <option value="mi">MI</option>
                <option value="wt">WT</option>
                <option value="cross_dock">Cross-Dock</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Source Document ID</label>
            <input
              type="text"
              value={form.sourceDocId}
              onChange={e => setForm(f => ({ ...f, sourceDocId: e.target.value }))}
              className="input-field w-full"
              placeholder="Document ID..."
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Item ID</label>
            <input
              type="text"
              value={form.itemId}
              onChange={e => setForm(f => ({ ...f, itemId: e.target.value }))}
              className="input-field w-full"
              placeholder="Item ID..."
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Quantity</label>
              <input
                type="number"
                min={1}
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: Number(e.target.value) }))}
                className="input-field w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">Max Dwell (hours)</label>
              <input
                type="number"
                min={1}
                value={form.maxDwellHours}
                onChange={e => setForm(f => ({ ...f, maxDwellHours: Number(e.target.value) }))}
                className="input-field w-full"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input-field w-full"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Create Assignment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────

type TabId = 'overview' | 'inbound' | 'outbound' | 'alerts';

export function StagingAreaPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [showNewModal, setShowNewModal] = useState(false);

  // Warehouse selector
  const { data: whResp } = useWarehouses();
  const warehouses = whResp?.data ?? [];
  const [warehouseId, setWarehouseId] = useState('');

  // Auto-select first warehouse
  React.useEffect(() => {
    if (!warehouseId && warehouses.length > 0) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  // Queries
  const { data: alertsResp } = useStagingAlerts(warehouseId || undefined);
  const alerts = alertsResp?.data ?? [];

  const { data: occupancyResp } = useStagingOccupancy(warehouseId || undefined);
  const occupancy = occupancyResp?.data ?? [];

  const { data: inboundResp } = useStagingAssignments(
    warehouseId ? { warehouseId, direction: 'inbound', status: 'staged', page: 1, pageSize: 50 } : undefined,
  );
  const inboundItems = inboundResp?.data ?? [];

  const { data: outboundResp } = useStagingAssignments(
    warehouseId ? { warehouseId, direction: 'outbound', status: 'staged', page: 1, pageSize: 50 } : undefined,
  );
  const outboundItems = outboundResp?.data ?? [];

  const moveMutation = useMoveFromStaging();

  const handleMove = (id: string) => {
    moveMutation.mutate(id);
  };

  // KPI counts
  const totalStaged = inboundItems.length + outboundItems.length;

  const tabs: { id: TabId; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'inbound', label: 'Inbound', icon: <ArrowDownCircle size={16} />, badge: inboundItems.length },
    { id: 'outbound', label: 'Outbound', icon: <ArrowUpCircle size={16} />, badge: outboundItems.length },
    { id: 'alerts', label: 'Alerts', icon: <AlertTriangle size={16} />, badge: alerts.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Layers size={28} className="text-nesma-secondary" />
            Staging Areas
          </h1>
          <p className="text-sm text-gray-400 mt-1">Manage inbound and outbound staging zones</p>
        </div>

        <div className="flex items-center gap-3">
          <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="input-field">
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>

          <button onClick={() => setShowNewModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={16} />
            New Assignment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  tab.id === 'alerts' ? 'bg-red-500/30 text-red-400' : 'bg-white/10 text-gray-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Staged" value={totalStaged} icon={<Layers size={20} />} />
            <KpiCard
              label="Inbound"
              value={inboundItems.length}
              icon={<ArrowDownCircle size={20} />}
              color="text-blue-400"
            />
            <KpiCard
              label="Outbound"
              value={outboundItems.length}
              icon={<ArrowUpCircle size={20} />}
              color="text-purple-400"
            />
            <KpiCard
              label="Overstay Alerts"
              value={alerts.length}
              icon={<AlertTriangle size={20} />}
              color="text-red-400"
              badge={alerts.length > 0 ? { count: alerts.length, color: 'bg-red-500/30 text-red-400' } : undefined}
            />
          </div>

          {/* Zone Occupancy */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4">Zone Occupancy</h2>
            {occupancy.length === 0 ? (
              <div className="glass-card rounded-2xl p-8 text-center">
                <Layers size={32} className="text-gray-500 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No staging zones configured for this warehouse.</p>
                <p className="text-xs text-gray-500 mt-1">
                  Create zones with type "staging_inbound" or "staging_outbound".
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {occupancy.map(zone => (
                  <OccupancyBar key={zone.zoneId} zone={zone} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'inbound' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Inbound Staging
            <span className="text-sm text-gray-400 font-normal ml-2">({inboundItems.length} items)</span>
          </h2>
          {inboundItems.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <ArrowDownCircle size={32} className="text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No inbound items currently staged.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {inboundItems.map(a => (
                <AssignmentRow key={a.id} assignment={a} onMove={handleMove} isMoving={moveMutation.isPending} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'outbound' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Outbound Staging
            <span className="text-sm text-gray-400 font-normal ml-2">({outboundItems.length} items)</span>
          </h2>
          {outboundItems.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <ArrowUpCircle size={32} className="text-gray-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No outbound items currently staged.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {outboundItems.map(a => (
                <AssignmentRow key={a.id} assignment={a} onMove={handleMove} isMoving={moveMutation.isPending} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white">
            Overstay Alerts
            <span className="text-sm text-gray-400 font-normal ml-2">({alerts.length} items)</span>
          </h2>
          {alerts.length === 0 ? (
            <div className="glass-card rounded-2xl p-8 text-center">
              <AlertTriangle size={32} className="text-emerald-500 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No overstay alerts. All items are within dwell limits.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map(a => (
                <AlertRow key={a.id} assignment={a} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* New Assignment Modal */}
      {showNewModal && warehouseId && (
        <NewAssignmentModal warehouseId={warehouseId} onClose={() => setShowNewModal(false)} />
      )}
    </div>
  );
}
