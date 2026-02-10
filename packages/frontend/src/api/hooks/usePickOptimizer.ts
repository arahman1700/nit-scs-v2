import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PickStop {
  itemId: string;
  itemCode: string;
  itemName: string;
  binNumber: string;
  zone: string;
  aisle: number;
  shelf: number;
  quantity: number;
  stopOrder: number;
}

export interface PickPath {
  stops: PickStop[];
  totalDistance: number;
  estimatedMinutes: number;
}

export interface Wave {
  id: string;
  warehouseId: string;
  miIds: string[];
  status: 'created' | 'picking' | 'completed';
  createdAt: string;
  completedAt?: string;
  pickPath?: PickPath;
  itemCount: number;
  totalQuantity: number;
}

// ── Pick Path ──────────────────────────────────────────────────────────────

export function useOptimizePickPath(
  warehouseId: string | undefined,
  items: Array<{ itemId: string; quantity: number }> | undefined,
) {
  return useQuery({
    queryKey: ['pick-optimizer', 'path', warehouseId, items],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PickPath>>('/pick-optimizer/path', {
        params: {
          warehouseId,
          items: JSON.stringify(items),
        },
      });
      return data;
    },
    enabled: !!warehouseId && !!items && items.length > 0,
  });
}

// ── Wave List ──────────────────────────────────────────────────────────────

export function useWaveList(warehouseId?: string, status?: string) {
  return useQuery({
    queryKey: ['pick-optimizer', 'waves', warehouseId, status],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (warehouseId) params.warehouseId = warehouseId;
      if (status) params.status = status;
      const { data } = await apiClient.get<ApiResponse<Wave[]>>('/pick-optimizer/waves', { params });
      return data;
    },
  });
}

// ── Wave Detail ────────────────────────────────────────────────────────────

export function useWave(waveId: string | undefined) {
  return useQuery({
    queryKey: ['pick-optimizer', 'waves', waveId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<Wave>>(`/pick-optimizer/waves/${waveId}`);
      return data;
    },
    enabled: !!waveId,
  });
}

// ── Create Wave ────────────────────────────────────────────────────────────

export function useCreateWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { warehouseId: string; miIds: string[] }) => {
      const { data } = await apiClient.post<ApiResponse<Wave>>('/pick-optimizer/waves', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pick-optimizer'] }),
  });
}

// ── Start Wave ─────────────────────────────────────────────────────────────

export function useStartWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (waveId: string) => {
      const { data } = await apiClient.post<ApiResponse<Wave>>(`/pick-optimizer/waves/${waveId}/start`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pick-optimizer'] }),
  });
}

// ── Complete Wave ──────────────────────────────────────────────────────────

export function useCompleteWave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (waveId: string) => {
      const { data } = await apiClient.post<ApiResponse<Wave>>(`/pick-optimizer/waves/${waveId}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pick-optimizer'] }),
  });
}
