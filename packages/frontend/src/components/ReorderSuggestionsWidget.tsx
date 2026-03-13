import React, { useState } from 'react';
import { Package, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useReorderSuggestions, useApplyReorderSuggestion } from '@/domains/inventory/hooks/useReorderSuggestions';
import type { ReorderSuggestion } from '@/domains/inventory/hooks/useReorderSuggestions';

// ── Row color logic ──────────────────────────────────────────────────────────

function getRowColor(suggestion: ReorderSuggestion): string {
  if (suggestion.currentQty <= 0) return 'bg-red-500/10 border-l-2 border-red-500';
  return 'bg-amber-500/10 border-l-2 border-amber-500';
}

function getQtyColor(suggestion: ReorderSuggestion): string {
  if (suggestion.currentQty <= 0) return 'text-red-400 font-bold';
  return 'text-amber-400 font-semibold';
}

// ── Apply row component ──────────────────────────────────────────────────────

interface ApplyRowProps {
  suggestion: ReorderSuggestion;
}

const ApplyRow: React.FC<ApplyRowProps> = ({ suggestion }) => {
  const [applied, setApplied] = useState(false);
  const applyMutation = useApplyReorderSuggestion();

  const handleApply = () => {
    applyMutation.mutate(
      {
        itemId: suggestion.itemId,
        warehouseId: suggestion.warehouseId,
        // Reapply the same reorder point to mark as acknowledged / refresh alert state
        reorderPoint: suggestion.reorderPoint,
      },
      {
        onSuccess: () => setApplied(true),
      },
    );
  };

  if (applied) {
    return (
      <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
        <CheckCircle2 size={14} />
        Applied
      </span>
    );
  }

  return (
    <button
      onClick={handleApply}
      disabled={applyMutation.isPending}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nesma-primary hover:bg-nesma-primary/80 text-white text-xs font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
      aria-label={`Apply reorder settings for ${suggestion.item.itemCode}`}
    >
      {applyMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
      Apply
    </button>
  );
};

// ── Main widget ──────────────────────────────────────────────────────────────

export const ReorderSuggestionsWidget: React.FC = () => {
  const { data: suggestions, isLoading, isError, refetch } = useReorderSuggestions();

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-5 w-48 bg-white/10 rounded animate-pulse" />
          <div className="h-5 w-16 bg-white/5 rounded animate-pulse" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-3 text-red-400">
          <AlertTriangle size={20} />
          <span className="text-sm">Failed to load reorder suggestions</span>
          <button
            onClick={() => void refetch()}
            className="ml-auto text-xs text-gray-400 hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const items = suggestions ?? [];

  // ── Empty state ────────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Package size={20} className="text-nesma-secondary" />
          <h3 className="text-lg font-semibold text-white">Reorder Suggestions</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
          <Package size={40} className="text-gray-600" />
          <p className="text-sm text-gray-400">All inventory levels are above reorder points</p>
        </div>
      </div>
    );
  }

  // ── Table view ─────────────────────────────────────────────────────────────

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={20} className="text-amber-400" />
          <h3 className="text-lg font-semibold text-white">Reorder Suggestions</h3>
        </div>
        <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full">
          {items.length} item{items.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2 pr-3">
                Item Code
              </th>
              <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2 pr-3">
                Description
              </th>
              <th className="text-left text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2 pr-3">
                Warehouse
              </th>
              <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2 pr-3">
                Current Qty
              </th>
              <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2 pr-3">
                Reorder Pt
              </th>
              <th className="text-right text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2 pr-3">
                Suggested Qty
              </th>
              <th className="text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest pb-2">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {items.map(suggestion => (
              <tr
                key={`${suggestion.itemId}-${suggestion.warehouseId}`}
                className={`${getRowColor(suggestion)} transition-colors`}
              >
                <td className="py-3 pr-3">
                  <span className="text-nesma-secondary font-mono text-xs">{suggestion.item.itemCode}</span>
                </td>
                <td className="py-3 pr-3 max-w-[180px]">
                  <span className="text-gray-300 truncate block" title={suggestion.item.itemDescription}>
                    {suggestion.item.itemDescription}
                  </span>
                </td>
                <td className="py-3 pr-3">
                  <span className="text-gray-400 text-xs">{suggestion.warehouse.warehouseCode}</span>
                </td>
                <td className="py-3 pr-3 text-right">
                  <span className={getQtyColor(suggestion)}>{suggestion.currentQty.toLocaleString()}</span>
                </td>
                <td className="py-3 pr-3 text-right">
                  <span className="text-gray-300">{suggestion.reorderPoint.toLocaleString()}</span>
                </td>
                <td className="py-3 pr-3 text-right">
                  <span className="text-white font-semibold">{suggestion.suggestedOrderQty.toLocaleString()}</span>
                </td>
                <td className="py-3 text-center">
                  <ApplyRow suggestion={suggestion} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 pt-2 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-gray-500">Out of stock</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-xs text-gray-500">Below reorder point</span>
        </div>
      </div>
    </div>
  );
};
