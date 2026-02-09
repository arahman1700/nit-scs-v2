import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';

// ── List ────────────────────────────────────────────────────────────────────
export function useGeneratorFuelList(params?: ListParams) {
  return useQuery({
    queryKey: ['generator-fuel', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown[]>>('/generator-fuel', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useGeneratorFuel(id: string | undefined) {
  return useQuery({
    queryKey: ['generator-fuel', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<unknown>>(`/generator-fuel/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────
export function useCreateGeneratorFuel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const { data } = await apiClient.post<ApiResponse<unknown>>('/generator-fuel', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generator-fuel'] }),
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateGeneratorFuel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<unknown>>(`/generator-fuel/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generator-fuel'] }),
  });
}
