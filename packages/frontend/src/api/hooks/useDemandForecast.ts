import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ItemForecast {
  itemId: string;
  itemCode: string;
  itemName: string;
  historicalMonthly: Array<{ month: string; quantity: number }>;
  forecastMonthly: Array<{ month: string; quantity: number; confidence: 'high' | 'medium' | 'low' }>;
  avgMonthlyDemand: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendSlope: number;
  suggestedReorderPoint: number;
  currentStock?: number;
  reorderAlert: boolean;
}

export interface SeasonalPattern {
  itemId: string;
  itemCode: string;
  itemName: string;
  seasonalIndices: Array<{ month: number; index: number; label: string }>;
  seasonalityStrength: number;
  peakMonth: string;
  troughMonth: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

/**
 * Fetch demand forecast for a specific item or all items in a warehouse.
 */
export function useDemandForecast(warehouseId?: string, itemId?: string) {
  return useQuery({
    queryKey: ['demand-forecast', warehouseId, itemId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (warehouseId) params.warehouseId = warehouseId;
      if (itemId) params.itemId = itemId;
      const { data } = await apiClient.get<ApiResponse<ItemForecast[]>>('/demand-forecast', { params });
      return data;
    },
    enabled: !!warehouseId || !!itemId,
  });
}

/**
 * Fetch top demand items for a warehouse.
 */
export function useTopDemandItems(warehouseId?: string, limit = 20) {
  return useQuery({
    queryKey: ['demand-forecast', 'top-demand', warehouseId, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = { limit };
      if (warehouseId) params.warehouseId = warehouseId;
      const { data } = await apiClient.get<ApiResponse<ItemForecast[]>>('/demand-forecast/top-demand', { params });
      return data;
    },
    enabled: !!warehouseId,
  });
}

/**
 * Fetch items where current stock is below the suggested reorder point.
 */
export function useReorderAlerts(warehouseId?: string) {
  return useQuery({
    queryKey: ['demand-forecast', 'reorder-alerts', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ItemForecast[]>>('/demand-forecast/reorder-alerts', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
  });
}

/**
 * Fetch seasonal demand patterns for items in a warehouse.
 */
export function useSeasonalPatterns(warehouseId?: string) {
  return useQuery({
    queryKey: ['demand-forecast', 'seasonal', warehouseId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (warehouseId) params.warehouseId = warehouseId;
      const { data } = await apiClient.get<ApiResponse<SeasonalPattern[]>>('/demand-forecast/seasonal', { params });
      return data;
    },
    enabled: !!warehouseId,
  });
}
