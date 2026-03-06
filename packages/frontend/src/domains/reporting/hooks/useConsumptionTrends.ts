import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ApiResponse } from '../../../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

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

// ── Hooks ──────────────────────────────────────────────────────────────────

/** GET /consumption-trends/items/:itemId — Monthly consumption trend for an item */
export function useItemConsumptionTrend(itemId: string | undefined, months?: number) {
  return useQuery({
    queryKey: ['consumption-trends', 'item', itemId, months],
    queryFn: async () => {
      const params = months ? { months } : undefined;
      const { data } = await apiClient.get<ApiResponse<ItemConsumptionTrend>>(`/consumption-trends/items/${itemId}`, {
        params,
      });
      return data;
    },
    enabled: !!itemId,
  });
}

/** GET /consumption-trends/top — Top consumed items */
export function useTopConsumptionItems(warehouseId?: string, months?: number, limit?: number) {
  return useQuery({
    queryKey: ['consumption-trends', 'top', warehouseId, months, limit],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (warehouseId) params.warehouseId = warehouseId;
      if (months) params.months = months;
      if (limit) params.limit = limit;
      const { data } = await apiClient.get<ApiResponse<TopConsumptionItem[]>>('/consumption-trends/top', { params });
      return data;
    },
  });
}
