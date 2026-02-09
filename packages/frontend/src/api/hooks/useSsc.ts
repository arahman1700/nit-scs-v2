import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useSscList(params?: ListParams) {
  return useQuery({
    queryKey: ['ssc', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/ssc', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useSsc(id: string | undefined) {
  return useQuery({
    queryKey: ['ssc', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/ssc/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateSsc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/ssc', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssc'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateSsc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/ssc/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssc'] }),
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────
export function useDeleteSsc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/ssc/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ssc'] }),
  });
}
