import { useState } from 'react';
import { Mail, BarChart3 } from 'lucide-react';
import { useEmailLogs, useEmailLogStats } from '@/api/hooks/useEmailTemplates';
import { EmailLogTable } from '@/components/email/EmailLogTable';

interface LogStats {
  total: number;
  sent: number;
  delivered: number;
  bounced: number;
  failed: number;
}

export const EmailLogsPage: React.FC = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const { data: logsData, isLoading } = useEmailLogs({ page, pageSize: 25, status: statusFilter || undefined });
  const { data: statsData } = useEmailLogStats();

  const logs = ((logsData as { data?: unknown[] })?.data || []) as {
    id: string;
    templateCode: string;
    toAddress: string;
    subject: string;
    status: 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';
    sentAt: string | null;
    deliveredAt: string | null;
    error: string | null;
    createdAt: string;
  }[];

  const stats = (statsData as unknown as { data?: LogStats })?.data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Mail size={20} className="text-blue-400" />
          Email Delivery Logs
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">Track email delivery status from workflow-triggered emails.</p>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-white' },
            { label: 'Sent', value: stats.sent, color: 'text-blue-400' },
            { label: 'Delivered', value: stats.delivered, color: 'text-emerald-400' },
            { label: 'Bounced', value: stats.bounced, color: 'text-amber-400' },
            { label: 'Failed', value: stats.failed, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-white/[0.03] rounded-xl border border-white/5 p-3 text-center">
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={e => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="bg-black/40 text-white text-sm rounded-lg p-2.5 border border-white/10 focus:border-[#80D1E9] outline-none"
        >
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="bounced">Bounced</option>
          <option value="failed">Failed</option>
        </select>
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <BarChart3 size={12} /> Page {page}
        </span>
      </div>

      {/* Log table */}
      <EmailLogTable logs={logs} isLoading={isLoading} />

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page <= 1}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors text-sm disabled:opacity-30"
        >
          Previous
        </button>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={logs.length < 25}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white transition-colors text-sm disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
};
