import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface StockAllocation {
  id: string;
  warehouseId: string;
  itemId: string;
  sourceDocType: string;
  sourceDocId: string;
  sourceLineId: string | null;
  allocatedQuantity: number;
  pickedQuantity: number;
  status: 'pending' | 'allocated' | 'partially_picked' | 'picked' | 'released' | 'cancelled';
  zoneId: string | null;
  binLocation: string | null;
  lpnId: string | null;
  lotNumber: string | null;
  serialNumber: string | null;
  expiryDate: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  allocatedAt: string;
  releasedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  item?: { id: string; itemCode: string; itemDescription: string; category: string };
  zone?: { id: string; zoneName: string; zoneCode: string };
}

export interface AllocationSummary {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  totalOnHand: number;
  totalAllocated: number;
  availableQuantity: number;
  pendingAllocations: number;
}

export interface StockAllocationFilters extends ListParams {
  warehouseId?: string;
  itemId?: string;
  status?: string;
  sourceDocType?: string;
}

// ── List ────────────────────────────────────────────────────────────────────
export function useStockAllocationList(params?: StockAllocationFilters) {
  return useQuery({
    queryKey: ['stock-allocations', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StockAllocation[]>>('/warehouse-ops/stock-allocations', {
        params,
      });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useStockAllocation(id: string | undefined) {
  return useQuery({
    queryKey: ['stock-allocations', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<StockAllocation>>(`/warehouse-ops/stock-allocations/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateStockAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<StockAllocation>>('/warehouse-ops/stock-allocations', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-allocations'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateStockAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<StockAllocation>>(
        `/warehouse-ops/stock-allocations/${id}`,
        body,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-allocations'] }),
  });
}

// ── Release ─────────────────────────────────────────────────────────────────
export function useReleaseStockAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StockAllocation>>(
        `/warehouse-ops/stock-allocations/${id}/release`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-allocations'] }),
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────────
export function useCancelStockAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<StockAllocation>>(
        `/warehouse-ops/stock-allocations/${id}/cancel`,
      );
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-allocations'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteStockAllocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/warehouse-ops/stock-allocations/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['stock-allocations'] }),
  });
}

// ── Allocation Summary (availability check) ─────────────────────────────────
export function useAllocationSummary(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['stock-allocations', 'summary', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AllocationSummary[]>>(
        '/warehouse-ops/stock-allocations/summary',
        { params: { warehouseId } },
      );
      return data;
    },
    enabled: !!warehouseId,
  });
}
