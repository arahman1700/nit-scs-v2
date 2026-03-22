import React, { useState, useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { PaginationMeta } from '@/api/types';
import type { EmailLog } from './notificationHelpers';
import { LOG_STATUSES, formatDate, getStatusColor, getStatusIcon } from './notificationHelpers';
import { useEmailLogs } from './notificationHooks';
import { Search, ChevronLeft, ChevronRight, RefreshCw, FileText } from 'lucide-react';

export function NotificationLogTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchEmail, setSearchEmail] = useState('');
  const [debouncedEmail, setDebouncedEmail] = useState('');
  const queryClient = useQueryClient();

  // Debounce email search
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleSearchChange = useCallback((val: string) => {
    setSearchEmail(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedEmail(val);
      setPage(1);
    }, 400);
  }, []);

  const params = useMemo(
    () => ({
      page,
      pageSize: 20,
      ...(statusFilter && { status: statusFilter }),
      ...(debouncedEmail && { toEmail: debouncedEmail }),
    }),
    [page, statusFilter, debouncedEmail],
  );

  const { data: response, isLoading } = useEmailLogs(params);

  const logs = (response?.data ?? []) as EmailLog[];
  const meta = response?.meta as PaginationMeta | undefined;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['email-logs'] });
  }, [queryClient]);

  return (
    <div className="space-y-4">
      {/* Filters Bar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          {/* Search by email */}
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input-field w-full pl-9"
              placeholder="Search by recipient email..."
              value={searchEmail}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Status:</span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setStatusFilter('');
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all duration-300 ${
                  statusFilter === ''
                    ? 'bg-nesma-primary text-white'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                All
              </button>
              {LOG_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setStatusFilter(s);
                    setPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-all duration-300 ${
                    statusFilter === s
                      ? 'bg-nesma-primary text-white'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            className="p-2 hover:bg-white/10 rounded-lg transition-all ml-auto"
            aria-label="Refresh logs"
          >
            <RefreshCw size={16} className="text-gray-400" />
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="glass-card rounded-2xl p-6">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-12 bg-white/10 rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && logs.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <FileText size={32} className="mx-auto mb-3 text-gray-400" />
          <p className="text-gray-400">No notification logs found.</p>
          {(statusFilter || debouncedEmail) && (
            <button
              onClick={() => {
                setStatusFilter('');
                setSearchEmail('');
                setDebouncedEmail('');
                setPage(1);
              }}
              className="text-nesma-secondary text-sm hover:underline mt-2"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Log Table */}
      {!isLoading && logs.length > 0 && (
        <div className="glass-card rounded-2xl p-6">
          {/* Table Header */}
          <div className="grid grid-cols-[140px_1fr_120px_1fr_100px] gap-4 px-4 pb-3 border-b border-white/10">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Date</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Recipient</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Template</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Subject</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</span>
          </div>

          {/* Rows */}
          <div className="space-y-1 mt-1">
            {logs.map(log => {
              const StatusIcon = getStatusIcon(log.status);
              return (
                <div
                  key={log.id}
                  className="grid grid-cols-[140px_1fr_120px_1fr_100px] gap-4 items-center px-4 py-3 bg-white/5 rounded-xl hover:bg-white/10 transition-all duration-300"
                >
                  <span className="text-xs text-gray-300">{formatDate(log.createdAt)}</span>
                  <span className="text-sm text-white truncate">{log.toEmail}</span>
                  <span className="text-xs text-gray-400 truncate">{log.template?.code ?? '-'}</span>
                  <span className="text-sm text-gray-300 truncate">{log.subject}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full capitalize ${getStatusColor(log.status)}`}
                  >
                    <StatusIcon size={12} />
                    {log.status}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {meta && meta.total > meta.pageSize && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/10">
              <span className="text-sm text-gray-400">
                Page {meta.page} of {Math.ceil(meta.total / meta.pageSize)}
                <span className="ml-2 text-gray-500">({meta.total} total)</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
                  aria-label="Previous page"
                >
                  <ChevronLeft size={16} className="text-gray-400" />
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={page >= Math.ceil(meta.total / meta.pageSize)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all disabled:opacity-30"
                  aria-label="Next page"
                >
                  <ChevronRight size={16} className="text-gray-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
