import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useGeneratorMaintenanceList(params?: ListParams) {
  return useQuery({
    queryKey: ['generator-maintenance', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/generator-maintenance', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useGeneratorMaintenance(id: string | undefined) {
  return useQuery({
    queryKey: ['generator-maintenance', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/generator-maintenance/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateGeneratorMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/generator-maintenance', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generator-maintenance'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateGeneratorMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/generator-maintenance/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generator-maintenance'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useStartGeneratorMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/generator-maintenance/${id}/start`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generator-maintenance'] }),
  });
}

export function useCompleteGeneratorMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/generator-maintenance/${id}/complete`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generator-maintenance'] }),
  });
}

export function useMarkOverdueGeneratorMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>(`/generator-maintenance/${id}/mark-overdue`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generator-maintenance'] }),
  });
}
