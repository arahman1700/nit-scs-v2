import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useWarehouseZoneList(params?: ListParams) {
  return useQuery({
    queryKey: ['warehouse-zones', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/warehouse-zones', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useWarehouseZone(id: string | undefined) {
  return useQuery({
    queryKey: ['warehouse-zones', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/warehouse-zones/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateWarehouseZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/warehouse-zones', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouse-zones'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateWarehouseZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/warehouse-zones/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouse-zones'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteWarehouseZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/warehouse-zones/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['warehouse-zones'] }),
  });
}
