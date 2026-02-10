import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

interface ABCResult {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  annualConsumptionValue: number;
  cumulativePercent: number;
  abcClass: 'A' | 'B' | 'C';
}

interface ABCSummary {
  classA: { count: number; totalValue: number; percentOfItems: number; percentOfValue: number };
  classB: { count: number; totalValue: number; percentOfItems: number; percentOfValue: number };
  classC: { count: number; totalValue: number; percentOfItems: number; percentOfValue: number };
  totalItems: number;
  totalValue: number;
  lastCalculatedAt: string | null;
}

interface ABCListParams {
  page?: number;
  pageSize?: number;
  abcClass?: string;
  search?: string;
}

// ── List items with ABC classification ───────────────────────────────────
export function useAbcAnalysis(params?: ABCListParams) {
  return useQuery({
    queryKey: ['abc-analysis', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ABCResult[]>>('/abc-analysis', { params });
      return data;
    },
  });
}

// ── ABC Summary stats ────────────────────────────────────────────────────
export function useAbcSummary(warehouseId?: string) {
  return useQuery({
    queryKey: ['abc-analysis', 'summary', warehouseId],
    queryFn: async () => {
      const params = warehouseId ? { warehouseId } : undefined;
      const { data } = await apiClient.get<ApiResponse<ABCSummary>>('/abc-analysis/summary', { params });
      return data;
    },
  });
}

// ── Trigger recalculation ────────────────────────────────────────────────
export function useRecalculateAbc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (warehouseId?: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/abc-analysis/recalculate', { warehouseId });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['abc-analysis'] });
    },
  });
}
