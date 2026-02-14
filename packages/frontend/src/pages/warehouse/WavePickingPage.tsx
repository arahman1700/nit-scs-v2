import React, { useState, useMemo } from 'react';
import {
  Waves,
  Plus,
  Package,
  MapPin,
  Clock,
  CheckCircle2,
  Play,
  ChevronRight,
  ArrowLeft,
  Route,
  Loader2,
  X,
} from 'lucide-react';
import { useWaveList, useWave, useCreateWave, useStartWave, useCompleteWave } from '@/api/hooks/usePickOptimizer';
import { useMiList } from '@/api/hooks/useMi';
import { useWarehouses } from '@/api/hooks/useMasterData';
import type { Wave, PickStop } from '@/api/hooks/usePickOptimizer';

// ── Status config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
  created: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Created', icon: <Package className="w-3 h-3" /> },
  picking: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Picking', icon: <Play className="w-3 h-3" /> },
  completed: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    label: 'Completed',
    icon: <CheckCircle2 className="w-3 h-3" />,
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

function groupStopsByZone(stops: PickStop[]): Map<string, PickStop[]> {
  const grouped = new Map<string, PickStop[]>();
  for (const stop of stops) {
    const zone = stop.zone || 'Unknown';
    if (!grouped.has(zone)) grouped.set(zone, []);
    grouped.get(zone)?.push(stop);
  }
  return grouped;
}

// ── Component ───────────────────────────────────────────────────────────

export const WavePickingPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>('active');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedWaveId, setSelectedWaveId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Queries
  const { data: warehousesRes } = useWarehouses();
  const warehouses =
    (warehousesRes as unknown as { data?: Array<{ id: string; warehouseName: string; warehouseCode: string }> })
      ?.data ?? [];

  const statusFilter = activeTab === 'completed' ? 'completed' : undefined;
  const { data: wavesRes, isLoading: wavesLoading } = useWaveList(selectedWarehouse || undefined, statusFilter);
  const allWaves = (wavesRes as unknown as { data?: Wave[] })?.data ?? [];

  // Filter active tab: created + picking
  const displayedWaves = useMemo(() => {
    if (activeTab === 'completed') return allWaves;
    return allWaves.filter(w => w.status === 'created' || w.status === 'picking');
  }, [allWaves, activeTab]);

  // Selected wave detail
  const { data: waveDetailRes, isLoading: detailLoading } = useWave(selectedWaveId ?? undefined);
  const waveDetail = (waveDetailRes as unknown as { data?: Wave })?.data;

  // Mutations
  const startMutation = useStartWave();
  const completeMutation = useCompleteWave();

  function handleStartPicking(waveId: string) {
    startMutation.mutate(waveId);
  }

  function handleCompleteWave(waveId: string) {
    completeMutation.mutate(waveId);
  }

  // ── Wave Detail View ──────────────────────────────────────────────────

  if (selectedWaveId) {
    const stops = waveDetail?.pickPath?.stops ?? [];
    const zoneGroups = groupStopsByZone(stops);

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedWaveId(null)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
          >
            <ArrowLeft className="w-5 h-5 text-gray-400" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold text-white">Wave Pick List</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {selectedWaveId.slice(0, 8)}... - {stops.length} stops
            </p>
          </div>
          {waveDetail && waveDetail.status === 'created' && (
            <button
              onClick={() => handleStartPicking(waveDetail.id)}
              disabled={startMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-xl hover:bg-amber-500/30 transition-colors border border-amber-500/30 text-sm font-medium"
            >
              <Play className="w-4 h-4" />
              Start Picking
            </button>
          )}
          {waveDetail && waveDetail.status === 'picking' && (
            <button
              onClick={() => handleCompleteWave(waveDetail.id)}
              disabled={completeMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-xl hover:bg-emerald-500/30 transition-colors border border-emerald-500/30 text-sm font-medium"
            >
              <CheckCircle2 className="w-4 h-4" />
              Complete Wave
            </button>
          )}
        </div>

        {detailLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="glass-card rounded-2xl p-4 border border-white/10">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</div>
                {waveDetail && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CONFIG[waveDetail.status]?.bg ?? ''} ${STATUS_CONFIG[waveDetail.status]?.text ?? ''}`}
                  >
                    {STATUS_CONFIG[waveDetail.status]?.icon}
                    {STATUS_CONFIG[waveDetail.status]?.label ?? waveDetail.status}
                  </span>
                )}
              </div>
              <div className="glass-card rounded-2xl p-4 border border-white/10">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Items</div>
                <div className="text-2xl font-bold text-white">{stops.length}</div>
              </div>
              <div className="glass-card rounded-2xl p-4 border border-white/10">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Distance</div>
                <div className="text-2xl font-bold text-white">
                  {waveDetail?.pickPath?.totalDistance ?? 0}{' '}
                  <span className="text-sm font-normal text-gray-400">units</span>
                </div>
              </div>
              <div className="glass-card rounded-2xl p-4 border border-white/10">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Est. Time</div>
                <div className="text-2xl font-bold text-white">
                  {waveDetail?.pickPath?.estimatedMinutes ?? 0}{' '}
                  <span className="text-sm font-normal text-gray-400">min</span>
                </div>
              </div>
            </div>

            {/* Pick path by zone */}
            <div className="space-y-4">
              {Array.from(zoneGroups.entries()).map(([zone, zoneStops]) => (
                <div key={zone} className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                  <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-nesma-primary" />
                    <span className="text-sm font-semibold text-white">Zone {zone}</span>
                    <span className="text-xs text-gray-500 ml-auto">{zoneStops.length} item(s)</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {zoneStops.map(stop => (
                      <div key={stop.stopOrder} className="px-5 py-3 flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-nesma-primary/20 text-nesma-primary flex items-center justify-center text-sm font-bold shrink-0">
                          {stop.stopOrder}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {stop.itemCode} - {stop.itemName}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            Bin: {stop.binNumber} (Aisle {stop.aisle}, Shelf {stop.shelf})
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-sm font-semibold text-white">{stop.quantity}</div>
                          <div className="text-xs text-gray-500">qty</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {stops.length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">No pick stops found for this wave.</div>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Wave List View ────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
            <Waves className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Wave Picking</h1>
            <p className="text-sm text-gray-400">Group MIs into optimized pick waves</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-nesma-primary text-white rounded-xl hover:bg-nesma-accent transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20"
        >
          <Plus className="w-4 h-4" />
          Create Wave
        </button>
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

      {/* Tab bar */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl border border-white/10 w-fit">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'active'
              ? 'bg-nesma-primary text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Active Waves
        </button>
        <button
          onClick={() => setActiveTab('completed')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'completed'
              ? 'bg-nesma-primary text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Completed
        </button>
      </div>

      {/* Wave cards */}
      {wavesLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : displayedWaves.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
          <Waves className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            {activeTab === 'active'
              ? 'No active waves. Create a new wave to start picking.'
              : 'No completed waves yet.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedWaves.map(wave => {
            const sc = STATUS_CONFIG[wave.status] ?? STATUS_CONFIG.created!;
            return (
              <button
                key={wave.id}
                onClick={() => setSelectedWaveId(wave.id)}
                className="glass-card rounded-2xl p-5 border border-white/10 hover:border-nesma-primary/40 transition-all text-left group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <span className="text-xs text-gray-500 font-mono">{wave.id.slice(0, 8)}...</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                      >
                        {sc.icon}
                        {sc.label}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-nesma-primary transition-colors" />
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div>
                    <div className="text-xs text-gray-500">MIs</div>
                    <div className="text-lg font-semibold text-white">{wave.miIds.length}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Items</div>
                    <div className="text-lg font-semibold text-white">{wave.itemCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Qty</div>
                    <div className="text-lg font-semibold text-white">{Math.round(wave.totalQuantity)}</div>
                  </div>
                </div>

                {wave.pickPath && (
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                    <Route className="w-3.5 h-3.5 text-gray-500" />
                    <span className="text-xs text-gray-500">
                      {wave.pickPath.totalDistance} dist / ~{wave.pickPath.estimatedMinutes} min
                    </span>
                  </div>
                )}

                <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  {formatDate(wave.createdAt)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Create Wave Modal */}
      {showCreateModal && (
        <CreateWaveModal
          warehouses={warehouses}
          onClose={() => setShowCreateModal(false)}
          defaultWarehouse={selectedWarehouse}
        />
      )}
    </div>
  );
};

// ── Create Wave Modal ──────────────────────────────────────────────────

interface CreateWaveModalProps {
  warehouses: Array<{ id: string; warehouseName: string; warehouseCode: string }>;
  onClose: () => void;
  defaultWarehouse: string;
}

function CreateWaveModal({ warehouses, onClose, defaultWarehouse }: CreateWaveModalProps) {
  const [warehouseId, setWarehouseId] = useState(defaultWarehouse);
  const [selectedMis, setSelectedMis] = useState<Set<string>>(new Set());

  // Fetch approved MIs for the selected warehouse
  const { data: miRes, isLoading: miLoading } = useMiList(
    warehouseId
      ? ({ page: 1, pageSize: 100, status: 'approved', warehouseId } as Record<
          string,
          unknown
        > as import('@/api/types').ListParams)
      : undefined,
  );
  const mis =
    (
      miRes as unknown as {
        data?: Array<{
          id: string;
          mirvNumber: string;
          project?: { name: string };
          requestDate: string;
          _count?: { lines: number };
        }>;
      }
    )?.data ?? [];

  const createMutation = useCreateWave();

  function toggleMi(id: string) {
    setSelectedMis(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selectedMis.size === mis.length) {
      setSelectedMis(new Set());
    } else {
      setSelectedMis(new Set(mis.map(m => m.id)));
    }
  }

  function handleCreate() {
    if (!warehouseId || selectedMis.size === 0) return;
    createMutation.mutate({ warehouseId, miIds: Array.from(selectedMis) }, { onSuccess: () => onClose() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl border border-white/10 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Create Pick Wave</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Warehouse selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Warehouse</label>
            <select
              value={warehouseId}
              onChange={e => {
                setWarehouseId(e.target.value);
                setSelectedMis(new Set());
              }}
              className="input-field w-full"
            >
              <option value="">Select warehouse...</option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.warehouseCode} - {w.warehouseName}
                </option>
              ))}
            </select>
          </div>

          {/* MI selection */}
          {warehouseId && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-400">Approved MIs ({selectedMis.size} selected)</label>
                {mis.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs text-nesma-primary hover:text-nesma-accent transition-colors"
                  >
                    {selectedMis.size === mis.length ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>

              {miLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
                </div>
              ) : mis.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No approved MIs available for this warehouse.
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {mis.map(mi => (
                    <label
                      key={mi.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        selectedMis.has(mi.id)
                          ? 'border-nesma-primary/50 bg-nesma-primary/10'
                          : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedMis.has(mi.id)}
                        onChange={() => toggleMi(mi.id)}
                        className="rounded border-white/20 bg-white/10 text-nesma-primary focus:ring-nesma-primary/50"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white">{mi.mirvNumber}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {mi.project?.name ?? 'No project'} - {new Date(mi.requestDate).toLocaleDateString('en-GB')}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!warehouseId || selectedMis.size === 0 || createMutation.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-nesma-primary text-white rounded-xl hover:bg-nesma-accent transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Wave ({selectedMis.size} MIs)
          </button>
        </div>
      </div>
    </div>
  );
}
