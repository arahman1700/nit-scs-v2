import React, { useState, useMemo } from 'react';
import { FileText, Search, Download, ChevronRight } from 'lucide-react';
import { useAuditLogs } from '@/api/hooks';
import { formatRelativeTime } from '@nit-scs/shared/formatters';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  update: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  delete: 'bg-red-500/20 text-red-400 border-red-500/30',
  approve: 'bg-green-500/20 text-green-400 border-green-500/30',
  reject: 'bg-red-500/20 text-red-400 border-red-500/30',
  status_change: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  login: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  export: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

// ── Loading Skeleton ───────────────────────────────────────────────────────

const AuditSkeleton: React.FC = () => (
  <div className="glass-card rounded-2xl overflow-hidden border border-white/10 animate-pulse">
    <div className="divide-y divide-white/5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-6 py-4 flex items-start gap-4">
          <div className="h-5 w-16 bg-white/10 rounded-full mt-1"></div>
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-white/10 rounded"></div>
            <div className="h-3 w-1/2 bg-white/5 rounded"></div>
          </div>
          <div className="h-3 w-20 bg-white/5 rounded"></div>
        </div>
      ))}
    </div>
  </div>
);

export const AuditLogPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const params = useMemo(() => ({
    page: currentPage,
    pageSize: 50,
    search: searchTerm || undefined,
    action: filterAction || undefined,
    tableName: filterEntity || undefined,
  }), [currentPage, searchTerm, filterAction, filterEntity]);

  const { data: response, isLoading, isError } = useAuditLogs(params);

  const logs = response?.data ?? [];
  const meta = response?.meta;

  // Extract unique entity types and actions for filter dropdowns
  const entityTypes = useMemo(() => {
    const types = new Set(logs.map(l => l.entityType));
    return Array.from(types);
  }, [logs]);

  const actionTypes = useMemo(() => {
    const actions = new Set(logs.map(l => l.action));
    return Array.from(actions);
  }, [logs]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Audit Log</h1>
          <p className="text-sm text-gray-400 mt-1">Track all system actions and changes</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/10 text-sm transition-all">
          <Download size={16} /> Export
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-xl p-4 border border-white/10 flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search by user, entity..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm placeholder-gray-500 focus:border-nesma-secondary outline-none" />
        </div>
        <select value={filterAction} onChange={(e) => { setFilterAction(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none min-w-[140px]">
          <option value="">All Actions</option>
          {actionTypes.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={filterEntity} onChange={(e) => { setFilterEntity(e.target.value); setCurrentPage(1); }}
          className="px-4 py-2.5 bg-black/20 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none min-w-[140px]">
          <option value="">All Entities</option>
          {entityTypes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
      </div>

      {/* Error State */}
      {isError && (
        <div className="glass-card p-4 rounded-xl border border-red-500/20 bg-red-500/5">
          <p className="text-sm text-red-400">Failed to load audit logs. Please try again.</p>
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <AuditSkeleton />
      ) : (
        /* Log Entries */
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
          <div className="divide-y divide-white/5">
            {logs.map(log => (
              <div key={log.id} className="px-6 py-4 hover:bg-white/5 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border ${ACTION_COLORS[log.action] || ACTION_COLORS.update}`}>
                        {log.action}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-white font-medium">{log.userName}</span>
                        <span className="text-gray-500">performed</span>
                        <span className="text-nesma-secondary font-medium">{log.action}</span>
                        <span className="text-gray-500">on</span>
                        <span className="text-gray-300">{log.entityType}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {log.entityId} {log.entityName && `\u2014 ${log.entityName}`}
                      </p>
                      {log.changes && log.changes.length > 0 && (
                        <div className="mt-2 space-y-1">
                          {log.changes.map((change, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500">{change.field}:</span>
                              <span className="text-red-400 line-through">{String(change.oldValue)}</span>
                              <ChevronRight size={12} className="text-gray-600" />
                              <span className="text-emerald-400">{String(change.newValue)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatRelativeTime(log.timestamp)}</span>
                </div>
              </div>
            ))}
            {logs.length === 0 && (
              <div className="px-6 py-12 text-center text-gray-500">
                <FileText size={32} className="mx-auto mb-2 opacity-50" />
                <p>No audit log entries found</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center">
              <span className="text-xs text-gray-400">
                Page {meta.page} of {meta.totalPages} ({meta.total} entries)
              </span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="px-3 py-1.5 border border-white/10 rounded-lg bg-black/20 text-gray-400 text-xs disabled:opacity-50 hover:bg-white/5 transition-all">Previous</button>
                <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage >= meta.totalPages}
                  className="px-3 py-1.5 border border-white/10 rounded-lg bg-black/20 text-gray-300 text-xs disabled:opacity-50 hover:bg-white/5 transition-all">Next</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
