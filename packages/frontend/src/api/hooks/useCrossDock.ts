import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface CrossDock {
  id: string;
  warehouseId: string;
  itemId: string;
  sourceGrnId: string | null;
  targetMiId: string | null;
  targetWtId: string | null;
  quantity: number;
  status: 'identified' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: string;
  completedAt: string | null;
  updatedAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  item?: { id: string; itemCode: string; itemDescription: string; category: string };
}

export interface CrossDockOpportunity {
  itemId: string;
  itemCode: string;
  itemDescription: string;
  warehouseId: string;
  sourceGrnId: string;
  sourceGrnNumber: string;
  grnQuantity: number;
  targets: Array<{
    type: 'mi' | 'wt';
    id: string;
    documentNumber: string;
    quantityNeeded: number;
  }>;
  suggestedQuantity: number;
}

export interface CrossDockStats {
  totalIdentified: number;
  totalActive: number;
  totalCompleted: number;
  totalCancelled: number;
  totalItemsBypassed: number;
  avgCompletionHours: number;
}

// ── Opportunities ──────────────────────────────────────────────────────────

export function useCrossDockOpportunities(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['cross-docks', 'opportunities', warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CrossDockOpportunity[]>>('/cross-docks/opportunities', {
        params: { warehouseId },
      });
      return data;
    },
    enabled: !!warehouseId,
  });
}

// ── Stats ──────────────────────────────────────────────────────────────────

export function useCrossDockStats(warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['cross-docks', 'stats', warehouseId],
    queryFn: async () => {
      const params = warehouseId ? { warehouseId } : {};
      const { data } = await apiClient.get<ApiResponse<CrossDockStats>>('/cross-docks/stats', { params });
      return data;
    },
  });
}

// ── List ───────────────────────────────────────────────────────────────────

export function useCrossDockList(filters?: {
  warehouseId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ['cross-docks', 'list', filters],
    queryFn: async () => {
      const params: Record<string, string | number> = {};
      if (filters?.warehouseId) params.warehouseId = filters.warehouseId;
      if (filters?.status) params.status = filters.status;
      if (filters?.page) params.page = filters.page;
      if (filters?.pageSize) params.pageSize = filters.pageSize;
      const { data } = await apiClient.get<ApiResponse<CrossDock[]>>('/cross-docks', { params });
      return data;
    },
  });
}

// ── Detail ─────────────────────────────────────────────────────────────────

export function useCrossDock(id: string | undefined) {
  return useQuery({
    queryKey: ['cross-docks', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<CrossDock>>(`/cross-docks/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ─────────────────────────────────────────────────────────────────

export function useCreateCrossDock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      warehouseId: string;
      itemId: string;
      sourceGrnId?: string;
      targetMiId?: string;
      targetWtId?: string;
      quantity: number;
    }) => {
      const { data } = await apiClient.post<ApiResponse<CrossDock>>('/cross-docks', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cross-docks'] }),
  });
}

// ── Approve ────────────────────────────────────────────────────────────────

export function useApproveCrossDock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<CrossDock>>(`/cross-docks/${id}/approve`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cross-docks'] }),
  });
}

// ── Execute ────────────────────────────────────────────────────────────────

export function useExecuteCrossDock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<CrossDock>>(`/cross-docks/${id}/execute`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cross-docks'] }),
  });
}

// ── Complete ───────────────────────────────────────────────────────────────

export function useCompleteCrossDock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<CrossDock>>(`/cross-docks/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cross-docks'] }),
  });
}

// ── Cancel ─────────────────────────────────────────────────────────────────

export function useCancelCrossDock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<CrossDock>>(`/cross-docks/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cross-docks'] }),
  });
}
