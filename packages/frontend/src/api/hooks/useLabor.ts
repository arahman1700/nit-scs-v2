import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

export interface LaborStandard {
  id: string;
  taskType: string;
  description: string | null;
  standardMinutes: number;
  unitOfMeasure: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceWorker {
  employeeId: string;
  employeeName: string;
  totalTasks: number;
  totalStandardMinutes: number;
  efficiency: number;
  taskBreakdown: Array<{ taskType: string; count: number; standardMinutes: number }>;
}

export interface PerformanceReport {
  period: { days: number; since: string };
  standards: Array<{ taskType: string; standardMinutes: number; unit: string }>;
  workers: PerformanceWorker[];
}

export function useLaborStandards() {
  return useQuery({
    queryKey: ['labor', 'standards'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<LaborStandard[]>>('/labor/standards');
      return data;
    },
  });
}

export function useUpsertLaborStandard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      taskType: string;
      standardMinutes: number;
      description?: string;
      unitOfMeasure?: string;
    }) => {
      const { taskType, ...body } = params;
      const { data } = await apiClient.put<ApiResponse<LaborStandard>>(`/labor/standards/${taskType}`, body);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labor', 'standards'] });
    },
  });
}

export function useLaborPerformance(days: number = 30, warehouseId?: string) {
  return useQuery({
    queryKey: ['labor', 'performance', days, warehouseId],
    queryFn: async () => {
      const params = new URLSearchParams({ days: String(days) });
      if (warehouseId) params.set('warehouseId', warehouseId);
      const { data } = await apiClient.get<ApiResponse<PerformanceReport>>(`/labor/performance?${params}`);
      return data;
    },
    refetchInterval: 5 * 60 * 1000,
  });
}
