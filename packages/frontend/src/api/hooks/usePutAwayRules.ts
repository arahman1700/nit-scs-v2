import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ApiResponse } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────

export interface PutAwayRule {
  id: string;
  name: string;
  priority: number;
  warehouseId: string;
  targetZoneId: string | null;
  itemCategory: string | null;
  isHazardous: boolean;
  maxWeight: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  targetZone?: { id: string; zoneName: string; zoneCode: string } | null;
}

export interface PutAwaySuggestion {
  zoneId: string;
  zoneName: string;
  zoneCode: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low';
}

// ── List ────────────────────────────────────────────────────────────────────
export function usePutAwayRules(warehouseId?: string) {
  return useQuery({
    queryKey: ['putaway-rules', 'list', warehouseId],
    queryFn: async () => {
      const params = warehouseId ? { warehouseId } : {};
      const { data } = await apiClient.get<ApiResponse<PutAwayRule[]>>('/putaway-rules', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function usePutAwayRule(id: string | undefined) {
  return useQuery({
    queryKey: ['putaway-rules', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PutAwayRule>>(`/putaway-rules/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreatePutAwayRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<PutAwayRule>>('/putaway-rules', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['putaway-rules'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdatePutAwayRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<PutAwayRule>>(`/putaway-rules/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['putaway-rules'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeletePutAwayRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/putaway-rules/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['putaway-rules'] }),
  });
}

// ── Suggestions ─────────────────────────────────────────────────────────────
export function usePutAwaySuggestion(itemId: string | undefined, warehouseId: string | undefined) {
  return useQuery({
    queryKey: ['putaway-rules', 'suggest', itemId, warehouseId],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<PutAwaySuggestion[]>>('/putaway-rules/suggest', {
        params: { itemId, warehouseId },
      });
      return data;
    },
    enabled: !!itemId && !!warehouseId,
  });
}
