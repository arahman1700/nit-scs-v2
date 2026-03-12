import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client';
import type { ListParams, ApiResponse } from '../../../api/types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface WaveHeader {
  id: string;
  waveNumber: string;
  warehouseId: string;
  status: 'draft' | 'planned' | 'released' | 'in_progress' | 'completed' | 'cancelled';
  waveType: 'standard' | 'priority' | 'bulk' | 'replenishment';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  plannedStartAt: string | null;
  actualStartAt: string | null;
  completedAt: string | null;
  totalOrders: number;
  totalLines: number;
  totalQuantity: number;
  pickedQuantity: number;
  createdById: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  createdBy?: { id: string; name: string; employeeCode: string };
  lines?: WaveLine[];
}

export interface WaveLine {
  id: string;
  waveId: string;
  sourceDocType: string;
  sourceDocId: string;
  sourceLineId: string | null;
  itemId: string;
  quantity: number;
  pickedQuantity: number;
  status: 'pending' | 'allocated' | 'picked' | 'short' | 'cancelled';
  item?: { id: string; itemCode: string; itemDescription: string; category: string };
}

export interface WaveFilters extends ListParams {
  warehouseId?: string;
  status?: string;
  waveType?: string;
}

// ── List ────────────────────────────────────────────────────────────────────
export function useWaveList(params?: WaveFilters) {
  return useQuery({
    queryKey: ['waves', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<WaveHeader[]>>('/warehouse-ops/waves', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useWave(id: string | undefined) {
  return useQuery({
    queryKey: ['waves', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<WaveHeader>>(`/warehouse-ops/waves/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<WaveHeader>>('/warehouse-ops/waves', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waves'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<WaveHeader>>(`/warehouse-ops/waves/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waves'] }),
  });
}

// ── Release ─────────────────────────────────────────────────────────────────
export function useReleaseWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<WaveHeader>>(`/warehouse-ops/waves/${id}/release`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waves'] }),
  });
}

// ── Complete ────────────────────────────────────────────────────────────────
export function useCompleteWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<WaveHeader>>(`/warehouse-ops/waves/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waves'] }),
  });
}

// ── Cancel ──────────────────────────────────────────────────────────────────
export function useCancelWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<WaveHeader>>(`/warehouse-ops/waves/${id}/cancel`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waves'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/warehouse-ops/waves/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['waves'] }),
  });
}
