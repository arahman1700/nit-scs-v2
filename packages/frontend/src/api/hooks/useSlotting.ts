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

// ── AI Slotting Types ──────────────────────────────────────────────────

export interface CoLocationPair {
  itemA: { id: string; code: string; name: string };
  itemB: { id: string; code: string; name: string };
  coOccurrences: number;
  itemABin: string | null;
  itemBBin: string | null;
  binDistance: number;
  suggestion: string;
}

export interface CoLocationAnalysis {
  warehouseId: string;
  pairs: CoLocationPair[];
  potentialTimeSavingMinutes: number;
}

export interface SeasonalItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  currentBin: string | null;
  abcClass: string;
  monthlyVolumes: Record<string, number>;
  avgMonthlyVolume: number;
  peakMonth: string;
  peakVolume: number;
  seasonalityIndex: number;
  recommendation: string;
}

export interface SeasonalAnalysis {
  warehouseId: string;
  items: SeasonalItem[];
  seasonalAlertCount: number;
}

export interface AiSlottingSummary {
  warehouseId: string;
  standardAnalysis: SlottingAnalysis;
  coLocation: CoLocationAnalysis;
  seasonal: SeasonalAnalysis;
  aiConfidence: number;
  topRecommendations: string[];
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

// ── AI Slotting Hooks ─────────────────────────────────────────────────

export function useCoLocation(warehouseId?: string) {
  return useQuery({
    queryKey: ['slotting', 'co-location', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CoLocationAnalysis>>(`/slotting/${warehouseId}/co-location`);
      return data;
    },
    enabled: !!warehouseId,
  });
}

export function useSeasonalTrends(warehouseId?: string) {
  return useQuery({
    queryKey: ['slotting', 'seasonal', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SeasonalAnalysis>>(`/slotting/${warehouseId}/seasonal`);
      return data;
    },
    enabled: !!warehouseId,
  });
}

export function useAiSlottingSummary(warehouseId?: string) {
  return useQuery({
    queryKey: ['slotting', 'ai-summary', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AiSlottingSummary>>(`/slotting/${warehouseId}/ai-summary`);
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
