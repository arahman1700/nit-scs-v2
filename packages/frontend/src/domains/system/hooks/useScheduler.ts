/**
 * Scheduler Admin React Query Hooks
 *
 * Hooks for managing BullMQ scheduled jobs from the admin dashboard.
 * Endpoints: /api/v1/scheduler/*
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ApiResponse } from '../../../api/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface SchedulerJob {
  name: string;
  legacyName: string;
  queue: string;
  schedule: string;
  scheduleMs: number | null;
  cronPattern: string | null;
  priority: number;
  maxAttempts: number;
  status: 'active' | 'paused' | 'unknown';
  lastRun: string | null;
  nextRun: string | null;
  completedCount: number;
  failedCount: number;
}

export interface JobHistoryEntry {
  id: string | undefined;
  jobName: string;
  status: 'completed' | 'failed';
  processedOn: string | null;
  finishedOn: string | null;
  duration: number | null;
  failedReason: string | null;
  attemptsMade: number;
}

export interface SchedulerDlqEntry {
  id: string | undefined;
  jobName: string;
  originalQueue: string | null;
  originalJobName: string | null;
  failedAt: string | null;
  failedReason: string | null;
  retryCount: number;
  data: unknown;
}

// ── Query Keys ───────────────────────────────────────────────────────────────

const KEYS = {
  jobs: ['scheduler-jobs'] as const,
  history: (jobName: string) => ['scheduler-history', jobName] as const,
  dlq: ['scheduler-dlq'] as const,
};

// ── Hooks ────────────────────────────────────────────────────────────────────

/** GET /api/v1/scheduler/jobs — All scheduled jobs with status */
export function useSchedulerJobs() {
  return useQuery({
    queryKey: KEYS.jobs,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SchedulerJob[]>>('/scheduler/jobs');
      return data;
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

/** GET /api/v1/scheduler/jobs/:jobName/history — Execution history */
export function useJobHistory(jobName: string | null, page = 1, pageSize = 10) {
  return useQuery({
    queryKey: [...KEYS.history(jobName ?? ''), page, pageSize],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<JobHistoryEntry[]>>(`/scheduler/jobs/${jobName}/history`, {
        params: { page, pageSize },
      });
      return data;
    },
    enabled: !!jobName,
    staleTime: 5_000,
  });
}

/** POST /api/v1/scheduler/jobs/:jobName/run — Trigger immediate execution */
export function useTriggerJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobName: string) => {
      const { data } = await apiClient.post<ApiResponse<{ found: boolean; jobId?: string }>>(
        `/scheduler/jobs/${jobName}/run`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.jobs }),
  });
}

/** POST /api/v1/scheduler/jobs/:jobName/pause — Pause a job */
export function usePauseJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobName: string) => {
      const { data } = await apiClient.post<ApiResponse<{ found: boolean }>>(`/scheduler/jobs/${jobName}/pause`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.jobs }),
  });
}

/** POST /api/v1/scheduler/jobs/:jobName/resume — Resume a paused job */
export function useResumeJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (jobName: string) => {
      const { data } = await apiClient.post<ApiResponse<{ found: boolean }>>(`/scheduler/jobs/${jobName}/resume`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.jobs }),
  });
}

/** GET /api/v1/scheduler/dlq — Dead Letter Queue entries */
export function useSchedulerDlq(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...KEYS.dlq, page, pageSize],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SchedulerDlqEntry[]>>('/scheduler/dlq', {
        params: { page, pageSize },
      });
      return data;
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}

/** POST /api/v1/scheduler/dlq/:id/retry — Retry a DLQ entry */
export function useRetrySchedulerDlq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<{ id: string; retried: boolean }>>(
        `/scheduler/dlq/${id}/retry`,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.dlq });
      qc.invalidateQueries({ queryKey: KEYS.jobs });
    },
  });
}

/** DELETE /api/v1/scheduler/dlq/:id — Remove a DLQ entry */
export function useDeleteSchedulerDlq() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete<ApiResponse<{ id: string; deleted: boolean }>>(`/scheduler/dlq/${id}`);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEYS.dlq });
      qc.invalidateQueries({ queryKey: KEYS.jobs });
    },
  });
}
