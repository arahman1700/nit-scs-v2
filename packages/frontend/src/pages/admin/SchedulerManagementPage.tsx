import React, { useState, useMemo, useCallback } from 'react';
import {
  useSchedulerJobs,
  useJobHistory,
  useTriggerJob,
  usePauseJob,
  useResumeJob,
  useSchedulerDlq,
  useRetrySchedulerDlq,
  useDeleteSchedulerDlq,
} from '@/domains/system/hooks/useScheduler';
import type { SchedulerJob, JobHistoryEntry, SchedulerDlqEntry } from '@/domains/system/hooks/useScheduler';
import {
  Timer,
  Play,
  Pause,
  RotateCcw,
  Trash2,
  ChevronDown,
  ChevronRight,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Inbox,
  Zap,
  RefreshCw,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatJobName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function formatQueueName(queue: string): string {
  return queue.replace(/_QUEUE$/, '').replace(/_/g, ' ');
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '--';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '--';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-emerald-500/20 text-emerald-400',
    paused: 'bg-amber-500/20 text-amber-400',
    failed: 'bg-red-500/20 text-red-400',
    completed: 'bg-emerald-500/20 text-emerald-400',
    unknown: 'bg-gray-500/20 text-gray-400',
  };
  const dotColors: Record<string, string> = {
    active: 'bg-emerald-400',
    paused: 'bg-amber-400',
    failed: 'bg-red-400',
    completed: 'bg-emerald-400',
    unknown: 'bg-gray-400',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${colors[status] ?? colors.unknown}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColors[status] ?? dotColors.unknown}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-4 hover:bg-white/10 transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon size={20} className="text-white" />
        </div>
        <div>
          <p className="text-3xl font-bold text-white">{value}</p>
          <p className="text-sm text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Job History Panel ────────────────────────────────────────────────────────

function JobHistoryPanel({ jobName }: { jobName: string }) {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useJobHistory(jobName, page, 5);
  const entries = (data?.data ?? []) as JobHistoryEntry[];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;

  return (
    <div className="mt-3 bg-white/5 rounded-xl p-4 space-y-3">
      <h4 className="text-sm font-medium text-gray-300">Execution History</h4>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-8 bg-white/10 rounded animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <p className="text-sm text-gray-500 py-2">No execution history available.</p>
      )}

      {!isLoading && entries.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 pr-4 font-medium">Run Date</th>
                  <th className="pb-2 pr-4 font-medium">Duration</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={entry.id ?? idx} className="border-t border-white/5">
                    <td className="py-2 pr-4 text-gray-300">{formatDateTime(entry.processedOn)}</td>
                    <td className="py-2 pr-4 text-gray-300">{formatDuration(entry.duration)}</td>
                    <td className="py-2 pr-4">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="py-2 text-gray-400 truncate max-w-[200px]">{entry.failedReason ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="px-3 py-1 text-xs bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Dead Letter Queue Section ────────────────────────────────────────────────

function DlqSection() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useSchedulerDlq(page, 10);
  const retryMutation = useRetrySchedulerDlq();
  const deleteMutation = useDeleteSchedulerDlq();

  const entries = (data?.data ?? []) as SchedulerDlqEntry[];
  const meta = data?.meta as { page: number; totalPages: number; total: number } | undefined;
  const total = meta?.total ?? 0;

  const handleRetry = useCallback(
    async (id: string | undefined) => {
      if (!id) return;
      await retryMutation.mutateAsync(id);
    },
    [retryMutation],
  );

  const handleDelete = useCallback(
    async (id: string | undefined) => {
      if (!id) return;
      if (!window.confirm('Permanently remove this failed job entry?')) return;
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Inbox size={20} className="text-red-400" />
          <h2 className="text-lg font-semibold text-white">Dead Letter Queue</h2>
          {total > 0 && (
            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">{total}</span>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && entries.length === 0 && (
        <div className="text-center py-8">
          <CheckCircle2 size={32} className="mx-auto mb-2 text-emerald-400" />
          <p className="text-gray-400 text-sm">No failed jobs in the dead letter queue.</p>
        </div>
      )}

      {!isLoading && entries.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-left">
                  <th className="pb-2 pr-4 font-medium">Job ID</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Failed At</th>
                  <th className="pb-2 pr-4 font-medium">Error</th>
                  <th className="pb-2 pr-4 font-medium">Retries</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, idx) => (
                  <tr key={entry.id ?? idx} className="border-t border-white/5 hover:bg-white/5 transition-all">
                    <td className="py-3 pr-4 text-gray-300 font-mono text-xs">
                      {entry.id ? entry.id.slice(0, 8) : '--'}
                    </td>
                    <td className="py-3 pr-4 text-white">{formatJobName(entry.originalJobName ?? entry.jobName)}</td>
                    <td className="py-3 pr-4 text-gray-300">{formatDateTime(entry.failedAt)}</td>
                    <td
                      className="py-3 pr-4 text-red-400 truncate max-w-[250px]"
                      title={entry.failedReason ?? undefined}
                    >
                      {entry.failedReason ?? '--'}
                    </td>
                    <td className="py-3 pr-4 text-gray-300">{entry.retryCount}</td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleRetry(entry.id)}
                          disabled={retryMutation.isPending}
                          className="p-1.5 hover:bg-emerald-500/20 rounded-lg transition-all"
                          aria-label="Retry job"
                          title="Retry"
                        >
                          <RotateCcw size={14} className="text-emerald-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleteMutation.isPending}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all"
                          aria-label="Delete job"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">
                Page {meta.page} of {meta.totalPages} ({meta.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1 text-xs bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300 transition-all"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="px-3 py-1 text-xs bg-white/5 rounded-lg hover:bg-white/10 disabled:opacity-30 text-gray-300 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function SchedulerManagementPage() {
  const { data: jobsData, isLoading, isError, refetch } = useSchedulerJobs();
  const triggerMutation = useTriggerJob();
  const pauseMutation = usePauseJob();
  const resumeMutation = useResumeJob();

  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'jobs' | 'dlq'>('jobs');

  const jobs = useMemo(() => {
    return (jobsData?.data ?? []) as SchedulerJob[];
  }, [jobsData]);

  // ── KPI computations ────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = jobs.length;
    const active = jobs.filter(j => j.status === 'active').length;
    const failed = jobs.reduce((sum, j) => sum + j.failedCount, 0);
    const paused = jobs.filter(j => j.status === 'paused').length;
    return { total, active, failed, paused };
  }, [jobs]);

  // ── Group jobs by queue ────────────────────────────────────────────────
  const groupedByQueue = useMemo(() => {
    const map = new Map<string, SchedulerJob[]>();
    for (const job of jobs) {
      const list = map.get(job.queue) ?? [];
      list.push(job);
      map.set(job.queue, list);
    }
    return Array.from(map.entries()).map(([queue, queueJobs]) => ({
      queue,
      label: formatQueueName(queue),
      jobs: queueJobs.sort((a, b) => a.priority - b.priority),
    }));
  }, [jobs]);

  const handleToggleExpand = useCallback((jobName: string) => {
    setExpandedJob(prev => (prev === jobName ? null : jobName));
  }, []);

  const handleTrigger = useCallback(
    async (jobName: string) => {
      await triggerMutation.mutateAsync(jobName);
    },
    [triggerMutation],
  );

  const handlePause = useCallback(
    async (jobName: string) => {
      await pauseMutation.mutateAsync(jobName);
    },
    [pauseMutation],
  );

  const handleResume = useCallback(
    async (jobName: string) => {
      await resumeMutation.mutateAsync(jobName);
    },
    [resumeMutation],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Timer size={24} className="text-nesma-secondary" />
            <h1 className="text-2xl font-bold text-white">Scheduler Management</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Monitor and manage background jobs, scheduled tasks, and the dead letter queue
          </p>
        </div>
        <button onClick={() => refetch()} className="btn-primary flex items-center gap-2">
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard icon={Activity} label="Total Jobs" value={kpis.total} color="bg-nesma-primary" />
        <KpiCard icon={Zap} label="Active Jobs" value={kpis.active} color="bg-emerald-600" />
        <KpiCard icon={XCircle} label="Failed Runs" value={kpis.failed} color="bg-red-600" />
        <KpiCard icon={Clock} label="Paused Jobs" value={kpis.paused} color="bg-amber-600" />
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            activeTab === 'jobs' ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          Scheduled Jobs
        </button>
        <button
          onClick={() => setActiveTab('dlq')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            activeTab === 'dlq' ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'
          }`}
        >
          Dead Letter Queue
        </button>
      </div>

      {/* Loading State */}
      {isLoading && activeTab === 'jobs' && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
              <div className="h-5 w-48 bg-white/10 rounded mb-4" />
              <div className="space-y-2">
                <div className="h-10 bg-white/10 rounded" />
                <div className="h-10 bg-white/10 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="glass-card rounded-2xl p-8 text-center">
          <AlertTriangle size={32} className="mx-auto mb-3 text-amber-400" />
          <p className="text-gray-400 mb-3">
            Failed to load scheduler data. The scheduler may not be running or Redis may be unavailable.
          </p>
          <button onClick={() => refetch()} className="text-nesma-secondary text-sm hover:underline">
            Try again
          </button>
        </div>
      )}

      {/* Jobs Tab */}
      {activeTab === 'jobs' && !isLoading && !isError && (
        <>
          {groupedByQueue.length === 0 && (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Timer size={32} className="mx-auto mb-3 text-gray-400" />
              <p className="text-gray-400">No scheduled jobs found.</p>
            </div>
          )}

          {groupedByQueue.map(group => (
            <div key={group.queue} className="glass-card rounded-2xl p-6 space-y-3">
              {/* Queue Group Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-nesma-primary/20 text-nesma-secondary px-3 py-1.5 rounded-lg border border-nesma-primary/30 font-mono">
                    {group.queue}
                  </span>
                  <h2 className="text-lg font-semibold text-white">{group.label}</h2>
                  <span className="text-sm text-gray-400">{group.jobs.length} job(s)</span>
                </div>
              </div>

              {/* Job Rows */}
              <div className="space-y-1">
                {group.jobs.map(job => (
                  <div key={job.name}>
                    {/* Job Row */}
                    <div
                      className={`flex items-center justify-between rounded-xl px-4 py-3 transition-all duration-300 cursor-pointer ${
                        expandedJob === job.name ? 'bg-white/10' : 'bg-white/5 hover:bg-white/10'
                      }`}
                      onClick={() => handleToggleExpand(job.name)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggleExpand(job.name);
                        }
                      }}
                      aria-expanded={expandedJob === job.name}
                    >
                      <div className="flex items-center gap-4 flex-wrap min-w-0 flex-1">
                        {/* Expand Indicator */}
                        <span className="text-gray-400 flex-shrink-0">
                          {expandedJob === job.name ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </span>

                        {/* Job Name */}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{formatJobName(job.name)}</p>
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                            {job.legacyName}
                          </p>
                        </div>

                        {/* Schedule */}
                        <span className="text-xs bg-white/5 text-gray-300 px-2.5 py-1 rounded-lg border border-white/10 flex-shrink-0">
                          {job.schedule}
                        </span>

                        {/* Priority */}
                        <span className="text-xs text-gray-400 flex-shrink-0">P{job.priority}</span>

                        {/* Last Run */}
                        <div className="hidden md:block flex-shrink-0">
                          <p className="text-xs text-gray-500">Last run</p>
                          <p className="text-xs text-gray-300">{timeAgo(job.lastRun)}</p>
                        </div>

                        {/* Next Run */}
                        <div className="hidden md:block flex-shrink-0">
                          <p className="text-xs text-gray-500">Next run</p>
                          <p className="text-xs text-gray-300">{timeAgo(job.nextRun)}</p>
                        </div>

                        {/* Status */}
                        <StatusBadge status={job.status} />

                        {/* Counters */}
                        {job.failedCount > 0 && (
                          <span className="text-xs text-red-400 flex-shrink-0">{job.failedCount} failed</span>
                        )}
                      </div>

                      {/* Actions */}
                      <div
                        className="flex items-center gap-1 flex-shrink-0 ml-2"
                        onClick={e => e.stopPropagation()}
                        role="group"
                        aria-label="Job actions"
                      >
                        {/* Pause / Resume Toggle */}
                        {job.status === 'active' ? (
                          <button
                            onClick={() => handlePause(job.name)}
                            disabled={pauseMutation.isPending}
                            className="p-2 hover:bg-amber-500/20 rounded-lg transition-all"
                            aria-label={`Pause ${job.name}`}
                            title="Pause"
                          >
                            <Pause size={14} className="text-amber-400" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleResume(job.name)}
                            disabled={resumeMutation.isPending}
                            className="p-2 hover:bg-emerald-500/20 rounded-lg transition-all"
                            aria-label={`Resume ${job.name}`}
                            title="Resume"
                          >
                            <Play size={14} className="text-emerald-400" />
                          </button>
                        )}

                        {/* Run Now */}
                        <button
                          onClick={() => handleTrigger(job.name)}
                          disabled={triggerMutation.isPending}
                          className="p-2 hover:bg-nesma-primary/20 rounded-lg transition-all"
                          aria-label={`Run ${job.name} now`}
                          title="Run Now"
                        >
                          <Zap size={14} className="text-nesma-secondary" />
                        </button>
                      </div>
                    </div>

                    {/* Expanded: History */}
                    {expandedJob === job.name && <JobHistoryPanel jobName={job.name} />}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* DLQ Tab */}
      {activeTab === 'dlq' && <DlqSection />}
    </div>
  );
}
