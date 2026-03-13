import React, { useState } from 'react';
import { useEventBusStats, useQueueStats, useDlqJobs, useRetryDlqJob } from '@/domains/system/hooks/useEventBusMonitor';
import type { EventBusStats, QueueJobCounts, DlqJobEntry } from '@/domains/system/hooks/useEventBusMonitor';
import { toRecord } from '@/utils/type-helpers';
import { Activity, Server, RefreshCw, AlertTriangle, RotateCcw } from 'lucide-react';

// ── Loading Skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div>
        <div className="h-8 w-72 bg-white/10 rounded mb-2" />
        <div className="h-4 w-96 bg-white/5 rounded" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass-card rounded-2xl p-6">
            <div className="h-8 w-16 bg-white/10 rounded mb-3" />
            <div className="h-4 w-28 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="glass-card rounded-2xl p-6">
        <div className="h-5 w-48 bg-white/10 rounded mb-4" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 bg-white/5 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Event Stats Section ───────────────────────────────────────────────────────

function EventStatsSection({ stats }: { stats: EventBusStats }) {
  const sortedTypes = Object.entries(stats.publishedByType).sort(([, a], [, b]) => b - a);

  const maxCount = sortedTypes.length > 0 ? sortedTypes[0][1] : 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Activity size={20} className="text-nesma-secondary" />
        <h2 className="text-lg font-semibold text-white">Event Statistics</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm text-gray-400">Total Published</p>
          <p className="text-3xl font-bold text-white mt-1">{stats.totalPublished.toLocaleString()}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm text-gray-400">Event Types</p>
          <p className="text-3xl font-bold text-white mt-1">{Object.keys(stats.publishedByType).length}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm text-gray-400">Recent Errors</p>
          <p className="text-3xl font-bold text-white mt-1">
            <span className={stats.errors.length > 0 ? 'text-red-400' : 'text-emerald-400'}>{stats.errors.length}</span>
          </p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-sm text-gray-400">Last Published</p>
          <p className="text-sm font-medium text-white mt-2">
            {stats.lastPublished ? new Date(stats.lastPublished).toLocaleString() : 'Never'}
          </p>
        </div>
      </div>

      {/* Events by type bar list */}
      {sortedTypes.length > 0 && (
        <div className="glass-card rounded-2xl p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Events by Type</h3>
          <div className="space-y-3">
            {sortedTypes.map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-300 truncate">{type}</span>
                    <span className="text-sm font-medium text-white ml-2">{count.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-nesma-secondary rounded-full transition-all duration-300"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error log */}
      {stats.errors.length > 0 && (
        <div className="glass-card rounded-2xl p-6 border border-red-500/20">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-red-400" />
            <h3 className="text-sm font-medium text-red-400">Recent Errors</h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.errors
              .slice()
              .reverse()
              .map((err, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm py-2 border-b border-white/5 last:border-0">
                  <span className="text-gray-500 whitespace-nowrap text-xs">
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-gray-400 font-mono text-xs">{err.type}</span>
                  <span className="text-red-300 truncate">{err.message}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Queue Health Section ──────────────────────────────────────────────────────

function QueueHealthSection({ queues }: { queues: QueueJobCounts[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Server size={20} className="text-nesma-secondary" />
        <h2 className="text-lg font-semibold text-white">Queue Health</h2>
      </div>

      {queues.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-gray-400">
          <Server size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No queues initialized yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {queues.map(queue => (
            <div key={queue.name} className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white">{queue.name}</h3>
                {queue.failed > 0 ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">
                    {queue.failed} failed
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">healthy</span>
                )}
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-bold text-amber-400">{queue.waiting}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Waiting</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-400">{queue.active}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Active</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-emerald-400">{queue.completed}</p>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Done</p>
                </div>
              </div>
              {(queue.delayed > 0 || queue.paused > 0) && (
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5 text-xs text-gray-400">
                  {queue.delayed > 0 && <span>Delayed: {queue.delayed}</span>}
                  {queue.paused > 0 && <span>Paused: {queue.paused}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── DLQ Section ───────────────────────────────────────────────────────────────

function DlqSection({
  jobs,
  page,
  onPageChange,
  retryJob,
  isRetrying,
}: {
  jobs: DlqJobEntry[];
  page: number;
  onPageChange: (page: number) => void;
  retryJob: (jobId: string) => void;
  isRetrying: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <AlertTriangle size={20} className="text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Dead Letter Queue</h2>
      </div>

      {jobs.length === 0 ? (
        <div className="glass-card rounded-2xl p-8 text-center text-gray-400">
          <AlertTriangle size={32} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm">No failed jobs in the DLQ</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Job ID</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Name</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Failed Reason</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Timestamp</th>
                  <th className="px-4 py-3 text-right text-gray-400 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr
                    key={job.id ?? job.timestamp}
                    className="border-b border-white/5 hover:bg-white/5 transition-all duration-300"
                  >
                    <td className="px-4 py-3 text-white font-mono text-xs">{job.id ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-300">{job.name}</td>
                    <td className="px-4 py-3 text-red-300 max-w-xs truncate">{job.failedReason ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(job.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {job.id && (
                        <button
                          onClick={() => retryJob(job.id!)}
                          disabled={isRetrying}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nesma-primary hover:bg-nesma-primary/80 text-white text-xs rounded-lg transition-all duration-300 disabled:opacity-50"
                          aria-label={`Retry job ${job.id}`}
                        >
                          <RotateCcw size={12} />
                          Retry
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-all duration-300"
            >
              Previous
            </button>
            <span className="text-sm text-gray-400">Page {page}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={jobs.length < 20}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-all duration-300"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export const EventBusMonitorDashboard: React.FC = () => {
  const [dlqPage, setDlqPage] = useState(1);

  const eventBusQuery = useEventBusStats();
  const queueQuery = useQueueStats();
  const dlqQuery = useDlqJobs(dlqPage);
  const retryMutation = useRetryDlqJob();

  const eventBusData = toRecord(eventBusQuery.data).data as EventBusStats | undefined;
  const queueData = toRecord(queueQuery.data).data as QueueJobCounts[] | undefined;
  const dlqData = toRecord(dlqQuery.data).data as DlqJobEntry[] | undefined;

  const isLoading = eventBusQuery.isLoading || queueQuery.isLoading;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">EventBus Monitor</h1>
          <p className="text-sm text-gray-400 mt-1">Real-time event bus instrumentation and queue health monitoring</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <RefreshCw size={14} className={eventBusQuery.isFetching ? 'animate-spin text-nesma-secondary' : ''} />
          <span>Auto-refresh every 10s</span>
        </div>
      </div>

      {/* Section 1: Event Stats */}
      {eventBusData && <EventStatsSection stats={eventBusData} />}

      {/* Section 2: Queue Health */}
      {queueData && <QueueHealthSection queues={queueData} />}

      {/* Section 3: DLQ */}
      <DlqSection
        jobs={dlqData ?? []}
        page={dlqPage}
        onPageChange={setDlqPage}
        retryJob={jobId => retryMutation.mutate(jobId)}
        isRetrying={retryMutation.isPending}
      />
    </div>
  );
};
