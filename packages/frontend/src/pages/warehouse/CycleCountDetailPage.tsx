import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  CheckCircle2,
  XCircle,
  ListChecks,
  Settings2,
  Clock,
  AlertTriangle,
  Package,
} from 'lucide-react';
import {
  useCycleCount,
  useGenerateLines,
  useStartCycleCount,
  useRecordCount,
  useCompleteCycleCount,
  useApplyAdjustments,
  useCancelCycleCount,
} from '@/api/hooks';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  in_progress: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

const LINE_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: 'bg-gray-500/20', text: 'text-gray-400' },
  counted: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  verified: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  adjusted: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
};

const COUNT_TYPE_LABELS: Record<string, string> = {
  full: 'Full Count',
  abc_based: 'ABC-Based',
  zone: 'Zone Count',
  random: 'Random Sample',
};

export const CycleCountDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: detailData, isLoading } = useCycleCount(id);
  const generateLines = useGenerateLines();
  const startCount = useStartCycleCount();
  const completeCount = useCompleteCycleCount();
  const applyAdjustments = useApplyAdjustments();
  const cancelCount = useCancelCycleCount();

  const cycleCount = detailData?.data;
  const lines = cycleCount?.lines ?? [];

  const pendingCount = lines.filter(l => l.status === 'pending').length;
  const countedCount = lines.filter(l => l.status === 'counted').length;
  const withVariance = lines.filter(l => l.varianceQty !== null && l.varianceQty !== 0).length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-card rounded-2xl p-6 animate-pulse">
          <div className="h-6 bg-white/10 rounded w-48 mb-4" />
          <div className="h-4 bg-white/10 rounded w-32" />
        </div>
      </div>
    );
  }

  if (!cycleCount) {
    return <div className="text-center py-16 text-gray-500">Cycle count not found.</div>;
  }

  const statusCfg = STATUS_COLORS[cycleCount.status] || STATUS_COLORS.scheduled;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/warehouse/cycle-counts')}
            className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-400" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{cycleCount.countNumber}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                {cycleCount.status.replace('_', ' ')}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {COUNT_TYPE_LABELS[cycleCount.countType]} | {cycleCount.warehouse?.warehouseCode}
              {cycleCount.zone ? ` / ${cycleCount.zone.zoneCode}` : ''}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {cycleCount.status === 'scheduled' && (
            <>
              <button
                onClick={() => generateLines.mutate(id!)}
                disabled={generateLines.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-white/10 text-gray-300 hover:bg-white/5"
              >
                <ListChecks className="w-4 h-4" />
                {generateLines.isPending ? 'Generating...' : 'Generate Lines'}
              </button>
              <button
                onClick={() => startCount.mutate(id!)}
                disabled={startCount.isPending || lines.length === 0}
                className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                {startCount.isPending ? 'Starting...' : 'Start Count'}
              </button>
            </>
          )}

          {cycleCount.status === 'in_progress' && (
            <button
              onClick={() => completeCount.mutate(id!)}
              disabled={completeCount.isPending || pendingCount > 0}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm disabled:opacity-50"
              title={pendingCount > 0 ? `${pendingCount} line(s) still pending` : ''}
            >
              <CheckCircle2 className="w-4 h-4" />
              {completeCount.isPending ? 'Completing...' : 'Complete Count'}
            </button>
          )}

          {cycleCount.status === 'completed' && withVariance > 0 && (
            <button
              onClick={() => applyAdjustments.mutate(id!)}
              disabled={applyAdjustments.isPending}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            >
              <Settings2 className="w-4 h-4" />
              {applyAdjustments.isPending ? 'Applying...' : `Apply Adjustments (${withVariance})`}
            </button>
          )}

          {(cycleCount.status === 'scheduled' || cycleCount.status === 'in_progress') && (
            <button
              onClick={() => cancelCount.mutate(id!)}
              disabled={cancelCount.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <XCircle className="w-4 h-4" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-400">Scheduled</span>
          </div>
          <div className="text-sm text-white">
            {new Date(cycleCount.scheduledDate).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-gray-500" />
            <span className="text-xs text-gray-400">Total Lines</span>
          </div>
          <div className="text-sm text-white font-semibold">{lines.length}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-gray-400">Counted</span>
          </div>
          <div className="text-sm text-emerald-400 font-semibold">{countedCount}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-amber-500" />
            <span className="text-xs text-gray-400">Pending</span>
          </div>
          <div className="text-sm text-amber-400 font-semibold">{pendingCount}</div>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-xs text-gray-400">Variances</span>
          </div>
          <div className="text-sm text-red-400 font-semibold">{withVariance}</div>
        </div>
      </div>

      {/* Notes */}
      {cycleCount.notes && (
        <div className="glass-card rounded-2xl p-4">
          <span className="text-xs text-gray-400">Notes:</span>
          <p className="text-sm text-gray-300 mt-1">{cycleCount.notes}</p>
        </div>
      )}

      {/* Lines Table */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Count Lines</h2>

        {lines.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            <ListChecks className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No lines yet. Generate lines to populate the count.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-3 text-gray-400 font-medium">Item Code</th>
                  <th className="text-left py-3 px-3 text-gray-400 font-medium">Description</th>
                  <th className="text-center py-3 px-3 text-gray-400 font-medium">ABC</th>
                  {cycleCount.status !== 'in_progress' && (
                    <th className="text-right py-3 px-3 text-gray-400 font-medium">Expected</th>
                  )}
                  <th className="text-right py-3 px-3 text-gray-400 font-medium">Counted</th>
                  {cycleCount.status !== 'in_progress' && (
                    <>
                      <th className="text-right py-3 px-3 text-gray-400 font-medium">Variance</th>
                      <th className="text-right py-3 px-3 text-gray-400 font-medium">Var %</th>
                    </>
                  )}
                  <th className="text-center py-3 px-3 text-gray-400 font-medium">Status</th>
                  {cycleCount.status === 'in_progress' && (
                    <th className="text-center py-3 px-3 text-gray-400 font-medium">Action</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {lines.map(line => {
                  const lineStatus = LINE_STATUS_COLORS[line.status] || LINE_STATUS_COLORS.pending;
                  const hasVariance = line.varianceQty !== null && line.varianceQty !== 0;

                  return (
                    <tr key={line.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 text-white font-mono text-xs">{line.item?.itemCode}</td>
                      <td className="py-3 px-3 text-gray-300 max-w-[250px] truncate">{line.item?.itemDescription}</td>
                      <td className="py-3 px-3 text-center">
                        {line.item?.abcClass ? (
                          <span className="text-xs font-semibold text-gray-300">{line.item.abcClass}</span>
                        ) : (
                          <span className="text-xs text-gray-600">-</span>
                        )}
                      </td>
                      {cycleCount.status !== 'in_progress' && (
                        <td className="py-3 px-3 text-right text-gray-300">{line.expectedQty.toFixed(1)}</td>
                      )}
                      <td className="py-3 px-3 text-right text-white">
                        {line.countedQty !== null ? line.countedQty.toFixed(1) : '-'}
                      </td>
                      {cycleCount.status !== 'in_progress' && (
                        <>
                          <td className={`py-3 px-3 text-right ${hasVariance ? 'text-red-400' : 'text-gray-400'}`}>
                            {line.varianceQty !== null ? line.varianceQty.toFixed(1) : '-'}
                          </td>
                          <td className={`py-3 px-3 text-right ${hasVariance ? 'text-red-400' : 'text-gray-400'}`}>
                            {line.variancePercent !== null ? `${line.variancePercent.toFixed(1)}%` : '-'}
                          </td>
                        </>
                      )}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${lineStatus.bg} ${lineStatus.text}`}
                        >
                          {line.status}
                        </span>
                      </td>
                      {cycleCount.status === 'in_progress' && (
                        <td className="py-3 px-3 text-center">
                          {line.status === 'pending' ? (
                            <CountInputCell cycleCountId={id!} line={line} />
                          ) : (
                            <span className="text-xs text-gray-500">Done</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Inline Count Input ────────────────────────────────────────────────────

const CountInputCell: React.FC<{
  cycleCountId: string;
  line: { id: string; expectedQty: number };
}> = ({ cycleCountId, line }) => {
  const [qty, setQty] = useState('');
  const recordCount = useRecordCount();

  const handleSubmit = () => {
    if (qty === '') return;
    recordCount.mutate({
      cycleCountId,
      lineId: line.id,
      countedQty: parseFloat(qty),
    });
  };

  return (
    <div className="flex items-center gap-1 justify-center">
      <input
        type="number"
        step="0.1"
        min="0"
        value={qty}
        onChange={e => setQty(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        placeholder="Qty"
        className="input-field w-20 py-1 px-2 text-xs rounded-lg text-center"
        disabled={recordCount.isPending}
      />
      <button
        onClick={handleSubmit}
        disabled={recordCount.isPending || qty === ''}
        className="p-1 rounded-lg bg-nesma-primary/20 text-nesma-primary hover:bg-nesma-primary/30 disabled:opacity-50"
      >
        <CheckCircle2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
