import React, { useMemo } from 'react';
import { Gavel, DollarSign, Loader2 } from 'lucide-react';
import { useSscList, useScrapList } from '@/api/hooks';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { StatusBadge } from '@/components/StatusBadge';

// ── SSC Dashboard ──────────────────────────────────────────────────────────
// Rendered as tab content inside AssetSectionPage (SSC tab).
// Shows scrap-selling-committee bids, summary KPIs, and active scrap count.

export const SscDashboard: React.FC = () => {
  const { data: sscResponse, isLoading: sscLoading } = useSscList({ pageSize: 20 });
  const { data: scrapResponse, isLoading: scrapLoading } = useScrapList({ status: 'in_ssc' });

  const rows = (sscResponse?.data ?? []) as Record<string, unknown>[];
  const scrapRows = (scrapResponse?.data ?? []) as unknown as Record<string, unknown>[];

  const isLoading = sscLoading || scrapLoading;

  // ── Summary KPIs ───────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalBids = rows.length;
    const accepted = rows.filter(r => String(r.status ?? '').toLowerCase() === 'accepted').length;
    const pending = rows.filter(r => String(r.status ?? '').toLowerCase() === 'pending').length;
    const totalValue = rows.reduce((sum, r) => sum + Number(r.bidAmount ?? 0), 0);
    return { totalBids, accepted, pending, totalValue };
  }, [rows]);

  const formatAmount = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toLocaleString();
  };

  const formatDate = (dateStr: unknown) => {
    if (!dateStr || typeof dateStr !== 'string') return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-nesma-secondary animate-spin" />
        <span className="ml-3 text-gray-400">Loading SSC data...</span>
      </div>
    );
  }

  return (
    <RouteErrorBoundary label="SSC Dashboard">
      <div className="space-y-6">
        {/* ── Summary Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                <Gavel className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400">Total Bids</p>
            </div>
            <p className="text-2xl font-bold text-white">{summary.totalBids}</p>
          </div>

          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                <Gavel className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400">Accepted</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{summary.accepted}</p>
          </div>

          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
                <Gavel className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400">Pending</p>
            </div>
            <p className="text-2xl font-bold text-amber-400">{summary.pending}</p>
          </div>

          <div className="glass-card p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                <DollarSign className="w-4 h-4" />
              </div>
              <p className="text-xs text-gray-400">Total Value</p>
            </div>
            <p className="text-2xl font-bold text-white">
              {formatAmount(summary.totalValue)} <span className="text-sm font-normal text-gray-400">SAR</span>
            </p>
          </div>
        </div>

        {/* ── Active Scrap Batches ───────────────────────────────────────── */}
        <div className="glass-card p-4 rounded-xl flex items-center gap-4">
          <div className="p-2 bg-orange-500/20 rounded-lg text-orange-400">
            <Gavel className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-gray-400">Active Scrap Batches in SSC</p>
            <p className="text-xl font-bold text-white">{scrapRows.length}</p>
          </div>
        </div>

        {/* ── Bids Table ─────────────────────────────────────────────────── */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h3 className="text-lg font-semibold text-white">SSC Bids</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-gray-400 border-b border-white/10">
                <tr>
                  <th className="pb-3 pt-3 pl-4">Scrap Batch</th>
                  <th className="pb-3 pt-3">Bidder Name</th>
                  <th className="pb-3 pt-3 text-right">Bid Amount (SAR)</th>
                  <th className="pb-3 pt-3">Date</th>
                  <th className="pb-3 pt-3 pr-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="text-white divide-y divide-white/5">
                {rows.length > 0 ? (
                  rows.map((row, idx) => (
                    <tr key={String(row.id ?? idx)} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pl-4 font-mono text-gray-300">
                        {String(row.scrapBatchNumber ?? row.scrapId ?? '--')}
                      </td>
                      <td className="py-3">{String(row.bidderName ?? '--')}</td>
                      <td className="py-3 text-right font-medium">{Number(row.bidAmount ?? 0).toLocaleString()}</td>
                      <td className="py-3 text-gray-400">{formatDate(row.bidDate ?? row.createdAt)}</td>
                      <td className="py-3 pr-4 text-center">
                        <StatusBadge status={String(row.status ?? 'Draft')} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-gray-500">
                      No SSC bids found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </RouteErrorBoundary>
  );
};
