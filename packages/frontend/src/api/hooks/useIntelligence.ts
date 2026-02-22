import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ───────────────────────────────────────────────────────────────

export interface SmartDefaults {
  warehouses: Array<{ id: string; name: string; count: number }>;
  projects: Array<{ id: string; name: string; count: number }>;
  suppliers: Array<{ id: string; name: string; count: number }>;
  recentItems: Array<{ id: string; code: string; description: string; lastUsed: string }>;
}

export interface Anomaly {
  type: 'quantity_spike' | 'off_hours' | 'repeated_issue' | 'negative_stock' | 'dormant_reactivation';
  severity: 'low' | 'medium' | 'high';
  description: string;
  itemId?: string;
  itemCode?: string;
  warehouseId?: string;
  warehouseName?: string;
  value?: number;
  threshold?: number;
  detectedAt: string;
  referenceId?: string;
  referenceTable?: string;
}

export interface InventoryHealthSummary {
  totalItems: number;
  negativeStockCount: number;
  lowStockCount: number;
  overstockCount: number;
  dormantItemCount: number;
}

export interface ReorderPrediction {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  warehouseName: string;
  currentStock: number;
  reservedQty: number;
  effectiveStock: number;
  avgDailyConsumption: number;
  stdDevDailyConsumption: number;
  estimatedLeadTimeDays: number;
  reorderPoint: number;
  currentReorderPoint: number | null;
  daysUntilStockout: number | null;
  predictedStockoutDate: string | null;
  suggestedOrderQty: number;
  urgency: 'critical' | 'warning' | 'ok';
}

// ── Smart Defaults ──────────────────────────────────────────────────────

/** Get smart default suggestions for the current user */
export function useSmartDefaults() {
  return useQuery({
    queryKey: ['intelligence', 'defaults'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<SmartDefaults>>('/intelligence/defaults');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

// ── Anomaly Detection ───────────────────────────────────────────────────

/** Fetch detected anomalies (last 24h by default) */
export function useAnomalies(params?: { since?: string; notify?: boolean }) {
  return useQuery({
    queryKey: ['intelligence', 'anomalies', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Anomaly[]>>('/intelligence/anomalies', { params });
      return data;
    },
    staleTime: 10 * 60 * 1000, // 10 min
  });
}

// ── Inventory Health ────────────────────────────────────────────────────

/** Get inventory health summary */
export function useInventoryHealth() {
  return useQuery({
    queryKey: ['intelligence', 'inventory-health'],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<InventoryHealthSummary>>('/intelligence/inventory-health');
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 min
  });
}

// ── Reorder Predictions ─────────────────────────────────────────────────

/** Get reorder predictions, optionally filtered by warehouse */
export function useReorderPredictions(warehouseId?: string) {
  return useQuery({
    queryKey: ['intelligence', 'reorder-predictions', warehouseId],
    queryFn: async () => {
      const params = warehouseId ? { warehouseId } : undefined;
      const { data } = await apiClient.get<ApiResponse<ReorderPrediction[]>>('/intelligence/reorder-predictions', {
        params,
      });
      return data;
    },
    staleTime: 30 * 60 * 1000, // 30 min — predictions are expensive
  });
}

/** Auto-update reorder points (admin only) */
export function useAutoUpdateReorderPoints() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<ApiResponse<{ updated: number; total: number }>>(
        '/intelligence/reorder-predictions/auto-update',
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['intelligence', 'reorder-predictions'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
