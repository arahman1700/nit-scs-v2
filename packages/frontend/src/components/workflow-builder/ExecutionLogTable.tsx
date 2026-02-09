import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';

interface ExecutionLog {
  id: string;
  ruleId: string;
  ruleName?: string;
  triggerEvent: string;
  matched: boolean;
  actionsRun: { type: string; success: boolean; error?: string }[];
  executionTimeMs: number;
  error: string | null;
  createdAt: string;
}

interface ExecutionLogTableProps {
  logs: ExecutionLog[];
  isLoading?: boolean;
}

function StatusIcon({ log }: { log: ExecutionLog }) {
  if (log.error) return <XCircle size={16} className="text-red-400" />;
  if (!log.matched) return <Clock size={16} className="text-gray-500" />;
  const anyFailed = log.actionsRun.some(a => !a.success);
  if (anyFailed) return <AlertTriangle size={16} className="text-amber-400" />;
  return <CheckCircle size={16} className="text-emerald-400" />;
}

function formatTime(ms: number): string {
  if (ms < 1) return '<1ms';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export const ExecutionLogTable: React.FC<ExecutionLogTableProps> = ({ logs, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#80D1E9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        No execution logs yet. Trigger an event to see results.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Status</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Event</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Matched</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Actions</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Time</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">When</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => (
            <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
              <td className="py-3 px-3">
                <StatusIcon log={log} />
              </td>
              <td className="py-3 px-3">
                <span className="text-white/80 font-mono text-xs">{log.triggerEvent}</span>
              </td>
              <td className="py-3 px-3">
                <span className={`text-xs font-bold ${log.matched ? 'text-emerald-400' : 'text-gray-600'}`}>
                  {log.matched ? 'YES' : 'NO'}
                </span>
              </td>
              <td className="py-3 px-3">
                {log.actionsRun.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {log.actionsRun.map((a, i) => (
                      <span
                        key={i}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          a.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'
                        }`}
                        title={a.error || ''}
                      >
                        {a.type}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-600 text-xs">-</span>
                )}
              </td>
              <td className="py-3 px-3">
                <span className="text-gray-400 text-xs font-mono">{formatTime(log.executionTimeMs)}</span>
              </td>
              <td className="py-3 px-3">
                <span className="text-gray-500 text-xs" title={new Date(log.createdAt).toLocaleString()}>
                  {timeAgo(log.createdAt)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
