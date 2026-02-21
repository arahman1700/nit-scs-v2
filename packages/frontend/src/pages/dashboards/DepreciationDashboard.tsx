import React from 'react';
import { TrendingDown, DollarSign, Building, Info } from 'lucide-react';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

// ── Depreciation Dashboard (Placeholder) ───────────────────────────────────
// Rendered as tab content inside AssetSectionPage (Depreciation tab).
// No real data hooks yet -- displays placeholder structure and info message.

export const DepreciationDashboard: React.FC = () => {
  return (
    <RouteErrorBoundary label="Depreciation Dashboard">
      <div className="space-y-6">
        {/* ── Summary Cards (placeholder) ────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <Building className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400">Total Asset Value</p>
            </div>
            <p className="text-2xl font-bold text-gray-500">&mdash;</p>
          </div>

          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
                <TrendingDown className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400">Accumulated Depreciation</p>
            </div>
            <p className="text-2xl font-bold text-gray-500">&mdash;</p>
          </div>

          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400">Net Book Value</p>
            </div>
            <p className="text-2xl font-bold text-gray-500">&mdash;</p>
          </div>

          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                <TrendingDown className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400">Monthly Depreciation</p>
            </div>
            <p className="text-2xl font-bold text-gray-500">&mdash;</p>
          </div>
        </div>

        {/* ── Info Notice ────────────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-6 flex items-start gap-4 border border-blue-500/20">
          <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-white font-semibold mb-1">Coming Soon</h4>
            <p className="text-gray-400 text-sm">
              Depreciation calculations will be integrated with the Fixed Assets module. Once connected, this dashboard
              will show straight-line and declining-balance depreciation schedules, monthly entries, and net book value
              trends for all registered fixed assets.
            </p>
          </div>
        </div>

        {/* ── Placeholder Table ──────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">Depreciation Entries</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-400 border-b border-white/10">
                <tr>
                  <th className="pb-3 pt-3 pl-4">Asset</th>
                  <th className="pb-3 pt-3">Category</th>
                  <th className="pb-3 pt-3 text-right">Original Cost</th>
                  <th className="pb-3 pt-3 text-right">Accum. Depreciation</th>
                  <th className="pb-3 pt-3 text-right">Net Book Value</th>
                  <th className="pb-3 pt-3">Method</th>
                  <th className="pb-3 pt-3 pr-4">Period</th>
                </tr>
              </thead>
              <tbody className="text-white">
                <tr>
                  <td colSpan={7} className="py-16 text-center text-gray-500">
                    <TrendingDown className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                    <p className="text-sm">No depreciation entries yet</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Entries will appear once the Fixed Assets module is connected.
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RouteErrorBoundary>
  );
};
