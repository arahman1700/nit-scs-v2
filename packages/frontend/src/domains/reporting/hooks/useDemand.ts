/**
 * Demand Analysis Hooks — L8 (Consumption Trends) + L9 (Demand Forecasting)
 *
 * useItemConsumptionTrend  — Monthly consumption trend for a specific item
 * useTopConsumptionItems   — Top N items by consumption volume
 * useReorderSuggestions    — Rule-based reorder suggestions
 * useItemForecast          — SMA-based item forecast projection
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ApiResponse } from '../../../api/types';

// ── Types ───────────────────────────────────────────────────────────────────

export interface MonthlyConsumption {
  month: string;
  totalQty: number;
  totalValue: number;
  issueCount: number;
}

export interface ItemConsumptionTrend {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  months: MonthlyConsumption[];
  averageMonthly: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface TopConsumptionItem {
  rank: number;
  itemId: string;
  itemCode: string;
  itemDescription: string;
  totalQty: number;
  totalValue: number;
  issueCount: number;
}

export interface ReorderSuggestion {
  itemId: string;
  itemCode: string;
  description: string;
  currentStock: number;
  avgMonthlyConsumption: number;
  reorderPoint: number;
  suggestedQty: number;
  urgency: 'critical' | 'soon' | 'planning';
  daysUntilStockout: number;
}

export interface ItemForecastProjection {
  current: number;
  forecast: Array<{
    month: string;
    projectedConsumption: number;
    projectedEndStock: number;
  }>;
  reorderRecommended: boolean;
}

// ── L8: Consumption Trend Hooks ─────────────────────────────────────────────

/**
 * Fetch monthly consumption trend for a specific item.
 */
export function useItemConsumptionTrend(itemId?: string, months?: number) {
  return useQuery({
    queryKey: ['demand', 'trends', itemId, months],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (months) params.months = months;
      const { data } = await apiClient.get<ApiResponse<ItemConsumptionTrend>>(`/demand/trends/${itemId}`, { params });
      return data;
    },
    enabled: !!itemId,
  });
}

/**
 * Fetch top N items by consumption volume.
 */
export function useTopConsumptionItems(warehouseId?: string, months?: number, limit?: number) {
  return useQuery({
    queryKey: ['demand', 'top-items', warehouseId, months, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (warehouseId) params.warehouseId = warehouseId;
      if (months) params.months = months;
      if (limit) params.limit = limit;
      const { data } = await apiClient.get<ApiResponse<TopConsumptionItem[]>>('/demand/top-items', { params });
      return data;
    },
  });
}

// ── L9: Demand Forecasting Hooks ────────────────────────────────────────────

/**
 * Fetch rule-based reorder suggestions for a warehouse.
 */
export function useReorderSuggestions(warehouseId?: string) {
  return useQuery({
    queryKey: ['demand', 'reorder-suggestions', warehouseId],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (warehouseId) params.warehouseId = warehouseId;
      const { data } = await apiClient.get<ApiResponse<ReorderSuggestion[]>>('/demand/reorder-suggestions', { params });
      return data;
    },
  });
}

/**
 * Fetch SMA-based forecast projection for a specific item in a warehouse.
 */
export function useItemForecast(itemId?: string, warehouseId?: string, months?: number) {
  return useQuery({
    queryKey: ['demand', 'forecast', itemId, warehouseId, months],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (warehouseId) params.warehouseId = warehouseId;
      if (months) params.months = months;
      const { data } = await apiClient.get<ApiResponse<ItemForecastProjection>>(`/demand/forecast/${itemId}`, {
        params,
      });
      return data;
    },
    enabled: !!itemId && !!warehouseId,
  });
}
