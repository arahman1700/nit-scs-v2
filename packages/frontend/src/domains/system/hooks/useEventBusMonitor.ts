// ============================================================================
// EventBus Monitor React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ApiResponse } from '../../../api/types';

// ── Types ────────────────────────────────────────────────────────────────────

export interface EventErrorEntry {
  type: string;
  message: string;
  timestamp: string;
}

export interface EventBusStats {
  totalPublished: number;
  publishedByType: Record<string, number>;
  errors: EventErrorEntry[];
  lastPublished: string | null;
}

export interface QueueJobCounts {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface DlqJobEntry {
  id: string | undefined;
  name: string;
  data: unknown;
  failedReason: string | undefined;
  timestamp: number;
  processedOn: number | undefined;
  finishedOn: number | undefined;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/** GET /api/monitor/eventbus/stats */
export function useEventBusStats() {
  return useQuery({
    queryKey: ['eventbus-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<EventBusStats>>('/monitor/eventbus/stats');
      return data;
    },
    refetchInterval: 10_000,
  });
}

/** GET /api/monitor/queues/stats */
export function useQueueStats() {
  return useQuery({
    queryKey: ['queue-stats'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<QueueJobCounts[]>>('/monitor/queues/stats');
      return data;
    },
    refetchInterval: 10_000,
  });
}

/** GET /api/monitor/queues/dlq */
export function useDlqJobs(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: ['dlq-jobs', page, pageSize],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DlqJobEntry[]>>('/monitor/queues/dlq', {
        params: { page, pageSize },
      });
      return data;
    },
    refetchInterval: 10_000,
  });
}

/** POST /api/monitor/queues/dlq/:jobId/retry */
export function useRetryDlqJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data } = await apiClient.post<ApiResponse<{ jobId: string; retried: boolean }>>(
        `/monitor/queues/dlq/${jobId}/retry`,
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq-jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queue-stats'] });
    },
  });
}
