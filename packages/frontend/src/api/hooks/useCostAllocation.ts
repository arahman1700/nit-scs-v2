// ============================================================================
// Cost Allocation React Query Hooks — L7
// Fetches per-project and summary cost allocation data
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CostCategory {
  count: number;
  totalValue: number;
}

export interface MonthlyBreakdown {
  month: string;
  total: number;
}

export interface CostAllocationData {
  project: { id: string; projectName: string; projectCode: string };
  dateRange: { from: string | null; to: string | null };
  categories: {
    receiving: CostCategory;
    materialIssues: CostCategory;
    jobOrders: CostCategory;
    shipments: CostCategory;
    rentalEquipment: CostCategory;
  };
  grandTotal: number;
  monthlyBreakdown: MonthlyBreakdown[];
}

export interface ProjectCostSummaryItem {
  projectId: string;
  projectName: string;
  projectCode: string;
  receiving: number;
  materialIssues: number;
  jobOrders: number;
  shipments: number;
  rentalEquipment: number;
  grandTotal: number;
}

export interface CostAllocationSummaryData {
  dateRange: { from: string | null; to: string | null };
  totals: {
    receiving: CostCategory;
    materialIssues: CostCategory;
    jobOrders: CostCategory;
    shipments: CostCategory;
    rentalEquipment: CostCategory;
  };
  grandTotal: number;
  projects: ProjectCostSummaryItem[];
  monthlyBreakdown: MonthlyBreakdown[];
}

// ── Hooks ──────────────────────────────────────────────────────────────────

/** GET /api/v1/cost-allocation/:projectId — Per-project cost breakdown */
export function useCostAllocation(projectId: string | undefined, dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['cost-allocation', projectId, dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const { data } = await apiClient.get<ApiResponse<CostAllocationData>>(`/cost-allocation/${projectId}`, {
        params,
      });
      return data;
    },
    enabled: !!projectId,
    staleTime: 120_000,
  });
}

/** GET /api/v1/cost-allocation/summary — All projects summary */
export function useCostAllocationSummary(dateFrom?: string, dateTo?: string) {
  return useQuery({
    queryKey: ['cost-allocation', 'summary', dateFrom, dateTo],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const { data } = await apiClient.get<ApiResponse<CostAllocationSummaryData>>('/cost-allocation/summary', {
        params,
      });
      return data;
    },
    staleTime: 120_000,
  });
}
