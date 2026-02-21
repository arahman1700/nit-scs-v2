import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';
import type { ListParams, ApiResponse } from '../types';
import type { RFIM } from '@nit-scs-v2/shared/types';

// ── List ────────────────────────────────────────────────────────────────────
export function useRfimList(params?: ListParams) {
  return useQuery({
    queryKey: ['rfim', 'list', params],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<RFIM[]>>('/rfim', { params });
      return data;
    },
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────
export function useRfim(id: string | undefined) {
  return useQuery({
    queryKey: ['rfim', id],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<RFIM>>(`/rfim/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

// ── Update ──────────────────────────────────────────────────────────────────
export function useUpdateRfim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.put<ApiResponse<RFIM>>(`/rfim/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rfim'] }),
  });
}

// ── Status Transitions ──────────────────────────────────────────────────────
export function useStartRfim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.post<ApiResponse<RFIM>>(`/rfim/${id}/start`);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rfim'] }),
  });
}

export function useCompleteRfim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: Record<string, unknown> & { id: string }) => {
      const { data } = await apiClient.post<ApiResponse<RFIM>>(`/rfim/${id}/complete`, body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rfim'] });
      qc.invalidateQueries({ queryKey: ['mrrv'] });
    },
  });
}
