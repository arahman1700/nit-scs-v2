import React, { useState, useMemo } from 'react';

import { useExpiringLots } from '@/domains/inventory/hooks/useExpiryAlerts';
import type { ExpiringItemGroup, ExpiringLot } from '@/domains/inventory/hooks/useExpiryAlerts';

import { AlertTriangle, Package, ChevronDown, ChevronRight, MapPin, Calendar, Layers } from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

type UrgencyLevel = 'critical' | 'warning' | 'caution';

function getUrgency(expiryDate: string | null): UrgencyLevel {
  if (!expiryDate) return 'caution';
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 30) return 'critical';
  if (diffDays < 60) return 'warning';
  return 'caution';
}

const URGENCY_STYLES: Record<UrgencyLevel, { badge: string; row: string; label: string }> = {
  critical: {
    badge: 'bg-red-500/20 text-red-400 border border-red-500/30',
    row: 'border-l-2 border-l-red-500',
    label: 'Critical',
  },
  warning: {
    badge: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    row: 'border-l-2 border-l-amber-500',
    label: 'Warning',
  },
  caution: {
    badge: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
    row: 'border-l-2 border-l-yellow-500',
    label: 'Caution',
  },
};

const DAYS_OPTIONS = [30, 60, 90] as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

// ── Component ────────────────────────────────────────────────────────────────

export const ExpiryAlertsPage: React.FC = () => {
  const [daysAhead, setDaysAhead] = useState<number>(60);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const { data: response, isLoading, isError, refetch } = useExpiringLots(daysAhead);

  const groups: ExpiringItemGroup[] = useMemo(() => response?.data ?? [], [response]);
  const meta = response?.meta;

  // Toggle expand/collapse for a group
  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  // Expand all / collapse all
  const allExpanded = groups.length > 0 && expandedItems.size === groups.length;
  const toggleAll = () => {
    if (allExpanded) {
      setExpandedItems(new Set());
    } else {
      setExpandedItems(new Set(groups.map(g => g.item.id)));
    }
  };

  // Compute total qty across all groups
  const totalQty = useMemo(() => groups.reduce((sum, g) => sum + g.totalQty, 0), [groups]);
  const totalLots = meta?.totalLots ?? groups.reduce((sum, g) => sum + g.lots.length, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text flex items-center gap-3">
            <AlertTriangle className="text-amber-400" />
            Expiry Alerts
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Lot-tracked inventory approaching expiry dates
            {meta?.asOf && (
              <span className="text-gray-500 ml-2">(as of {new Date(meta.asOf).toLocaleDateString()})</span>
            )}
          </p>
        </div>
      </div>

      {/* ── Days Ahead Selector ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-400">Show items expiring within:</span>
        <div className="flex border border-white/10 rounded-lg overflow-hidden">
          {DAYS_OPTIONS.map(d => (
            <button
              key={d}
              onClick={() => setDaysAhead(d)}
              className={`px-4 py-2 text-sm font-medium transition-all ${
                daysAhead === d ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Summary Row ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Package size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">
                {isLoading ? (
                  <span className="animate-pulse bg-white/10 rounded w-10 h-7 inline-block" />
                ) : (
                  (meta?.totalItems ?? groups.length)
                )}
              </p>
              <p className="text-xs text-gray-400">Items At Risk</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-nesma-primary/20 rounded-lg">
              <Layers size={20} className="text-nesma-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {isLoading ? <span className="animate-pulse bg-white/10 rounded w-10 h-7 inline-block" /> : totalLots}
              </p>
              <p className="text-xs text-gray-400">Total Lots</p>
            </div>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {isLoading ? (
                  <span className="animate-pulse bg-white/10 rounded w-10 h-7 inline-block" />
                ) : (
                  totalQty.toLocaleString()
                )}
              </p>
              <p className="text-xs text-gray-400">Total Qty At Risk</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Error State ───────────────────────────────────────────────────── */}
      {isError && (
        <div className="glass-card rounded-2xl p-6 border border-red-500/20 text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-medium">Failed to load expiry data</p>
          <p className="text-gray-500 text-sm mt-1">Check your connection and try again</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-nesma-primary text-white rounded-lg text-sm hover:bg-nesma-primary/80 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading Skeleton ──────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="bg-white/10 rounded w-6 h-6" />
                <div className="flex-1 space-y-2">
                  <div className="bg-white/10 rounded h-5 w-48" />
                  <div className="bg-white/10 rounded h-4 w-32" />
                </div>
                <div className="bg-white/10 rounded h-6 w-16" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Grouped List ──────────────────────────────────────────────────── */}
      {!isLoading && !isError && (
        <>
          {/* Expand/Collapse toggle */}
          {groups.length > 0 && (
            <div className="flex justify-end">
              <button onClick={toggleAll} className="text-xs text-nesma-secondary hover:text-white transition-colors">
                {allExpanded ? 'Collapse All' : 'Expand All'}
              </button>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center border border-white/10">
              <Package size={40} className="mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-semibold text-white mb-2">No Expiry Alerts</h3>
              <p className="text-gray-400 text-sm">No items are expiring within the next {daysAhead} days.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map(group => {
                const isExpanded = expandedItems.has(group.item.id);
                // Determine worst urgency for the group header badge
                const worstUrgency: UrgencyLevel = group.lots.reduce<UrgencyLevel>((worst, lot) => {
                  const u = getUrgency(lot.expiryDate);
                  if (u === 'critical') return 'critical';
                  if (u === 'warning' && worst !== 'critical') return 'warning';
                  return worst;
                }, 'caution');

                return (
                  <div key={group.item.id} className="glass-card rounded-2xl overflow-hidden border border-white/10">
                    {/* Group Header */}
                    <button
                      onClick={() => toggleExpand(group.item.id)}
                      className="w-full flex items-center gap-4 p-4 md:p-5 hover:bg-white/5 transition-all text-left"
                      aria-label={`Toggle lots for ${group.item.itemCode}`}
                    >
                      <div className="text-gray-400">
                        {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-nesma-secondary text-sm font-medium">
                            {group.item.itemCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${URGENCY_STYLES[worstUrgency].badge}`}
                          >
                            {URGENCY_STYLES[worstUrgency].label}
                          </span>
                          {group.item.category && (
                            <span className="px-2 py-0.5 bg-nesma-primary/20 text-nesma-secondary rounded text-xs">
                              {group.item.category}
                            </span>
                          )}
                        </div>
                        <p className="text-white text-sm truncate">{group.item.itemDescription}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-white">{group.totalQty.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                          {group.lots.length} lot{group.lots.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </button>

                    {/* Expanded Lot Rows */}
                    {isExpanded && (
                      <div className="border-t border-white/10">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm">
                            <thead className="text-gray-400 text-xs uppercase tracking-wider border-b border-white/5 bg-white/[0.02]">
                              <tr>
                                <th className="px-5 py-3">Lot Number</th>
                                <th className="px-5 py-3">Expiry Date</th>
                                <th className="px-5 py-3">Days Left</th>
                                <th className="px-5 py-3 text-right">Qty</th>
                                <th className="px-5 py-3">Warehouse</th>
                                <th className="px-5 py-3">Bin Location</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {group.lots.map((lot: ExpiringLot) => {
                                const urgency = getUrgency(lot.expiryDate);
                                const days = daysUntil(lot.expiryDate);
                                return (
                                  <tr
                                    key={lot.id}
                                    className={`hover:bg-white/5 transition-colors ${URGENCY_STYLES[urgency].row}`}
                                  >
                                    <td className="px-5 py-3 font-mono text-white text-xs">{lot.lotNumber || '--'}</td>
                                    <td className="px-5 py-3">
                                      <span className="flex items-center gap-1.5 text-gray-300">
                                        <Calendar size={13} className="text-gray-500" />
                                        {formatDate(lot.expiryDate)}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3">
                                      {days !== null ? (
                                        <span
                                          className={`px-2 py-0.5 rounded text-xs font-medium ${URGENCY_STYLES[urgency].badge}`}
                                        >
                                          {days <= 0 ? 'Expired' : `${days}d`}
                                        </span>
                                      ) : (
                                        <span className="text-gray-500 text-xs">--</span>
                                      )}
                                    </td>
                                    <td className="px-5 py-3 text-right font-mono text-white font-medium">
                                      {lot.availableQty.toLocaleString()}
                                    </td>
                                    <td className="px-5 py-3">
                                      <span className="flex items-center gap-1.5 text-gray-400 text-xs">
                                        <MapPin size={12} />
                                        {lot.warehouse?.warehouseName ?? '--'}
                                      </span>
                                    </td>
                                    <td className="px-5 py-3 text-gray-400 text-xs">{lot.binLocation || '--'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};
