import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

export interface WorkerProductivity {
  employeeId: string;
  fullName: string;
  role: string;
  metrics: {
    grnsProcessed: number;
    misIssued: number;
    wtsTransferred: number;
    tasksCompleted: number;
    avgTaskDurationMinutes: number | null;
  };
}

export interface DailyThroughput {
  date: string;
  grns: number;
  mis: number;
  wts: number;
  tasks: number;
}

export interface ProductivitySummary {
  period: { from: string; to: string };
  totals: {
    grnsProcessed: number;
    misIssued: number;
    wtsTransferred: number;
    tasksCompleted: number;
  };
  workers: WorkerProductivity[];
  dailyThroughput: DailyThroughput[];
}

export function useLaborProductivity(days: number = 30, warehouseId?: string) {
  return useQuery({
    queryKey: ['dashboard', 'labor-productivity', days, warehouseId],
    queryFn: async () => {
      const params = new URLSearchParams({ days: String(days) });
      if (warehouseId) params.set('warehouseId', warehouseId);
      const { data } = await apiClient.get<ApiResponse<ProductivitySummary>>(`/dashboard/labor-productivity?${params}`);
      return data;
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });
}
