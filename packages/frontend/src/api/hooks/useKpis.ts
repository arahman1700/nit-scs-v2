// ============================================================================
// KPI React Query Hooks
// Fetches comprehensive KPI data from the /kpis endpoint (M7)
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface KpiResult {
  value: number;
  trend: number;
  label: string;
  unit: string;
}

export interface InventoryKpis {
  inventoryTurnover: KpiResult;
  stockAccuracy: KpiResult;
  deadStock: KpiResult;
  warehouseUtilization: KpiResult;
}

export interface ProcurementKpis {
  grnProcessingTime: KpiResult;
  supplierOnTimeDelivery: KpiResult;
  poFulfillmentRate: KpiResult;
}

export interface LogisticsKpis {
  joCompletionRate: KpiResult;
  joAvgResponseTime: KpiResult;
  gatePassTurnaround: KpiResult;
}

export interface QualityKpis {
  qciPassRate: KpiResult;
  drResolutionTime: KpiResult;
  ncrRate: KpiResult;
}

export interface FinancialKpis {
  pendingApprovalValue: KpiResult;
  monthlySpend: KpiResult;
}

export interface ComprehensiveKpis {
  inventory: InventoryKpis;
  procurement: ProcurementKpis;
  logistics: LogisticsKpis;
  quality: QualityKpis;
  financial: FinancialKpis;
}

export type KpiCategory = 'inventory' | 'procurement' | 'logistics' | 'quality' | 'financial';

// ── Hooks ──────────────────────────────────────────────────────────────────

/** GET /api/v1/kpis — All 15 comprehensive KPIs */
export function useKpis(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['kpis', 'all', dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const { data } = await apiClient.get<ApiResponse<ComprehensiveKpis>>('/kpis', { params });
      return data;
    },
    staleTime: 30_000,
  });
}

/** GET /api/v1/kpis/:category — KPIs filtered by category */
export function useKpisByCategory(category: KpiCategory, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['kpis', category, dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const { data } = await apiClient.get<ApiResponse<Record<string, KpiResult>>>(`/kpis/${category}`, { params });
      return data;
    },
    staleTime: 30_000,
  });
}
