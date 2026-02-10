import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ───────────────────────────────────────────────────────────────

export interface SlottingSuggestion {
  itemId: string;
  itemCode: string;
  itemName: string;
  abcClass: string;
  pickFrequency: number;
  currentBin: string;
  suggestedBin: string;
  currentZone: string;
  suggestedZone: string;
  reason: string;
  priorityScore: number;
}

export interface SlottingAnalysis {
  warehouseId: string;
  suggestions: SlottingSuggestion[];
  currentEfficiency: number;
  projectedEfficiency: number;
  estimatedTimeSavingMinutes: number;
}

export interface ItemPickFrequency {
  itemId: string;
  itemCode: string;
  itemName: string;
  abcClass: string;
  pickCount: number;
  totalQtyIssued: number;
  pickFrequency: number;
}

// ── Hooks ───────────────────────────────────────────────────────────────

export function useSlottingAnalysis(warehouseId?: string) {
  return useQuery({
    queryKey: ['slotting', 'analysis', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SlottingAnalysis>>('/slotting/analyze', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
  });
}

export function usePickFrequencies(warehouseId?: string) {
  return useQuery({
    queryKey: ['slotting', 'frequencies', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ItemPickFrequency[]>>('/slotting/frequencies', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
  });
}

export function useApplySlotting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { itemId: string; warehouseId: string; newBinNumber: string }) => {
      const { data } = await apiClient.post<ApiResponse<{ success: boolean; oldBin: string; newBin: string }>>(
        '/slotting/apply',
        payload,
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slotting'] });
      qc.invalidateQueries({ queryKey: ['bin-cards'] });
    },
  });
}
