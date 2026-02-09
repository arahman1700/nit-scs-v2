import { CheckCircle, XCircle, Clock, Send, AlertTriangle, RotateCcw } from 'lucide-react';

type EmailStatus = 'queued' | 'sent' | 'delivered' | 'bounced' | 'failed';

interface EmailLog {
  id: string;
  templateCode: string;
  toAddress: string;
  subject: string;
  status: EmailStatus;
  sentAt: string | null;
  deliveredAt: string | null;
  error: string | null;
  createdAt: string;
}

interface EmailLogTableProps {
  logs: EmailLog[];
  isLoading?: boolean;
}

const STATUS_CONFIG: Record<EmailStatus, { icon: React.ElementType; color: string; bg: string }> = {
  queued: { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20' },
  sent: { icon: Send, color: 'text-blue-400', bg: 'bg-blue-500/20' },
  delivered: { icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  bounced: { icon: RotateCcw, color: 'text-amber-400', bg: 'bg-amber-500/20' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20' },
};

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

export const EmailLogTable: React.FC<EmailLogTableProps> = ({ logs, isLoading }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-[#80D1E9] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return <div className="text-center py-12 text-gray-500 text-sm">No emails sent yet.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Status</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Template</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">To</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Subject</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Sent</th>
            <th className="text-left text-xs text-gray-500 uppercase tracking-wide py-3 px-3">Error</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(log => {
            const cfg = STATUS_CONFIG[log.status] || STATUS_CONFIG.queued;
            const Icon = cfg.icon;
            return (
              <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full ${cfg.bg} ${cfg.color}`}
                  >
                    <Icon size={12} />
                    {log.status}
                  </span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-white/70 font-mono text-xs">{log.templateCode}</span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-white/80 text-xs">{log.toAddress}</span>
                </td>
                <td className="py-3 px-3">
                  <span className="text-gray-400 text-xs truncate max-w-[200px] block">{log.subject}</span>
                </td>
                <td className="py-3 px-3">
                  <span
                    className="text-gray-500 text-xs"
                    title={log.sentAt ? new Date(log.sentAt).toLocaleString() : ''}
                  >
                    {log.sentAt ? timeAgo(log.sentAt) : '-'}
                  </span>
                </td>
                <td className="py-3 px-3">
                  {log.error ? (
                    <span className="text-red-400 text-xs flex items-center gap-1" title={log.error}>
                      <AlertTriangle size={10} />
                      {log.error.length > 40 ? log.error.substring(0, 40) + '...' : log.error}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-xs">-</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
